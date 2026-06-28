import Navbar from "@/components/navbar"
import DocumentationSection from "@/components/documentation-section"
import Footer from "@/components/footer"

export default function DocumentationPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <DocumentationSection />
      </div>
      <Footer />
    </main>
  )
}
