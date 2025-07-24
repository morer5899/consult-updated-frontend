"use client"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Video, ArrowLeft, Plus, Trash, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { useAuth } from "../contexts/AuthContext.jsx"

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export default function SetAvailabilityPage() {
  const navigate = useNavigate()
  const { user, getAuthHeader } = useAuth()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [availability, setAvailability] = useState({}) // Stores availability for all fetched dates
  const [newSlotStart, setNewSlotStart] = useState("")
  const [newSlotEnd, setNewSlotEnd] = useState("")
  const [saveStatus, setSaveStatus] = useState("") // 'saving', 'success', 'error'
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState(null)

  const getFormattedDate = (date) => format(date, "yyyy-MM-dd")

  const fetchAvailabilityForDate = useCallback(async () => {
    if (!user?.id || user.role !== "consultant") {
      setLoadingAvailability(false)
      setAvailabilityError("You must be a consultant to manage availability.")
      return
    }

    setLoadingAvailability(true)
    setAvailabilityError(null)
    const formattedDate = getFormattedDate(selectedDate)

    try {
      const response = await fetch(`${BACKEND_URL}/api/availability/${user.id}/${formattedDate}`, {
        headers: getAuthHeader(),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch availability")
      }

      const data = await response.json()
      setAvailability((prev) => ({
        ...prev,
        [formattedDate]: data.slots || [], // Store slots under the formatted date key
      }))
    } catch (err) {
      console.error("Error fetching availability:", err)
      setAvailabilityError(err.message || "Failed to load availability for this date.")
      setAvailability((prev) => ({
        ...prev,
        [formattedDate]: [], // Set to empty array on error
      }))
    } finally {
      setLoadingAvailability(false)
    }
  }, [selectedDate, user, getAuthHeader])

  // Fetch availability whenever selectedDate or user changes
  useEffect(() => {
    fetchAvailabilityForDate()
  }, [fetchAvailabilityForDate])

  const handleAddSlot = () => {
    if (newSlotStart && newSlotEnd) {
      const formattedDate = getFormattedDate(selectedDate)
      setAvailability((prev) => ({
        ...prev,
        [formattedDate]: [...(prev[formattedDate] || []), { start: newSlotStart, end: newSlotEnd }],
      }))
      setNewSlotStart("")
      setNewSlotEnd("")
    }
  }

  const handleRemoveSlot = (indexToRemove) => {
    const formattedDate = getFormattedDate(selectedDate)
    setAvailability((prev) => ({
      ...prev,
      [formattedDate]: prev[formattedDate].filter((_, index) => index !== indexToRemove),
    }))
  }

  const handleSaveAvailability = async () => {
    if (!user?.id || user.role !== "consultant") {
      setSaveStatus("error")
      setAvailabilityError("You must be a consultant to save availability.")
      return
    }

    setSaveStatus("saving")
    setAvailabilityError(null)
    const formattedDate = getFormattedDate(selectedDate)
    const slotsToSave = availability[formattedDate] || []

    try {
      const response = await fetch(`${BACKEND_URL}/api/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          consultantId: user.id,
          date: formattedDate,
          slots: slotsToSave,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save availability")
      }

      setSaveStatus("success")
    } catch (err) {
      console.error("Error saving availability:", err)
      setSaveStatus("error")
      setAvailabilityError(err.message || "Failed to save availability. Please try again.")
    } finally {
      setTimeout(() => {
        setSaveStatus("")
        setAvailabilityError(null)
      }, 3000)
    }
  }

  // Get slots for the currently selected day
  const currentDaySlots = availability[getFormattedDate(selectedDate)] || []

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
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Set Your Availability</h1>
          <p className="text-gray-600">Manage the times you are available for consultations.</p>
        </div>

        {user?.role !== "consultant" && (
          <Card className="max-w-2xl mx-auto mb-8 p-6 text-center bg-red-50 border border-red-200 text-red-700">
            <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
            <CardDescription>Only consultants can set their availability.</CardDescription>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Go to Dashboard
            </Button>
          </Card>
        )}

        {user?.role === "consultant" && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Calendar for Date Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
                <CardDescription>Choose a day to manage your availability.</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border mx-auto"
                />
              </CardContent>
            </Card>

            {/* Time Slot Management for Selected Date */}
            <Card>
              <CardHeader>
                <CardTitle>Availability for {format(selectedDate, "PPP")}</CardTitle>
                <CardDescription>Add or remove time slots for this day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingAvailability ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading slots...</p>
                  </div>
                ) : availabilityError ? (
                  <p className="text-red-600 text-center">{availabilityError}</p>
                ) : (
                  <div className="space-y-3">
                    {currentDaySlots.length === 0 ? (
                      <p className="text-gray-500 text-center">No slots set for this day.</p>
                    ) : (
                      currentDaySlots.map((slot, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-100 p-3 rounded-md">
                          <span>
                            {slot.start} - {slot.end}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveSlot(index)}>
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Add New Slot */}
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newSlotStart}
                      onChange={(e) => setNewSlotStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={newSlotEnd}
                      onChange={(e) => setNewSlotEnd(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddSlot} disabled={!newSlotStart || !newSlotEnd}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Slot
                  </Button>
                </div>

                {/* Save Button */}
                <Button onClick={handleSaveAvailability} className="w-full" disabled={saveStatus === "saving"}>
                  {saveStatus === "saving" ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Availability
                    </>
                  )}
                </Button>
                {saveStatus === "success" && <p className="text-green-600 text-sm text-center">Availability saved!</p>}
                {saveStatus === "error" && (
                  <p className="text-red-600 text-sm text-center">Failed to save availability.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
