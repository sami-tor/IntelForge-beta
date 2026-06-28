import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { ParticlesInit } from "@/components/particles-init"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Intel Forge - Data Beyond History",
  description: "Advanced Open Source Intelligence Gathering Platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Adobe Typekit - Oxanium Font */}
        <link rel="preconnect" href="https://use.typekit.net/" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/pgi3fvu.css" />
      </head>
      <body className="font-sans antialiased relative">
        <AuthProvider>
          <div id="particles-js" className="fixed inset-0 -z-10 pointer-events-none" />
          <ParticlesInit />
          {children}
          <Toaster position="bottom-right" theme="dark" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  )
}
