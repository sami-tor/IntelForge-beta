"use client"

import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { Scale } from "lucide-react"

export default function AcceptableUsePage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14 mt-8">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              <Scale className="w-3 h-3" />
              Legal
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">Acceptable Use Policy</h1>
            <p className="text-zinc-500 text-sm">Last Updated: November 7, 2025</p>
          </div>

          <div className="space-y-5">
            {/* Introduction */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Introduction</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                This Acceptable Use Policy governs your use of IntelForge's OSINT platform. By using our Service, you agree to comply with this Policy.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                IntelForge is designed for legitimate security research, investigations, and intelligence gathering by authorized professionals. Any misuse is strictly prohibited and may result in immediate account termination and legal action.
              </p>
            </section>

            {/* Permitted Uses */}
            <section className="rounded-2xl border border-green-500/20 bg-green-500/5 p-7">
              <h2 className="text-xl font-bold text-green-400 mb-4">Permitted Uses</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                You may use IntelForge for the following lawful purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Security Research:</strong> Identifying vulnerabilities, data breaches, and security threats</li>
                <li><strong>Fraud Investigation:</strong> Investigating fraudulent activities and scams</li>
                <li><strong>Law Enforcement:</strong> Authorized investigations by government agencies</li>
                <li><strong>Corporate Security:</strong> Protecting organizations from cyber threats and data leaks</li>
                <li><strong>Journalism:</strong> Investigative journalism and public interest reporting</li>
                <li><strong>Academic Research:</strong> Educational and research purposes in cybersecurity</li>
                <li><strong>Due Diligence:</strong> Background checks and risk assessment for business purposes</li>
                <li><strong>Threat Intelligence:</strong> Monitoring and analyzing cyber threats and threat actors</li>
              </ul>
            </section>

            {/* Prohibited Uses */}
            <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7">
              <h2 className="text-xl font-bold text-red-400 mb-5">Prohibited Uses</h2>
              <p className="text-zinc-400 leading-relaxed mb-5">
                You may NOT use IntelForge for any of the following purposes:
              </p>
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Illegal Activities</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-4 text-sm">
                    <li>Any activity that violates local, national, or international law</li>
                    <li>Hacking, unauthorized access, or computer fraud</li>
                    <li>Identity theft or impersonation of others</li>
                    <li>Stalking, harassment, or threatening behavior</li>
                    <li>Blackmail, extortion, or coercion</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Malicious Intent</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-4 text-sm">
                    <li>Doxxing (publishing private information without consent)</li>
                    <li>Swatting or making false reports to authorities</li>
                    <li>Revenge porn or non-consensual intimate image sharing</li>
                    <li>Cyberbullying or online harassment of any kind</li>
                    <li>Creating or distributing malware, viruses, or exploits</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Privacy Violations</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-4 text-sm">
                    <li>Unauthorized surveillance or monitoring of individuals</li>
                    <li>Collecting personal information for spam or phishing campaigns</li>
                    <li>Selling or trading personal data obtained from our Service</li>
                    <li>Violating data protection laws (GDPR, CCPA, etc.)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Service Abuse</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-4 text-sm">
                    <li>Scraping, crawling, or automated data collection beyond API limits</li>
                    <li>Circumventing rate limits, quotas, or access controls</li>
                    <li>Sharing or reselling access to your account or API keys</li>
                    <li>Reverse engineering or attempting to extract our databases</li>
                    <li>Overloading or disrupting our infrastructure</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-300 mb-2">Discrimination & Harm</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-4 text-sm">
                    <li>Targeting individuals based on race, religion, gender, sexual orientation, or disability</li>
                    <li>Facilitating hate crimes or violence against any group</li>
                    <li>Child exploitation or abuse material (CSAM)</li>
                    <li>Human trafficking or modern slavery facilitation</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Responsible Use */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Responsible Use Guidelines</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                When using IntelForge, you should:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Verify information from multiple sources before taking action</li>
                <li>Respect privacy rights and data protection laws applicable to your jurisdiction</li>
                <li>Use information only for its intended legitimate purpose</li>
                <li>Secure your account and API keys to prevent unauthorized access</li>
                <li>Report security vulnerabilities responsibly through our contact form</li>
                <li>Comply with your organization's policies and ethical guidelines</li>
                <li>Consider the potential impact of your investigations on individuals</li>
                <li>Document your methodology and maintain audit trails of all activities</li>
              </ul>
            </section>

            {/* Law Enforcement */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Law Enforcement & Government Use</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Law enforcement agencies and government entities must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Use the Service only for authorized investigations with proper legal authority</li>
                <li>Comply with applicable laws and regulations in your jurisdiction</li>
                <li>Obtain proper warrants or legal authority where required</li>
                <li>Protect the confidentiality of ongoing investigations</li>
                <li>Follow chain of custody procedures for any evidence obtained</li>
                <li>Contact us for specialized government and enterprise plans</li>
              </ul>
            </section>

            {/* Corporate */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Corporate & Enterprise Use</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Organizations using IntelForge must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Ensure employees are trained on proper use and legal compliance</li>
                <li>Implement internal policies governing OSINT activities</li>
                <li>Maintain logs and audit trails of all investigations conducted</li>
                <li>Respect employee privacy rights and applicable labor laws</li>
                <li>Use information only for legitimate business purposes</li>
                <li>Comply with industry-specific regulations (HIPAA, FINRA, etc.)</li>
              </ul>
            </section>

            {/* Reporting */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Reporting Violations</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                If you become aware of any violation of this Policy, please report it immediately:
              </p>
              <ul className="space-y-2 text-zinc-400">
                <li>Email: <a href="mailto:abuse@osintsearch.online" className="text-red-400 hover:underline">abuse@osintsearch.online</a></li>
                <li>Web: <a href="/about#contact" className="text-red-400 hover:underline">Contact Form</a></li>
                <li className="text-zinc-500 text-sm">For immediate threats, contact local law enforcement first.</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-4">
                We take all reports seriously and investigate promptly. Reports can be made anonymously.
              </p>
            </section>

            {/* Consequences */}
            <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Consequences of Violations</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Violations of this Policy may result in:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Warning:</strong> First-time minor violations may result in a warning</li>
                <li><strong>Temporary Suspension:</strong> Serious violations may result in account suspension</li>
                <li><strong>Permanent Ban:</strong> Severe or repeated violations result in permanent termination</li>
                <li><strong>Legal Action:</strong> Criminal activities will be reported to law enforcement</li>
                <li><strong>Civil Liability:</strong> You may be held liable for damages caused by misuse</li>
                <li><strong>No Refund:</strong> Terminated accounts are not eligible for refunds</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-4">
                We reserve the right to take immediate action without prior notice in cases of severe violations.
              </p>
            </section>

            {/* Data Deletion */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Data Deletion Requests</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                If you believe your personal information appears in our database and wish to have it removed:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Submit a deletion request via our <a href="/about#contact" className="text-red-400 hover:underline">contact form</a></li>
                <li>Provide proof of identity and specify the data to be removed</li>
                <li>We will review your request within 30 days</li>
                <li>Note: We aggregate publicly available data; removal from our database does not remove it from public sources</li>
              </ul>
            </section>

            {/* Ethical Considerations */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Ethical Considerations</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                As an OSINT professional, consider these ethical principles:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Proportionality:</strong> Use methods proportionate to the investigation's purpose</li>
                <li><strong>Necessity:</strong> Collect only information necessary for your legitimate purpose</li>
                <li><strong>Transparency:</strong> Be transparent about your methods when appropriate</li>
                <li><strong>Accountability:</strong> Take responsibility for your actions and their consequences</li>
                <li><strong>Respect:</strong> Respect human dignity and fundamental privacy rights</li>
                <li><strong>Accuracy:</strong> Verify information and correct errors when discovered</li>
                <li><strong>Minimization:</strong> Minimize harm to individuals, organizations, and communities</li>
              </ul>
            </section>

            {/* Contact */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Contact Us</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Questions about this Policy? Contact us:
              </p>
              <ul className="space-y-2 text-zinc-400">
                <li>General: <a href="mailto:support@osintsearch.online" className="text-red-400 hover:underline">support@osintsearch.online</a></li>
                <li>Abuse: <a href="mailto:abuse@osintsearch.online" className="text-red-400 hover:underline">abuse@osintsearch.online</a></li>
                <li>Legal: <a href="mailto:legal@osintsearch.online" className="text-red-400 hover:underline">legal@osintsearch.online</a></li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
