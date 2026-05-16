'use client'

import { useState } from 'react'
import { Terminal, Users, Briefcase, BarChart3 } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { TerminalTab } from '@/components/TerminalTab'
import { AgentsTab } from '@/components/AgentsTab'
import { JobsTab } from '@/components/JobsTab'
import { DashboardTab } from '@/components/DashboardTab'

const TABS = [
  { id: 'terminal', label: '~/live-events', icon: Terminal },
  { id: 'agents', label: 'agent-registry', icon: Users },
  { id: 'jobs', label: 'job-queue', icon: Briefcase },
  { id: 'dashboard', label: 'dashboard', icon: BarChart3 },
] as const

type TabId = typeof TABS[number]['id']

export default function JobChainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('terminal')

  return (
    <div className="app-container">
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

            <div className="sidebar-section-label" style={{ marginTop: 24 }}>PROTOCOL</div>
            <div className="sidebar-item">
              <span style={{ color: 'var(--warp-success)' }}>■</span> ERC-8004 Identity
            </div>
            <div className="sidebar-item">
              <span style={{ color: 'var(--warp-cyan)' }}>■</span> ERC-8183 Jobs
            </div>
            <div className="sidebar-item">
              <span style={{ color: 'var(--warp-warning)' }}>■</span> USDC Escrow
            </div>

            <div style={{ marginTop: 'auto', padding: '16px' }}>
              <div className="sidebar-section-label">WALLET</div>
              <div className="wallet-container">
                <ConnectButton.Custom>
                  {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
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
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'jobs' && <JobsTab />}
            {activeTab === 'dashboard' && <DashboardTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
