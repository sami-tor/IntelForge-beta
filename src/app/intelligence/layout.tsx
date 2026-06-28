import DashboardNavbar from "@/components/dashboard-navbar"
import { IntelSidebar, IntelMobileNav } from "@/components/intelligence/intel-sidebar"

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <DashboardNavbar />
      <div className="flex flex-1 pt-16 overflow-hidden min-h-0">
        <IntelSidebar />
        <div className="relative z-10 flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          <IntelMobileNav />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
