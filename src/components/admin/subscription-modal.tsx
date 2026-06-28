"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { X, Plus, Trash2 } from "lucide-react"

interface Subscription {
  id?: number
  name: string
  description: string
  price: number
  duration_value: number | null
  duration_unit: string | null
  is_lifetime: boolean
  features: string[]
}

interface SubscriptionModalProps {
  subscription: Subscription | null
  onClose: () => void
  onSave: () => void
}

export function SubscriptionModal({ subscription, onClose, onSave }: SubscriptionModalProps) {
  const [name, setName] = useState(subscription?.name || "")
  const [description, setDescription] = useState(subscription?.description || "")
  const [price, setPrice] = useState(subscription?.price || 0)
  const [durationValue, setDurationValue] = useState(subscription?.duration_value || 1)
  const [durationUnit, setDurationUnit] = useState(subscription?.duration_unit || "month")
  const [isLifetime, setIsLifetime] = useState(subscription?.is_lifetime || false)
  const [features, setFeatures] = useState<string[]>(subscription?.features || [""])

  const handleAddFeature = () => {
    setFeatures([...features, ""])
  }

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...features]
    newFeatures[index] = value
    setFeatures(newFeatures)
  }

  const handleSave = async () => {
    const data = {
      name,
      description,
      price,
      durationValue: isLifetime ? null : durationValue,
      durationUnit: isLifetime ? null : durationUnit,
      isLifetime,
      features: features.filter((f) => f.trim() !== ""),
    }

    const url = "/api/admin/subscriptions"
    const method = subscription?.id ? "PUT" : "POST"
    const body = subscription?.id ? { ...data, id: subscription.id } : data

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{subscription ? "Edit" : "Add"} Subscription</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>

          <div>
            <Label>Price ($)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number.parseFloat(e.target.value))}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <input type="checkbox" checked={isLifetime} onChange={(e) => setIsLifetime(e.target.checked)} />
              Lifetime Subscription
            </Label>
          </div>

          {!isLifetime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration Value</Label>
                <Input
                  type="number"
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number.parseInt(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Duration Unit</Label>
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Features</Label>
              <Button size="sm" variant="outline" onClick={handleAddFeature}>
                <Plus className="w-4 h-4 mr-1" />
                Add Feature
              </Button>
            </div>
            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input value={feature} onChange={(e) => handleFeatureChange(index, e.target.value)} />
                  <Button size="sm" variant="destructive" onClick={() => handleRemoveFeature(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1">
              {subscription ? "Update" : "Create"} Subscription
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
