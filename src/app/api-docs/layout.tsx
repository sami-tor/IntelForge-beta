import Navbar from "@/components/navbar"

export const dynamic = "force-dynamic"

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
