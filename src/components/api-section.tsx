"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export default function ApiSection() {
  const [copied, setCopied] = useState(false)

  const codeExample = `curl -X POST https://api.intelforge.com/v1/search \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "example.com",
    "type": "domain",
    "depth": "full"
  }'`

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExample)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="py-20 md:py-32 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Powerful API
                </span>
              </h2>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Integrate OSINT capabilities directly into your applications with our RESTful API. Simple, fast, and
                reliable.
              </p>

              <div className="space-y-4">
                {[
                  "RESTful API with JSON responses",
                  "Rate limiting: 1000 requests/hour",
                  "WebSocket support for real-time data",
                  "Comprehensive error handling",
                  "Multiple authentication methods",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-primary to-secondary rounded-full"></div>
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition-opacity duration-500"></div>

              <div className="relative bg-card border border-primary/30 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-muted border-b border-border">
                  <span className="text-sm font-semibold text-foreground">API Example</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-primary text-sm transition-all duration-300"
                  >
                    {copied ? (
                      <>
                        <Check size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="p-6 overflow-x-auto">
                  <pre className="text-sm text-primary/90 font-mono leading-relaxed">{codeExample}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
