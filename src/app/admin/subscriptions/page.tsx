"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2 } from "lucide-react"
import { SubscriptionModal } from "@/components/admin/subscription-modal"

interface Subscription {
  id: number
  name: string
  description: string
  price: number
  duration_value: number | null
  duration_unit: string | null
  is_lifetime: boolean
  features: string[]
  is_active: boolean
}

export default function SubscriptionsManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch("/api/admin/subscriptions", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setSubscriptions(data.subscriptions || [])
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error)
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return

    try {
      const response = await fetch(`/api/admin/subscriptions?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        fetchSubscriptions()
      }
    } catch (error) {
      console.error("Failed to delete subscription:", error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading subscriptions...</div>
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Subscription Management</h1>
          <p className="text-muted-foreground">Manage subscription plans and pricing</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Subscription
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptions.map((sub) => (
          <Card key={sub.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-1">{sub.name}</h3>
                {sub.is_lifetime && <Badge className="mb-2">Lifetime</Badge>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">${sub.price}</div>
                {!sub.is_lifetime && sub.duration_value && (
                  <div className="text-sm text-muted-foreground">
                    per {sub.duration_value} {sub.duration_unit}
                  </div>
                )}
              </div>
            </div>

            <p className="text-muted-foreground mb-4">{sub.description}</p>

            <div className="space-y-2 mb-6">
              {sub.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {feature}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setSelectedSubscription(sub)
                  setShowModal(true)
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(sub.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <SubscriptionModal
          subscription={selectedSubscription}
          onClose={() => {
            setShowModal(false)
            setSelectedSubscription(null)
          }}
          onSave={() => {
            fetchSubscriptions()
            setShowModal(false)
            setSelectedSubscription(null)
          }}
        />
      )}
    </div>
  )
}
