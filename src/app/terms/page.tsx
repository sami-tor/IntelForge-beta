'use client'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14 mt-8">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              Legal
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">Terms of Service</h1>
            <p className="text-zinc-500 text-sm">Last Updated: November 7, 2025</p>
          </div>

          {/* Content */}
          <div className="space-y-5">
            {/* 1. Agreement to Terms */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">1. Agreement to Terms</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                By accessing or using IntelForge ("Service"), you agree to be bound by these Terms of Service ("Terms").
                If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                IntelForge is an Open Source Intelligence (OSINT) platform designed for security professionals,
                researchers, and authorized users to conduct legitimate investigations.
              </p>
            </section>

            {/* 2. Use License */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">2. Use License</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Permission is granted to temporarily access the Service for personal, non-commercial transitory viewing only.
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose without explicit authorization</li>
                <li>Attempt to reverse engineer any software contained on IntelForge</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              </ul>
            </section>

            {/* 3. Acceptable Use Policy */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">3. Acceptable Use Policy</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                You agree to use IntelForge only for lawful purposes and in accordance with these Terms. You agree NOT to use the Service:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
                <li>To violate any international, federal, provincial, or state regulations</li>
                <li>To infringe upon or violate our intellectual property rights or others' rights</li>
                <li>To harass, abuse, insult, harm, defame, slander, disparage, or discriminate</li>
                <li>To submit false or misleading information</li>
                <li>To upload or transmit viruses or any other type of malicious code</li>
                <li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
                <li>For any obscene or immoral purpose</li>
                <li>To interfere with or circumvent the security features of the Service</li>
              </ul>
            </section>

            {/* 4. User Accounts */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">4. User Accounts</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                When you create an account with us, you must provide accurate, complete, and current information at all times.
                Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                You are responsible for safeguarding your password. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>
            </section>

            {/* 5. Subscriptions & Billing */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">5. Subscriptions & Billing</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-2">5.1 Subscription Plans</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    IntelForge offers various subscription tiers with different features and search quotas. Details are available on our Pricing page.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-2">5.2 Billing</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Subscription fees are billed in advance on a monthly or annual basis. You will be charged automatically at the start of each billing period.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-2">5.3 Refunds</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Refunds are handled on a case-by-case basis. Contact our support team for refund requests.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-300 mb-2">5.4 Cancellation</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    You may cancel your subscription at any time from your dashboard. Cancellation will take effect at the end of the current billing period.
                  </p>
                </div>
              </div>
            </section>

            {/* 6. API Usage */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">6. API Usage</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Premium users with API access must comply with the following:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 ml-4">
                <li>Respect rate limits assigned to your subscription tier</li>
                <li>Keep your API keys confidential and secure</li>
                <li>Do not share API keys with unauthorized parties</li>
                <li>Report any security vulnerabilities immediately</li>
                <li>Use the API only for authorized purposes</li>
              </ul>
            </section>

            {/* 7. Data & Privacy */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">7. Data & Privacy</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                IntelForge aggregates publicly available data from various sources. We do not guarantee the accuracy, completeness, or timeliness of any data provided through the Service.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                For information about how we collect, use, and protect your personal information, please see our <a href="/privacy" className="text-red-400 hover:underline">Privacy Policy</a>.
              </p>
            </section>

            {/* 8. Intellectual Property */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">8. Intellectual Property</h2>
              <p className="text-zinc-400 leading-relaxed">
                The Service and its original content, features, and functionality are and will remain the exclusive property of IntelForge and its licensors.
                The Service is protected by copyright, trademark, and other laws.
              </p>
            </section>

            {/* 9. Disclaimer */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">9. Disclaimer</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. INTELFORGE MAKES NO WARRANTIES,
                EXPRESSED OR IMPLIED, AND HEREBY DISCLAIMS AND NEGATES ALL OTHER WARRANTIES INCLUDING, WITHOUT
                LIMITATION, IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                OR NON-INFRINGEMENT OF INTELLECTUAL PROPERTY OR OTHER VIOLATION OF RIGHTS.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                IntelForge does not warrant or make any representations concerning the accuracy, likely results,
                or reliability of the use of the materials on its website or otherwise relating to such materials.
              </p>
            </section>

            {/* 10. Limitation of Liability */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">10. Limitation of Liability</h2>
              <p className="text-zinc-400 leading-relaxed">
                IN NO EVENT SHALL INTELFORGE OR ITS SUPPLIERS BE LIABLE FOR ANY DAMAGES (INCLUDING, WITHOUT
                LIMITATION, DAMAGES FOR LOSS OF DATA OR PROFIT, OR DUE TO BUSINESS INTERRUPTION) ARISING OUT
                OF THE USE OR INABILITY TO USE THE SERVICE, EVEN IF INTELFORGE OR AN AUTHORIZED REPRESENTATIVE
                HAS BEEN NOTIFIED ORALLY OR IN WRITING OF THE POSSIBILITY OF SUCH DAMAGE.
              </p>
            </section>

            {/* 11. Termination */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">11. Termination</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or contact support.
              </p>
            </section>

            {/* 12. Governing Law */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">12. Governing Law</h2>
              <p className="text-zinc-400 leading-relaxed">
                These Terms shall be governed and construed in accordance with applicable international laws,
                without regard to its conflict of law provisions.
              </p>
            </section>

            {/* 13. Changes to Terms */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">13. Changes to Terms</h2>
              <p className="text-zinc-400 leading-relaxed">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
                If a revision is material, we will try to provide at least 30 days' notice prior to any new
                terms taking effect.
              </p>
            </section>

            {/* 14. Contact Us */}
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-7">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">14. Contact Us</h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <ul className="space-y-2 text-zinc-400">
                <li>Email: legal@osintsearch.online</li>
                <li>Website: <a href="/about#contact" className="text-red-400 hover:underline">Contact Form</a></li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}

