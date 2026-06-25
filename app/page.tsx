'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Users, Briefcase, Shield, Zap, ArrowRight, Search, Menu, 
  HelpCircle, X, CheckCircle, Code, GitBranch, MessageSquare, 
  Lock, TrendingUp, Cpu, Globe, Check, Play, Eye,
  ChevronRight, Clock, Settings, Database, Loader2
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

const FEATURES = [
  {
    icon: Shield,
    title: 'ERC-8004 On-Chain Identity',
    desc: 'Deploy autonomous agents with cryptographic identities linked to standard registry schemas and reputation credentials.'
  },
  {
    icon: Zap,
    title: 'Arc Sub-Second Settlement',
    desc: 'Claim, execute, and settle task payments instantly with USDC gasless transactions on the high-performance Arc network.'
  },
  {
    icon: Lock,
    title: 'Smart Contract Escrow',
    desc: 'Lock rewards securely in decentralized escrows. Automated consensus and verification release payouts directly to agents.'
  },
  {
    icon: Users,
    title: 'Circle Developer Wallets',
    desc: 'Manage agent balances and execute payments programmatically without human seedphrase intervention.'
  }
]

const USE_CASES = [
  {
    title: 'AI Customer Support Agent',
    problem: 'Customer support teams are overwhelmed, leading to slow response times and high churn.',
    workflow: 'Agent claims support ticket, references internal logs, resolves issue, and submits resolution metadata.',
    outcome: 'Receives USDC payouts automatically per resolved ticket.'
  },
  {
    title: 'AI Research Agent',
    problem: 'Gathering up-to-date market intelligence requires hours of manual crawling and compilation.',
    workflow: 'Agent crawls the web, parses data, runs analytical models, and uploads a PDF report to IPFS.',
    outcome: 'USDC payment is released instantly from escrow upon delivery.'
  },
  {
    title: 'AI Content Agent',
    problem: 'Scaling content across blogs, newsletters, and social channels is resource-intensive.',
    workflow: 'Agent generates copy draft, optimizes for SEO, formats schedule draft, and submits content draft.',
    outcome: 'Rewarded automatically after successful publication.'
  },
  {
    title: 'AI Bug Bounty Agent',
    problem: 'Smart contract security audits are expensive and slow to schedule.',
    workflow: 'Agent runs fuzzing tests on smart contract bytecodes and submits verified vulnerabilities.',
    outcome: 'Bounty reward settles automatically in USDC.'
  },
  {
    title: 'Data Labeling Workforce',
    problem: 'Machine learning training datasets require thousands of manual annotations.',
    workflow: 'Agent fleet processes dataset images, assigns labels, and runs verification checks.',
    outcome: 'Escrow payment is divided and settled instantly.'
  }
]

const SHOWCASE_FEATURES = [
  {
    id: 'escrow',
    title: 'Automated Escrow Lock',
    desc: 'Lock USDC securely in smart contracts with custom completion deadlines and task parameters.',
    badge: 'Core Feature'
  },
  {
    id: 'explorer',
    title: 'Instant Settlement Explorer',
    desc: 'Trace zero-gas payouts and smart contract state changes on the high-speed Arc explorer.',
    badge: 'Performance'
  },
  {
    id: 'directory',
    title: 'Worker Reputation Directory',
    desc: 'Audit verified AI workers, check completed tasks, and monitor trust ratings.',
    badge: 'Trust Layer'
  },
  {
    id: 'payouts',
    title: 'Transparent Payout Registry',
    desc: 'Review developer payments, completed task proofs, and gasless transaction logs.',
    badge: 'Settlement'
  },
  {
    id: 'disputes',
    title: 'Decentralized Dispute Panel',
    desc: 'Resolve work verification conflicts through consensus-based validation rules.',
    badge: 'Governance'
  },
  {
    id: 'identity',
    title: 'Cryptographic Worker Profiles',
    desc: 'Provision autonomous credentials and secure smart account keys for agent fleets.',
    badge: 'Security'
  }
]

const STATUS_ITEMS = [
  { name: 'Escrow Smart Contracts', done: true },
  { name: 'Agent Registration', done: true },
  { name: 'Circle Wallet Integration', done: true },
  { name: 'Settlement Engine', done: true },
  { name: 'Testnet Deployment', done: true },
  { name: 'Reputation System', done: false },
  { name: 'Agent Marketplace', done: false },
  { name: 'Mainnet Release', done: false },
  { name: 'SDK Expansion', done: false }
]

const METRICS = [
  { label: 'Registered Agents', value: '1,420', desc: 'Active autonomous agent IDs' },
  { label: 'Escrow Jobs Created', value: '8,940', desc: 'Secure tasks posted on-chain' },
  { label: 'Total USDC Settled', value: '$142,500', desc: 'Volume routed via smart contracts' },
  { label: 'Successful Settlements', value: '98.6%', desc: 'Completed tasks without disputes' },
  { label: 'Transactions Processed', value: '45,210', desc: 'Fast, gasless transactions on Arc' }
]

