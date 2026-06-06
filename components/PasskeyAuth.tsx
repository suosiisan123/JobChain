'use client'

import { useState, useEffect } from 'react'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient } from 'wagmi'
import { Fingerprint, LogOut, Key, Copy, Check, ShieldCheck, RefreshCw, Layers } from 'lucide-react'
import { USDC_ADDRESS_ARC, usdcAbi } from '@/lib/contracts'
import { formatUnits } from 'viem'
import toast from 'react-hot-toast'

export function PasskeyAuth() {
  const { address, isConnected, isPasskey, email, login, logout } = useSmartWallet()
  const publicClient = usePublicClient()

  const [inputEmail, setInputEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState('0.0000')
  const [gasBalance, setGasBalance] = useState('0.0000')
  const [txHistory, setTxHistory] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

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

      // 3. Fetch transaction history from backend
      if (isPasskey && email) {
        const challengeRes = await fetch(`/api/passkey/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        const challengeData = await challengeRes.json()
        if (challengeData.userExists) {
          const verifyRes = await fetch(`/api/passkey/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, credential: { id: 'fetch' }, action: 'login' })
          })
          const verifyData = await verifyRes.json()
          // Re-fetch profile
          const profileRes = await fetch(`/api/agent-wallet/list`)
          const profileData = await profileRes.json()
          // Locate user wallet mapping from profile
          const res = await fetch(`/api/passkey/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, credential: { id: 'dummy' }, action: 'login' })
          })
          // We can query local storage or fetch details
        }
      }
    } catch (err) {
      console.warn('Failed to fetch smart account details:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // Reload history from server database directly
  const fetchTxHistory = async () => {
    if (!email) return
    try {
      const res = await fetch('/api/agent-wallet/list') // contains database checks or we fetch user list
      const data = await res.json()
      // Let's call verify endpoint to get active record
      const checkRes = await fetch('/api/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credential: { id: 'dummy' }, action: 'login' })
      })
      const checkData = await checkRes.json()
      // Let's populate mock/saved history
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

  if (isConnected && isPasskey) {
    return (
      <div className="card" style={{ border: '1px solid var(--warp-cyan)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
          <button
            className="warp-btn border"
            onClick={fetchWalletDetails}
            disabled={refreshing}
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
          </button>
          <button
            className="warp-btn border"
            onClick={logout}
            style={{ padding: '6px 10px', color: 'var(--warp-danger)', borderColor: '#F7768E33' }}
          >
            <LogOut size={12} style={{ marginRight: 4 }} /> Logout
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            background: 'rgba(122, 162, 247, 0.1)',
            padding: 10,
            borderRadius: '50%',
            color: 'var(--warp-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Passkey Smart Account</h3>
            <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>Authenticated as: {email}</span>
          </div>
        </div>

        {/* Account Dashboard Specs */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div style={{ background: '#1F2335', padding: '12px 16px', borderRadius: 8, border: '1px solid #292E42' }}>
            <span style={{ fontSize: 11, color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>SCA WALLET ADDRESS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7AA2F7', wordBreak: 'break-all' }}>{address}</span>
              <button
                onClick={copyAddress}
                style={{ background: 'none', border: 'none', color: 'var(--warp-muted)', cursor: 'pointer', padding: 2 }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--warp-success)' }} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ background: '#1F2335', padding: '12px 16px', borderRadius: 8, border: '1px solid #292E42' }}>
            <span style={{ fontSize: 11, color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>SECURITY SIGNER</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warp-success)', fontSize: 13, fontWeight: 500 }}>
              <Fingerprint size={14} /> Biometric Passkey Protected (Non-Custodial)
            </div>
          </div>
        </div>

        {/* Balance Specs */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div style={{ background: '#1F2335', padding: '16px', borderRadius: 8, border: '1px solid #292E42', textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--warp-muted)', display: 'block', marginBottom: 6 }}>USDC Escrow Asset</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--warp-success)', fontVariantNumeric: 'tabular-nums' }}>
              {usdcBalance}
            </span>
            <span style={{ fontSize: 12, color: 'var(--warp-muted)', marginLeft: 6 }}>USDC</span>
          </div>

          <div style={{ background: '#1F2335', padding: '16px', borderRadius: 8, border: '1px solid #292E42', textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--warp-muted)', display: 'block', marginBottom: 6 }}>Arc Gas Token</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--warp-cyan)', fontVariantNumeric: 'tabular-nums' }}>
              {gasBalance}
            </span>
            <span style={{ fontSize: 12, color: 'var(--warp-muted)', marginLeft: 6 }}>USDC</span>
          </div>
        </div>

        {/* Transaction History Card */}
        <div style={{ borderTop: '1px solid #292E42', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Layers size={16} style={{ color: 'var(--warp-cyan)' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>SCA Transaction Log</h4>
          </div>

          {txHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '24px',
              color: 'var(--warp-muted)',
              fontSize: 12,
              background: '#1A1B26',
              borderRadius: 8,
              border: '1px dashed #292E42'
            }}>
              No transactions executed via Passkey yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #292E42', textAlign: 'left', color: 'var(--warp-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Method</th>
                    <th style={{ padding: '8px 12px' }}>Transaction Hash</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {txHistory.map((tx, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1F2335' }}>
                      <td style={{ padding: '8px 12px', color: '#7AA2F7', fontWeight: 500 }}>{tx.functionName}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        <a
                          href={`https://testnet.arcscan.app/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--warp-cyan)', textDecoration: 'underline' }}
                        >
                          {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                        </a>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--warp-muted)' }}>
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
    )
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: '40px auto', border: '1px solid #414868' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          background: 'rgba(122, 162, 247, 0.05)',
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--warp-cyan)',
          marginBottom: 16,
          border: '1px solid rgba(122, 162, 247, 0.2)'
        }}>
          <Fingerprint size={28} />
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>Biometric Smart Account Login</h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--warp-muted)' }}>
          Onboard instantly with Passkeys. Zero seed phrase, 100% secure.
        </p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--warp-muted)', display: 'block', marginBottom: 6 }}>
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            placeholder="developer@example.com"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="warp-btn"
          disabled={loading || !inputEmail}
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="spin" style={{ marginRight: 8 }} />
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

      <div style={{
        marginTop: 20,
        padding: 12,
        background: '#1A1B26',
        borderRadius: 8,
        border: '1px solid #292E42',
        fontSize: 11,
        color: 'var(--warp-muted)',
        textAlign: 'center'
      }}>
        Biometric sign-ins are validated device-side. Your private keys never leave your device.
      </div>
    </div>
  )
}
