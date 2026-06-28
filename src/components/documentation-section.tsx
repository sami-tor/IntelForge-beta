import { Book, Code, Terminal, FileText } from "lucide-react"

export default function DocumentationSection() {
  const docs = [
    {
      icon: Book,
      title: "Getting Started",
      description: "Learn the basics and start your first investigation in minutes.",
      link: "#",
    },
    {
      icon: Code,
      title: "API Reference",
      description: "Complete API documentation with code examples and use cases.",
      link: "#",
    },
    {
      icon: Terminal,
      title: "CLI Tools",
      description: "Command-line interface for advanced users and automation.",
      link: "#",
    },
    {
      icon: FileText,
      title: "Best Practices",
      description: "Industry-standard methodologies and investigation techniques.",
      link: "#",
    },
  ]

  return (
    <section className="py-20 md:py-32 relative bg-card/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Documentation
              </span>
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto leading-relaxed">
              Comprehensive guides and resources to help you master the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {docs.map((doc, index) => (
              <a
                key={index}
                href={doc.link}
                className="group relative bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <doc.icon className="text-background" size={24} />
                </div>

                <h3 className="text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors duration-300">
                  {doc.title}
                </h3>

                <p className="text-sm text-foreground/60 leading-relaxed">{doc.description}</p>

                <div className="mt-4 text-primary text-sm font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                  Learn more →
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
