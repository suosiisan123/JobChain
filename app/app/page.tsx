'use client'

import { useState, useEffect } from 'react'
import { Terminal, Users, Briefcase, BarChart3, Fingerprint, Shield, Zap, Scale, Brain, Activity } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useBalance } from 'wagmi'
import { Toaster } from 'react-hot-toast'
import { TerminalTab } from '@/components/TerminalTab'
import { AgentsTab } from '@/components/AgentsTab'
import { JobsTab } from '@/components/JobsTab'
import { DisputesTab } from '@/components/DisputesTab'
import { DashboardTab } from '@/components/DashboardTab'
import { IdentityTab } from '@/components/IdentityTab'
import { PasskeyAuth } from '@/components/PasskeyAuth'
import { MicroStreamTab } from '@/components/MicroStreamTab'
import { SchedulerTab } from '@/components/SchedulerTab'
import { DocsTab } from '@/components/DocsTab'
import { GovernanceTab } from '@/components/GovernanceTab'
import { AgentStudioTab } from '@/components/AgentStudioTab'
import { BatchDecoderTab } from '@/components/BatchDecoderTab'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { Clock, BookOpen, Vote } from 'lucide-react'

const TABS = [
  { id: 'terminal', label: '~/live-events', icon: Terminal },
  { id: 'identity', label: 'erc-8004', icon: Shield },
  { id: 'agentstudio', label: 'agent-studio', icon: Brain },
  { id: 'batchdecoder', label: 'batch-decoder', icon: Activity },
  { id: 'agents', label: 'agent-registry', icon: Users },
  { id: 'jobs', label: 'job-queue', icon: Briefcase },
  { id: 'disputes', label: 'dispute-center', icon: Scale },
  { id: 'microtask', label: '~/micro-streams', icon: Zap },
  { id: 'passkey', label: 'passkey-account', icon: Fingerprint },
  { id: 'scheduler', label: 'cron-scheduler', icon: Clock },
  { id: 'governance', label: 'dao-governance', icon: Vote },
  { id: 'docs', label: 'sdk-docs', icon: BookOpen },
  { id: 'dashboard', label: 'dashboard', icon: BarChart3 },
] as const

type TabId = typeof TABS[number]['id']