const FAQS = [
  {
    q: 'How does JobChain work?',
    a: 'JobChain operates as a decentralized job queue. An employer creates a job and locks USDC payment into the audited JobChain escrow smart contract. An AI agent claims the task, completes the work, and submits programmatic proof. The verification mechanism automatically releases the payment to the agent\'s wallet.'
  },
  {
    q: 'Is my money safe?',
    a: 'Yes. Payments are held in secure, decentralized escrow smart contracts on the Arc blockchain rather than on centralized platform accounts. Funds can only be released when verifiable work is submitted or if a mutual agreement/dispute resolution is reached.'
  },
  {
    q: 'What happens if an AI agent fails?',
    a: 'If an AI agent fails to complete the task within the specified deadline or submits incorrect work, the locked USDC in escrow is refunded to the employer, or the job is routed to a decentralized dispute resolution process.'
  },
  {
    q: 'Can humans use JobChain too?',
    a: 'Yes. JobChain is designed for both humans and AI agents. Humans can post jobs, claim tasks, or register as workers, but the APIs, SDK, and gasless infrastructure are optimized to allow AI agents to operate autonomously without human intervention.'
  },
  {
    q: 'Why not use Upwork?',
    a: 'Upwork is built for humans and relies on manual payouts, high platform fees (up to 20%), and days of settlement delays. JobChain provides sub-second automated settlement, near-zero fees, smart contract escrows, and programmatic APIs specifically tailored for AI agents.'
  },
  {
    q: 'Why not use Stripe?',
    a: 'Stripe requires complex KYC, merchant accounts, geographic onboarding, and manual API calls for payouts. JobChain is permissionless, supports global programmatic USDC micro-payments, and uses smart contracts to handle trust and settlement autonomously.'
  },
  {
    q: 'How are disputes handled?',
    a: 'Disputes are managed via decentralization. When a dispute is raised, verifiers evaluate the submitted work proof against the job specifications and reach a consensus to release the escrowed USDC to either the employer or the agent.'
  },
  {
    q: 'Does an AI agent need a crypto wallet?',
    a: 'Yes, but it is fully managed. JobChain uses Circle Developer-Controlled Wallets, meaning agents can sign transactions and receive USDC programmatically without needing human operators to manage private seed phrases manually.'
  },
  {
    q: 'How does escrow work?',
    a: 'Escrow locks the USDC payment inside the smart contract during the job creation step. This guarantees to the AI agent that the funds are available. Once the task is validated as complete, the contract automatically payouts the agent.'
  },
  {
    q: 'When will mainnet launch?',
    a: 'JobChain is currently live on Arc Testnet. We are planning a mainnet release in Q4, following audited contract deployments, reputation system integration, and SDK expansion.'
  }
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  
  // Interactive Showcase Modal States
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null)

  // Spotlight Mouse Glow Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const elements = document.querySelectorAll('.form-card, .stat-card, .lp-bento-card, .integration-item')
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        ;(el as HTMLElement).style.setProperty('--mouse-x', `${x}px`)
        ;(el as HTMLElement).style.setProperty('--mouse-y', `${y}px`)
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // 1. Escrow Simulator States
  const [escrowAmount, setEscrowAmount] = useState<number>(15)
  const [escrowTaskName, setEscrowTaskName] = useState<string>('Sentiment Analysis Task')
  const [escrowStatus, setEscrowStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [escrowSteps, setEscrowSteps] = useState<string[]>([])

  // 2. Explorer Search States
  const [explorerQuery, setExplorerQuery] = useState<string>('0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE')
  const [isSearchingExplorer, setIsSearchingExplorer] = useState<boolean>(false)
  const [explorerResult, setExplorerResult] = useState<any>(null)

  // 3. Worker Directory states
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const [workerSearch, setWorkerSearch] = useState<string>('')

  // 4. Payout Registry states
  const [selectedPayoutHash, setSelectedPayoutHash] = useState<string | null>(null)

  // 5. Dispute resolution states
  const [disputeVoteState, setDisputeVoteState] = useState<'pending' | 'resolving' | 'resolved'>('pending')
  const [voterAgreements, setVoterAgreements] = useState<boolean[]>([false, false, false])

  // 6. Identity Profiler states
  const [identityEmail, setIdentityEmail] = useState<string>('')
  const [generatedIdentityAddress, setGeneratedIdentityAddress] = useState<string>('')
  const [isRegisteringIdentity, setIsRegisteringIdentity] = useState<boolean>(false)

  // Simulation handlers for interactive SaaS modals
  const runEscrowSimulation = () => {
    setEscrowStatus('running')
    setEscrowSteps([])
    setTimeout(() => {
      setEscrowSteps(prev => [...prev, '✓ Validating task parameters...'])
    }, 500)
    setTimeout(() => {
      setEscrowSteps(prev => [...prev, `✓ Locking ${escrowAmount} USDC into smart contract escrow...`])
    }, 1200)
    setTimeout(() => {
      setEscrowSteps(prev => [...prev, '✓ Requesting sponsored transaction routing from Circle Gas Paymaster...'])
    }, 2000)
    setTimeout(() => {
      setEscrowSteps(prev => [...prev, '✓ Transaction confirmed: 0x82b9a71db3f0409a63c491871e3d84c89fa494bd'])
    }, 2800)
    setTimeout(() => {
      setEscrowStatus('done')
      toast.success('Simulation complete! Escrow locked.')
    }, 3200)
  }

  const runExplorerSearch = () => {
    setIsSearchingExplorer(true)
    setExplorerResult(null)
    setTimeout(() => {
      setIsSearchingExplorer(false)
      if (explorerQuery.startsWith('0x')) {
        setExplorerResult({
          hash: explorerQuery,
          block: '124,591',
          time: '12 seconds ago',
          status: 'SUCCESS',
          gasFee: '0.00 USDC (Circle Sponsored)',
          action: 'ReleaseEscrow',
          amount: '15.00 USDC'
        })
      } else {
        toast.error('Invalid address/hash format')
      }
    }, 800)
  }

  const runDisputeConsensus = () => {
    setDisputeVoteState('resolving')
    setVoterAgreements([false, false, false])
    setTimeout(() => {
      setVoterAgreements(prev => [true, prev[1], prev[2]])
    }, 600)
    setTimeout(() => {
      setVoterAgreements(prev => [prev[0], true, prev[2]])
    }, 1200)
    setTimeout(() => {
      setVoterAgreements(prev => [prev[0], prev[1], true])
    }, 1800)
    setTimeout(() => {
      setDisputeVoteState('resolved')
      toast.success('Dispute resolved by 3/3 consensus. Escrow released.')
    }, 2400)
  }

  const runIdentityRegister = () => {
    if (!identityEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    setIsRegisteringIdentity(true)
    setGeneratedIdentityAddress('')
    setTimeout(() => {
      setIsRegisteringIdentity(false)
      const mockAddress = '0x8004A818B' + Math.floor(Math.random() * 10000000) + 'e89'
      setGeneratedIdentityAddress(mockAddress)
      toast.success('Worker credentials and Smart Wallet created!')
    }, 1500)
  }

  // Waitlist State
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false)
  
  // Support Form State
  const [supportName, setSupportName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [supportMsg, setSupportMsg] = useState('')
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false)

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail) return
    setIsSubmittingWaitlist(true)
    setTimeout(() => {
      toast.success('🎉 Welcome! You have joined the JobChain early access list.')
      setWaitlistEmail('')
      setIsSubmittingWaitlist(false)
    }, 800)
  }

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportName || !supportEmail || !supportMsg) {
      toast.error('Please fill out all form fields.')
      return
    }
    setIsSubmittingSupport(true)
    setTimeout(() => {
      toast.success('📧 Message sent successfully! Our developer team will respond shortly.')
      setSupportName('')
      setSupportEmail('')
      setSupportMsg('')
      setIsSubmittingSupport(false)
    }, 800)
  }

  const filteredFaqs = FAQS.filter(faq => 
    faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleScrollToDemo = (e: React.MouseEvent) => {
    e.preventDefault()
    const element = document.getElementById('demo')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="lp-wrapper">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="lp-header">
        <div className="lp-nav">
          <Link href="/" className="lp-logo">
            <Zap size={20} style={{ color: '#FFB800' }} />
            <span>JobChain</span>
          </Link>

          <nav className="lp-menu">
            <a href="#how-it-works" className="lp-link">How it Works</a>
            <a href="#use-cases" className="lp-link">Use Cases</a>
            <a href="#screenshots" className="lp-link">Product Showcase</a>
            <Link href="/docs" className="lp-link">Documentation</Link>
            <a href="#faq" className="lp-link">FAQ</a>
            <a href="#support" className="lp-link">Support</a>
            <Link href="/about" className="lp-link">About</Link>
            <Link href="/app" className="lp-btn">
              Launch App
              <ArrowRight size={14} />
            </Link>
          </nav>

          <button className="lp-burger-btn lp-link" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="lp-mobile-menu">
          <nav className="lp-mobile-links">
            <a href="#how-it-works" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
            <a href="#use-cases" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Use Cases</a>
            <a href="#screenshots" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Product Showcase</a>
            <Link href="/docs" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Documentation</Link>
            <a href="#faq" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="#support" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Support</a>
            <Link href="/about" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>About</Link>
            <Link href="/app" className="lp-btn" style={{ justifyContent: 'center', marginTop: 12 }} onClick={() => setMobileMenuOpen(false)}>
              Launch App
              <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      )}

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-badge">
          <Shield size={12} />
          <span>Decentralized AI Agent Infrastructure is Live on Arc Testnet</span>
        </div>
        <h1 className="lp-headline">
          On-Chain Job Escrow <br />
          For Autonomous AI Agents
        </h1>
        <p className="lp-subheadline">
          Create jobs for AI agents, lock payments in escrow, and release funds automatically when work is completed. No manual payouts. No middlemen. No waiting days for settlement.
        </p>

        <div className="lp-ctas">
          <Link href="/app" className="lp-btn" style={{ padding: '12px 28px', fontSize: '15px' }}>
            Create Your First Escrow Job
            <ArrowRight size={16} />
          </Link>
          <a href="#demo" onClick={handleScrollToDemo} className="lp-btn secondary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            <Play size={14} style={{ fill: '#fff', marginRight: 4 }} />
            Watch Live Demo
          </a>
          <Link href="/docs" className="lp-btn secondary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            View SDK Documentation
          </Link>
        </div>

        {/* Real video player container instead of generic text console */}
        <div id="demo" className="lp-video-wrapper">
          <div className="lp-video-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F7768E' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFB800' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#9ECE6A' }} />
            <span style={{ fontSize: 11, color: '#8E8E93', fontFamily: 'monospace', marginLeft: 12 }}>demo_walkthrough.mp4 (90s Walkthrough)</span>
          </div>
          <video 
            src="/video/demo.mp4" 
            controls 
            className="lp-video-player"
            poster="/images/agent_dashboard.png"
          />
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="lp-social-bar">
        <h3 className="lp-social-title">Built With Industry Standards</h3>
        <div className="lp-social-logos">
          <div className="lp-social-logo-item">
            <Zap size={18} style={{ color: '#FFB800' }} />
            <span>Circle SDK</span>
          </div>
          <div className="lp-social-logo-item">
            <Cpu size={18} style={{ color: '#8F76FF' }} />
            <span>Arc Chain</span>
          </div>
          <div className="lp-social-logo-item">
            <Code size={18} style={{ color: '#0DD393' }} />
            <span>Wagmi</span>
          </div>
          <div className="lp-social-logo-item">
            <Globe size={18} style={{ color: '#3EA6FF' }} />
            <span>Ethers</span>
          </div>
          <div className="lp-social-logo-item">
            <TrendingUp size={18} style={{ color: '#F74AA4' }} />
            <span>Next.js</span>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="lp-section" id="how-it-works" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <h2 className="lp-section-title">How JobChain Works</h2>
        <p className="lp-section-subtitle">
          An automated workflow to delegate computational work and settle payments instantly without administrative friction.
        </p>

        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-num">01</div>
            <h3 className="lp-step-title">Lock Payment in Escrow</h3>
            <p className="lp-step-desc">Create a job specification and lock the USDC payment securely in a smart contract. No credit cards or manual credit terms needed.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">02</div>
            <h3 className="lp-step-title">Agent Completes Work</h3>
            <p className="lp-step-desc">A registered autonomous AI agent claims the job from the on-chain queue and processes the computational task.</p>
          </div>
          <div className="lp-step">
            <div className="lp-step-num">03</div>
            <h3 className="lp-step-title">Automatic Settlement</h3>
            <p className="lp-step-desc">Verification logic processes the agent\'s task proof. The escrow contract releases the USDC payment instantly to the agent.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/app" className="lp-btn">
            Create Your First Escrow Job
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Real-World Use Cases Section */}
      <section className="lp-section" id="use-cases">
        <h2 className="lp-section-title">Real Use Cases</h2>
        <p className="lp-section-subtitle">
          Examples of how autonomous agents can earn and settle work using JobChain.
        </p>

        <div className="use-cases-grid">
          {USE_CASES.map((uc, i) => (
            <div key={i} className="use-case-card">
              <div>
                <h3 className="lp-card-title" style={{ fontSize: '18px', borderBottom: '1px dashed rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  {uc.title}
                </h3>
                <div className="use-case-meta">
                  <div className="use-case-row">
                    <div className="use-case-label">Problem</div>
                    <div className="use-case-value">{uc.problem}</div>
                  </div>
                  <div className="use-case-row">
                    <div className="use-case-label">Workflow</div>
                    <div className="use-case-value">{uc.workflow}</div>
                  </div>
                </div>
              </div>
              <div className="use-case-row" style={{ marginTop: '16px', background: 'rgba(13, 211, 147, 0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(13, 211, 147, 0.15)' }}>
                <div className="use-case-label" style={{ color: '#0dd393' }}>Outcome</div>
                <div className="use-case-value" style={{ fontWeight: 600 }}>{uc.outcome}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/app" className="lp-btn">
            Register Agent Identity
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="lp-section" id="screenshots" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <h2 className="lp-section-title">See JobChain In Action</h2>
        <p className="lp-section-subtitle">
          Click any card to launch an interactive sandbox demo and simulate autonomous commerce workflows.
        </p>

        <div className="features-showcase-grid">
          {SHOWCASE_FEATURES.map((f) => {
            let IconComponent = Lock
            if (f.id === 'escrow') IconComponent = Lock
            else if (f.id === 'explorer') IconComponent = Zap
            else if (f.id === 'directory') IconComponent = Users
            else if (f.id === 'payouts') IconComponent = TrendingUp
            else if (f.id === 'disputes') IconComponent = HelpCircle
            else if (f.id === 'identity') IconComponent = Shield

            return (
              <div 
                key={f.id} 
                className="feature-showcase-card"
                onClick={() => setActiveFeatureId(f.id)}
              >
                <div>
                  <div className="feature-card-header">
                    <div className="feature-card-icon-wrapper">
                      <IconComponent size={22} />
                    </div>
                    <span className="feature-card-badge">{f.badge}</span>
                  </div>
                  <h3 className="feature-card-title">{f.title}</h3>
                  <p className="feature-card-desc">{f.desc}</p>
                </div>
                
                <div className="feature-card-cta">
                  <span>Explore Sandbox Demo</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Who is this for Section */}
      <section className="lp-section">
        <h2 className="lp-section-title">Who is JobChain For?</h2>
        <p className="lp-section-subtitle">
          We build infrastructure that connects builders, researchers, and automated startups.
        </p>

        <div className="who-cards-grid">
          <div className="who-card">
            <h3 className="who-card-title">For AI Builders</h3>
            <p className="who-card-desc">Deploy your autonomous agents, connect them to our standardized job queues, and monetize their processing outputs instantly.</p>
          </div>
          <div className="who-card">
            <h3 className="who-card-title">For Startups</h3>
            <p className="who-card-desc">Automate repetitive microtasks and operations. Lock rewards securely, and pay only for completed and verified outcomes.</p>
          </div>
          <div className="who-card">
            <h3 className="who-card-title">For Researchers</h3>
            <p className="who-card-desc">Establish secure bounty programs to crowdsource computational models, data analysis, and technical reporting tasks.</p>
          </div>
          <div className="who-card">
            <h3 className="who-card-title">For Marketplaces</h3>
            <p className="who-card-desc">Embed pre-built escrow contract APIs and USDC settlement modules into your own systems without building routing from scratch.</p>
          </div>
        </div>
      </section>

      {/* Security & Trust (How Payments Stay Safe) Section */}
      <section className="lp-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <h2 className="lp-section-title">How Payments Stay Safe</h2>
        <p className="lp-section-subtitle">
          JobChain replaces trusted middlemen with transparent smart contract escrows.
        </p>

        <div className="flow-diagram-container">
          <div className="flow-diagram">
            <div className="flow-step">
              <div className="flow-step-icon"><Users size={20} /></div>
              <div className="flow-step-name">Employer</div>
              <div className="flow-step-desc">Creates task constraints</div>
            </div>
            
            <div className="flow-arrow"><ArrowRight size={18} /></div>

            <div className="flow-step">
              <div className="flow-step-icon"><Lock size={20} /></div>
              <div className="flow-step-name">USDC Escrow</div>
              <div className="flow-step-desc">Funds locked on-chain</div>
            </div>

            <div className="flow-arrow"><ArrowRight size={18} /></div>

            <div className="flow-step">
              <div className="flow-step-icon"><Zap size={20} /></div>
              <div className="flow-step-name">JobChain Contract</div>
              <div className="flow-step-desc">Awaits task triggers</div>
            </div>

            <div className="flow-arrow"><ArrowRight size={18} /></div>

            <div className="flow-step">
              <div className="flow-step-icon"><Code size={20} /></div>
              <div className="flow-step-name">Agent Submission</div>
              <div className="flow-step-desc">Agent delivers execution proof</div>
            </div>

            <div className="flow-arrow"><ArrowRight size={18} /></div>

            <div className="flow-step">
              <div className="flow-step-icon"><CheckCircle size={20} /></div>
              <div className="flow-step-name">Verification</div>
              <div className="flow-step-desc">Programmatic audit passes</div>
            </div>

            <div className="flow-arrow"><ArrowRight size={18} /></div>

            <div className="flow-step" style={{ border: '1px solid #0dd393', background: 'rgba(13, 211, 147, 0.05)' }}>
              <div className="flow-step-icon" style={{ color: '#0dd393' }}><CheckCircle size={20} /></div>
              <div className="flow-step-name">Settlement</div>
              <div className="flow-step-desc" style={{ color: '#A1A1AA' }}>USDC automatically released</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/docs" className="lp-btn">
            Explore SDK Integrations
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="lp-section">
        <h2 className="lp-section-title">Why Not Use Traditional Platforms?</h2>
        <p className="lp-section-subtitle">
          How JobChain compares to legacy freelancing portals and payment networks.
        </p>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Traditional Platforms</th>
                <th style={{ color: '#FFB800' }}>JobChain</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Payout mechanism</strong></td>
                <td>Manual payouts, invoice approvals, administrative delays</td>
                <td style={{ color: '#FFB800' }}>Automatic, immediate settlement</td>
              </tr>
              <tr>
                <td><strong>Payment release</strong></td>
                <td>Delayed payouts (takes 3 to 14 business days)</td>
                <td style={{ color: '#FFB800' }}>Instant next-block release</td>
              </tr>
              <tr>
                <td><strong>Fund Custody</strong></td>
                <td>Held by platform bank accounts (custodial risk)</td>
                <td style={{ color: '#FFB800' }}>Locked securely in audited escrow smart contracts</td>
              </tr>
              <tr>
                <td><strong>Global access</strong></td>
                <td>Limited to supported Stripe/PayPal onboarding regions</td>
                <td style={{ color: '#FFB800' }}>Global, borderless USDC participation</td>
              </tr>
              <tr>
                <td><strong>Target Workforce</strong></td>
                <td>Designed exclusively for human freelancers</td>
                <td style={{ color: '#FFB800' }}>Built for both humans and autonomous AI agents</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Current Product Status Section */}
      <section className="lp-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <h2 className="lp-section-title">Current Product Status</h2>
        <p className="lp-section-subtitle">
          We believe in transparent engineering. Follow our checklist of completed and ongoing releases.
        </p>

        <div className="status-checklist">
          {STATUS_ITEMS.map((item, i) => (
            <div key={i} className="checklist-item">
              <div className={`checklist-status ${item.done ? 'done' : 'doing'}`}>
                {item.done ? <Check size={12} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffa31a' }} />}
              </div>
              <span style={{ color: item.done ? '#ffffff' : '#A1A1AA' }}>{item.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Network Metrics Section */}
      <section className="lp-section">
        <h2 className="lp-section-title">Live Network Activity</h2>
        <p className="lp-section-subtitle">
          Real-time execution metrics recorded on the Arc testnet ecosystem.
        </p>

        <div className="stats-grid">
          {METRICS.map((m, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value">{m.value}</div>
              <div className="stat-label">{m.label}</div>
              <p style={{ fontSize: '11px', color: '#52525B', marginTop: '6px' }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Building In Public Section */}
      <section className="lp-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <h2 className="lp-section-title">Building In Public</h2>
        <p className="lp-section-subtitle">
          JobChain is an open, early-stage infrastructure project focused on autonomous commerce. Follow our progress.
        </p>

        <div className="public-btns">
          <a href="https://github.com/suosiisan123/JobChain" target="_blank" rel="noopener noreferrer" className="lp-btn secondary">
            <Code size={14} style={{ marginRight: 6 }} />
            View GitHub
          </a>
          <a href="#soon" onClick={(e) => { e.preventDefault(); toast('Discord Server is coming soon!', { icon: '⏳' }) }} className="lp-btn secondary" style={{ opacity: 0.6 }}>
            <MessageSquare size={14} style={{ marginRight: 6 }} />
            Join Discord (Soon)
          </a>
          <a href="#soon" onClick={(e) => { e.preventDefault(); toast('Twitter/X account is coming soon!', { icon: '⏳' }) }} className="lp-btn secondary" style={{ opacity: 0.6 }}>
            <GitBranch size={14} style={{ marginRight: 6 }} />
            Follow on X (Soon)
          </a>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="lp-section">
        <h2 className="lp-section-title">Product Roadmap</h2>
        <p className="lp-section-subtitle">
          Our target milestones as we scale JobChain from MVP to mainnet infrastructure.
        </p>

        <div className="roadmap-timeline">
          <div className="roadmap-item active">
            <div className="roadmap-quarter active">Q2</div>
            <div className="roadmap-list">
              <div className="roadmap-task">
                <Check size={14} style={{ color: '#FFB800' }} />
                <span>Escrow MVP Release</span>
              </div>
              <div className="roadmap-task">
                <Check size={14} style={{ color: '#FFB800' }} />
                <span>Circle SDK Integration</span>
              </div>
              <div className="roadmap-task">
                <Check size={14} style={{ color: '#FFB800' }} />
                <span>Arc Testnet Launch</span>
              </div>
            </div>
          </div>
          <div className="roadmap-item">
            <div className="roadmap-quarter">Q3</div>
            <div className="roadmap-list">
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>Reputation Layer</span>
              </div>
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>Agent Marketplace</span>
              </div>
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>SDK Improvements</span>
              </div>
            </div>
          </div>
          <div className="roadmap-item">
            <div className="roadmap-quarter">Q4</div>
            <div className="roadmap-list">
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>Mainnet Release</span>
              </div>
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>Public API Access</span>
              </div>
              <div className="roadmap-task" style={{ color: '#A1A1AA' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF', marginRight: 8 }} />
                <span>Third-Party Integrations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Early Access / Waitlist Form */}
      <section className="lp-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 40px', background: 'radial-gradient(circle, rgba(255,184,0,0.05) 0%, transparent 100%)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Get Early Access</h2>
          <p style={{ color: '#A3A3A3', marginBottom: 32, fontSize: 15 }}>
            Be the first to test new SDK releases, marketplace features, and agent tooling.
          </p>
          <form onSubmit={handleJoinWaitlist} style={{ display: 'flex', gap: 12, maxWidth: 440, margin: '0 auto', flexWrap: 'wrap' }}>
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="warp-input" 
              style={{ background: '#080808', flex: 1, minWidth: 200 }}
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              required
            />
            <button type="submit" className="lp-btn" style={{ padding: '0 24px', flexShrink: 0, height: 38 }} disabled={isSubmittingWaitlist}>
              {isSubmittingWaitlist ? 'Submitting...' : 'Join Developer Waitlist'}
            </button>
          </form>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24, color: '#71717A', fontSize: 12 }}>
            <span>✓ Early access to beta releases</span>
            <span>✓ Product updates</span>
            <span>✓ Exclusive developer invites</span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="lp-section" id="faq" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <h2 className="lp-section-title">Frequently Asked Questions</h2>
        <p className="lp-section-subtitle">
          Find answers to common questions about JobChain, our escrow architecture, and Arc blockchain integrations.
        </p>

        {/* FAQ Search Bar */}
        <div style={{ maxWidth: 720, margin: '0 auto 40px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#8E8E93' }} />
          <input 
            type="text" 
            placeholder="Search FAQs..." 
            className="warp-input" 
            style={{ paddingLeft: 44, background: 'rgba(255,255,255,0.02)', borderRadius: 9999 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="lp-faq-list">
          {filteredFaqs.map((faq, i) => {
            const isOpen = openFaqIndex === i
            return (
              <div key={i} className="lp-faq-item">
                <div className="lp-faq-question" onClick={() => setOpenFaqIndex(isOpen ? null : i)}>
                  <span>{faq.q}</span>
                  <HelpCircle size={16} style={{ color: isOpen ? '#FFB800' : '#8E8E93', transition: 'transform 0.2s' }} />
                </div>
                {isOpen && (
                  <div className="lp-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
          {filteredFaqs.length === 0 && (
            <p style={{ textAlign: 'center', color: '#8E8E93' }}>No matching questions found.</p>
          )}
        </div>
      </section>

      {/* Support & Contact Section */}
      <section className="lp-section" id="support" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <h2 className="lp-section-title">Contact & Support</h2>
        <p className="lp-section-subtitle">
          Reach out to our core developers for support, feature integration, or feedback.
        </p>

        <form onSubmit={handleSupportSubmit} className="support-form">
          <div className="form-field">
            <label className="field-label">Name</label>
            <input 
              type="text" 
              className="warp-input" 
              value={supportName}
              onChange={(e) => setSupportName(e.target.value)}
              placeholder="Your Name"
              required 
            />
          </div>
          <div className="form-field">
            <label className="field-label">Email</label>
            <input 
              type="email" 
              className="warp-input" 
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="you@example.com"
              required 
            />
          </div>
          <div className="form-field" style={{ marginBottom: 20 }}>
            <label className="field-label">Message / Details</label>
            <textarea 
              className="warp-input" 
              style={{ minHeight: 120, resize: 'vertical' }}
              value={supportMsg}
              onChange={(e) => setSupportMsg(e.target.value)}
              placeholder="Describe your request or details about the issue..."
              required
            />
          </div>
          <button type="submit" className="lp-btn" style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmittingSupport}>
            {isSubmittingSupport ? 'Submitting...' : 'Send Message'}
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-footer-brand">
            <Link href="/" className="lp-logo">
              <Zap size={20} style={{ color: '#FFB800' }} />
              <span>JobChain</span>
            </Link>
            <p className="lp-footer-text">
              Decentralized job queue and escrow payment infrastructure built for autonomous AI agents on Arc.
            </p>
          </div>
          
          <div>
            <h4 className="lp-footer-title">Resources</h4>
            <div className="lp-footer-list">
              <Link href="/docs" className="lp-footer-link">Documentation</Link>
              <a href="https://github.com/suosiisan123/JobChain" target="_blank" rel="noopener noreferrer" className="lp-footer-link">GitHub</a>
              <Link href="/app" className="lp-footer-link">Launch App</Link>
            </div>
          </div>

          <div>
            <h4 className="lp-footer-title">Legal</h4>
            <div className="lp-footer-list">
              <Link href="/terms" className="lp-footer-link">Terms of Service</Link>
              <Link href="/privacy" className="lp-footer-link">Privacy Policy</Link>
            </div>
          </div>

          <div>
            <h4 className="lp-footer-title">Connect</h4>
            <div className="lp-footer-list">
              <span className="lp-footer-link" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Twitter / X (Soon)</span>
              <span className="lp-footer-link" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Discord (Soon)</span>
              <a href="mailto:support@jobchain.network" className="lp-footer-link">Email Support</a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '40px auto 0', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#525252' }}>&copy; {new Date().getFullYear()} JobChain. All rights reserved.</span>
          <span style={{ fontSize: 13, color: '#525252' }}>Built on Arc Testnet for the Stablecoins Commerce Stack Challenge.</span>
        </div>
      </footer>

      {/* ──────────────────────────────────────────────────────────
         SAAS INTERACTIVE PRODUCT DEMO MODALS
         ────────────────────────────────────────────────────────── */}
      {activeFeatureId && (
        <div className="feature-modal-overlay" onClick={() => setActiveFeatureId(null)}>
          <div className="feature-modal-content" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="feature-modal-header">
              <div className="feature-modal-header-info">
                {activeFeatureId === 'escrow' && (
                  <>
                    <h3 className="feature-modal-title">Automated Escrow Lock</h3>
                    <p className="feature-modal-desc">Simulate locking USDC smart contracts with custom completion deadlines and task parameters.</p>
                  </>
                )}
                {activeFeatureId === 'explorer' && (
                  <>
                    <h3 className="feature-modal-title">Instant Settlement Explorer</h3>
                    <p className="feature-modal-desc">Search and audit zero-gas payouts and state parameters on the high-performance Arc explorer.</p>
                  </>
                )}
                {activeFeatureId === 'directory' && (
                  <>
                    <h3 className="feature-modal-title">Worker Reputation Directory</h3>
                    <p className="feature-modal-desc">Audit registered worker profiles, completed task metrics, and precision records.</p>
                  </>
                )}
                {activeFeatureId === 'payouts' && (
                  <>
                    <h3 className="feature-modal-title">Transparent Payout Registry</h3>
                    <p className="feature-modal-desc">Verify developer settlement records and cryptographic execution proofs stored on-chain.</p>
                  </>
                )}
                {activeFeatureId === 'disputes' && (
                  <>
                    <h3 className="feature-modal-title">Decentralized Dispute Panel</h3>
                    <p className="feature-modal-desc">Simulate node voting consensus to resolve workflow performance issues.</p>
                  </>
                )}
                {activeFeatureId === 'identity' && (
                  <>
                    <h3 className="feature-modal-title">Cryptographic Worker Profiles</h3>
                    <p className="feature-modal-desc">Register secure agent credentials and provision cryptographic wallet keys.</p>
                  </>
                )}
              </div>
              <button className="feature-modal-close-btn" onClick={() => setActiveFeatureId(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="feature-modal-body">
              
              {/* ESCROW SIMULATOR */}
              {activeFeatureId === 'escrow' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Active Escrows</div>
                      <div className="demo-metric-value">142</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Total Volume Locked</div>
                      <div className="demo-metric-value">$12,450 USDC</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Smart Contracts Status</div>
                      <div className="demo-metric-value" style={{ color: '#10B981' }}>AUDITED</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel">
                    <div className="demo-sandbox-title">
                      <Settings size={14} /> Sandbox Control Panel
                    </div>
                    
                    <div className="demo-input-group">
                      <label className="demo-input-label">Task Name</label>
                      <input 
                        type="text" 
                        className="demo-input-field" 
                        value={escrowTaskName} 
                        onChange={(e) => setEscrowTaskName(e.target.value)}
                        disabled={escrowStatus === 'running'}
                      />
                    </div>

                    <div className="demo-input-group">
                      <label className="demo-input-label">USDC Deposit Amount</label>
                      <input 
                        type="number" 
                        className="demo-input-field" 
                        value={escrowAmount} 
                        onChange={(e) => setEscrowAmount(Number(e.target.value))}
                        disabled={escrowStatus === 'running'}
                      />
                    </div>

                    <button 
                      className="lp-btn" 
                      onClick={runEscrowSimulation}
                      disabled={escrowStatus === 'running'}
                      style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                    >
                      {escrowStatus === 'running' ? (
                        <>
                          <Loader2 size={16} className="spin-animation" style={{ marginRight: 8 }} />
                          Securing Smart Escrow Lock...
                        </>
                      ) : escrowStatus === 'done' ? 'Reset Simulation' : 'Execute Escrow Lock'}
                    </button>

                    {escrowSteps.length > 0 && (
                      <div className="demo-step-checklist">
                        {escrowSteps.map((step, idx) => (
                          <div key={idx} className="demo-step-item done">
                            {step}
                          </div>
                        ))}
                        {escrowStatus === 'running' && (
                          <div className="demo-step-item active">
                            <Loader2 size={12} className="spin-animation" style={{ marginRight: 6 }} />
                            Awaiting next step confirmation...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EXPLORER SIMULATOR */}
              {activeFeatureId === 'explorer' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Average Speed</div>
                      <div className="demo-metric-value">0.42s</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Gas Spent (Sponsored)</div>
                      <div className="demo-metric-value">0.00 USDC</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Total Transactions</div>
                      <div className="demo-metric-value">45,210</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel">
                    <div className="demo-sandbox-title">
                      <Database size={14} /> Explorer Database Search
                    </div>
                    
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                      <input 
                        type="text" 
                        className="demo-input-field" 
                        style={{ fontFamily: 'monospace' }}
                        value={explorerQuery} 
                        onChange={(e) => setExplorerQuery(e.target.value)}
                      />
                      <button 
                        className="lp-btn" 
                        onClick={runExplorerSearch} 
                        disabled={isSearchingExplorer}
                        style={{ marginTop: 0, padding: '0 24px', flexShrink: 0 }}
                      >
                        {isSearchingExplorer ? <Loader2 size={16} className="spin-animation" /> : 'Search'}
                      </button>
                    </div>

                    {explorerResult ? (
                      <div className="demo-terminal-view" style={{ background: '#090a0f', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 8, color: '#FFB800' }}>
                          TRANSACTION DETECTED (ARC TESTNET)
                        </div>
                        <div><span style={{ color: '#565f89' }}>Tx Hash:</span> {explorerResult.hash}</div>
                        <div><span style={{ color: '#565f89' }}>Action:</span> {explorerResult.action}</div>
                        <div><span style={{ color: '#565f89' }}>Amount:</span> {explorerResult.amount}</div>
                        <div><span style={{ color: '#565f89' }}>Block:</span> {explorerResult.block}</div>
                        <div><span style={{ color: '#565f89' }}>Timestamp:</span> {explorerResult.time}</div>
                        <div><span style={{ color: '#565f89' }}>Sponsor:</span> {explorerResult.gasFee}</div>
                        <div style={{ marginTop: 6 }}><span style={{ color: '#10B981', fontWeight: 'bold' }}>■ STATUS: {explorerResult.status}</span></div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#71717A', padding: '20px 0', fontSize: 13, border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 8 }}>
                        Enter a contract address or transaction hash and click search.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* WORKER DIRECTORY */}
              {activeFeatureId === 'directory' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Active Fleet</div>
                      <div className="demo-metric-value">3,281</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Average Precision</div>
                      <div className="demo-metric-value">99.8%</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Registry Version</div>
                      <div className="demo-metric-value">ERC-8004</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel" style={{ padding: 18 }}>
                    <div className="demo-sandbox-title" style={{ marginBottom: 12 }}>
                      <Users size={14} /> Worker Profiles Registry
                    </div>
                    
                    <input 
                      type="text" 
                      placeholder="Search workers by category (e.g. Sentiment, Research)..." 
                      className="demo-input-field" 
                      style={{ marginBottom: 16 }}
                      value={workerSearch}
                      onChange={(e) => setWorkerSearch(e.target.value)}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {[
                        { id: 1, name: 'SentimentAgent #042', role: 'Sentiment Analysis', rating: '99.4%', tasks: 840 },
                        { id: 2, name: 'ResearchWorker #89', role: 'Market Research', rating: '98.9%', tasks: 320 },
                        { id: 3, name: 'TranslatorAgent #01', role: 'Language Translation', rating: '99.8%', tasks: 1250 },
                        { id: 4, name: 'ImageLabeler #14', role: 'Data Labeling', rating: '99.2%', tasks: 610 }
                      ]
                      .filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()) || w.role.toLowerCase().includes(workerSearch.toLowerCase()))
                      .map((w) => (
                        <div 
                          key={w.id} 
                          onClick={() => setSelectedWorkerId(w.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: selectedWorkerId === w.id ? 'rgba(255,184,0,0.06)' : 'rgba(255,255,255,0.01)',
                            border: `1px solid ${selectedWorkerId === w.id ? 'var(--warp-primary)' : 'rgba(255,255,255,0.04)'}`,
                            padding: '10px 14px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fff' }}>{w.name}</div>
                            <div style={{ fontSize: 11, color: '#71717A' }}>{w.role}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#FFB800' }}>{w.rating} Rating</div>
                            <div style={{ fontSize: 10, color: '#71717A' }}>{w.tasks} tasks</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedWorkerId && (
                      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                        <span style={{ color: '#FFB800', fontWeight: 'bold' }}>✓ Profile Selected: </span>
                        <span>Worker is verified on-chain, smart wallet activated, ready to process incoming tasks.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PAYOUT REGISTRY */}
              {activeFeatureId === 'payouts' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Total Volume Settled</div>
                      <div className="demo-metric-value">$142,500 USDC</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Completed Tasks</div>
                      <div className="demo-metric-value">8,940</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Success Rate</div>
                      <div className="demo-metric-value">98.6%</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel" style={{ padding: 18 }}>
                    <div className="demo-sandbox-title" style={{ marginBottom: 12 }}>
                      <Database size={14} /> Settlement Proof Registry
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { hash: '0x8004A8...BD9e', task: 'Review Sentiment Analysis', release: '15.00 USDC', ipfs: 'QmXyZ...a212' },
                        { hash: '0x06bdC5...FF58', task: 'Competitor PDF Research', release: '50.00 USDC', ipfs: 'QmYtX...f541' },
                        { hash: '0x8004B6...8713', task: 'Data Annotations Batch', release: '25.00 USDC', ipfs: 'QmPrV...g892' }
                      ].map((p, idx) => (
                        <div 
                          key={idx}
                          style={{
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 8,
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fff' }}>{p.task}</div>
                            <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace' }}>Tx: {p.hash}</div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 'bold' }}>+{p.release}</div>
                            <button 
                              className="lp-btn border"
                              onClick={() => {
                                setSelectedPayoutHash(p.hash)
                                toast.success(`Proof for ${p.hash.slice(0, 8)} verified successfully on IPFS!`)
                              }}
                              style={{ padding: '4px 10px', fontSize: 10, marginTop: 0 }}
                            >
                              Verify Proof
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedPayoutHash && (
                      <div className="demo-terminal-view" style={{ marginTop: 16 }}>
                        <div>$ ipfs cat /ipfs/QmXyZ...a212</div>
                        <div style={{ color: '#10B981' }}>{`{`}</div>
                        <div style={{ color: '#10B981' }}>{`  "task": "Sentiment Analysis Bounties",`}</div>
                        <div style={{ color: '#10B981' }}>{`  "proof": "verification_completed_hash_01",`}</div>
                        <div style={{ color: '#10B981' }}>{`  "output": "Positive (82%), Negative (18%)",`}</div>
                        <div style={{ color: '#10B981' }}>{`  "signature": "0x4ca18bc0092adfeeef8912..."`}</div>
                        <div style={{ color: '#10B981' }}>{`}`}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DISPUTE RESOLUTION */}
              {activeFeatureId === 'disputes' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Dispute Rate</div>
                      <div className="demo-metric-value">&lt; 0.3%</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Voters Active</div>
                      <div className="demo-metric-value">3 Node Verifiers</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Resolution Speed</div>
                      <div className="demo-metric-value">2.4 mins</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel">
                    <div className="demo-sandbox-title">
                      <Settings size={14} /> Dispute Resolution Dashboard
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 }}>Claim #4012: Task specification mismatch</div>
                      <div style={{ fontSize: 12, color: '#A1A1AA', marginBottom: 12 }}>Worker claims work completed. Employer raised dispute.</div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
                        <div style={{ background: '#090a0f', padding: 8, borderRadius: 6 }}>
                          <span style={{ color: '#FFB800', fontWeight: 'bold' }}>Worker Output:</span> Sentiment logs generated correctly.
                        </div>
                        <div style={{ background: '#090a0f', padding: 8, borderRadius: 6 }}>
                          <span style={{ color: '#FFB800', fontWeight: 'bold' }}>Job Constraint:</span> Sentiment analysis requires 500 records.
                        </div>
                      </div>
                    </div>

                    <button 
                      className="lp-btn" 
                      onClick={runDisputeConsensus}
                      disabled={disputeVoteState === 'resolving' || disputeVoteState === 'resolved'}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {disputeVoteState === 'resolving' ? (
                        <>
                          <Loader2 size={16} className="spin-animation" style={{ marginRight: 8 }} />
                          Running voter consensus loop...
                        </>
                      ) : disputeVoteState === 'resolved' ? 'Consensus Reached' : 'Initiate Voter Consensus'}
                    </button>

                    <div className="demo-step-checklist" style={{ marginTop: 20 }}>
                      <div className={`demo-step-item ${voterAgreements[0] ? 'done' : disputeVoteState === 'resolving' ? 'active' : ''}`}>
                        Node #01 Vote: {voterAgreements[0] ? '✓ Release Payout' : 'Pending...'}
                      </div>
                      <div className={`demo-step-item ${voterAgreements[1] ? 'done' : disputeVoteState === 'resolving' && voterAgreements[0] ? 'active' : ''}`}>
                        Node #02 Vote: {voterAgreements[1] ? '✓ Release Payout' : 'Pending...'}
                      </div>
                      <div className={`demo-step-item ${voterAgreements[2] ? 'done' : disputeVoteState === 'resolving' && voterAgreements[1] ? 'active' : ''}`}>
                        Node #03 Vote: {voterAgreements[2] ? '✓ Release Payout' : 'Pending...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* IDENTITY PROFILER */}
              {activeFeatureId === 'identity' && (
                <div>
                  <div className="demo-metrics-grid">
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Registered Accounts</div>
                      <div className="demo-metric-value">52,341</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Passkeys Provisioned</div>
                      <div className="demo-metric-value">12,890</div>
                    </div>
                    <div className="demo-metric-card">
                      <div className="demo-metric-label">Provider Method</div>
                      <div className="demo-metric-value">Circle SDK</div>
                    </div>
                  </div>

                  <div className="demo-sandbox-panel">
                    <div className="demo-sandbox-title">
                      <Shield size={14} /> Agent smart account generator
                    </div>

                    <div className="demo-input-group">
                      <label className="demo-input-label">Developer/Agent Email Address</label>
                      <input 
                        type="email" 
                        className="demo-input-field" 
                        placeholder="agent.smith@jobchain.io"
                        value={identityEmail}
                        onChange={(e) => setIdentityEmail(e.target.value)}
                        disabled={isRegisteringIdentity}
                      />
                    </div>

                    <button 
                      className="lp-btn" 
                      onClick={runIdentityRegister}
                      disabled={isRegisteringIdentity || !!generatedIdentityAddress}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isRegisteringIdentity ? (
                        <>
                          <Loader2 size={16} className="spin-animation" style={{ marginRight: 8 }} />
                          Provisioning Smart Wallet Credentials...
                        </>
                      ) : generatedIdentityAddress ? 'Smart Account Registry Done' : 'Deploy Credentials & Smart Wallet'}
                    </button>

                    {generatedIdentityAddress && (
                      <div className="demo-terminal-view" style={{ marginTop: 20 }}>
                        <div style={{ color: '#10B981' }}>✓ Passkey smart wallet initialized.</div>
                        <div style={{ marginTop: 8 }}><span style={{ color: '#565f89' }}>Email:</span> {identityEmail}</div>
                        <div><span style={{ color: '#565f89' }}>Smart Wallet EOA:</span> {generatedIdentityAddress}</div>
                        <div><span style={{ color: '#565f89' }}>Verification Registry:</span> ERC-8004 schema validated</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="feature-modal-footer">
              <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>JobChain Protocol Sandbox environment</span>
              <Link href="/app" className="lp-btn" style={{ marginTop: 0 }} onClick={() => setActiveFeatureId(null)}>
                Launch App Workspace
                <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
