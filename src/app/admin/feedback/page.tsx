"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Trash2, Archive, CheckCircle } from "lucide-react"

interface Feedback {
  id: number
  userId?: number
  userEmail?: string
  name: string
  email: string
  subject: string
  message: string
  status: "new" | "read" | "resolved"
  rating?: number
  createdAt: string
}

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("new")

  useEffect(() => {
    fetchFeedback()
  }, [])

  const fetchFeedback = async () => {
    try {
      const response = await fetch("/api/admin/contact", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setFeedbacks(data.messages || [])
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      const response = await fetch("/api/admin/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: "reviewed" }),
      })

      if (response.ok) {
        fetchFeedback()
      } else {
        const data = await response.json()
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Failed to mark as read:", error)
      alert("Network error")
    }
  }

  const markAsResolved = async (id: number) => {
    try {
      const response = await fetch("/api/admin/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: "resolved" }),
      })

      if (response.ok) {
        fetchFeedback()
      } else {
        const data = await response.json()
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Failed to mark as resolved:", error)
      alert("Network error")
    }
  }

  const deleteFeedback = async (id: number) => {
    if (!confirm("Are you sure you want to delete this message?")) return

    try {
      const response = await fetch(`/api/admin/contact?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        fetchFeedback()
      } else {
        const data = await response.json()
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Failed to delete feedback:", error)
      alert("Network error")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-500/20 text-blue-600 border-blue-500/30"
      case "read":
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
      case "resolved":
        return "bg-green-500/20 text-green-600 border-green-500/30"
      default:
        return ""
    }
  }

  const filteredFeedbacks = feedbacks.filter(
    (f) => filterStatus === "all" || f.status === filterStatus
  )

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading feedback...</div>
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">User Feedback & Messages</h1>
        <p className="text-muted-foreground">Manage user feedback and contact form submissions</p>
      </div>

      <Card className="p-6 bg-blue-50/5 border-blue-500/20">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{feedbacks.filter((f) => f.status === "new").length}</div>
            <div className="text-sm text-muted-foreground">New Messages</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{feedbacks.filter((f) => f.status === "read").length}</div>
            <div className="text-sm text-muted-foreground">Read</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{feedbacks.filter((f) => f.status === "resolved").length}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        {["new", "read", "resolved", "all"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              filterStatus === status
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <div className="text-muted-foreground">No feedback found</div>
          </Card>
        ) : (
          filteredFeedbacks.map((feedback) => (
            <Card
              key={feedback.id}
              className={`p-6 border ${
                feedback.status === "new" ? "border-blue-500/30 bg-blue-50/5" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{feedback.subject}</h3>
                    <Badge className={`${getStatusColor(feedback.status)} border`}>
                      {feedback.status}
                    </Badge>
                    {feedback.rating && (
                      <Badge variant="outline">{feedback.rating}/5 ⭐</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    From: <span className="font-mono">{feedback.email}</span>
                    {feedback.name && ` (${feedback.name})`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(feedback.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg mb-4 text-sm whitespace-pre-wrap">
                {feedback.message}
              </div>

              <div className="flex gap-2">
                {feedback.status === "new" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsRead(feedback.id)}
                    className="gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Read
                  </Button>
                )}

                {feedback.status !== "resolved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsResolved(feedback.id)}
                    className="gap-2"
                  >
                    <Archive className="w-4 h-4" /> Mark as Resolved
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteFeedback(feedback.id)}
                  className="gap-2 ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
