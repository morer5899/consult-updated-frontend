"use client"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  User,
  Bell,
  Shield,
  CreditCard,
  ArrowLeft,
  Camera,
  Save,
  Star,
  Video,
  Plus,
  Trash,
  Loader2,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext.jsx"

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "")

export default function ProfilePage() {
  const { user, getAuthHeader, logout } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null) // Ref for the hidden file input

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    specialties: [],
    hourlyRate: 0,
    timezone: "",
    languages: [],
    avatar: "",
  })
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    appointmentReminders: true,
    marketingEmails: false,
  })
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    showEmail: false,
    showPhone: false,
  })

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // New states for Billing & Payments
  const [paymentMethods, setPaymentMethods] = useState([])
  const [billingHistory, setBillingHistory] = useState([])
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingError, setBillingError] = useState(null)

  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  const razorpayKeyId = "rzp_test_YOUR_KEY_ID" // Replace with your actual Razorpay Test Key ID

  // Function to load Razorpay script
  const loadRazorpayScript = useCallback(() => {
    if (razorpayLoaded || document.getElementById("razorpay-checkout-script-profile")) {
      return Promise.resolve(true)
    }
    return new Promise((resolve) => {
      const script = document.createElement("script")
      script.id = "razorpay-checkout-script-profile"
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.async = true
      script.onload = () => {
        setRazorpayLoaded(true)
        resolve(true)
      }
      script.onerror = () => {
        console.error("Failed to load Razorpay script.")
        setBillingError("Failed to load payment gateway. Please try again.")
        resolve(false)
      }
      document.body.appendChild(script)
    })
  }, [razorpayLoaded])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !user.id) {
        setLoadingProfile(false)
        return
      }

      setLoadingProfile(true)
      setProfileError(null)
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
          headers: getAuthHeader(),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to fetch profile")
        }

        const data = await response.json()
        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          bio: data.bio || "",
          specialties: data.specialties || [],
          hourlyRate: data.hourlyRate || 0,
          timezone: data.timezone || "",
          languages: data.languages || [],
          avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`,
        })
        setNotifications(
          data.notifications || {
            emailNotifications: true,
            smsNotifications: false,
            appointmentReminders: true,
            marketingEmails: false,
          },
        )
        setPrivacy(
          data.privacy || {
            profileVisibility: "public",
            showEmail: false,
            showPhone: false,
          },
        )
      } catch (err) {
        console.error("Error fetching profile:", err)
        setProfileError(err.message || "Failed to load profile. Please try again.")
      } finally {
        setLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [user, getAuthHeader])

  // Simulate fetching payment methods and billing history
  useEffect(() => {
    setLoadingBilling(true)
    setBillingError(null)
    // Simulate API call
    setTimeout(() => {
      setPaymentMethods([
        { id: "pm_1", type: "Visa", last4: "4242", expiry: "12/25" },
        { id: "pm_2", type: "Mastercard", last4: "5555", expiry: "08/24" },
      ])
      setBillingHistory([
        {
          id: "bill_1",
          date: "2024-06-15",
          description: "Consultation with Dr. Wilson",
          amount: 150.0,
          status: "Paid",
        },
        { id: "bill_2", date: "2024-05-20", description: "Consultation with John Doe", amount: 75.0, status: "Paid" },
        { id: "bill_3", date: "2024-04-10", description: "Monthly Subscription", amount: 29.99, status: "Paid" },
      ])
      setLoadingBilling(false)
    }, 1000)
  }, [])

  const handleProfileUpdate = async () => {
    setSavingProfile(true)
    setProfileError(null)
    setSaveSuccess(false)
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          specialties: profile.specialties,
          hourlyRate: profile.hourlyRate,
          timezone: profile.timezone,
          languages: profile.languages,
          phone: profile.phone,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile")
      }
      setSaveSuccess(true)
    } catch (err) {
      console.error("Error updating profile:", err)
      setProfileError(err.message || "Failed to save profile. Please try again.")
    } finally {
      setSavingProfile(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleNotificationUpdate = async () => {
    setSavingProfile(true)
    setProfileError(null)
    setSaveSuccess(false)
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ notifications }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to update notifications")
      }
      setSaveSuccess(true)
    } catch (err) {
      console.error("Error updating notifications:", err)
      setProfileError(err.message || "Failed to save notification preferences. Please try again.")
    } finally {
      setSavingProfile(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handlePrivacyUpdate = async () => {
    setSavingProfile(true)
    setProfileError(null)
    setSaveSuccess(false)
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ privacy }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to update privacy settings")
      }
      setSaveSuccess(true)
    } catch (err) {
      console.error("Error updating privacy:", err)
      setProfileError(err.message || "Failed to save privacy settings. Please try again.")
    } finally {
      setSavingProfile(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const uploadAvatar = async (file) => {
    setSavingProfile(true)
    setProfileError(null)
    setSaveSuccess(false)

    const formData = new FormData()
    formData.append("avatar", file)

    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${user.id}/avatar`, {
        method: "PUT",
        headers: {
          ...getAuthHeader(),
        },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to upload avatar")
      }
      setProfile((prevProfile) => ({
        ...prevProfile,
        avatar: data.avatar,
      }))
      setSaveSuccess(true)
    } catch (err) {
      console.error("Error uploading avatar:", err)
      setProfileError(err.message || "Failed to upload avatar. Please try again.")
    } finally {
      setSavingProfile(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleAvatarChangeClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      uploadAvatar(file)
    }
  }

  // Simulated Razorpay payment for adding a new method
  const handleAddPaymentMethod = async () => {
    if (!razorpayLoaded || !window.Razorpay) {
      setBillingError("Razorpay script not loaded. Please try again.")
      return
    }

    setLoadingBilling(true)
    setBillingError(null)

    const options = {
      key: razorpayKeyId,
      amount: 100, // Smallest amount for verification (e.g., 1 INR = 100 paisa)
      currency: "INR",
      name: "ConsultPro",
      description: "Add Payment Method Verification",
      image: "/placeholder.svg",
      order_id: "order_simulated_pm_" + Date.now(), // Simulated order ID
      handler: (response) => {
        console.log("Razorpay payment method added (simulated):", response)
        // In a real app, you'd save the payment method token/details to your backend
        const newMethod = {
          id: `pm_${Date.now()}`,
          type: "Visa", // This would come from Razorpay response or user input
          last4: "4242", // This would come from Razorpay response
          expiry: "12/25", // This would come from Razorpay response
        }
        setPaymentMethods((prev) => [...prev, newMethod])
        setLoadingBilling(false)
        setSaveSuccess(true) // Use saveSuccess for payment method addition too
        setTimeout(() => setSaveSuccess(false), 3000)
      },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: profile.phone || "",
      },
      notes: {
        userId: user.id,
        action: "add_payment_method",
      },
      theme: {
        color: "#3B82F6",
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.on("payment.failed", (response) => {
      console.error("Razorpay payment method addition failed:", response.error)
      setBillingError(response.error.description || "Failed to add payment method. Please try again.")
      setLoadingBilling(false)
    })
    rzp.open()
  }

  const handleDeletePaymentMethod = (id) => {
    // Simulate API call to delete payment method
    setLoadingBilling(true)
    setBillingError(null)
    setTimeout(() => {
      setPaymentMethods((prev) => prev.filter((method) => method.id !== id))
      setLoadingBilling(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }, 500)
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Loading profile...</p>
      </div>
    )
  }

  if (profileError && !loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96 text-center p-8">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{profileError}</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </Card>
      </div>
    )
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
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and professional information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={profile.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{profile.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                    <Button variant="outline" size="sm" onClick={handleAvatarChangeClick}>
                      <Camera className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input
                        id="timezone"
                        value={profile.timezone}
                        onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Tell clients about your expertise and experience..."
                      rows={4}
                    />
                  </div>
                  {user?.role === "consultant" && (
                    <div>
                      <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        value={profile.hourlyRate}
                        onChange={(e) => setProfile({ ...profile, hourlyRate: Number.parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                  <Button onClick={handleProfileUpdate} disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Changes"}
                    <Save className="h-4 w-4 ml-2" />
                  </Button>
                  {saveSuccess && <p className="text-green-600 text-sm">Profile saved successfully!</p>}
                  {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Member since</span>
                    <span className="text-sm font-medium">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" })
                        : "N/A"}
                    </span>
                  </div>
                  {user?.role === "consultant" && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Rating</span>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium ml-1">4.9</span>
                          <span className="ml-1 text-sm text-gray-600">(127 reviews)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Sessions</span>
                        <span className="text-sm font-medium">127</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified about appointments and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-gray-600">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailNotifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms-notifications">SMS Notifications</Label>
                    <p className="text-sm text-gray-600">Receive notifications via text message</p>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={notifications.smsNotifications}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, smsNotifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
                    <p className="text-sm text-gray-600">Get reminded about upcoming appointments</p>
                  </div>
                  <Switch
                    id="appointment-reminders"
                    checked={notifications.appointmentReminders}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, appointmentReminders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="marketing-emails">Marketing Emails</Label>
                    <p className="text-sm text-gray-600">Receive updates about new features and tips</p>
                  </div>
                  <Switch
                    id="marketing-emails"
                    checked={notifications.marketingEmails}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, marketingEmails: checked })}
                  />
                </div>
                <Button onClick={handleNotificationUpdate} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Preferences"}
                  <Save className="h-4 w-4 mr-2" />
                </Button>
                {saveSuccess && <p className="text-green-600 text-sm">Preferences saved successfully!</p>}
                {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control who can see your information and how it's used</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="profile-visibility">Profile Visibility</Label>
                    <p className="text-sm text-gray-600">Control who can view your public profile</p>
                  </div>
                  <Select
                    value={privacy.profileVisibility}
                    onValueChange={(value) =>
                      setPrivacy((prev) => ({
                        ...prev,
                        profileVisibility: value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="show-email">Show Email</Label>
                    <p className="text-sm text-gray-600">Display your email on your public profile</p>
                  </div>
                  <Switch
                    id="show-email"
                    checked={privacy.showEmail}
                    onCheckedChange={(checked) => setPrivacy({ ...privacy, showEmail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="show-phone">Show Phone</Label>
                    <p className="text-sm text-gray-600">Display your phone number on your public profile</p>
                  </div>
                  <Switch
                    id="show-phone"
                    checked={privacy.showPhone}
                    onCheckedChange={(checked) => setPrivacy({ ...privacy, showPhone: checked })}
                  />
                </div>
                <Button onClick={handlePrivacyUpdate} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Settings"}
                  <Save className="h-4 w-4 mr-2" />
                </Button>
                {saveSuccess && <p className="text-green-600 text-sm">Settings saved successfully!</p>}
                {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Payments</CardTitle>
                <CardDescription>Manage your payment methods and billing information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingBilling ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading billing information...</p>
                  </div>
                ) : billingError ? (
                  <div className="text-center py-8 text-red-600">
                    <p>{billingError}</p>
                  </div>
                ) : (
                  <>
                    {/* Payment Methods Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
                      {paymentMethods.length === 0 ? (
                        <div className="text-center py-4 text-gray-600">No payment methods added.</div>
                      ) : (
                        <div className="space-y-3">
                          {paymentMethods.map((method) => (
                            <div
                              key={method.id}
                              className="flex items-center justify-between p-3 border rounded-md bg-gray-50"
                            >
                              <div className="flex items-center space-x-3">
                                <CreditCard className="h-5 w-5 text-gray-500" />
                                <div>
                                  <div className="font-medium">
                                    {method.type} ending in {method.last4}
                                  </div>
                                  <div className="text-sm text-gray-600">Expires {method.expiry}</div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePaymentMethod(method.id)}
                                disabled={loadingBilling}
                              >
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button onClick={handleAddPaymentMethod} disabled={loadingBilling || !razorpayLoaded}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Payment Method
                      </Button>
                      {!razorpayLoaded && (
                        <p className="text-gray-500 text-center text-sm">Loading Razorpay script...</p>
                      )}
                      {saveSuccess && <p className="text-green-600 text-sm">Action successful!</p>}
                    </div>

                    <div className="border-t pt-6 mt-6 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Billing History</h3>
                      {billingHistory.length === 0 ? (
                        <div className="text-center py-4 text-gray-600">No billing history available.</div>
                      ) : (
                        <div className="space-y-3">
                          {billingHistory.map((bill) => (
                            <div
                              key={bill.id}
                              className="flex items-center justify-between p-3 border rounded-md bg-gray-50"
                            >
                              <div>
                                <div className="font-medium">{bill.description}</div>
                                <div className="text-sm text-gray-600">
                                  {bill.date} - ${bill.amount.toFixed(2)}
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                {bill.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
