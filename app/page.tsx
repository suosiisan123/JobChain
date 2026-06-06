'use client'

import { useState, useEffect } from 'react'
import { Terminal, Users, Briefcase, BarChart3, Fingerprint } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import { Toaster } from 'react-hot-toast'
import { TerminalTab } from '@/components/TerminalTab'
import { AgentsTab } from '@/components/AgentsTab'
import { JobsTab } from '@/components/JobsTab'
import { DashboardTab } from '@/components/DashboardTab'
import { IdentityTab } from '@/components/IdentityTab'

const TABS = [
  { id: 'terminal', label: '~/live-events', icon: Terminal },
  { id: 'identity', label: 'erc-8004', icon: Fingerprint },
  { id: 'agents', label: 'agent-registry', icon: Users },
  { id: 'jobs', label: 'job-queue', icon: Briefcase },
  { id: 'dashboard', label: 'dashboard', icon: BarChart3 },
] as const

type TabId = typeof TABS[number]['id']

export default function JobChainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('terminal')
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
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
            background: '#24283B',
            color: '#C0CAF5',
            border: '1px solid #414868',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#9ECE6A', secondary: '#1A1B26' } },
          error: { iconTheme: { primary: '#F7768E', secondary: '#1A1B26' } },
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
          <div className="warp-tabs">
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
                <div className="sidebar-section-label" style={{ marginTop: 24 }}>BALANCE</div>
                <div className="sidebar-item">
                  <span style={{ color: 'var(--warp-success)', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(balance.formatted).toFixed(4)}
                  </span>
                  <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>USDC</span>
                </div>
              </>
            )}

            <div style={{ marginTop: 'auto', padding: '16px' }}>
              <div className="sidebar-section-label">WALLET</div>
              <div className="wallet-container">
                <ConnectButton.Custom>
                  {({ account, openConnectModal, openAccountModal, mounted }) => {
                    if (!mounted) return null
                    if (!account) {
                      return (
                        <button className="warp-btn" onClick={openConnectModal} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                          Connect Wallet
                        </button>
                      )
                    }
                    return (
                      <div className="sidebar-item" onClick={openAccountModal} style={{ cursor: 'pointer' }}>
                        <span className="status-dot online" />
                        <span style={{ color: 'var(--warp-success)', fontSize: 12 }}>
                          {account.displayName}
                        </span>
                      </div>
                    )
                  }}
                </ConnectButton.Custom>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="warp-main">
            {activeTab === 'terminal' && <TerminalTab />}
            {activeTab === 'identity' && <IdentityTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'jobs' && <JobsTab />}
            {activeTab === 'dashboard' && <DashboardTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
