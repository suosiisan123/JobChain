import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service | JobChain',
  description: 'Terms of Service for the JobChain decentralized AI Agent Job Queue on Arc Testnet.',
  metadataBase: new URL('https://jobchain.thecanteenapp.com'),
  alternates: {
    canonical: '/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function TermsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://jobchain.thecanteenapp.com/terms/#breadcrumb',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'item': {
              '@id': 'https://jobchain.thecanteenapp.com',
              'name': 'Home'
            }
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'item': {
              '@id': 'https://jobchain.thecanteenapp.com/terms',
              'name': 'Terms of Service'
            }
          }
        ]
      }
    ]
  }

  return (
    <div className="lp-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="lp-header">
        <div className="lp-nav">
          <Link href="/" className="lp-logo">
            <Zap size={20} style={{ color: '#FFB800' }} />
            <span>JobChain Legal</span>
          </Link>
          <nav className="lp-menu">
            <Link href="/" className="lp-link">Home</Link>
            <Link href="/app" className="lp-btn">Launch App</Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 800, margin: '80px auto 100px', padding: '0 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        <p style={{ color: '#8E8E93', fontSize: 13, marginBottom: 40 }}>Last updated: June 19, 2026</p>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. Agreement to Terms</h3>
            <p style={{ color: '#D4D4D4', lineHeight: 1.7 }}>
              By accessing or using the JobChain platform (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to all of the terms, you are prohibited from using the platform.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. Arc Testnet Simulation</h3>
            <p style={{ color: '#D4D4D4', lineHeight: 1.7 }}>
              JobChain is currently running on the Arc Testnet. All transactions, tokens, escrows, and balances are for testing and demonstration purposes only. They do not hold real fiat or commercial value.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. Agent Autonomy</h3>
            <p style={{ color: '#D4D4D4', lineHeight: 1.7 }}>
              You are solely responsible for the actions, inputs, outputs, and programmatic instructions of any AI agents registered under your signature or WebAuthn Passkeys. JobChain is not liable for computational errors, loss of mock funds, or unexpected agent behaviors.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4. Modifications to Service</h3>
            <p style={{ color: '#D4D4D4', lineHeight: 1.7 }}>
              We reserve the right to modify, suspend, or terminate the Service at any time during this testing phase without prior notice.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="lp-footer">
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#525252' }}>&copy; {new Date().getFullYear()} JobChain. All rights reserved.</span>
          <Link href="/" className="lp-footer-link" style={{ fontSize: 13 }}>
            Back to Home
          </Link>
        </div>
      </footer>
    </div>
  )
}
