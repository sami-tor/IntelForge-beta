"use client"

import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { Shield } from "lucide-react"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14 mt-8">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              <Shield className="w-3 h-3" />
              Legal
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">Privacy Policy</h1>
            <p className="text-zinc-500 text-sm">Last Updated: November 7, 2025</p>
          </div>

          <div className="space-y-5">
            {/* Introduction */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Introduction</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                IntelForge ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Open Source Intelligence (OSINT) platform.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </section>

            {/* 1. Information We Collect */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-5">1. Information We Collect</h2>
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-3">1.1 Personal Information</h3>
                  <p className="text-zinc-400 leading-relaxed mb-3">
                    We collect information that you voluntarily provide when you:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                    <li>Register for an account (email, username, password)</li>
                    <li>Subscribe to a paid plan (billing information via payment processor)</li>
                    <li>Contact us (name, email, message content)</li>
                    <li>Use our services (search queries, API usage)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-3">1.2 Automatically Collected Information</h3>
                  <p className="text-zinc-400 leading-relaxed mb-3">
                    When you access our Service, we automatically collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                    <li>IP address and location data</li>
                    <li>Browser type and version, device information</li>
                    <li>Usage data (pages visited, time spent, features used)</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-3">1.3 Search and Usage Data</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    We log search queries, API requests, and usage patterns for security, analytics, and service improvement purposes. We do NOT log the actual content of search results.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. How We Use Your Information */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">2. How We Use Your Information</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We use the information we collect for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>To provide, maintain, and improve our Service</li>
                <li>To process your transactions and manage your subscription</li>
                <li>To send you technical notices, updates, and security alerts</li>
                <li>To respond to your comments, questions, and customer service requests</li>
                <li>To monitor and analyze usage trends and preferences</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
                <li>To enforce our Terms of Service and protect our legal rights</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            {/* 3. Data Sharing */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">3. Data Sharing and Disclosure</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We do NOT sell your personal information. We may share your information in:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Service Providers:</strong> With third-party vendors (payment processing, hosting, analytics)</li>
                <li><strong>Legal Requirements:</strong> When required by law, subpoena, or legal process</li>
                <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
                <li><strong>Protection of Rights:</strong> To protect our rights, privacy, safety, or property</li>
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share specific information</li>
              </ul>
            </section>

            {/* 4. Data Security */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">4. Data Security</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We implement appropriate technical and organizational security measures:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Encryption of data in transit (HTTPS/TLS)</li>
                <li>Encrypted password storage (bcrypt hashing)</li>
                <li>Secure API key generation and storage</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and authentication mechanisms</li>
                <li>IP-based access restrictions (optional)</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means, we cannot guarantee absolute security.
              </p>
            </section>

            {/* 5. Data Retention */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">5. Data Retention</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We retain your personal information for as long as necessary to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Provide you with our services</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce our agreements</li>
                <li>Maintain security and prevent fraud</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-4">
                Search logs are retained for up to 90 days. Account data is retained until you request deletion.
              </p>
            </section>

            {/* 6. Your Privacy Rights */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">6. Your Privacy Rights</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Depending on your location, you may have:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to processing of your data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="text-zinc-400 leading-relaxed mt-4">
                To exercise these rights, contact us at <a href="mailto:privacy@osintsearch.online" className="text-red-400 hover:underline">privacy@osintsearch.online</a> or use our <a href="/about#contact" className="text-red-400 hover:underline">contact form</a>.
              </p>
            </section>

            {/* 7. Cookies */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">7. Cookies and Tracking</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We use cookies and similar tracking technologies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li><strong>Essential Cookies:</strong> Required for authentication and security</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Analytics Cookies:</strong> Understand how you use our Service</li>
                <li><strong>Device Fingerprinting:</strong> Track anonymous usage quotas</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-4">
                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features.
              </p>
            </section>

            {/* 8. Third-Party */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">8. Third-Party Services</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Our Service may contain links to third-party websites or integrate with third-party services. We are not responsible for the privacy practices of these third parties. Third-party services we may use include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Payment processors (Stripe, PayPal)</li>
                <li>Email service providers</li>
                <li>Cloud hosting providers</li>
                <li>Analytics services</li>
              </ul>
            </section>

            {/* 9. Children's Privacy */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">9. Children's Privacy</h2>
              <p className="text-zinc-400 leading-relaxed">
                Our Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If you believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            {/* 10. International Transfers */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">10. International Data Transfers</h2>
              <p className="text-zinc-400 leading-relaxed">
                Your information may be transferred to and maintained on servers outside your country. By using our Service, you consent to such transfers. We take appropriate safeguards to ensure your data is treated securely and in accordance with this Privacy Policy.
              </p>
            </section>

            {/* 11. Changes to Privacy Policy */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">11. Changes to This Privacy Policy</h2>
              <p className="text-zinc-400 leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically.
              </p>
            </section>

            {/* 12. Contact Us */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">12. Contact Us</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                If you have any questions about this Privacy Policy:
              </p>
              <ul className="space-y-2 text-zinc-400">
                <li>Email: <a href="mailto:privacy@osintsearch.online" className="text-red-400 hover:underline">privacy@osintsearch.online</a></li>
                <li>Contact Form: <a href="/about#contact" className="text-red-400 hover:underline">Submit a request</a></li>
                <li>DPO: <a href="mailto:dpo@osintsearch.online" className="text-red-400 hover:underline">dpo@osintsearch.online</a></li>
              </ul>
            </section>

            {/* GDPR/CCPA */}
            <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">GDPR & CCPA Compliance</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                <strong className="text-zinc-300">For EU Users (GDPR):</strong> We comply with the General Data Protection Regulation (GDPR). You have the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal data.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                <strong className="text-zinc-300">For California Users (CCPA):</strong> We comply with the California Consumer Privacy Act (CCPA). You have the right to know what personal information is collected, delete personal information, opt-out of the sale of personal information (we do not sell your data), and non-discrimination.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
