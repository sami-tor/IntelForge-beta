import Navbar from "@/components/navbar"
import HeroSection from "@/components/hero-section"
import TrustedCompanies from "@/components/trusted-companies"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 relative">
      <Navbar />
      <HeroSection />
      <TrustedCompanies />
      <Footer />
    </main>
  )
}
