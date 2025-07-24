"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { io } from "socket.io-client";

const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export default function VideoRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  // pc
  // UI State
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [mediaError, setMediaError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const socketRef = useRef(null);
  const cleanupRef = useRef(false);
  const isInitializedRef = useRef(false);
  const mountedRef = useRef(true);
  const pendingCandidatesRef = useRef([]);
  const connectionTimeoutRef = useRef(null);

  // Enhanced ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };

  // Generate truly unique session ID - ONLY ONCE
  const sessionId = useRef(null);
  if (!sessionId.current) {
    sessionId.current = `${user?.id}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Update debug info
  const updateDebugInfo = useCallback((info) => {
    if (!mountedRef.current) return;
    setDebugInfo((prev) => ({ ...prev, ...info }));
  }, []);

  // Clear connection timeout when connected
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      console.log("⏰ Clearing connection timeout - connection successful!");
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  // Set connection timeout
  const setConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnected && mountedRef.current && !cleanupRef.current) {
        console.error("⏰ Connection timeout after 30 seconds");
        setConnectionStatus("failed");
        setMediaError("Connection timeout. Please try refreshing the page.");
      }
    }, 30000); // 30 second timeout
  }, [isConnected]);

  // Prevent multiple initializations with better checks
  const initializeOnce = useCallback(() => {
    if (isInitializedRef.current || cleanupRef.current || !mountedRef.current) {
      console.log(
        "❌ Skipping initialization - already initialized or cleaning up"
      );
      return false;
    }
    isInitializedRef.current = true;
    console.log(
      "✅ Initializing for the first time with session:",
      sessionId.current
    );
    return true;
  }, []);

  // Get media stream with better error handling
  const getMediaStream = useCallback(async () => {
    try {
      console.log("🎥 Requesting media stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("✅ Media stream obtained successfully");
      console.log(
        "📹 Stream tracks:",
        stream.getTracks().map((t) => `${t.kind}:${t.id} (${t.label})`)
      );
      updateDebugInfo({ mediaStatus: "✅ Camera & Microphone Access Granted" });
      return stream;
    } catch (error) {
      console.error("❌ Failed to get media stream:", error);
      updateDebugInfo({
        mediaStatus: "❌ Media Access Failed: " + error.message,
      });

      // Try audio-only fallback
      try {
        console.log("🎤 Trying audio-only fallback...");
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        updateDebugInfo({ mediaStatus: "⚠️ Audio-only mode (camera failed)" });
        return audioStream;
      } catch (audioError) {
        console.error("❌ Audio-only fallback also failed:", audioError);
        throw new Error(
          "Unable to access camera or microphone. Please check permissions."
        );
      }
    }
  }, [updateDebugInfo]);

  // Enhanced peer connection creation
  const createPeerConnection = useCallback(() => {
    if (cleanupRef.current || !mountedRef.current) return null;

    console.log("🔗 Creating new RTCPeerConnection with enhanced config...");
    const pc = new RTCPeerConnection(iceServers);

    // Clear pending candidates
    pendingCandidatesRef.current = [];

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (
        event.candidate &&
        socketRef.current?.connected &&
        !cleanupRef.current &&
        mountedRef.current
      ) {
        console.log(
          "🧊 Sending ICE candidate:",
          event.candidate.type,
          event.candidate.candidate.substring(0, 50) + "..."
        );
        socketRef.current.emit(
          "candidate",
          roomId,
          event.candidate,
          socketRef.current.id
        );
      } else if (!event.candidate) {
        console.log("🧊 ICE gathering complete");
      }
    };

    // Improved track handling with enhanced video playback
    pc.ontrack = (event) => {
      if (cleanupRef.current || !mountedRef.current) return;

      if (!event.streams || event.streams.length === 0) {
        console.log("⚠️ Received track event but no streams");
        return;
      }

      console.log("📹 🎉 RECEIVED REMOTE STREAM - CONNECTION ESTABLISHED!");
      console.log(
        "📹 Remote stream tracks:",
        event.streams[0].getTracks().map((t) => `${t.kind}:${t.id}`)
      );
      updateDebugInfo({ connectionStatus: "✅ Video Stream Connected" });

      if (remoteVideoRef.current && event.streams[0]) {
        console.log("📺 Setting remote video stream...");
        remoteVideoRef.current.srcObject = event.streams[0];

        // Enhanced video playback with multiple strategies
        const playVideo = async () => {
          if (!remoteVideoRef.current || cleanupRef.current) return;

          console.log("📺 Attempting to play remote video...");

          // Strategy 1: Try unmuted autoplay first
          try {
            remoteVideoRef.current.muted = false;
            await remoteVideoRef.current.play();
            console.log("✅ Remote video playing successfully (unmuted)");
            return;
          } catch (err1) {
            console.log("⚠️ Unmuted autoplay failed:", err1.message);

            // Strategy 2: Try muted autoplay
            try {
              remoteVideoRef.current.muted = true;
              await remoteVideoRef.current.play();
              console.log("✅ Remote video playing (muted)");

              // Add click handler to unmute
              const unmuteHandler = () => {
                if (remoteVideoRef.current && !cleanupRef.current) {
                  remoteVideoRef.current.muted = false;
                  console.log("🔊 Remote video unmuted after click");
                  remoteVideoRef.current.removeEventListener(
                    "click",
                    unmuteHandler
                  );
                }
              };
              remoteVideoRef.current.addEventListener("click", unmuteHandler);
              console.log("👆 Click the video to unmute");
              return;
            } catch (err2) {
              console.error("❌ Muted autoplay also failed:", err2.message);

              // Strategy 3: Create manual play button overlay
              const createPlayButton = () => {
                // Remove any existing play button
                const existingButton =
                  remoteVideoRef.current?.parentElement?.querySelector(
                    ".manual-play-button"
                  );
                if (existingButton) {
                  existingButton.remove();
                }

                const playButton = document.createElement("button");
                playButton.textContent = "▶️ Click to Play Video";
                playButton.className = "manual-play-button";
                playButton.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 20;
              background: rgba(0, 0, 0, 0.8);
              color: white;
              border: 2px solid #3b82f6;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s ease;
            `;

                playButton.onclick = async () => {
                  try {
                    console.log("📺 Manual play button clicked");
                    remoteVideoRef.current.muted = false;
                    await remoteVideoRef.current.play();
                    console.log("✅ Manual play successful");
                    playButton.remove();
                  } catch (err3) {
                    console.error("❌ Manual play failed:", err3.message);
                    playButton.textContent =
                      "❌ Play Failed - Check Permissions";
                  }
                };

                if (remoteVideoRef.current?.parentElement) {
                  remoteVideoRef.current.parentElement.appendChild(playButton);
                  console.log("✅ Manual play button created");
                }
              };

              createPlayButton();
            }
          }
        };

        // Add comprehensive video event listeners
        const setupVideoEventListeners = () => {
          if (!remoteVideoRef.current) return;

          const video = remoteVideoRef.current;

          const handleCanPlay = () => {
            console.log("📺 Video can play, attempting playback");
            playVideo();
          };

          const handlePlay = () => {
            console.log("▶️ Video started playing");
            // Remove any manual play button when video starts
            const playButton = video.parentElement?.querySelector(
              ".manual-play-button"
            );
            if (playButton) {
              playButton.remove();
            }
          };

          const handlePause = () => console.log("⏸️ Video paused");
          const handleError = (e) => {
            console.log("❌ Video error:", video.error, e);
            updateDebugInfo({
              videoError: video.error?.message || "Unknown video error",
            });
          };

          const handleLoadedMetadata = () => {
            console.log("📺 Video metadata loaded");
            playVideo();
          };

          const handleLoadedData = () => {
            console.log("📺 Video data loaded");
            playVideo();
          };

          // Add all event listeners
          video.addEventListener("canplay", handleCanPlay);
          video.addEventListener("play", handlePlay);
          video.addEventListener("pause", handlePause);
          video.addEventListener("error", handleError);
          video.addEventListener("loadedmetadata", handleLoadedMetadata);
          video.addEventListener("loadeddata", handleLoadedData);

          // Cleanup function
          const cleanup = () => {
            video.removeEventListener("canplay", handleCanPlay);
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
            video.removeEventListener("error", handleError);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("loadeddata", handleLoadedData);
          };

          // Store cleanup function for later use
          video._videoEventCleanup = cleanup;

          return cleanup;
        };

        // Setup event listeners
        setupVideoEventListeners();

        // Immediate play attempt
        setTimeout(playVideo, 100);

        // Update connection state IMMEDIATELY
        setIsConnected(true);
        setConnectionStatus("connected");
        clearConnectionTimeout();

        // Start call timer IMMEDIATELY
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
          console.log(
            "⏰ Call timer started at:",
            new Date(callStartTimeRef.current)
          );
        }

        // Update participants list
        setParticipants([
          {
            id: "remote-user",
            name: "Remote Participant",
            role: "participant",
            isVideoOn: true,
            isAudioOn: true,
          },
        ]);

        console.log("🎉 🎉 CALL IS NOW FULLY CONNECTED! 🎉 🎉");
      }
    };

    // Enhanced state change handlers
    pc.onconnectionstatechange = () => {
      if (cleanupRef.current || !mountedRef.current) return;

      console.log(`🔄 PeerConnection state: ${pc.connectionState}`);
      updateDebugInfo({ peerConnectionState: pc.connectionState });

      switch (pc.connectionState) {
        case "connecting":
          console.log("🔄 Peer connection is connecting...");
          updateDebugInfo({ connectionStatus: "🔄 Connecting..." });
          break;
        case "connected":
          console.log("🎉 Peer connection CONNECTED!");
          setIsConnected(true);
          setConnectionStatus("connected");
          updateDebugInfo({ connectionStatus: "✅ Connected" });
          clearConnectionTimeout();
          break;
        case "disconnected":
          console.log("⚠️ Peer connection disconnected");
          setIsConnected(false);
          setConnectionStatus("disconnected");
          updateDebugInfo({ connectionStatus: "⚠️ Disconnected" });
          break;
        case "failed":
          console.log("❌ Peer connection failed");
          setIsConnected(false);
          setConnectionStatus("failed");
          updateDebugInfo({ connectionStatus: "❌ Connection Failed" });
          break;
        case "closed":
          setIsConnected(false);
          updateDebugInfo({ connectionStatus: "🔒 Connection Closed" });
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (cleanupRef.current || !mountedRef.current) return;
      console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);
      updateDebugInfo({ iceConnectionState: pc.iceConnectionState });

      switch (pc.iceConnectionState) {
        case "checking":
          console.log("🧊 ICE is checking connectivity...");
          break;
        case "connected":
          console.log("🧊 ICE connection established!");
          clearConnectionTimeout();
          break;
        case "completed":
          console.log("🧊 ICE connection completed!");
          clearConnectionTimeout();
          break;
        case "failed":
          console.log("❌ ICE connection failed");
          break;
        case "disconnected":
          console.log("⚠️ ICE connection disconnected");
          break;
      }
    };

    pc.onicegatheringstatechange = () => {
      if (cleanupRef.current || !mountedRef.current) return;
      console.log(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
      updateDebugInfo({ iceGatheringState: pc.iceGatheringState });
    };

    pc.onsignalingstatechange = () => {
      if (cleanupRef.current || !mountedRef.current) return;
      console.log(`📡 Signaling state: ${pc.signalingState}`);
      updateDebugInfo({ signalingState: pc.signalingState });
    };

    return pc;
  }, [roomId, updateDebugInfo, clearConnectionTimeout]);

  // End call
  const endCall = useCallback(() => {
    console.log("📞 Ending call...");
    cleanupRef.current = true;
    mountedRef.current = false;
    navigate("/dashboard");
  }, [navigate]);

  // Enhanced setup call with proper sequencing
  const setupCall = useCallback(async () => {
    if (!initializeOnce()) return;

    try {
      console.log("🚀 Setting up call...");
      console.log("👤 User ID:", user?.id);
      console.log("📧 User Email:", user?.email);
      console.log("🏠 Room ID:", roomId);
      console.log("🎭 Session ID:", sessionId.current);

      updateDebugInfo({
        userId: user?.id,
        roomId: roomId,
        sessionId: sessionId.current,
        userEmail: user?.email,
        userRole: user?.role,
      });

      setConnectionStatus("connecting");
      setMediaError(null);

      // Get user media FIRST
      const stream = await getMediaStream();
      console.log(
        "📹 Local stream obtained with tracks:",
        stream.getTracks().map((t) => `${t.kind}:${t.id}`)
      );

      if (cleanupRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Force local video to play
        try {
          await localVideoRef.current.play();
          console.log("✅ Local video started playing successfully");
        } catch (e) {
          console.log(
            "⚠️ Local video autoplay prevented (normal for muted local video):",
            e.message
          );
        }
      }

      // Update UI based on available tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      setIsVideoOn(videoTracks.length > 0 && videoTracks[0].enabled);
      setIsAudioOn(audioTracks.length > 0 && audioTracks[0].enabled);

      console.log(
        `📹 Video tracks: ${videoTracks.length}, 🎤 Audio tracks: ${audioTracks.length}`
      );

      // Setup socket connection with enhanced configuration
      if (socketRef.current) {
        console.log("⚠️ Socket already exists, disconnecting old one");
        socketRef.current.disconnect();
      }

      const socket = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        timeout: 20000,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        forceNew: true,
        query: {
          userId: user?.id,
          sessionId: sessionId.current,
          roomId: roomId,
        },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (cleanupRef.current || !mountedRef.current) return;
        console.log("🔌 Socket connected:", socket.id);
        updateDebugInfo({ socketId: socket.id, socketStatus: "✅ Connected" });

        // Join room with unique session ID
        socket.emit("join-room", roomId, sessionId.current);
        setConnectionStatus("waiting");
      });

      // Enhanced user-joined handler
      socket.on("user-joined", async (joinedSessionId, joinedSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          joinedSocketId === socket.id ||
          joinedSessionId === sessionId.current
        ) {
          console.log("❌ Ignoring user-joined event (same user or cleanup)");
          return;
        }

        console.log(
          "👤 NEW USER JOINED! Session:",
          joinedSessionId,
          "Socket:",
          joinedSocketId
        );
        updateDebugInfo({ otherParticipant: joinedSessionId });
        setConnectionStatus("connecting-peer");
        setConnectionTimeout();

        // Create new peer connection
        const pc = createPeerConnection();
        if (!pc) return;
        peerConnectionRef.current = pc;

        // Add local tracks FIRST - this is crucial
        console.log("➕ Adding local tracks to peer connection...");
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track: ${track.id}`);
          pc.addTrack(track, localStreamRef.current);
        });

        try {
          console.log("📤 Creating offer with enhanced constraints...");
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          console.log("📤 Setting local description...");
          await pc.setLocalDescription(offer);
          console.log("📤 Sending offer to remote peer...");
          socket.emit("offer", roomId, offer, socket.id);
          console.log("✅ Offer sent successfully");
        } catch (error) {
          console.error("❌ Error creating offer:", error);
        }
      });

      // Enhanced offer handler
      socket.on("offer", async (offer, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        ) {
          console.log("❌ Ignoring offer from self or during cleanup");
          return;
        }

        console.log("📨 RECEIVED OFFER from:", senderSocketId);
        setConnectionStatus("connecting-peer");
        setConnectionTimeout();

        // Create or reuse peer connection
        if (
          !peerConnectionRef.current ||
          peerConnectionRef.current.connectionState === "closed"
        ) {
          const pc = createPeerConnection();
          if (!pc) return;
          peerConnectionRef.current = pc;

          // Add local tracks FIRST
          console.log("➕ Adding local tracks to peer connection...");
          localStreamRef.current.getTracks().forEach((track) => {
            console.log(`➕ Adding ${track.kind} track: ${track.id}`);
            pc.addTrack(track, localStreamRef.current);
          });
        }

        const pc = peerConnectionRef.current;

        try {
          if (!pc.remoteDescription) {
            console.log("📥 Setting remote description from offer...");
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            console.log("✅ Remote description set from offer");

            console.log("📤 Creating answer...");
            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });

            console.log("📤 Setting local description...");
            await pc.setLocalDescription(answer);
            console.log("📤 Sending answer back...");
            socket.emit("answer", roomId, answer, socket.id);
            console.log("✅ Answer sent successfully");

            // Process any pending ICE candidates
            console.log(
              `🧊 Processing ${pendingCandidatesRef.current.length} pending ICE candidates...`
            );
            for (const candidate of pendingCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("🧊 Added pending ICE candidate");
              } catch (error) {
                console.error("❌ Error adding pending ICE candidate:", error);
              }
            }
            pendingCandidatesRef.current = [];
          }
        } catch (error) {
          console.error("❌ Error handling offer:", error);
        }
      });

      // Enhanced answer handler
      socket.on("answer", async (answer, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        ) {
          console.log("❌ Ignoring answer from self or during cleanup");
          return;
        }

        console.log("📨 RECEIVED ANSWER from:", senderSocketId);
        const pc = peerConnectionRef.current;

        if (pc && pc.remoteDescription === null) {
          try {
            console.log("📥 Setting remote description from answer...");
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("✅ Remote description set from answer");

            // Process any pending ICE candidates
            console.log(
              `🧊 Processing ${pendingCandidatesRef.current.length} pending ICE candidates...`
            );
            for (const candidate of pendingCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("🧊 Added pending ICE candidate");
              } catch (error) {
                console.error("❌ Error adding pending ICE candidate:", error);
              }
            }
            pendingCandidatesRef.current = [];
          } catch (error) {
            console.error("❌ Error setting remote description:", error);
          }
        }
      });

      // Enhanced candidate handler
      socket.on("candidate", async (candidate, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        )
          return;

        console.log("🧊 Received ICE candidate:", candidate.type);

        try {
          if (
            peerConnectionRef.current &&
            peerConnectionRef.current.remoteDescription
          ) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
            console.log("✅ Added ICE candidate successfully");
          } else {
            console.log(
              "⚠️ Queueing ICE candidate (no PC or remote description yet)"
            );
            pendingCandidatesRef.current.push(candidate);
          }
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      });

      socket.on("chat-message", (message) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setMessages((prev) => [...prev, message]);
      });

      socket.on("user-left", (sessionId, socketId) => {
        if (cleanupRef.current || !mountedRef.current) return;
        console.log("👋 User left:", sessionId);
        updateDebugInfo({ otherParticipant: "Left" });
        setIsConnected(false);
        setConnectionStatus("waiting");
        setParticipants([]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      socket.on("disconnect", (reason) => {
        if (cleanupRef.current || !mountedRef.current) return;
        console.log("🔌 Socket disconnected:", reason);
        updateDebugInfo({ socketStatus: "❌ Disconnected: " + reason });
        setIsConnected(false);
        setConnectionStatus("disconnected");
      });

      socket.on("connect_error", (error) => {
        if (cleanupRef.current || !mountedRef.current) return;
        console.error("❌ Socket connection error:", error);
        updateDebugInfo({ socketStatus: "❌ Connection Error" });
        setConnectionStatus("error");
        setMediaError("Connection failed. Please try again.");
      });

      socket.on("error", (error) => {
        if (cleanupRef.current || !mountedRef.current) return;
        console.error("❌ Socket error:", error);
        setMediaError(error);
      });
    } catch (error) {
      if (cleanupRef.current || !mountedRef.current) return;
      console.error("❌ Error setting up call:", error);
      setMediaError(error.message);
      setConnectionStatus("error");
    }
  }, [
    roomId,
    user?.id,
    user?.email,
    user?.role,
    createPeerConnection,
    getMediaStream,
    initializeOnce,
    updateDebugInfo,
    setConnectionTimeout,
  ]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up...");
    cleanupRef.current = true;
    isInitializedRef.current = false;

    // Clear connection timeout
    clearConnectionTimeout();

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Clear pending candidates
    pendingCandidatesRef.current = [];

    // Reset state
    setIsConnected(false);
    setConnectionStatus("disconnected");
    setParticipants([]);
    setCallDuration(0);
    setMediaError(null);
    callStartTimeRef.current = null;
  }, [clearConnectionTimeout]);

  // Main effect - only run once
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      navigate("/login");
      return;
    }

    if (!roomId) {
      navigate("/dashboard");
      return;
    }

    cleanupRef.current = false;
    setupCall();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []); // Empty dependency array to run only once

  // Call duration timer
  useEffect(() => {
    if (!peerConnectionRef.current || !isConnected) return;

    const pc = peerConnectionRef.current;
    let statsInterval;

    const monitorStats = () => {
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        pc.getStats()
          .then((stats) => {
            stats.forEach((report) => {
              if (report.type === "inbound-rtp" && report.kind === "video") {
                const videoStats = {
                  framesDecoded: report.framesDecoded || 0,
                  framesDropped: report.framesDropped || 0,
                  framesPerSecond: report.framesPerSecond || 0,
                  bytesReceived: report.bytesReceived || 0,
                  packetsReceived: report.packetsReceived || 0,
                  packetsLost: report.packetsLost || 0,
                };

                updateDebugInfo({
                  videoStats: `${videoStats.framesPerSecond} fps, ${Math.round(
                    videoStats.bytesReceived / 1024
                  )} KB received`,
                });
              }
            });
          })
          .catch((err) => {
            console.log("📊 Stats error:", err.message);
          });
      }
    };

    // Start monitoring
    statsInterval = setInterval(monitorStats, 2000); // Every 2 seconds

    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [isConnected, updateDebugInfo]);

  // Connection quality monitoring
  useEffect(() => {
    if (!peerConnectionRef.current || !isConnected) return;

    const pc = peerConnectionRef.current;
    let statsInterval;

    const monitorStats = () => {
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        pc.getStats()
          .then((stats) => {
            stats.forEach((report) => {
              if (report.type === "inbound-rtp" && report.kind === "video") {
                const videoStats = {
                  framesDecoded: report.framesDecoded || 0,
                  framesDropped: report.framesDropped || 0,
                  framesPerSecond: report.framesPerSecond || 0,
                  bytesReceived: report.bytesReceived || 0,
                  packetsReceived: report.packetsReceived || 0,
                  packetsLost: report.packetsLost || 0,
                };

                // Log stats every 10 seconds
                if (Math.random() < 0.1) {
                  // 10% chance to log (roughly every 10 calls)
                  console.log("📊 Video stats:", videoStats);
                }

                updateDebugInfo({
                  videoStats: `${videoStats.framesPerSecond} fps, ${Math.round(
                    videoStats.bytesReceived / 1024
                  )} KB received`,
                });
              }
            });
          })
          .catch((err) => {
            console.log("📊 Stats error:", err.message);
          });
      }
    };

    // Start monitoring
    statsInterval = setInterval(monitorStats, 2000); // Every 2 seconds

    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [isConnected, updateDebugInfo]);

  // Media control functions
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const videoSender = peerConnectionRef.current
          ?.getSenders()
          .find((sender) => sender.track?.kind === "video");

        if (videoSender && screenStream.getVideoTracks()[0]) {
          await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && videoSender) {
            const cameraTrack = localStreamRef.current.getVideoTracks()[0];
            if (cameraTrack) {
              videoSender.replaceTrack(cameraTrack);
            }
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          }
        };
      } else {
        const videoSender = peerConnectionRef.current
          ?.getSenders()
          .find((sender) => sender.track?.kind === "video");

        if (localStreamRef.current && videoSender) {
          const cameraTrack = localStreamRef.current.getVideoTracks()[0];
          if (cameraTrack) {
            await videoSender.replaceTrack(cameraTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error("❌ Error with screen sharing:", error);
    }
  }, [isScreenSharing]);

  const sendMessage = useCallback(() => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        sender: user?.name || "You",
        text: newMessage,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, message]);
      setNewMessage("");

      // Send message via socket
      if (socketRef.current) {
        socketRef.current.emit("chat-message", roomId, message);
      }
    }
  }, [newMessage, user?.name, roomId]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case "connecting":
        return "Initializing media...";
      case "waiting":
        return "Waiting for other participant...";
      case "connecting-peer":
        return "Connecting to participant...";
      case "connected":
        return "Connected!";
      case "failed":
        return "Connection failed";
      default:
        return "Setting up connection...";
    }
  };

  // Loading states
  if (
    connectionStatus === "connecting" ||
    connectionStatus === "waiting" ||
    connectionStatus === "connecting-peer"
  ) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold mb-2 text-white">
                {getStatusMessage()}
              </h2>
              <p className="text-gray-400 mb-4">
                {connectionStatus === "connecting"
                  ? "Setting up camera and microphone"
                  : connectionStatus === "connecting-peer"
                  ? "Establishing peer-to-peer connection"
                  : "Share this room ID with the other participant"}
              </p>
            </div>

            {/* Enhanced Debug Information */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold text-white mb-3">
                🔧 Connection Debug Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">User Email:</span>
                  <span className="text-white ml-2">{debugInfo.userEmail}</span>
                </div>
                <div>
                  <span className="text-gray-400">User Role:</span>
                  <span className="text-white ml-2">{debugInfo.userRole}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-400">Session ID:</span>
                  <span className="text-blue-400 ml-2 font-mono text-xs">
                    {debugInfo.sessionId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Socket ID:</span>
                  <span className="text-green-400 ml-2 font-mono text-xs">
                    {debugInfo.socketId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Room ID:</span>
                  <span className="text-yellow-400 ml-2 font-mono">
                    {debugInfo.roomId}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-400">Connection Status:</span>
                  <span className="ml-2 font-semibold text-blue-400">
                    {connectionStatus.toUpperCase()}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-400">Media Status:</span>
                  <span className="ml-2">{debugInfo.mediaStatus}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-400">Socket Status:</span>
                  <span className="ml-2">{debugInfo.socketStatus}</span>
                </div>
                {debugInfo.otherParticipant && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">Other Participant:</span>
                    <span className="text-purple-400 ml-2 font-mono text-xs">
                      {debugInfo.otherParticipant}
                    </span>
                  </div>
                )}
                {debugInfo.peerConnectionState && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">Peer Connection:</span>
                    <span className="text-orange-400 ml-2 font-semibold">
                      {debugInfo.peerConnectionState}
                    </span>
                  </div>
                )}
                {debugInfo.iceConnectionState && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">ICE Connection:</span>
                    <span className="text-cyan-400 ml-2 font-semibold">
                      {debugInfo.iceConnectionState}
                    </span>
                  </div>
                )}
                {debugInfo.signalingState && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">Signaling State:</span>
                    <span className="text-pink-400 ml-2 font-semibold">
                      {debugInfo.signalingState}
                    </span>
                  </div>
                )}
                {debugInfo.iceGatheringState && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">ICE Gathering:</span>
                    <span className="text-indigo-400 ml-2 font-semibold">
                      {debugInfo.iceGatheringState}
                    </span>
                  </div>
                )}
                {debugInfo.videoStats && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">Video Stats:</span>
                    <span className="text-green-400 ml-2 font-mono text-xs">
                      {debugInfo.videoStats}
                    </span>
                  </div>
                )}
                {debugInfo.videoError && (
                  <div className="md:col-span-2">
                    <span className="text-gray-400">Video Error:</span>
                    <span className="text-red-400 ml-2 text-xs">
                      {debugInfo.videoError}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Testing Instructions */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-blue-400 font-semibold mb-2">
                🧪 Enhanced Testing Protocol:
              </h4>

              {debugInfo.userEmail && (
                <div className="mb-3 p-2 bg-green-900/20 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm">
                    ✅ Currently logged in as:{" "}
                    <strong>{debugInfo.userEmail}</strong>
                  </p>
                  <p className="text-green-300 text-xs mt-1">
                    Session ID:{" "}
                    <span className="font-mono">{debugInfo.sessionId}</span>
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                  <h5 className="text-yellow-400 font-semibold text-sm mb-2">
                    📋 Step-by-Step Testing:
                  </h5>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Open a different browser (Chrome/Firefox/Edge)</li>
                    <li>Login with a DIFFERENT email account</li>
                    <li>
                      Navigate to:{" "}
                      <span className="font-mono text-yellow-400">
                        {roomId}
                      </span>
                    </li>
                    <li>Allow camera/microphone permissions</li>
                    <li>Wait for connection (up to 30 seconds)</li>
                  </ol>
                </div>

                <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3">
                  <h5 className="text-purple-400 font-semibold text-sm mb-2">
                    🔍 What to Look For:
                  </h5>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>💡 Each browser should show different Session IDs</li>
                    <li>
                      🔄 Status: "waiting" → "connecting-peer" → "connected"
                    </li>
                    <li>🎥 Console: "RECEIVED REMOTE STREAM" message</li>
                    <li>⏰ Timer should start counting when connected</li>
                    <li>👥 Participant count should show "2"</li>
                  </ul>
                </div>

                <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                  <h5 className="text-red-400 font-semibold text-sm mb-2">
                    ⚠️ Troubleshooting:
                  </h5>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>🔄 If stuck at "waiting", refresh both browsers</li>
                    <li>
                      🎥 If no video, click the video area to manually start
                    </li>
                    <li>🔊 Check browser's audio/video permissions</li>
                    <li>🌐 Try incognito/private browsing mode</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (connectionStatus === "error" || connectionStatus === "failed") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="text-red-500 mb-4">
              <VideoOff className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">
              Connection Error
            </h2>
            <p className="text-gray-400 mb-4">
              {mediaError || "Unable to connect to the video call."}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">Video Consultation</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {formatDuration(callDuration)}
          </Badge>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">
              {isConnected ? participants.length + 1 : 1}
            </span>
          </div>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Main video area */}
        <div className="flex-1 relative">
          <div className="w-full h-full bg-gray-800 relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls={false}
              className="w-full h-full object-cover cursor-pointer bg-black"
              style={{
                display: isConnected ? "block" : "none",
                backgroundColor: "black", // Ensure background when loading
              }}
              onClick={() => {
                console.log(
                  "📺 Remote video clicked - attempting manual play..."
                );
                if (remoteVideoRef.current) {
                  if (remoteVideoRef.current.paused) {
                    remoteVideoRef.current.muted = false;
                    remoteVideoRef.current.play().catch((e) => {
                      console.log("Manual play failed:", e);
                      // Try muted play as fallback
                      remoteVideoRef.current.muted = true;
                      remoteVideoRef.current
                        .play()
                        .catch((e2) =>
                          console.log("Muted manual play failed:", e2)
                        );
                    });
                  } else {
                    // If playing but muted, unmute it
                    remoteVideoRef.current.muted = false;
                    console.log("🔊 Remote video unmuted via click");
                  }
                }
              }}
            />

            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">
                    Waiting for other participant...
                  </p>
                  <p className="text-sm text-gray-500">
                    Room ID:{" "}
                    <span className="font-mono text-blue-400">{roomId}</span>
                  </p>
                  <div className="mt-4 text-xs text-gray-600">
                    <p>Make sure both users have different email accounts!</p>
                    <p className="mt-1">
                      Your session:{" "}
                      <span className="font-mono text-purple-400">
                        {sessionId.current}
                      </span>
                    </p>
                    <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                      <p className="text-yellow-400 text-xs">
                        💡 If video doesn't auto-play when connected, click the
                        video area to start playback
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isConnected && participants.length > 0 && (
              <div className="absolute top-4 left-4">
                <div className="bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
                  {participants[0].name}
                </div>
              </div>
            )}
          </div>

          {/* Local video */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              You ({user?.email?.split("@")[0]})
            </div>
          </div>

          {/* Control buttons */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-4 bg-gray-800 px-6 py-3 rounded-full shadow-lg">
              <Button
                variant={isAudioOn ? "secondary" : "destructive"}
                size="sm"
                onClick={toggleAudio}
                className="rounded-full w-12 h-12"
              >
                {isAudioOn ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant={isVideoOn ? "secondary" : "destructive"}
                size="sm"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12"
              >
                {isVideoOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="sm"
                onClick={toggleScreenShare}
                className="rounded-full w-12 h-12"
              >
                <Monitor className="h-5 w-5" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="rounded-full w-12 h-12"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={endCall}
                className="rounded-full w-12 h-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold">Chat</h3>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">
                        {message.sender}
                      </span>
                      <span className="text-xs text-gray-400">
                        {message.timestamp}
                      </span>
                    </div>
                    <p className="text-sm">{message.text}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-gray-400 text-center">No messages yet</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button size="sm" onClick={sendMessage}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
