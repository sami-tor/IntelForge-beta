import Navbar from "@/components/navbar"
import AboutSection from "@/components/about-section"
import Footer from "@/components/footer"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16">
        <AboutSection />
      </div>
      <Footer />
    </main>
  )
}
