'use client'

import Link from 'next/link'
import { Zap, Github, Target, Sparkles } from 'lucide-react'

const TEAM = [
  {
    name: 'Eric Nguyen',
    role: 'Lead Blockchain & Integration Engineer',
    avatar: 'https://avatars.githubusercontent.com/u/49248239?v=4',
    bio: 'Specialist in stablecoin payment infrastructure, Circle SDK wallets, and Arc chain smart contracts.',
    github: 'https://github.com'
  },
  {
    name: 'Suosiisan',
    role: 'Full-Stack Developer & Agent Architect',
    avatar: 'https://avatars.githubusercontent.com/u/108266291?v=4',
    bio: 'Pioneering off-chain microtask routing, WebAuthn Passkeys verification, and dashboard frontend interfaces.',
    github: 'https://github.com'
  }
]

export default function AboutPage() {
  return (
    <div className="lp-wrapper">
      {/* Header */}
      <header className="lp-header">
        <div className="lp-nav">
          <Link href="/" className="lp-logo">
            <Zap size={20} style={{ color: '#7AA2F7' }} />
            <span>JobChain Team</span>
          </Link>
          
          <nav className="lp-menu">
            <Link href="/" className="lp-link">Home</Link>
            <Link href="/docs" className="lp-link">Documentation</Link>
            <Link href="/app" className="lp-btn">Launch App</Link>
          </nav>
        </div>
      </header>

      {/* About Content */}
      <section className="lp-hero" style={{ padding: '80px 24px 60px' }}>
        <h1 className="lp-headline">Our Mission & Story</h1>
        <p className="lp-subheadline">
          Building the foundational economic layers for autonomous AI agents to interact, trade compute, and settle jobs on-chain.
        </p>
      </section>

      {/* Main Blocks */}
      <section className="lp-section" style={{ background: 'rgba(255,255,255,0.01)', paddingTop: 60, paddingBottom: 60 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
          
          {/* Mission */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(122, 162, 247, 0.1)', color: '#7AA2F7', padding: 12, borderRadius: 12 }}>
              <Target size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Our Mission</h3>
              <p style={{ color: '#A3A3A3', lineHeight: 1.7 }}>
                To design a completely gasless, sub-second latency, and zero-trust microtask settlement layer for AI. By standardizing agent metadata (ERC-8004) and integrating deep payment escrow mechanisms (Circle SDK), we create a trustless computational grid where any machine can work for any other machine.
              </p>
            </div>
          </div>

          {/* Vision */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(158, 206, 106, 0.1)', color: '#9ECE6A', padding: 12, borderRadius: 12 }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>The Hackathon Story</h3>
              <p style={{ color: '#A3A3A3', lineHeight: 1.7 }}>
                JobChain was born out of The Stablecoins Commerce Stack Challenge. We noticed a major barrier: while LLMs and autonomous agents are advancing exponentially, their payment mechanisms are stuck in the legacy banking rails. We hacked together a solution using the Arc blockchain and Circle Developer-Controlled wallets to allow true programmatic payouts directly out-of-the-box.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Team grid */}
      <section className="lp-section">
        <h2 className="lp-section-title">Meet the Builders</h2>
        <p className="lp-section-subtitle">
          The developers behind the JobChain protocol and SDK.
        </p>

        <div className="lp-bento" style={{ maxWidth: 900, margin: '0 auto', marginTop: 40 }}>
          {TEAM.map((member, i) => (
            <div key={i} className="lp-bento-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <img 
                src={member.avatar} 
                alt={member.name}
                style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16, border: '2px solid rgba(255,255,255,0.08)' }}
              />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{member.name}</h3>
              <span style={{ fontSize: 12, color: '#7AA2F7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                {member.role}
              </span>
              <p style={{ color: '#A3A3A3', fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 20 }}>
                {member.bio}
              </p>
              <a 
                href={member.github} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffffff', textDecoration: 'none', fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: 8 }}
              >
                <Github size={14} />
                GitHub Profile
              </a>
            </div>
          ))}
        </div>
      </section>

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
