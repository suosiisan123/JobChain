'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Terminal, Users, Briefcase, BarChart3, Fingerprint, Shield, Zap, MessageSquare, Copy, X, RefreshCw, LogOut } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useBalance, useAccount } from 'wagmi'
import { Toaster, toast } from 'react-hot-toast'
import { JobsTab } from '@/components/JobsTab'
import { AgentWorkspaceTab } from '@/components/AgentWorkspaceTab'
import { DashboardTab } from '@/components/DashboardTab'
import { WorkersTab } from '@/components/WorkersTab'
import { SettingsTab } from '@/components/SettingsTab'
import { ActivityTab } from '@/components/ActivityTab'
import { useSmartWallet } from '@/hooks/useSmartWallet'

const TABS = [
  { id: 'home', label: 'Home', icon: BarChart3 },
  { id: 'tasks', label: 'Tasks', icon: Briefcase },
  { id: 'workers', label: 'Workers', icon: Users },
  { id: 'payments', label: 'AI Chat', icon: MessageSquare },
  { id: 'activity', label: 'Activity', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Shield },
] as const

type TabId = typeof TABS[number]['id']

export default function JobChainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [devMode, setDevMode] = useState<boolean>(false)
  const [showUserModal, setShowUserModal] = useState<boolean>(false)
  const { address, isConnected, isPasskey, email, logout } = useSmartWallet()
  const { address: eoaAddress } = useAccount()
  const { data: balance } = useBalance({ address: address as `0x${string}` })
  const { data: scaErc20USDC } = useBalance({
    address: address as `0x${string}`,
    token: '0x3600000000000000000000000000000000000000',
  })
  const { data: scaErc20EURC } = useBalance({
    address: address as `0x${string}`,
    token: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  })
  const { data: eoaNativeBalance } = useBalance({
    address: eoaAddress as `0x${string}`,
  })
  const { data: eoaErc20USDC } = useBalance({
    address: eoaAddress as `0x${string}`,
    token: '0x3600000000000000000000000000000000000000',
  })
  const { data: eoaErc20EURC } = useBalance({
    address: eoaAddress as `0x${string}`,
    token: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  })

  const [circleStatus, setCircleStatus] = useState<'Active' | 'Simulated' | 'Checking'>('Checking')
  const [agentWallets, setAgentWallets] = useState<any[]>([])
  const [agentBalances, setAgentBalances] = useState<Record<string, any[]>>({})
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false)

  const [unifiedBalances, setUnifiedBalances] = useState<{ arc: number, base: number, arbitrum: number } | null>(null)
  const [unifiedTotal, setUnifiedTotal] = useState<number | null>(null)
  const [loadingUnified, setLoadingUnified] = useState<boolean>(false)

  useEffect(() => {
    if (!address) {
      setUnifiedBalances(null)
      setUnifiedTotal(null)
      return
    }
    
    async function fetchUnified() {
      setLoadingUnified(true)
      try {
        const res = await fetch(`/api/unified-balance?address=${address}`)
        const data = await res.json()
        if (data.balances) {
          setUnifiedBalances(data.balances)
          setUnifiedTotal(data.total)
        }
      } catch (e) {
        console.error('Error fetching unified balance:', e)
      } finally {
        setLoadingUnified(false)
      }
    }
    
    fetchUnified()
    
    const interval = setInterval(fetchUnified, 12000)
    return () => clearInterval(interval)
  }, [address])

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

  // Fetch balances for developer-controlled wallets
  const fetchAgentBalances = async (walletsList: any[]) => {
    setLoadingBalances(true)
    try {
      const balancesMap: Record<string, any[]> = {}
      await Promise.all(
        walletsList.map(async (wallet) => {
          try {
            const res = await fetch(`/api/agent-wallet/balance?walletId=${wallet.walletId}`)
            const data = await res.json()
            if (data.tokenBalances) {
              balancesMap[wallet.walletId] = data.tokenBalances
            }
          } catch (e) {
            console.error('Failed to fetch balance for wallet', wallet.walletId, e)
          }
        })
      )
      setAgentBalances(balancesMap)
    } catch (err) {
      console.error('Error fetching agent balances:', err)
    } finally {
      setLoadingBalances(false)
    }
  }

  // Check Circle Integration Status and list wallets
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
        if (data.wallets) {
          const walletsArray = Object.entries(data.wallets).map(([agentId, info]: any) => ({
            agentId,
            ...info
          }))
          setAgentWallets(walletsArray)
          if (showUserModal) {
            fetchAgentBalances(walletsArray)
          }
        }
      } catch {
        setCircleStatus('Simulated')
      }
    }
    checkCircle()
  }, [showUserModal])

  // Load Developer Mode Preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jobchain_dev_mode')
      setDevMode(saved === 'true')
    }
  }, [])

  // Filter tabs: Show 'Activity' tab only in Developer Mode
  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'activity') return devMode
    return true
  })

  // Safe fallback if activeTab is 'activity' but devMode is turned off
  useEffect(() => {
    if (activeTab === 'activity' && !devMode) {
      setActiveTab('home')
    }
  }, [devMode, activeTab])

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161619',
            color: '#F4F4F5',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: "var(--warp-font)",
            fontSize: '12px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#0A0A0C' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#0A0A0C' } },
        }}
      />

      <div className="warp-window">
        {/* Title Bar */}
        <div className="warp-titlebar">
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            color: '#ffffff',
            marginRight: '20px',
            marginLeft: '12px',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'opacity 0.2s'
          }} className="app-logo-hover">
            <Zap size={15} style={{ color: '#FFB800' }} />
            <span style={{
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '-0.02em',
              fontFamily: 'var(--warp-font)'
            }}>JobChain</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="warp-tabs desktop-only">
            {visibleTabs.map(tab => (
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
              {visibleTabs.map(tab => (
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
            {devMode && (
              <div className="sidebar-item">
                <span className="status-dot" /> Chain ID: 5042002
              </div>
            )}

            {devMode && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: 24 }}>CIRCLE STACK</div>
                <div className="sidebar-item">
                  <span className={`status-dot ${circleStatus === 'Active' ? 'online' : 'away'}`} />
                  <span>Programmatic: {circleStatus}</span>
                </div>
              </>
            )}

            {devMode && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: 24 }}>INFRASTRUCTURE</div>
                <a href="https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
                  <span style={{ color: 'var(--warp-success)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>Worker Profiles</span>
                </a>
                <a href="https://testnet.arcscan.app/address/0x8004B663056A597Dffe9eCcC1965A193B7388713" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
                  <span style={{ color: 'var(--warp-warning)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>Worker Rankings</span>
                </a>
                <a href="https://testnet.arcscan.app/address/0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE" target="_blank" rel="noopener noreferrer" className="sidebar-item" style={{ textDecoration: 'none' }}>
                  <span style={{ color: 'var(--warp-cyan)' }}>■</span> <span style={{ color: 'var(--warp-text)' }}>Payments &amp; Escrow</span>
                </a>
              </>
            )}

            {/* Dynamic Unified Balance */}
            {isConnected && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: 24 }}>UNIFIED USDC BALANCE ({isPasskey ? 'SCA' : 'EOA'})</div>
                <div className="sidebar-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ color: 'var(--warp-success)', fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                      {unifiedTotal !== null ? unifiedTotal.toFixed(2) : parseFloat(balance?.formatted || '0').toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--warp-muted)', fontSize: 10, fontWeight: 'bold' }}>USDC</span>
                  </div>
                  {unifiedBalances && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: 'var(--warp-muted)', width: '100%', paddingLeft: 6, borderLeft: '1px solid var(--warp-border)', marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Arc Network:</span> <span style={{ color: 'var(--warp-text)' }}>{unifiedBalances.arc.toFixed(2)} USDC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Base Sepolia:</span> <span style={{ color: 'var(--warp-text)' }}>{unifiedBalances.base.toFixed(2)} USDC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Arbitrum Sepolia:</span> <span style={{ color: 'var(--warp-text)' }}>{unifiedBalances.arbitrum.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  )}
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
                    onClick={() => setShowUserModal(true)}
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
                  {({ account, openConnectModal, mounted }) => {
                    if (!mounted) return null
                    if (!account) {
                      return (
                        <button className="warp-btn" onClick={openConnectModal} style={{ width: '100%', justifyContent: 'center' }}>
                          Connect EOA Wallet
                        </button>
                      )
                    }
                    return (
                      <div className={`sidebar-item ${!isPasskey ? 'active' : ''}`} onClick={() => setShowUserModal(true)} style={{ cursor: 'pointer' }}>
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
                    onClick={() => setActiveTab('settings')}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Fingerprint size={12} style={{ marginRight: 6 }} /> Login with Passkey
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="warp-main" style={{ position: 'relative' }}>
            {!isConnected && activeTab !== 'settings' && activeTab !== 'home' ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(100vh - 200px)',
                background: 'rgba(7, 7, 9, 0.75)',
                border: '1px dashed var(--warp-border)',
                borderRadius: 16,
                padding: 32,
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
              }}>
                <div style={{
                  background: 'rgba(255, 184, 0, 0.08)',
                  border: '1px solid rgba(255, 184, 0, 0.2)',
                  borderRadius: '50%',
                  padding: 24,
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(255, 184, 0, 0.1)'
                }}>
                  <Shield size={48} style={{ color: 'var(--warp-primary)' }} />
                </div>
                
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginBottom: 12, letterSpacing: '-0.02em' }}>
                  SECURE CLEARING INTERFACE LOCKED
                </h1>
                
                <p style={{ maxWidth: 460, fontSize: 13, color: 'var(--warp-muted)', lineHeight: 1.6, marginBottom: 32 }}>
                  The JobChain clearing economy requires an active authorized signer to submit goals, release escrows, or query worker credentials. Connect your external wallet or access with passkeys.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                  <ConnectButton.Custom>
                    {({ account, openConnectModal, mounted }) => {
                      if (!mounted) return null
                      return (
                        <button 
                          className="warp-btn" 
                          onClick={openConnectModal}
                          style={{
                            padding: '12px 24px',
                            fontSize: 13,
                            fontWeight: 'bold',
                            background: 'var(--warp-primary)',
                            color: '#070709',
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: 'none',
                            marginTop: 0
                          }}
                        >
                          <Zap size={16} /> Connect EOA Wallet
                        </button>
                      )
                    }}
                  </ConnectButton.Custom>

                  <button
                    className="warp-btn border"
                    onClick={() => setActiveTab('settings')}
                    style={{
                      padding: '12px 24px',
                      fontSize: 13,
                      fontWeight: 'bold',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--warp-border)',
                      color: '#ffffff',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <Fingerprint size={16} style={{ color: 'var(--warp-primary)' }} />
                    Login with Biometrics
                  </button>
                </div>
              </div>
            ) : (
              <div key={activeTab} className="tab-fade-in">
                {activeTab === 'home' && <DashboardTab devMode={devMode} />}
                {activeTab === 'tasks' && <JobsTab devMode={devMode} />}
                {activeTab === 'workers' && <WorkersTab devMode={devMode} />}
                {activeTab === 'payments' && <AgentWorkspaceTab setActiveTab={setActiveTab} />}
                {activeTab === 'activity' && <ActivityTab devMode={devMode} />}
                {activeTab === 'settings' && <SettingsTab devMode={devMode} setDevMode={setDevMode} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── USER CREDENTIALS MODAL ── */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: '#0E1015',
            border: '1px solid var(--warp-border)',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: 'rgba(143, 118, 255, 0.08)',
                  border: '1px solid rgba(143, 118, 255, 0.2)',
                  borderRadius: 8,
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Fingerprint size={20} style={{ color: 'var(--warp-primary)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', margin: 0 }}>SECURE ACCOUNT DETAILS</h3>
                  <span style={{ fontSize: 10, color: 'var(--warp-muted)' }}>Authorized credentials & signers on Arc</span>
                </div>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--warp-border)',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--warp-muted)',
                  transition: 'all 0.2s'
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Content Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              
              {/* Smart Contract Account details */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--warp-border)',
                borderRadius: 8,
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-cyan)', letterSpacing: '0.05em' }}>SMART ACCOUNT (SCA)</span>
                  <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>Active</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#070709', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 6 }}>
                  <code style={{ fontSize: 11, color: '#ffffff', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {address || 'Not Created'}
                  </code>
                  {address && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(address)
                        toast.success('Copied SCA address!')
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
                      title="Copy Address"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--warp-muted)' }}>Security Model:</span>
                    <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>Biometric Passkey</span>
                  </div>
                  {email && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--warp-muted)' }}>Linked Credential:</span>
                      <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>{email}</span>
                    </div>
                  )}
                </div>

                {/* SCA Balances Grid */}
                <div style={{
                  marginTop: 10,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  padding: 8,
                  borderRadius: 6
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>USDC Gas</span>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-cyan)', fontFamily: 'monospace' }}>
                      {parseFloat(balance?.formatted || '0').toFixed(4)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>USDC ERC-20</span>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-success)', fontFamily: 'monospace' }}>
                      {parseFloat(scaErc20USDC?.formatted || '0').toFixed(2)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>EURC ERC-20</span>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-warning)', fontFamily: 'monospace' }}>
                      {parseFloat(scaErc20EURC?.formatted || '0').toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* EOA signer details */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--warp-border)',
                borderRadius: 8,
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-success)', letterSpacing: '0.05em' }}>EXTERNAL SIGNER (EOA)</span>
                  <span style={{ fontSize: 9, background: eoaAddress ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: eoaAddress ? '#10B981' : 'var(--warp-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                    {eoaAddress ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#070709', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 6 }}>
                  <code style={{ fontSize: 11, color: eoaAddress ? '#ffffff' : 'var(--warp-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {eoaAddress || '—'}
                  </code>
                  {eoaAddress && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(eoaAddress)
                        toast.success('Copied EOA address!')
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
                      title="Copy Address"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--warp-muted)' }}>Role:</span>
                    <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>Smart Account Owner / Signer</span>
                  </div>
                </div>

                {eoaAddress && (
                  /* EOA Balances Grid */
                  <div style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    padding: 8,
                    borderRadius: 6
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>USDC Gas</span>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-cyan)', fontFamily: 'monospace' }}>
                        {parseFloat(eoaNativeBalance?.formatted || '0').toFixed(4)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>USDC ERC-20</span>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-success)', fontFamily: 'monospace' }}>
                        {parseFloat(eoaErc20USDC?.formatted || '0').toFixed(2)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--warp-muted)', display: 'block' }}>EURC ERC-20</span>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-warning)', fontFamily: 'monospace' }}>
                        {parseFloat(eoaErc20EURC?.formatted || '0').toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Developer-Controlled Agent Wallets */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--warp-border)',
                borderRadius: 8,
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-warning)', letterSpacing: '0.05em' }}>DEVELOPER-CONTROLLED AGENT WALLETS</span>
                  <button
                    onClick={() => fetchAgentBalances(agentWallets)}
                    disabled={loadingBalances}
                    style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 'bold' }}
                  >
                    <RefreshCw size={10} className={loadingBalances ? 'spin-animation' : ''} />
                    {loadingBalances ? 'Syncing...' : 'Sync Balances'}
                  </button>
                </div>
                
                {agentWallets.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--warp-muted)', textAlign: 'center', padding: '10px 0' }}>
                    No programmatic agent wallets spawned yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    {agentWallets.map((wallet) => {
                      const balances = agentBalances[wallet.walletId] || [];
                      return (
                        <div key={wallet.walletId} style={{ background: '#070709', border: '1px solid rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-text)' }}>
                              Worker Agent #{wallet.agentId}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontFamily: 'monospace' }}>
                              UUID: {wallet.walletId.slice(0, 8)}...
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>
                            <code style={{ fontSize: 10, color: 'var(--warp-cyan)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                              {wallet.address}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(wallet.address)
                                toast.success(`Copied Worker #${wallet.agentId} address!`)
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}
                              title="Copy Address"
                            >
                              <Copy size={10} />
                            </button>
                          </div>
                          
                          {/* Balances list */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {loadingBalances && balances.length === 0 ? (
                              <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontStyle: 'italic' }}>Loading balances...</span>
                            ) : balances.length === 0 ? (
                              <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontStyle: 'italic' }}>No balances returned or wallet unfunded</span>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                                {balances.map((b: any, i: number) => (
                                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: 4, textAlign: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                                    <span style={{ fontSize: 8, color: 'var(--warp-muted)', display: 'block' }}>
                                      {b.token?.symbol || 'USDC'} {b.token?.isNative ? 'Gas' : 'ERC-20'}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-success)', fontFamily: 'monospace' }}>
                                      {parseFloat(b.amount || '0').toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Infrastructure details */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--warp-border)',
                borderRadius: 8,
                padding: 14,
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--warp-muted)' }}>Active Network:</span>
                  <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>Arc Testnet (Chain ID 5042002)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--warp-muted)' }}>Gas Sponsor Status:</span>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>100% Sponsored (Gasless)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--warp-muted)' }}>Circle Agent Status:</span>
                  <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>{circleStatus} Mode</span>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              {isPasskey && (
                <button
                  onClick={() => {
                    logout()
                    setShowUserModal(false)
                    toast.success('Smart Account disconnected. You can now log in with a new email.')
                  }}
                  className="warp-btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    marginTop: 0,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#EF4444',
                    fontWeight: 'bold',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <LogOut size={14} />
                  Disconnect
                </button>
              )}
              <button
                onClick={() => setShowUserModal(false)}
                className="warp-btn"
                style={{ flex: 1, justifyContent: 'center', marginTop: 0, background: 'var(--warp-primary)', color: '#000', fontWeight: 'bold' }}
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
