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

  // ICE servers configuration
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

  // Generate unique session ID
  const sessionId = useRef(null);
  if (!sessionId.current) {
    sessionId.current = `${user?.id}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Debug info updater
  const updateDebugInfo = useCallback((info) => {
    if (!mountedRef.current) return;
    setDebugInfo((prev) => ({ ...prev, ...info }));
  }, []);

  // Connection timeout helpers
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const setConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnected && mountedRef.current && !cleanupRef.current) {
        setConnectionStatus("failed");
        setMediaError("Connection timeout. Please try refreshing the page.");
      }
    }, 30000);
  }, [isConnected]);

  // Prevent multiple initializations
  const initializeOnce = useCallback(() => {
    if (isInitializedRef.current || cleanupRef.current || !mountedRef.current) {
      return false;
    }
    isInitializedRef.current = true;
    return true;
  }, []);

  // Get media stream
  const getMediaStream = useCallback(async () => {
    try {
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
      updateDebugInfo({ mediaStatus: "✅ Camera & Microphone Access Granted" });
      return stream;
    } catch (error) {
      updateDebugInfo({
        mediaStatus: "❌ Media Access Failed: " + error.message,
      });
      // Try audio-only fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        updateDebugInfo({ mediaStatus: "⚠️ Audio-only mode (camera failed)" });
        return audioStream;
      } catch (audioError) {
        throw new Error(
          "Unable to access camera or microphone. Please check permissions."
        );
      }
    }
  }, [updateDebugInfo]);

  // Peer connection creation
  const createPeerConnection = useCallback(() => {
    if (cleanupRef.current || !mountedRef.current) return null;

    const pc = new RTCPeerConnection(iceServers);

    pendingCandidatesRef.current = [];

    pc.onicecandidate = (event) => {
      if (
        event.candidate &&
        socketRef.current?.connected &&
        !cleanupRef.current &&
        mountedRef.current
      ) {
        socketRef.current.emit(
          "candidate",
          roomId,
          event.candidate,
          socketRef.current.id
        );
      }
    };

    pc.ontrack = (event) => {
      if (cleanupRef.current || !mountedRef.current) return;
      if (!event.streams || event.streams.length === 0) return;

      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        // Play remote video
        const playVideo = async () => {
          if (!remoteVideoRef.current || cleanupRef.current) return;
          try {
            remoteVideoRef.current.muted = false;
            await remoteVideoRef.current.play();
          } catch {
            remoteVideoRef.current.muted = true;
            await remoteVideoRef.current.play().catch(() => {});
          }
        };
        playVideo();
        setIsConnected(true);
        setConnectionStatus("connected");
        clearConnectionTimeout();
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = Date.now();
        }
        setParticipants([
          {
            id: "remote-user",
            name: "Remote Participant",
            role: "participant",
            isVideoOn: true,
            isAudioOn: true,
          },
        ]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (cleanupRef.current || !mountedRef.current) return;
      switch (pc.connectionState) {
        case "connected":
          setIsConnected(true);
          setConnectionStatus("connected");
          clearConnectionTimeout();
          break;
        case "disconnected":
          setIsConnected(false);
          setConnectionStatus("disconnected");
          break;
        case "failed":
          setIsConnected(false);
          setConnectionStatus("failed");
          break;
        case "closed":
          setIsConnected(false);
          break;
      }
    };

    return pc;
  }, [roomId, clearConnectionTimeout]);

  // End call
  const endCall = useCallback(() => {
    cleanupRef.current = true;
    mountedRef.current = false;
    navigate("/dashboard");
  }, [navigate]);

  // Setup call
  const setupCall = useCallback(async () => {
    if (!initializeOnce()) return;

    try {
      setConnectionStatus("connecting");
      setMediaError(null);

      // Get user media
      const stream = await getMediaStream();
      if (cleanupRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
        } catch {}
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      setIsVideoOn(videoTracks.length > 0 && videoTracks[0].enabled);
      setIsAudioOn(audioTracks.length > 0 && audioTracks[0].enabled);

      // Setup socket connection
      if (socketRef.current) {
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
        socket.emit("join-room", roomId, sessionId.current);
        setConnectionStatus("waiting");
      });

      socket.on("user-joined", async (joinedSessionId, joinedSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          joinedSocketId === socket.id ||
          joinedSessionId === sessionId.current
        ) {
          return;
        }
        setConnectionStatus("connecting-peer");
        setConnectionTimeout();

        // Create new peer connection
        const pc = createPeerConnection();
        if (!pc) return;
        peerConnectionRef.current = pc;

        // Add local tracks
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });

        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit("offer", roomId, offer, socket.id);
        } catch (error) {}
      });

      socket.on("offer", async (offer, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        ) {
          return;
        }
        setConnectionStatus("connecting-peer");
        setConnectionTimeout();

        if (
          !peerConnectionRef.current ||
          peerConnectionRef.current.connectionState === "closed"
        ) {
          const pc = createPeerConnection();
          if (!pc) return;
          peerConnectionRef.current = pc;
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current);
          });
        }

        const pc = peerConnectionRef.current;

        try {
          if (!pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);
            socket.emit("answer", roomId, answer, socket.id);
            for (const candidate of pendingCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {}
            }
            pendingCandidatesRef.current = [];
          }
        } catch (error) {}
      });

      socket.on("answer", async (answer, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        ) {
          return;
        }
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription === null) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            for (const candidate of pendingCandidatesRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {}
            }
            pendingCandidatesRef.current = [];
          } catch (error) {}
        }
      });

      socket.on("candidate", async (candidate, senderSocketId) => {
        if (
          cleanupRef.current ||
          !mountedRef.current ||
          senderSocketId === socket.id
        )
          return;

        try {
          if (
            peerConnectionRef.current &&
            peerConnectionRef.current.remoteDescription
          ) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        } catch (error) {}
      });

      socket.on("chat-message", (message) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setMessages((prev) => [...prev, message]);
      });

      socket.on("user-left", (sessionId, socketId) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus("waiting");
        setParticipants([]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      socket.on("disconnect", (reason) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus("disconnected");
      });

      socket.on("connect_error", (error) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setConnectionStatus("error");
        setMediaError("Connection failed. Please try again.");
      });

      socket.on("error", (error) => {
        if (cleanupRef.current || !mountedRef.current) return;
        setMediaError(error);
      });
    } catch (error) {
      if (cleanupRef.current || !mountedRef.current) return;
      setMediaError(error.message);
      setConnectionStatus("error");
    }
  }, [
    roomId,
    user?.id,
    createPeerConnection,
    getMediaStream,
    initializeOnce,
    setConnectionTimeout,
  ]);

  // Cleanup function
  const cleanup = useCallback(() => {
    cleanupRef.current = true;
    isInitializedRef.current = false;
    clearConnectionTimeout();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    pendingCandidatesRef.current = [];
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
  }, []); // Only once

  // Call duration timer
  useEffect(() => {
    if (!peerConnectionRef.current || !isConnected) return;
    const interval = setInterval(() => {
      if (callStartTimeRef.current) {
        setCallDuration(
          Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Media control functions
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
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
    } catch (error) {}
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
                backgroundColor: "black",
              }}
              onClick={() => {
                if (remoteVideoRef.current) {
                  if (remoteVideoRef.current.paused) {
                    remoteVideoRef.current.muted = false;
                    remoteVideoRef.current.play().catch(() => {
                      remoteVideoRef.current.muted = true;
                      remoteVideoRef.current.play().catch(() => {});
                    });
                  } else {
                    remoteVideoRef.current.muted = false;
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
