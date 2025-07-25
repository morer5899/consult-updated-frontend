"use client"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarIcon, Clock, Star, ArrowLeft, CheckCircle, Video, Loader2 } from "lucide-react"
import { useAuth } from "../contexts/AuthContext.jsx"
import { format } from "date-fns"

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export default function BookingPage() {
  const { user, getAuthHeader } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: Select Consultant, 2: Select Time, 3: Details, 4: Payment, 5: Confirmation
  const [selectedConsultant, setSelectedConsultant] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTime, setSelectedTime] = useState("")
  const [duration, setDuration] = useState("60")
  const [consultationType, setConsultationType] = useState("business")
  const [description, setDescription] = useState("")
  const [consultants, setConsultants] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingBooking, setLoadingBooking] = useState(false)
  const [loadingConsultants, setLoadingConsultants] = useState(true)
  const [bookingError, setBookingError] = useState(null)
  const [consultantsError, setConsultantsError] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState("idle") // 'idle', 'processing', 'success', 'failed'
  const [profile, setProfile] = useState({ phone: "" }) // Declare profile variable

  // Razorpay specific states
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  const [razorpayKeyId, setRazorpayKeyId] = useState("") // Will be fetched from backend
  const [currentOrderId, setCurrentOrderId] = useState(null) // Store the order ID from backend

  const paymentAmount = selectedConsultant
    ? ((selectedConsultant.hourlyRate || 50) * (Number.parseInt(duration) / 60)).toFixed(2)
    : 0

  // Function to load Razorpay script
  const loadRazorpayScript = useCallback(() => {
    if (razorpayLoaded || document.getElementById("razorpay-checkout-script")) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.id = "razorpay-checkout-script"
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.async = true
      script.onload = () => {
        setRazorpayLoaded(true)
        resolve(true)
      }
      script.onerror = () => {
        console.error("Failed to load Razorpay script.")
        setBookingError("Failed to load payment gateway. Please try again.")
        resolve(false)
      }
      document.body.appendChild(script)
    })
  }, [razorpayLoaded])

  useEffect(() => {
    const fetchConsultants = async () => {
      setLoadingConsultants(true)
      setConsultantsError(null)

      try {
        const response = await fetch(`${BACKEND_URL}/api/users/consultants`, {
          headers: getAuthHeader(),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to fetch consultants")
        }

        const data = await response.json()
        setConsultants(data)
      } catch (err) {
        console.error("Error fetching consultants:", err)
        setConsultantsError(err.message || "Failed to load consultants. Please try again.")
      } finally {
        setLoadingConsultants(false)
      }
    }

    fetchConsultants()
  }, [getAuthHeader])

  useEffect(() => {
    if (selectedConsultant && selectedDate) {
      // In a real app, you'd fetch availability from the backend for the selected consultant and date
      // For now, using dummy slots
      const slots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]
      setAvailableSlots(slots)
      setSelectedTime("")
    }
  }, [selectedConsultant, selectedDate])

  // Load Razorpay script when entering the payment step
  useEffect(() => {
    if (step === 4) {
      loadRazorpayScript()
    }
  }, [step, loadRazorpayScript])

  const handleConsultantSelect = (consultant) => {
    setSelectedConsultant(consultant)
    setStep(2)
  }

  const handleTimeSelect = () => {
    if (selectedTime) {
      setStep(3)
    }
  }

  const handleProceedToPayment = () => {
    if (!description.trim()) {
      setBookingError("Please provide a description for your consultation.")
      return
    }
    setBookingError(null)
    setStep(4)
  }

  const bookAppointment = async (paymentDetails) => {
    setLoadingBooking(true)
    setBookingError(null)

    const appointmentData = {
      consultantId: selectedConsultant._id,
      title: `${consultationType} consultation with ${selectedConsultant.name}`,
      description: description,
      date: format(selectedDate, "yyyy-MM-dd"),
      time: selectedTime,
      duration: Number.parseInt(duration),
      // Include payment details if needed by the appointment creation logic
      paymentId: paymentDetails?.paymentId,
      orderId: paymentDetails?.orderId,
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(appointmentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to book appointment")
      }

      setStep(5) // Move to confirmation step
    } catch (err) {
      console.error("Error booking appointment:", err)
      setBookingError(err.message || "Failed to book appointment. Please try again.")
      setPaymentStatus("failed") // Set payment status to failed if booking fails after payment
    } finally {
      setLoadingBooking(false)
      setTimeout(() => setPaymentStatus("idle"), 3000)
    }
  }

  const displayRazorpay = async () => {
    if (!razorpayLoaded || !window.Razorpay) {
      setBookingError("Razorpay script not loaded. Please try again.")
      return
    }

    setLoadingBooking(true)
    setPaymentStatus("processing")
    setBookingError(null)

    try {
      // 1. First create the appointment in "pending" state
      const appointmentResponse = await fetch(`${BACKEND_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          consultantId: selectedConsultant._id,
          clientId: user.id,
          title: `${consultationType} consultation with ${selectedConsultant.name}`,
          description: description,
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          duration: Number.parseInt(duration),
          status: "pending",
          paymentStatus: "pending",
        }),
      })

      const appointmentData = await appointmentResponse.json()
      if (!appointmentResponse.ok) {
        throw new Error(appointmentData.message || "Failed to create appointment")
      }

      // 2. Create Razorpay order with real appointment ID
      const orderResponse = await fetch(`${BACKEND_URL}/api/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          amount: Math.round(Number.parseFloat(paymentAmount) * 100),
          currency: "INR",
          receipt: `appointment_${appointmentData._id}`,
          appointmentId: appointmentData._id,
        }),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok) {
        // Clean up appointment if payment order fails
        await fetch(`${BACKEND_URL}/api/appointments/${appointmentData._id}`, {
          method: "DELETE",
          headers: getAuthHeader(),
        })
        throw new Error(orderData.message || "Failed to create payment order")
      }

      // 3. Initialize Razorpay
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ConsultPro",
        description: "Consultation Booking",
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            // 4. Verify payment on backend
            const verifyResponse = await fetch(`${BACKEND_URL}/api/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                appointmentId: appointmentData._id,
                amount: orderData.amount, // Include the amount
              }),
            })

            const verifyData = await verifyResponse.json()
            if (!verifyResponse.ok) {
              throw new Error(verifyData.message || "Payment verification failed")
            }

            // 5. Success - update UI
            setPaymentStatus("success")
            setStep(5)
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr)
            setBookingError(verifyErr.message)
            setPaymentStatus("failed")
          } finally {
            setLoadingBooking(false)
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: profile.phone || "",
        },
        theme: {
          color: "#3B82F6",
        },
      }

      const rzp1 = new window.Razorpay(options)
      rzp1.on("payment.failed", async (response) => {
        console.error("Payment failed:", response.error)
        setBookingError(response.error.description || "Payment failed")
        setPaymentStatus("failed")
        setLoadingBooking(false)

        // Clean up appointment on payment failure
        await fetch(`${BACKEND_URL}/api/appointments/${appointmentData._id}`, {
          method: "DELETE",
          headers: getAuthHeader(),
        })
      })

      rzp1.open()
    } catch (err) {
      console.error("Payment error:", err)
      setBookingError(err.message || "Payment failed")
      setPaymentStatus("failed")
      setLoadingBooking(false)
    }
  }

  const handleConfirmPayment = async () => {
    await displayRazorpay()
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4, 5].map((stepNumber) => (
        <div key={stepNumber} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= stepNumber ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            {step > stepNumber ? <CheckCircle className="h-4 w-4" /> : stepNumber}
          </div>
          {stepNumber < 5 && <div className={`w-16 h-1 ${step > stepNumber ? "bg-blue-600" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  )

  const renderConsultantSelection = () => (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Consultant</h2>
        <p className="text-gray-600">Select from our expert consultants</p>
      </div>

      {loadingConsultants ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading consultants...</p>
        </div>
      ) : consultantsError ? (
        <div className="text-center py-8 text-red-600">
          <p>{consultantsError}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {consultants.map((consultant) => (
            <Card
              key={consultant._id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleConsultantSelect(consultant)}
            >
              <CardHeader className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={consultant.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{consultant.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-lg">{consultant.name}</CardTitle>
                <CardDescription>{consultant.specialties?.join(", ") || "General Consultant"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-3">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="ml-1 text-sm font-medium">4.9</span>
                    <span className="ml-1 text-sm text-gray-600">(127 reviews)</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4 text-center">{consultant.bio || "Experienced consultant"}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {consultant.specialties?.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  )) || (
                    <Badge variant="secondary" className="text-xs">
                      General Consulting
                    </Badge>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-blue-600">${consultant.hourlyRate || 50}/hour</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {consultants.length === 0 && !loadingConsultants && !consultantsError && (
            <div className="col-span-full text-center py-8 text-gray-600">
              No consultants available at the moment. Please check back later.
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderTimeSelection = () => (
    <div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setStep(1)} className="mr-4">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select Date & Time</h2>
          <p className="text-gray-600">Choose your preferred consultation slot</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date.getDay() === 0}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Available Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {availableSlots.map((slot) => (
                <Button
                  key={slot}
                  variant={selectedTime === slot ? "default" : "outline"}
                  onClick={() => setSelectedTime(slot)}
                  className="w-full"
                >
                  {slot}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleTimeSelect} disabled={!selectedTime} className="w-full">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderBookingDetails = () => (
    <div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setStep(2)} className="mr-4">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consultation Details</h2>
          <p className="text-gray-600">Provide details about your consultation</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Consultation Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="type">Consultation Type</Label>
                <Select value={consultationType} onValueChange={setConsultationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business Strategy</SelectItem>
                    <SelectItem value="marketing">Marketing & Sales</SelectItem>
                    <SelectItem value="financial">Financial Planning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe what you'd like to discuss in this consultation..."
                  rows={4}
                />
              </div>

              {bookingError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">{bookingError}</div>
              )}

              <Button onClick={handleProceedToPayment} disabled={!description.trim()}>
                Proceed to Payment
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={selectedConsultant?.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{selectedConsultant?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedConsultant?.name}</div>
                  <div className="text-sm text-gray-600">{selectedConsultant?.specialties?.[0] || "Consultant"}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{selectedDate ? format(selectedDate, "PPP") : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span>{selectedTime || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span>{duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span>{consultationType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rate:</span>
                  <span>${selectedConsultant?.hourlyRate || 50}/hour</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${((selectedConsultant?.hourlyRate || 50) * (Number.parseInt(duration) / 60)).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  const renderPaymentDetails = () => (
    <div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setStep(3)} className="mr-4">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Information</h2>
          <p className="text-gray-600">Enter your payment details to complete the booking</p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Confirm Payment</CardTitle>
            <CardDescription>
              You will be charged <span className="font-bold text-blue-600">${paymentAmount}</span> for this
              consultation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-100 p-4 rounded-md text-center text-gray-600">
              <p>Click the button below to proceed with Razorpay.</p>
            </div>

            {bookingError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">{bookingError}</div>
            )}

            <Button onClick={handleConfirmPayment} disabled={loadingBooking || !razorpayLoaded} className="w-full">
              {loadingBooking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {paymentStatus === "processing" ? "Processing Payment..." : "Booking..."}
                </>
              ) : (
                "Pay with Razorpay"
              )}
            </Button>

            {!razorpayLoaded && <p className="text-gray-500 text-center text-sm">Loading Razorpay script...</p>}

            {paymentStatus === "success" && <p className="text-green-600 text-center mt-2">Payment successful!</p>}

            {paymentStatus === "failed" && (
              <p className="text-red-600 text-center mt-2">Payment failed. Please try again.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderConfirmation = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
        <p className="text-gray-600">Your consultation has been successfully booked</p>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={selectedConsultant?.avatar || "/placeholder.svg"} />
                <AvatarFallback>{selectedConsultant?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h3 className="text-xl font-semibold">{selectedConsultant?.name}</h3>
                <p className="text-gray-600">{selectedConsultant?.specialties?.[0] || "Consultant"}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Consultation Details</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Date: {selectedDate ? format(selectedDate, "PPP") : "N/A"}</p>
                  <p>Time: {selectedTime || "N/A"}</p>
                  <p>Duration: {duration} minutes</p>
                  <p>Type: {consultationType}</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• Check your email for confirmation</p>
                  <p>• Join the call from your dashboard</p>
                  <p>• Prepare any materials needed</p>
                  <p>• Test your camera and microphone</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button onClick={() => navigate("/dashboard")} className="flex-1">
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Book Another
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderStepIndicator()}
        {step === 1 && renderConsultantSelection()}
        {step === 2 && renderTimeSelection()}
        {step === 3 && renderBookingDetails()}
        {step === 4 && renderPaymentDetails()}
        {step === 5 && renderConfirmation()}
      </div>
    </div>
  )
}
