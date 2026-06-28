"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, CheckCircle, AlertCircle } from "lucide-react"

interface TwoFactorSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TwoFactorSetupModal({ isOpen, onClose, onSuccess }: TwoFactorSetupModalProps) {
  const [step, setStep] = useState<"start" | "qr" | "verify">("start")
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string>("")
  const [secret, setSecret] = useState<string>("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleStartSetup = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to setup 2FA")
      }

      setQrCode(data.qrCode)
      setSecret(data.secret)
      setBackupCodes(data.backupCodes || [])
      setStep("qr")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error setting up 2FA")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          secret,
          token: verifyCode,
          backupCodes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Verification failed")
      }

      setStep("verify")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const downloadBackupCodes = () => {
    const content = backupCodes.join("\n")
    const element = document.createElement("a")
    element.setAttribute("href", `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`)
    element.setAttribute("download", "2fa-backup-codes.txt")
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleClose = () => {
    setStep("start")
    setQrCode("")
    setSecret("")
    setBackupCodes([])
    setVerifyCode("")
    setError("")
    setShowBackupCodes(false)
    onClose()
  }

  const handleSuccess = () => {
    handleClose()
    onSuccess()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Secure your account with an additional layer of protection
          </DialogDescription>
        </DialogHeader>

        {step === "start" && (
          <div className="space-y-6 py-4">
            <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground/80">
                  <p className="font-semibold mb-1">⚠️ Important</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Save backup codes in a safe place</li>
                    <li>You'll need a code to login after enabling</li>
                    <li>Download codes before closing this dialog</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <p className="text-sm text-foreground/70">
                Two-factor authentication adds extra security to your account. You'll need to enter a code from your phone when logging in.
              </p>

              <div className="flex gap-3">
                <Button onClick={handleStartSetup} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Get Started
                </Button>
                <Button onClick={handleClose} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "qr" && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>1. Scan QR Code</Label>
              <p className="text-xs text-foreground/70">
                Use Google Authenticator, Microsoft Authenticator, or Authy to scan:
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {qrCode ? (
                  <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
                ) : (
                  <div className="text-center">Loading...</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>2. Or enter manually</Label>
              <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                {secret}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(secret, "secret")}
                className="w-full"
              >
                {copiedCode === "secret" ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedCode === "secret" ? "Copied!" : "Copy"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>3. Save Backup Codes</Label>
              <p className="text-xs text-foreground/70 mb-2">
                If you lose access to your authenticator, use these codes to login:
              </p>
              <Card className="p-3 max-h-40 overflow-y-auto bg-muted/50">
                <div className="space-y-1">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono p-1">
                      <span>{code}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(code, `code-${idx}`)}
                      >
                        {copiedCode === `code-${idx}` ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadBackupCodes}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Codes
              </Button>
            </div>

            <Button onClick={() => setStep("verify")} className="w-full">
              Next: Verify Code
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-6 py-4">
            <p className="text-sm text-foreground/70">
              Enter the 6-digit code from your authenticator app to confirm setup:
            </p>

            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                  setVerifyCode(val)
                }}
                maxLength={6}
                className="text-center text-2xl letter-spacing tracking-widest font-mono"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Verify & Enable
              </Button>
              <Button onClick={() => setStep("qr")} variant="outline">
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && error === "" && verifyCode.length === 6 && (
          <div className="space-y-4 py-4">
            <Card className="p-4 bg-green-500/10 border-green-500/30">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-600">
                  <p className="font-semibold">✅ Two-Factor Authentication Enabled!</p>
                  <p className="text-xs mt-1">Your account is now protected. You'll need to enter a code on your next login.</p>
                </div>
              </div>
            </Card>

            <Button onClick={handleSuccess} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