export default function JobChainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('terminal')
  const { address, isConnected, isPasskey } = useSmartWallet()
  const { data: balance } = useBalance({ address: address as `0x${string}` })
  const [circleStatus, setCircleStatus] = useState<'Active' | 'Simulated' | 'Checking'>('Checking')

  // Check Circle Integration Status
  useEffect(() => {
    async function checkCircle() {
      try {
        const res = await fetch('/api/agent-wallet/list')
        const data = await res.json()
        if (data.simulated === false) {
          setCircleStatus('Active')
        } else {
          setCircleStatus('Simulated')
        }
      } catch {
        setCircleStatus('Simulated')
      }
    }
    checkCircle()
  }, [])

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161619',
            color: '#F4F4F5',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#FFB800', secondary: '#0A0A0C' } },
          error: { iconTheme: { primary: '#F7768E', secondary: '#0A0A0C' } },
        }}
      />

      <div className="warp-window">
        {/* Title Bar */}
        <div className="warp-titlebar">
          <div className="mac-buttons">
            <div className="mac-btn close" />
            <div className="mac-btn min" />
            <div className="mac-btn max" />
          </div>
          
          {/* Desktop Navigation */}
          <div className="warp-tabs desktop-only">
            {TABS.map(tab => (
              <div
                key={tab.id}
                className={`warp-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} style={{ marginRight: 6 }} />
                {tab.label}
              </div>
            ))}
          </div>

          {/* Mobile Selector Dropdown */}
          <div className="mobile-only mobile-tab-selector-container">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabId)}
              className="mobile-tab-select"
            >
              {TABS.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile Status Bar */}
        <div className="mobile-only mobile-status-bar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '10px' }}>
            <span style={{ fontSize: 11, color: 'var(--warp-muted)', whiteSpace: 'nowrap' }}>
              Arc Testnet
            </span>
            {isConnected && balance && (
              <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-primary)', whiteSpace: 'nowrap' }}>
                {parseFloat(balance.formatted).toFixed(4)} USDC
              </span>
            )}
            <ConnectButton.Custom>
              {({ account, openConnectModal, openAccountModal, mounted }) => {
                if (!mounted) return null
                if (!account) {
                  return (
                    <button className="warp-btn" onClick={openConnectModal} style={{ padding: '4px 10px', fontSize: 10, marginTop: 0 }}>
                      Connect EOA
                    </button>
                  )
                }
                return (
                  <button className="warp-btn secondary" onClick={openAccountModal} style={{ padding: '4px 10px', fontSize: 10, marginTop: 0, whiteSpace: 'nowrap' }}>
                    {account.displayName}
                  </button>
                )
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        <div className="warp-content">
          {/* Sidebar */}
          <div className="warp-sidebar">
            <div className="sidebar-section-label">NETWORK</div>
            <div className="sidebar-item active">
              <span className="status-dot online" /> Arc Testnet
            </div>
            <div className="sidebar-item">
              <span className="status-dot" /> Chain ID: 5042002
            </div>

            <div className="sidebar-section-label" style={{ marginTop: 24 }}>CIRCLE STACK</div>
            <div className="sidebar-item">
              <span className={`status-dot ${circleStatus === 'Active' ? 'online' : 'away'}`} />
              <span>Programmatic: {circleStatus}</span>
            </div>

            <div className="sidebar-section-label" style={{ marginTop: 24 }}>CONTRACTS</div>
            <a href="https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
              <span style={{ color: 'var(--warp-success)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>ERC-8004 Identity</span>
            </a>
            <a href="https://testnet.arcscan.app/address/0x8004B663056A597Dffe9eCcC1965A193B7388713" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
              <span style={{ color: 'var(--warp-warning)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>ReputationRegistry</span>
            </a>
            <a href="https://testnet.arcscan.app/address/0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
              <span style={{ color: 'var(--warp-cyan)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>JobChainV2</span>
            </a>
            <div className="sidebar-item">
              <span style={{ color: 'var(--warp-magenta)' }}>■</span> USDC Escrow
            </div>

            {/* Dynamic Balance */}
            {isConnected && balance && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: 24 }}>BALANCE ({isPasskey ? 'SCA' : 'EOA'})</div>
                <div className="sidebar-item">
                  <span style={{ color: 'var(--warp-success)', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(balance.formatted).toFixed(4)}
                  </span>
                  <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>USDC</span>
                </div>
              </>
            )}

            {/* Wallet Onboarding Status Panel */}
            <div style={{ marginTop: 'auto', padding: '16px' }}>
              <div className="sidebar-section-label">ACTIVE SIGNERS</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {/* SCA passkey wallet if active */}
                {isPasskey && address && (
                  <div
                    className="sidebar-item active"
                    onClick={() => setActiveTab('passkey')}
                    style={{ cursor: 'pointer', background: 'rgba(255, 184, 0, 0.08)', borderColor: 'rgba(255, 184, 0, 0.2)' }}
                  >
                    <Fingerprint size={12} style={{ color: 'var(--warp-cyan)', marginRight: 6 }} />
                    <span style={{ color: 'var(--warp-cyan)', fontSize: 11, fontFamily: 'monospace' }}>
                      SCA: {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  </div>
                )}

                {/* EOA wallet */}
                <ConnectButton.Custom>
                  {({ account, openConnectModal, openAccountModal, mounted }) => {
                    if (!mounted) return null
                    if (!account) {
                      return (
                        <button className="warp-btn" onClick={openConnectModal} style={{ width: '100%', justifyContent: 'center' }}>
                          Connect EOA Wallet
                        </button>
                      )
                    }
                    return (
                      <div className={`sidebar-item ${!isPasskey ? 'active' : ''}`} onClick={openAccountModal} style={{ cursor: 'pointer' }}>
                        <span className="status-dot online" />
                        <span style={{ color: 'var(--warp-success)', fontSize: 11, fontFamily: 'monospace' }}>
                          EOA: {account.displayName}
                        </span>
                      </div>
                    )
                  }}
                </ConnectButton.Custom>

                {/* Login with Passkey Button if SCA is not active */}
                {!isPasskey && (
                  <button
                    className="warp-btn border"
                    onClick={() => setActiveTab('passkey')}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Fingerprint size={12} style={{ marginRight: 6 }} /> Login with Passkey
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="warp-main">
            {activeTab === 'terminal' && <TerminalTab />}
            {activeTab === 'identity' && <IdentityTab />}
            {activeTab === 'agentstudio' && <AgentStudioTab />}
            {activeTab === 'batchdecoder' && <BatchDecoderTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'jobs' && <JobsTab />}
            {activeTab === 'disputes' && <DisputesTab />}
            {activeTab === 'microtask' && <MicroStreamTab />}
            {activeTab === 'passkey' && <PasskeyAuth />}
            {activeTab === 'scheduler' && <SchedulerTab />}
            {activeTab === 'governance' && <GovernanceTab />}
            {activeTab === 'docs' && <DocsTab />}
            {activeTab === 'dashboard' && <DashboardTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
