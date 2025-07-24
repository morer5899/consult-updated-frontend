"use client"

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import LandingPage from "./components/LandingPage.jsx"
import Login from "./components/Login.jsx"
import Register from "./components/Register.jsx"
import Dashboard from "./components/Dashboard.jsx"
import VideoRoom from "./components/VideoRoom.jsx"
import BookingPage from "./components/BookingPage.jsx"
import ProfilePage from "./components/ProfilePage.jsx"
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx"
import SetAvailabilityPage from "./components/SetAvailabilityPage.jsx"

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Redirect from root to dashboard if user is logged in */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/video/:roomId" element={user ? <VideoRoom /> : <Navigate to="/login" />} />
      <Route path="/book" element={user ? <BookingPage /> : <Navigate to="/login" />} />
      <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
      <Route path="/availability" element={user ? <SetAvailabilityPage /> : <Navigate to="/login" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  )
}
