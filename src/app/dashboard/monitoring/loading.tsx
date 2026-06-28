import { Loader2, Shield } from "lucide-react"

export default function MonitoringLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <Shield className="w-16 h-16 text-primary/30 mx-auto" />
          <Loader2 className="w-8 h-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-muted-foreground">Loading monitoring data...</p>
      </div>
    </div>
  )
}

