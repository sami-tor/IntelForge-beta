"use client"

import { Check, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const plans = [
  {
    name: "Starter",
    description: "For beginners and hobbyist researchers",
    price: { monthly: 50, annual: 500 },
    features: [
      "500 searches per month",
      "Core data sources (Logs, ULP, Stealer)",
      "Basic selectors (email, domain, IP, URL)",
      "Up to 10 results per search",
      "30-day data retention",
      "Email support",
    ],
    popular: false,
    accent: "#64748b",
  },
  {
    name: "Security Analyst",
    description: "For professional researchers and investigators",
    price: { monthly: 300, annual: 3000 },
    features: [
      "1,500 searches per month",
      "All data sources included",
      "Advanced selectors (crypto, phone, CIDR)",
      "Unlimited results per search",
      "Unlimited data retention",
      "Priority support (2-4 hour response)",
      "Search history & exports",
      "Advanced analytics",
    ],
    popular: true,
    accent: "#ef4444",
  },
  {
    name: "API Access",
    description: "For developers and automated integrations",
    price: { monthly: 1499, annual: 14990 },
    features: [
      "Unlimited searches & users",
      "All data sources + custom feeds",
      "Full REST API access",
      "24/7 dedicated support",
      "Custom integrations",
      "Advanced team features",
      "SLA guarantee",
      "Priority processing queue",
    ],
    popular: false,
    accent: "#22c55e",
  },
]

const enterprise = {
  name: "Enterprise",
  description: "Government, law enforcement, and large organizations",
  features: [
    "Unlimited everything",
    "Custom data source integration",
    "Dedicated account manager",
    "Custom SLA & compliance",
    "White-label options",
    "Advanced security features",
    "On-premise deployment option",
    "Volume pricing — contact for quote",
  ],
  accent: "#f59e0b",
}

export default function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              <Zap className="w-3 h-3" />
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">
              Choose your intelligence plan
            </h2>
            <p className="text-zinc-500 text-sm max-w-lg leading-relaxed mb-8">
              Flexible plans for individual researchers and enterprise teams. All prices in USD.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              <button onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  billing === "monthly"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}>
                Monthly
              </button>
              <button onClick={() => setBilling("annual")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  billing === "annual"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}>
                Annual
                <span className="ml-2 text-[10px] text-red-500 font-semibold">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Plans grid */}
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan, i) => (
              <div key={i}
                className={`relative rounded-2xl border transition-all duration-300 p-8 ${
                  plan.popular
                    ? "border-red-500/40 bg-zinc-900/60 shadow-lg shadow-red-500/10"
                    : "border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700/60"
                }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider border border-red-400/50">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: plan.accent }} />
                  <h3 className="text-lg font-bold text-zinc-100 mb-1">{plan.name}</h3>
                  <p className="text-xs text-zinc-500">{plan.description}</p>
                </div>

                <div className="mb-7">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-zinc-100">${plan.price[billing]}</span>
                    <span className="text-zinc-600 text-sm">/{billing === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  {billing === "annual" && (
                    <p className="text-[10px] text-zinc-600 mt-1">Billed annually</p>
                  )}
                </div>

                <Button
                  className={`w-full mb-7 h-11 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-red-500 hover:bg-red-600 text-white border border-red-500/50 shadow-lg shadow-red-500/20"
                      : "bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200 border border-zinc-700/40"
                  }`}>
                  Get Started
                </Button>

                <div className="space-y-3">
                  {plan.features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${plan.accent}15`, border: `1px solid ${plan.accent}40` }}>
                        <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                      </div>
                      <span className="text-xs text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise card */}
          <div className="mt-6 relative rounded-2xl border border-amber-500/30 bg-zinc-900/30 p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle at top right, #f59e0b10 0%, transparent 60%)" }} />
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <h3 className="text-xl font-bold text-zinc-100">{enterprise.name}</h3>
                </div>
                <p className="text-zinc-500 text-sm mb-4">{enterprise.description}</p>
                <div className="grid grid-cols-2 gap-2">
                  {enterprise.features.slice(0, 4).map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center md:border-l md:border-zinc-800 md:pl-8">
                <p className="text-2xl font-bold text-amber-400 mb-1">Custom Pricing</p>
                <p className="text-zinc-500 text-xs mb-6">Volume discounts and custom SLAs available</p>
                <Button className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold h-11 px-8 rounded-xl border border-amber-400/50 w-full md:w-auto">
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
