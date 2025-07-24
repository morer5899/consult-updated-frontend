"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Video, Calendar, Users, Clock, Plus, Settings, LogOut, Bell, Search, Filter } from "lucide-react"
import { useAuth } from "../contexts/AuthContext.jsx"

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export default function Dashboard() {
  const { user, logout, getAuthHeader } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState({
    totalAppointments: 0,
    upcomingAppointments: 0,
    completedAppointments: 0,
    totalHours: 0,
  })
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState(null)

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) {
        setLoadingAppointments(false)
        return
      }

      if (!BACKEND_URL) {
        console.error("BACKEND_URL is not defined")
        setAppointmentsError("Backend URL is not configured. Please contact support.")
        setLoadingAppointments(false)
        return
      }

      setLoadingAppointments(true)
      setAppointmentsError(null)

      try {
        const response = await fetch(`${BACKEND_URL}/api/appointments/user/${user.id}`, {
          headers: getAuthHeader(),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to fetch appointments")
        }

        const data = await response.json()
        setAppointments(data)

        const upcoming = data.filter((apt) => apt.status === "scheduled" || apt.status === "confirmed").length
        const completed = data.filter((apt) => apt.status === "completed").length
        const totalDuration = data.reduce((total, apt) => total + apt.duration, 0) / 60

        setStats({
          totalAppointments: data.length,
          upcomingAppointments: upcoming,
          completedAppointments: completed,
          totalHours: totalDuration,
        })
      } catch (err) {
        console.error("Error fetching appointments:", err)
        setAppointmentsError(err.message || "Failed to load appointments. Please try again.")
      } finally {
        setLoadingAppointments(false)
      }
    }

    fetchAppointments()
    const pollingInterval = setInterval(fetchAppointments, 30000)

    return () => {
      clearInterval(pollingInterval)
    }
  }, [user, getAuthHeader])

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const joinVideoCall = (appointmentId) => {
    navigate(`/video/${appointmentId}`)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
      case "confirmed":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString) => {
    const options = { weekday: "short", year: "numeric", month: "short", day: "numeric" }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Video className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">ConsultPro</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={user?.avatar || "/placeholder.svg?height=32&width=32"} />
                  <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600">
            {user?.role === "consultant"
              ? "Manage your consultations and connect with clients"
              : "Book consultations and manage your appointments"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">+2 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
              <p className="text-xs text-muted-foreground">Next appointment today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedAppointments}</div>
              <p className="text-xs text-muted-foreground">+1 from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {user?.role === "client" ? (
              <Link to="/book">
                <Button className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Book Consultation
                </Button>
              </Link>
            ) : (
              <Link to="/availability">
                <Button className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Set Availability
                </Button>
              </Link>
            )}
            <Link to="/profile">
              <Button variant="outline" className="flex items-center bg-transparent">
                <Settings className="h-4 w-4 mr-2" />
                Manage Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Appointments Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{user?.role === "consultant" ? "Your Consultations" : "Your Appointments"}</CardTitle>
                <CardDescription>Manage your upcoming and past appointments</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                  View All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAppointments ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading appointments...</p>
              </div>
            ) : appointmentsError ? (
              <div className="text-center py-8 text-red-600">
                <p>{appointmentsError}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => {
                  const otherUser = user?.role === "consultant" ? appointment.clientId : appointment.consultantId
                  const otherUserName = otherUser?.name || (user?.role === "consultant" ? "Client" : "Consultant")

                  return (
                    <div
                      key={appointment._id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Video className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{appointment.title}</h3>
                          <p className="text-sm text-gray-600">with {otherUserName}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-500">
                              {formatDate(appointment.date)} at {formatTime(appointment.time)}
                            </span>
                            <span className="text-sm text-gray-500">{appointment.duration} min</span>
                            <Badge className={getStatusColor(appointment.status)}>{appointment.status}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
                          <Button onClick={() => joinVideoCall(appointment._id)} className="flex items-center">
                            <Video className="h-4 w-4 mr-2" />
                            Join Call
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          Details
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {appointments.length === 0 && (
                  <div className="text-center py-8">
                    <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments yet</h3>
                    <p className="text-gray-600 mb-4">
                      {user?.role === "client"
                        ? "Book your first consultation to get started"
                        : "Set your availability to start receiving bookings"}
                    </p>
                    {user?.role === "client" && (
                      <Link to="/book">
                        <Button>Book Consultation</Button>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
