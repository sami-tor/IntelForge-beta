'use client'

import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Search, Shield, Zap, FileText, Lock, Unlock } from 'lucide-react'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'

export default function HelpPage() {
  const { user, loading } = useAuth()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']))
  
  // Determine user type
  const getUserType = () => {
    if (!user) return 'unregistered'
    if (user.role === 'admin') return 'admin'
    if (user.isLifetime || ['starter', 'professional', 'enterprise', 'api_access'].includes((user.subscriptionType || '').toLowerCase())) {
      return 'premium'
    }
    return 'free'
  }

  const userType = getUserType()

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14 mt-8">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              Documentation
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">Help & Documentation</h1>
            <p className="text-zinc-500 text-sm max-w-md">
              Complete guide to using IntelForge OSINT Platform
            </p>
            {user && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="text-sm text-zinc-400">Your Access Level:</span>
                <span className="text-sm font-bold text-red-400 uppercase">{userType}</span>
              </div>
            )}
          </div>

          {/* Getting Started */}
          <Section
            id="getting-started"
            title="Getting Started"
            expanded={expandedSections.has('getting-started')}
            onToggle={() => toggleSection('getting-started')}
          >
            <div className="space-y-6">
              {/* Unregistered Users */}
              {userType === 'unregistered' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Welcome, Visitor!
                  </h3>
                  <div className="space-y-4 text-foreground/80">
                    <p className="leading-relaxed">
                      You're currently browsing as an <strong>unregistered user</strong>. Here's what you can do:
                    </p>
                    
                    <div className="bg-card/50 rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-foreground mb-2">✅ What You CAN Do:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• Browse the platform and explore features</li>
                        <li>• Perform limited searches (10 searches per session)</li>
                        <li>• View search results (all content is blurred)</li>
                        <li>• See basic file information</li>
                      </ul>
                    </div>

                    <div className="bg-card/50 rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-foreground mb-2">❌ What You CANNOT Do:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• View actual file content (everything is blurred)</li>
                        <li>• Access premium data sources</li>
                        <li>• Use advanced selectors (crypto, phone numbers, etc.)</li>
                        <li>• Download or export results</li>
                        <li>• Use API access</li>
                      </ul>
                    </div>

                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                      <p className="font-semibold text-primary mb-2">🎯 Ready to unlock full access?</p>
                      <p className="text-sm mb-3">Create a FREE account to get 50 searches per month with unblurred results!</p>
                      <a href="/auth/register" className="inline-block px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition">
                        Create Free Account →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Free Users */}
              {userType === 'free' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-green-300 mb-4 flex items-center gap-2">
                    <Unlock className="w-5 h-5" />
                    Free Account Features
                  </h3>
                  <div className="space-y-4 text-foreground/80">
                    <p className="leading-relaxed">
                      You have a <strong>Free Account</strong>. Here's what you can access:
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-card/50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-300 mb-3 flex items-center gap-2">
                          ✅ Included Features
                        </h4>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>50 searches per month</strong> - Resets monthly</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>10 results per search</strong> - Best matches shown first</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>5 results per file</strong> - Multiple files searchable</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>Unblurred results</strong> - See actual content</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>Basic selectors</strong> - Email, Domain, URL, IP</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span><strong>File preview</strong> - View 50 lines of context</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-card/50 rounded-lg p-4">
                        <h4 className="font-semibold text-red-300 mb-3 flex items-center gap-2">
                          🔒 Premium Only
                        </h4>
                        <ul className="space-y-2 text-sm text-foreground/60">
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>Unlimited searches</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>Unlimited results per search</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>Advanced selectors (crypto, phone, SSN)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>Premium data sources</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>API access</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>Priority support</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                      <p className="font-semibold text-primary mb-2">💎 Want unlimited access?</p>
                      <p className="text-sm mb-3">Upgrade to Premium starting at $50/month for 500 searches and advanced features!</p>
                      <a href="/pricing" className="inline-block px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition">
                        View Pricing Plans →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Premium/Admin Users */}
              {(userType === 'premium' || userType === 'admin') && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {userType === 'admin' ? 'Admin Access' : 'Premium Account Features'}
                  </h3>
                  <div className="space-y-4 text-foreground/80">
                    <p className="leading-relaxed">
                      You have <strong>full access</strong> to all Intel Forge features:
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-card/50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-300 mb-3">🔓 Search Capabilities</h4>
                        <ul className="space-y-2 text-sm">
                          <li>• <strong>Unlimited searches</strong> (or high quota based on plan)</li>
                          <li>• <strong>Unlimited results</strong> per search</li>
                          <li>• <strong>All file types</strong> - CSV, TXT, ZIP, RAR, 7Z, etc.</li>
                          <li>• <strong>Archive search</strong> - Search inside compressed files</li>
                          <li>• <strong>Full file preview</strong> - View entire files</li>
                          <li>• <strong>Export results</strong> - Download and save data</li>
                        </ul>
                      </div>

                      <div className="bg-card/50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-300 mb-3">💎 Advanced Features</h4>
                        <ul className="space-y-2 text-sm">
                          <li>• <strong>All selectors</strong> - Email, crypto, phone, SSN, etc.</li>
                          <li>• <strong>Premium data sources</strong> - Stealer logs, ULP, etc.</li>
                          <li>• <strong>API access</strong> - Programmatic integration</li>
                          <li>• <strong>Priority support</strong> - Fast response times</li>
                          <li>• <strong>Advanced filters</strong> - Category-based search</li>
                          <li>• <strong>Search history</strong> - Track your investigations</li>
                        </ul>
                      </div>
                    </div>

                    {userType === 'admin' && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4">
                        <p className="font-semibold text-red-300 mb-2">👑 Admin Privileges</p>
                        <p className="text-sm">You have full administrative access including user management, search logs, API key management, and system configuration.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* How to Search */}
          <Section
            id="how-to-search"
            title="How to Search"
            expanded={expandedSections.has('how-to-search')}
            onToggle={() => toggleSection('how-to-search')}
          >
            <div className="space-y-6">
              <div className="prose prose-invert max-w-none">
                <h3 className="text-lg font-semibold text-foreground mb-4">Basic Search Process</h3>
                <ol className="space-y-4 text-foreground/80">
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Navigate to Search:</strong> Go to the <a href="/search" className="text-primary hover:underline">Search page</a> from the main navigation.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Enter Your Query:</strong> Type what you're looking for in the search box. Minimum 5 characters required.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Optional - Select Categories:</strong> Use the category filter to narrow your search to specific data types (Stealer Logs, ULP, CSV Files, etc.).
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Click Search:</strong> Hit the search button and wait for results. Large searches may take a few seconds.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Review Results:</strong> Results show matching lines with context. Click "View File" to see the full file.
                  </li>
                </ol>
              </div>

              <div className="bg-card/50 border border-border rounded-lg p-6">
                <h4 className="font-semibold text-foreground mb-4">💡 Search Tips for Best Results</h4>
                <ul className="space-y-3 text-sm text-foreground/80">
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">1.</span>
                    <span><strong>Be Specific:</strong> More specific queries return better results. Instead of "john", try "john.doe@example.com"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">2.</span>
                    <span><strong>Use Selectors:</strong> Search for specific data types like emails, IPs, or crypto addresses for targeted results</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">3.</span>
                    <span><strong>Case Insensitive:</strong> Searches are not case-sensitive. "EMAIL" and "email" return the same results</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">4.</span>
                    <span><strong>Exact Matches:</strong> The system searches for exact string matches. Use complete emails or IPs for best results</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold">5.</span>
                    <span><strong>Check Archives:</strong> Results may come from ZIP, RAR, or 7Z files. Look for the archive icon</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Selectors Documentation */}
          <Section
            id="selectors"
            title="Search Selectors (Data Types)"
            expanded={expandedSections.has('selectors')}
            onToggle={() => toggleSection('selectors')}
          >
            <div className="space-y-6">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-foreground/90 leading-relaxed">
                  <strong>Selectors</strong> are specific data formats that Intel Forge can identify and extract. 
                  Use these to find emails, IP addresses, cryptocurrency wallets, phone numbers, and more.
                </p>
              </div>

              {/* Basic Selectors (Free) */}
              <div>
                <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
                  <Unlock className="w-5 h-5" />
                  Basic Selectors (Free & Premium)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: '📧',
                      title: 'Email Addresses',
                      description: 'Search for email addresses in any format',
                      example: 'user@example.com, john.doe@company.co.uk',
                      tips: 'Finds complete email addresses. Supports all TLDs.'
                    },
                    {
                      icon: '🌐',
                      title: 'Domain Names',
                      description: 'Search for domain names and subdomains',
                      example: 'example.com, subdomain.example.com',
                      tips: 'Searching "example.com" finds all subdomains too.'
                    },
                    {
                      icon: '🔗',
                      title: 'URLs',
                      description: 'Search for complete web addresses',
                      example: 'https://example.com/page, http://test.com',
                      tips: 'Finds full URLs including protocol and path.'
                    },
                    {
                      icon: '🖥️',
                      title: 'IP Addresses',
                      description: 'Search for IPv4 and IPv6 addresses',
                      example: '192.168.1.1, 2001:db8::1',
                      tips: 'Supports both IPv4 and IPv6 formats.'
                    }
                  ].map((selector, idx) => (
                    <div key={idx} className="bg-card border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-2xl">{selector.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{selector.title}</h4>
                          <p className="text-xs text-foreground/70 mt-1">{selector.description}</p>
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded p-2 mt-2">
                        <p className="text-xs text-muted-foreground">Example:</p>
                        <p className="text-xs font-mono text-primary mt-1">{selector.example}</p>
                      </div>
                      <p className="text-xs text-foreground/60 mt-2">💡 {selector.tips}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premium Selectors */}
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Advanced Selectors (Premium Only)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: '₿',
                      title: 'Bitcoin Addresses',
                      description: 'Search for Bitcoin wallet addresses',
                      example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: 'Ξ',
                      title: 'Ethereum Addresses',
                      description: 'Search for Ethereum wallet addresses',
                      example: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '📞',
                      title: 'Phone Numbers',
                      description: 'Search for international phone numbers',
                      example: '+1234567890, 00420123456789',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '📍',
                      title: 'CIDR Notation',
                      description: 'Search for IP address ranges',
                      example: '192.168.0.0/24, 2001:db8::/32',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '🔗',
                      title: 'MAC Addresses',
                      description: 'Search for device MAC addresses',
                      example: '00:1A:2B:3C:4D:5E',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '🆔',
                      title: 'Social Security Numbers',
                      description: 'Search for US SSN format numbers',
                      example: '555-50-1234',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '📦',
                      title: 'IPFS Addresses',
                      description: 'Search for InterPlanetary File System addresses',
                      example: 'QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX',
                      locked: userType !== 'premium' && userType !== 'admin'
                    },
                    {
                      icon: '₿',
                      title: 'Monero Addresses',
                      description: 'Search for Monero cryptocurrency addresses',
                      example: '46thSVXSPNhJkCgUsFD9WuCjW4K41DAHGL...',
                      locked: userType !== 'premium' && userType !== 'admin'
                    }
                  ].map((selector, idx) => (
                    <div 
                      key={idx} 
                      className={`bg-card border rounded-lg p-4 ${
                        selector.locked 
                          ? 'border-red-500/30 opacity-60' 
                          : 'border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-2xl">{selector.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{selector.title}</h4>
                            {selector.locked && (
                              <Lock className="w-3 h-3 text-red-400" />
                            )}
                          </div>
                          <p className="text-xs text-foreground/70 mt-1">{selector.description}</p>
                        </div>
                      </div>
                      {!selector.locked ? (
                        <div className="bg-muted/50 rounded p-2 mt-2">
                          <p className="text-xs text-muted-foreground">Example:</p>
                          <p className="text-xs font-mono text-primary mt-1 break-all">{selector.example}</p>
                        </div>
                      ) : (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
                          <p className="text-xs text-red-300">🔒 Upgrade to Premium to unlock</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Understanding Results */}
          <Section
            id="results"
            title="Understanding Search Results"
            expanded={expandedSections.has('results')}
            onToggle={() => toggleSection('results')}
          >
            <div className="space-y-6">
              <div className="prose prose-invert max-w-none">
                <h3 className="text-lg font-semibold text-foreground mb-4">Result Components</h3>
                <div className="space-y-4">
                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-2">📁 File Path</h4>
                    <p className="text-sm text-foreground/80">
                      Shows the complete path to the file, including folders and archive names if applicable.
                      Example: <code className="text-primary">/data/SteakerLogs/archive.zip/passwords.txt</code>
                    </p>
                  </div>

                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-2">📝 Content Preview</h4>
                    <p className="text-sm text-foreground/80">
                      Shows the matching line with 5 lines of context above and below. The matching line is highlighted.
                      This helps you understand the context of the match.
                    </p>
                  </div>

                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-2">🔢 Match Count</h4>
                    <p className="text-sm text-foreground/80">
                      Shows how many times your search query appears in that specific file. 
                      Example: "5 matches in this file" means your query was found 5 times.
                    </p>
                  </div>

                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-2">👁️ View File Button</h4>
                    <p className="text-sm text-foreground/80">
                      Click to open the full file viewer showing 50 lines of context around each match. 
                      You can see more context and navigate through all matches in the file.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Important Notes</h4>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li>• Results are cached for 1 hour for faster subsequent searches</li>
                  <li>• Duplicate results are automatically removed</li>
                  <li>• Free users see up to 10 total results (5 per file)</li>
                  <li>• Premium users see unlimited results</li>
                  <li>• Archive files (ZIP/RAR/7Z) are searchable and show the internal path</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* API Access (Premium Only) */}
          {(userType === 'premium' || userType === 'admin') && (
            <Section
              id="api"
              title="API Access"
              expanded={expandedSections.has('api')}
              onToggle={() => toggleSection('api')}
            >
              <div className="space-y-4">
                <p className="text-foreground/80 leading-relaxed">
                  As a premium user, you have access to our RESTful API for programmatic searches. 
                  Generate API keys from your <a href="/dashboard" className="text-primary hover:underline">Dashboard</a>.
                </p>

                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-3">Quick Start</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-foreground/70 mb-2">1. Generate an API key from your dashboard</p>
                      <p className="text-foreground/70 mb-2">2. Include it in the Authorization header:</p>
                      <div className="bg-muted/50 rounded p-3 font-mono text-xs">
                        Authorization: Bearer YOUR_API_KEY_HERE
                      </div>
                    </div>
                    <div>
                      <p className="text-foreground/70 mb-2">3. Make GET requests to the search endpoint:</p>
                      <div className="bg-muted/50 rounded p-3 font-mono text-xs">
                        GET /api/search?q=example@email.com
                      </div>
                    </div>
                  </div>
                </div>

                <a 
                  href="/api-docs" 
                  className="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition"
                >
                  View Full API Documentation →
                </a>
              </div>
            </Section>
          )}

          {/* FAQ */}
          <Section
            id="faq"
            title="Frequently Asked Questions"
            expanded={expandedSections.has('faq')}
            onToggle={() => toggleSection('faq')}
          >
            <div className="space-y-4">
              {[
                {
                  q: 'How often is the data updated?',
                  a: 'Data is continuously updated as new sources become available. The exact frequency depends on the data source.'
                },
                {
                  q: 'Can I download search results?',
                  a: 'Premium users can export search results. Free users can view results online but cannot download them.'
                },
                {
                  q: 'What file types are supported?',
                  a: 'We support TXT, CSV, ZIP, RAR, 7Z, and other common formats. Archives are automatically extracted and searched.'
                },
                {
                  q: 'How do I report incorrect data?',
                  a: 'Use the contact form in the About section to submit data deletion requests or report issues.'
                },
                {
                  q: 'Is my search history private?',
                  a: 'Yes. Your search queries are logged for security and quota tracking but are not shared. See our Privacy Policy for details.'
                },
                {
                  q: 'Can I cancel my subscription?',
                  a: 'Yes, you can cancel anytime from your dashboard. Your access continues until the end of the billing period.'
                }
              ].map((faq, idx) => (
                <div key={idx} className="bg-card/50 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">{faq.q}</h4>
                  <p className="text-sm text-foreground/80">{faq.a}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Support */}
          <Section
            id="support"
            title="Get Support"
            expanded={expandedSections.has('support')}
            onToggle={() => toggleSection('support')}
          >
            <div className="space-y-4">
              <p className="text-foreground/80 leading-relaxed">
                Need help? We're here to assist you:
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-3">📧 Email Support</h4>
                  <p className="text-sm text-foreground/80 mb-2">support@osintsearch.online</p>
                  <p className="text-xs text-muted-foreground">Response time: 24-48 hours (free), 2-4 hours (premium)</p>
                </div>

                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-3">🌐 Contact Form</h4>
                  <a href="/about#contact" className="text-sm text-primary hover:underline">Submit a request →</a>
                  <p className="text-xs text-muted-foreground mt-2">For general inquiries and feedback</p>
                </div>
              </div>

              {(userType === 'premium' || userType === 'admin') && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-300 mb-2">⚡ Priority Support</h4>
                  <p className="text-sm text-foreground/80">
                    As a premium user, you receive priority support with faster response times and dedicated assistance.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Upgrade CTA */}
          {userType === 'free' && (
            <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/40 p-8 text-center mt-12">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at top, #ef444415 0%, transparent 60%)" }} />
              <h2 className="text-2xl font-bold mb-3 text-zinc-100 relative z-10">Ready for More?</h2>
              <p className="text-zinc-500 text-sm mb-6 max-w-2xl mx-auto relative z-10">
                Upgrade to Premium to unlock unlimited searches, advanced selectors, API access, and priority support.
                Choose from flexible plans starting at $50/month.
              </p>
              <a href="/pricing" className="relative z-10 inline-block px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition">
                View Pricing Plans →
              </a>
            </div>
          )}

          {userType === 'unregistered' && (
            <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/40 p-8 text-center mt-12">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at top, #ef444115 0%, transparent 60%)" }} />
              <h2 className="text-2xl font-bold mb-3 text-zinc-100 relative z-10">Get Started Today</h2>
              <p className="text-zinc-500 text-sm mb-6 max-w-2xl mx-auto relative z-10">
                Create a free account to get 50 searches per month with unblurred results and access to basic selectors.
                No credit card required!
              </p>
              <a href="/auth/register" className="relative z-10 inline-block px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition">
                Create Free Account →
              </a>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  )
}

// Collapsible Section Component
function Section({ 
  id, 
  title, 
  expanded, 
  onToggle, 
  children 
}: { 
  id: string
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 bg-zinc-900/50 hover:bg-zinc-900/70 transition-all border border-zinc-800/60 rounded-xl"
      >
        <h2 className="text-base font-semibold text-zinc-200">{title}</h2>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>
      {expanded && (
        <div className="bg-zinc-900/30 rounded-xl p-6 border border-zinc-800/60 mt-2">
          {children}
        </div>
      )}
    </div>
  )
}
