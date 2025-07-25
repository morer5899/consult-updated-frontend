"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"

// Ensure VITE_BACKEND_URL defaults to http://localhost:8000
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    console.log("AuthContext useEffect: Initializing...")
    const storedUser = localStorage.getItem("user")
    const storedToken = localStorage.getItem("token")
    console.log("AuthContext useEffect: Raw storedUser from localStorage:", storedUser)
    console.log("AuthContext useEffect: Raw storedToken from localStorage:", storedToken)

    // Check for token and user in URL query parameters (after Google OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const tokenFromUrl = urlParams.get("token")
    const userFromUrl = urlParams.get("user")

    if (tokenFromUrl && userFromUrl) {
      try {
        const decodedUser = JSON.parse(decodeURIComponent(userFromUrl))
        // Ensure the user object has an id field
        const userWithId = {
          ...decodedUser,
          id: decodedUser._id || decodedUser.id,
        }

        localStorage.setItem("token", tokenFromUrl)
        localStorage.setItem("user", JSON.stringify(userWithId))
        setUser(userWithId)
        console.log("AuthContext: Processed Google OAuth redirect. User set:", userWithId)

        // Clear URL parameters to prevent re-processing on refresh
        urlParams.delete("token")
        urlParams.delete("user")
        window.history.replaceState({}, document.title, window.location.pathname + urlParams.toString())
        navigate("/dashboard", { replace: true })
      } catch (error) {
        console.error("AuthContext: Error parsing user data from URL:", error)
        navigate("/login?error=oauth_parse_error", { replace: true })
      } finally {
        setLoading(false)
        console.log("AuthContext useEffect: Loading set to false after URL params.")
      }
    } else if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser)
        // Ensure the user object has an id field
        const userWithId = {
          ...parsedUser,
          id: parsedUser._id || parsedUser.id,
        }

        setUser(userWithId)
        console.log("AuthContext useEffect: Found stored user and token in localStorage. User set:", userWithId)
      } catch (parseError) {
        console.error("AuthContext useEffect: Error parsing stored user from localStorage:", parseError)
        // Clear potentially corrupted data
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        setUser(null)
      } finally {
        setLoading(false)
        console.log("AuthContext useEffect: Loading set to false after localStorage check.")
      }
    } else {
      console.log("AuthContext useEffect: No user or token found in localStorage or URL params.")
      setLoading(false)
      console.log("AuthContext useEffect: Loading set to false (no stored data).")
    }
  }, [navigate])

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem("token")
    return token ? { "x-auth-token": token } : {}
  }, [])

  const login = async (email, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Login failed")
      }

      // Ensure the user object has an id field
      const userWithId = {
        ...data.user,
        id: data.user._id || data.user.id, // Handle both _id and id
      }

      localStorage.setItem("token", data.token)
      localStorage.setItem("user", JSON.stringify(userWithId))
      setUser(userWithId)
      console.log("AuthContext: Manual login successful. User data saved to localStorage.", userWithId)

      return userWithId
    } catch (error) {
      console.error("AuthContext: Login error:", error)
      throw error
    }
  }

  const register = async (name, email, password, role) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Registration failed")
      }

      // Ensure the user object has an id field
      const userWithId = {
        ...data.user,
        id: data.user._id || data.user.id, // Handle both _id and id
      }

      localStorage.setItem("token", data.token)
      localStorage.setItem("user", JSON.stringify(userWithId))
      setUser(userWithId)
      console.log("AuthContext: Registration successful. User data saved to localStorage.", userWithId)

      return userWithId
    } catch (error) {
      console.error("AuthContext: Registration error:", error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    console.log("AuthContext: User logged out. localStorage cleared.")
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    getAuthHeader,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
