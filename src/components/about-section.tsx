"use client"

import { Database, Zap, Lock, Shield, ArrowRight, Mail, MessageSquare, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AboutSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    messageType: "feedback",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMessage(null)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitMessage({ type: "success", text: data.message })
        setFormData({ name: "", email: "", messageType: "feedback", message: "" })
      } else {
        setSubmitMessage({ type: "error", text: data.error || "Failed to submit" })
      }
    } catch {
      setSubmitMessage({ type: "error", text: "Network error. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  const features = [
    {
      icon: Database,
      title: "268 Billion+ Records",
      description: "Massive indexed dataset spanning domains, emails, IPs, URLs, hashes, and breach data — refreshed continuously.",
    },
    {
      icon: Zap,
      title: "Sub-Second Search",
      description: "Advanced indexing and query optimization deliver results in milliseconds. No waiting for intelligence.",
    },
    {
      icon: Shield,
      title: "Threat Actor Tracking",
      description: "Dedicated APT profiles, campaign tracking, and known exploited vulnerabilities — all in one view.",
    },
    {
      icon: Lock,
      title: "Secure & Private",
      description: "Your searches are encrypted and never shared. We maintain strict data handling practices for researcher privacy.",
    },
  ]

  return (
    <section className="py-20">
      {/* ─── Why IntelForge ─── */}
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-14">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              Why IntelForge
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">
              Built for threat intelligence professionals
            </h2>
            <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">
              Trusted by security researchers, investigators, and analysts worldwide for comprehensive OSINT operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index}
                className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 hover:border-zinc-700/60 transition-all duration-300">
                <div className="flex items-start gap-5">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-all">
                    <feature.icon className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-200 mb-2">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Contact Form ─── */}
      <div className="container mx-auto px-4 lg:px-8 mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800/60 bg-zinc-900/40 p-10 backdrop-blur">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top, #ef444410 0%, transparent 60%)" }} />
            <div className="relative z-10">
              <div className="flex flex-col items-center text-center mb-8">
                <h3 className="text-2xl font-bold text-zinc-100 mb-2">Get In Touch</h3>
                <p className="text-zinc-500 text-sm">Send feedback, request support, or submit a data deletion request</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-zinc-500 uppercase tracking-wider">Name</Label>
                    <Input id="name" type="text" placeholder="Your name" value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                      className="bg-zinc-900/60 border-zinc-800/60 text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-zinc-500 uppercase tracking-wider">Email</Label>
                    <Input id="email" type="email" placeholder="your@email.com" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} required
                      className="bg-zinc-900/60 border-zinc-800/60 text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/40" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="messageType" className="text-xs text-zinc-500 uppercase tracking-wider">Message Type</Label>
                  <select id="messageType" value={formData.messageType}
                    onChange={(e) => setFormData({ ...formData, messageType: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 text-sm">
                    <option value="feedback">Feedback</option>
                    <option value="contact">Contact / Support</option>
                    <option value="deletion_request">Data Deletion Request</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs text-zinc-500 uppercase tracking-wider">Message</Label>
                  <textarea id="message" rows={5} placeholder="Your message here..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })} required
                    className="w-full px-3 py-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 text-sm resize-none" />
                </div>

                {submitMessage && (
                  <div className={`p-4 rounded-xl text-sm ${
                    submitMessage.type === "success"
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}>
                    {submitMessage.text}
                  </div>
                )}

                <Button type="submit" disabled={submitting}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold h-11 rounded-xl border border-red-500/50">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">◌</span> Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {formData.messageType === "feedback" && <MessageSquare className="w-4 h-4" />}
                      {formData.messageType === "contact" && <Mail className="w-4 h-4" />}
                      {formData.messageType === "deletion_request" && <Trash2 className="w-4 h-4" />}
                      Submit {formData.messageType === "deletion_request" ? "Request" : "Message"}
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
