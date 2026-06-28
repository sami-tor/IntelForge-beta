import Navbar from "@/components/navbar"
import PricingSection from "@/components/pricing-section"
import Footer from "@/components/footer"

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16">
        <PricingSection />
      </div>
      <Footer />
    </main>
  )
}
