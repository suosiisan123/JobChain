'use client'

import { useState, useEffect } from 'react'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient } from 'wagmi'
import { 
  Fingerprint, LogOut, Key, Copy, Check, ShieldCheck, 
  RefreshCw, Layers, ToggleLeft, ToggleRight, Laptop, Cpu, ShieldAlert
} from 'lucide-react'
import { USDC_ADDRESS_ARC, usdcAbi, IDENTITY_REGISTRY, REPUTATION_REGISTRY, JOBCHAIN_CONTRACT_ADDRESS, GATEWAY_VAULT_ADDRESS } from '@/lib/contracts'
import { formatUnits } from 'viem'
import toast from 'react-hot-toast'

interface SettingsTabProps {
  devMode: boolean
  setDevMode: (val: boolean) => void
}

export function SettingsTab({ devMode, setDevMode }: SettingsTabProps) {
  const { address, isConnected, isPasskey, email, login, logout } = useSmartWallet()
  const publicClient = usePublicClient()

  const [inputEmail, setInputEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState('0.0000')
  const [gasBalance, setGasBalance] = useState('0.0000')
  const [txHistory, setTxHistory] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [faucetLoading, setFaucetLoading] = useState(false)

  const handleFaucet = async () => {
    if (!address) return
    setFaucetLoading(true)
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Faucet credits requested!')
        setTimeout(fetchWalletDetails, 5000)
      } else {
        toast.error(data.error || 'Faucet request failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request credits')
    } finally {
      setFaucetLoading(false)
    }
  }

  // Fetch balances and history
  const fetchWalletDetails = async () => {
    if (!address || !publicClient) return
    setRefreshing(true)
    try {
      // 1. Fetch USDC balance
      const rawUsdc = await publicClient.readContract({
        address: USDC_ADDRESS_ARC,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint
      setUsdcBalance(parseFloat(formatUnits(rawUsdc, 6)).toFixed(4))

      // 2. Fetch Native (gas) balance
      const rawGas = await publicClient.getBalance({ address: address as `0x${string}` })
      setGasBalance(parseFloat(formatUnits(rawGas, 18)).toFixed(4))
    } catch (err) {
      console.warn('Failed to fetch smart account details:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const fetchTxHistory = async () => {
    if (!email) return
    try {
      if (typeof window !== 'undefined') {
        const localHistory = localStorage.getItem(`tx_history_${email}`)
        if (localHistory) {
          setTxHistory(JSON.parse(localHistory))
        }
      }
    } catch {}
  }

  useEffect(() => {
    fetchWalletDetails()
    fetchTxHistory()
  }, [address, email, publicClient])

  // Track dynamic transactions executed via useSmartWallet hook
  useEffect(() => {
    const handleTxLogged = () => {
      fetchTxHistory()
      fetchWalletDetails()
    }
    window.addEventListener('storage', handleTxLogged)
    return () => window.removeEventListener('storage', handleTxLogged)
  }, [email])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputEmail) return
    setLoading(true)
    try {
      await login(inputEmail)
      setInputEmail('')
    } catch (err) {
      // already toasted in hook
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    toast.success('Copied address!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ fontFamily: 'var(--warp-font)', color: 'var(--warp-text)', paddingBottom: 40 }}>
      {/* Breadcrumbs */}
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>JobChain &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Settings</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0 }}>
            System Settings
          </h1>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
            Manage your interface modes, security preferences, and passkeys.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Card 1: Interface & Preferences */}
        <div className="form-card" style={{
          background: 'rgba(15,16,21,0.5)',
          padding: 24,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Laptop size={18} style={{ color: 'var(--warp-primary)' }} />
            Application Preferences
          </h3>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
            Customize dashboard display depth and complexity filters.
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--warp-border)',
            borderRadius: 8
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13, color: '#ffffff' }}>Developer Mode</div>
              <p style={{ fontSize: 11, color: 'var(--warp-muted)', margin: '4px 0 0 0', maxWidth: 450 }}>
                Expose advanced telemetry logs, node status diagrams, transaction hashes, and direct blockchain contract explorer links.
              </p>
            </div>
            <button 
              onClick={() => {
                const nextVal = !devMode
                setDevMode(nextVal)
                localStorage.setItem('jobchain_dev_mode', String(nextVal))
                toast.success(`Developer Mode ${nextVal ? 'enabled' : 'disabled'}`)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: devMode ? 'var(--warp-primary)' : 'var(--warp-muted)',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {devMode ? <ToggleRight size={44} /> : <ToggleLeft size={44} />}
            </button>
          </div>
        </div>

        {/* Card 2: Biometric Passkey Smart Account */}
        <div className="form-card" style={{
          background: 'rgba(15,16,21,0.5)',
          padding: 24,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Fingerprint size={18} style={{ color: 'var(--warp-success)' }} />
            Secure Biometric Wallet (SCA)
          </h3>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
            Non-custodial smart contract account credentials powered by device biometrics.
          </p>

          {isConnected && isPasskey ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    background: 'rgba(143, 118, 255, 0.08)',
                    padding: 10,
                    borderRadius: '50%',
                    color: 'var(--warp-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(143, 118, 255, 0.2)'
                  }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Active Security Credentials</h4>
                    <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>Linked Email: {email}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="warp-btn secondary"
                    onClick={handleFaucet}
                    disabled={faucetLoading}
                    style={{ padding: '6px 12px', fontSize: 11, marginTop: 0 }}
                  >
                    {faucetLoading ? 'Processing...' : 'Request Test Credits'}
                  </button>
                  <button
                    className="warp-btn secondary"
                    onClick={fetchWalletDetails}
                    disabled={refreshing}
                    style={{ padding: '6px 12px', fontSize: 11, marginTop: 0 }}
                  >
                    <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} />
                  </button>
                  <button
                    className="warp-btn secondary"
                    onClick={logout}
                    style={{ padding: '6px 12px', fontSize: 11, marginTop: 0, borderColor: 'rgba(255, 90, 90, 0.3)', color: '#FF5A5A' }}
                  >
                    <LogOut size={12} /> Logout
                  </button>
                </div>
              </div>

              {/* Account Address Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ background: 'rgba(7, 7, 9, 0.5)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--warp-border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', marginBottom: 4, fontWeight: 'bold' }}>SMART ACCOUNT ADDRESS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--warp-primary)', wordBreak: 'break-all' }}>{address}</span>
                    <button
                      onClick={copyAddress}
                      style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', padding: 2 }}
                    >
                      {copied ? <Check size={14} style={{ color: 'var(--warp-success)' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(7, 7, 9, 0.5)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--warp-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Fingerprint size={16} style={{ color: 'var(--warp-success)' }} />
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', fontWeight: 'bold' }}>SECURITY ENVELOPE KEY</span>
                    <span style={{ color: 'var(--warp-success)', fontSize: 12, fontWeight: 600 }}>Biometric Passkey Secured</span>
                  </div>
                </div>
              </div>

              {/* Balance Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div style={{ background: 'rgba(7, 7, 9, 0.5)', padding: '16px', borderRadius: 8, border: '1px solid var(--warp-border)', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--warp-muted)', display: 'block', marginBottom: 6, fontWeight: 'bold' }}>CLEARING ASSET BALANCE</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--warp-success)', fontVariantNumeric: 'tabular-nums' }}>
                    {usdcBalance}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--warp-muted)', marginLeft: 6 }}>USDC</span>
                </div>

                <div style={{ background: 'rgba(7, 7, 9, 0.5)', padding: '16px', borderRadius: 8, border: '1px solid var(--warp-border)', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--warp-muted)', display: 'block', marginBottom: 6, fontWeight: 'bold' }}>GAS SUBSIDY CREDIT</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--warp-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {gasBalance}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--warp-muted)', marginLeft: 6 }}>USDC</span>
                </div>
              </div>

              {/* Transaction History */}
              <div style={{ borderTop: '1px solid var(--warp-border)', paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Layers size={16} style={{ color: 'var(--warp-primary)' }} />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Smart Account Transactions</h4>
                </div>

                {txHistory.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '24px',
                    color: 'var(--warp-muted)',
                    fontSize: 12,
                    background: 'rgba(7, 7, 9, 0.3)',
                    borderRadius: 8,
                    border: '1px dashed var(--warp-border)'
                  }}>
                    No system settlements executed via Passkey yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th>Transaction Hash</th>
                          <th style={{ textAlign: 'right' }}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txHistory.map((tx, idx) => (
                          <tr key={idx}>
                            <td style={{ color: 'var(--warp-primary)', fontWeight: 600 }}>{tx.functionName}</td>
                            <td>
                              <a
                                href={`https://testnet.arcscan.app/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--warp-text)', textDecoration: 'none', fontFamily: 'monospace' }}
                              >
                                {tx.txHash.slice(0, 12)}...{tx.txHash.slice(-10)} ↗
                              </a>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--warp-muted)' }}>
                              {new Date(tx.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 440, margin: '20px auto 0', padding: 12 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Sign In with Device Passkey</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--warp-muted)', lineHeight: '1.5' }}>
                  Register or login to a gasless smart account using your device's biometric reader (Windows Hello, TouchID, FaceID).
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--warp-muted)', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. name@company.com (for gasless smart account sign-in)"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    required
                    className="warp-input"
                    style={{ background: 'rgba(7, 7, 9, 0.6)' }}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="warp-btn"
                  disabled={loading || !inputEmail}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '12px',
                    borderRadius: '8px',
                    background: loading || !inputEmail ? 'rgba(143, 118, 255, 0.2)' : 'var(--warp-primary)',
                    color: loading || !inputEmail ? 'rgba(255, 255, 255, 0.3)' : '#070709',
                    fontWeight: 700,
                    marginTop: 0
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" style={{ marginRight: 8 }} />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Key size={14} style={{ marginRight: 8 }} />
                      Continue with Passkey
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Card 3: Advanced Network Details (Only visible in Dev Mode) */}
        {devMode && (
          <div className="form-card" style={{
            background: 'rgba(15,16,21,0.5)',
            padding: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} style={{ color: 'var(--warp-warning)' }} />
              On-Chain Contract Specifications
            </h3>
            <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
              Raw contract addresses and transaction routing configuration.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12, fontFamily: 'monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--warp-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Identity Registry (ERC-8004):</span>
                <span style={{ color: '#ffffff' }}>
                  {IDENTITY_REGISTRY}
                  <a href={`https://testnet.arcscan.app/address/${IDENTITY_REGISTRY}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--warp-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Reputation Registry:</span>
                <span style={{ color: '#ffffff' }}>
                  {REPUTATION_REGISTRY}
                  <a href={`https://testnet.arcscan.app/address/${REPUTATION_REGISTRY}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--warp-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Clearing &amp; Escrow Manager:</span>
                <span style={{ color: '#ffffff' }}>
                  {JOBCHAIN_CONTRACT_ADDRESS}
                  <a href={`https://testnet.arcscan.app/address/${JOBCHAIN_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--warp-border)', borderRadius: 6 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Gateway Vault:</span>
                <span style={{ color: '#ffffff' }}>
                  {GATEWAY_VAULT_ADDRESS}
                  <a href={`https://testnet.arcscan.app/address/${GATEWAY_VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
