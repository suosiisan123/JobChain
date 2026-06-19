'use client'

import { useState, useEffect, useRef } from 'react'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient, useSignMessage } from 'wagmi'
import { Wallet, ShieldCheck, Zap, Play, Square, Loader2, Plus, ArrowDown, RefreshCw, BarChart2, Coins } from 'lucide-react'
import { GATEWAY_VAULT_ADDRESS, gatewayVaultAbi, USDC_ADDRESS_ARC, usdcAbi } from '@/lib/contracts'
import { parseUnits, formatUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import toast from 'react-hot-toast'

interface StreamLog {
  timestamp: string
  amount: number
  status: string
  txHash: string
  output: string
}

export function MicroStreamTab() {
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const { signMessageAsync } = useSignMessage()

  // Session keys
  const [sessionPrivateKey, setSessionPrivateKey] = useState<string | null>(null)
  const [authSignature, setAuthSignature] = useState<string | null>(null)

  // Vault Balances
  const [buyerVault, setBuyervault] = useState(0)
  const [agentEarnings, setAgentEarnings] = useState(0)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [depositAmount, setDepositAmount] = useState('5.00')
  const [withdrawAmount, setWithdrawAmount] = useState('5.00')

  // Streaming Parameters
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamSpeed, setStreamSpeed] = useState(200) // ms
  const [cumulativeEarned, setCumulativeEarned] = useState(0)
  const [totalRequests, setTotalRequests] = useState(0)
  const [logs, setLogs] = useState<StreamLog[]>([])

  // Chart data (rolling request volume)
  const [chartData, setChartData] = useState<number[]>([10, 15, 8, 12, 20, 18, 25, 30, 22, 28, 35, 42])

  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Fetch balances
  const fetchBalances = async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/microtask/vault?address=${address}`)
      const data = await res.json()
      if (res.ok) {
        setBuyervault(data.deposit || 0)
        setAgentEarnings(data.earnings || 0)
      }
    } catch (err) {
      console.error('Failed to load gateway balances:', err)
    }
  }

  useEffect(() => {
    fetchBalances()
    const timer = setInterval(fetchBalances, 8000)
    return () => clearInterval(timer)
  }, [address])

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Deposit Logic
  const handleVaultAction = async (action: 'deposit' | 'withdraw' | 'withdraw-earnings') => {
    if (!address) {
      toast.error('Connect wallet first')
      return
    }

    const amountStr = action === 'deposit' ? depositAmount : action === 'withdraw' ? withdrawAmount : agentEarnings.toString()
    const amountVal = parseFloat(amountStr)
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Invalid amount entered')
      return
    }

    setVaultLoading(true)
    const tid = toast.loading(`${action === 'deposit' ? 'Depositing' : 'Withdrawing'} USDC...`)

    try {
      // Execute standard on-chain transactions on Arc Testnet
      const rewardUnits = parseUnits(amountStr, 6)

      if (action === 'deposit') {
        // 1. Approve USDC transfer to GatewayVault
        await writeContractAsync({
          address: USDC_ADDRESS_ARC,
          abi: usdcAbi,
          functionName: 'approve',
          args: [GATEWAY_VAULT_ADDRESS, rewardUnits]
        })
        // 2. Deposit USDC into GatewayVault
        await writeContractAsync({
          address: GATEWAY_VAULT_ADDRESS,
          abi: gatewayVaultAbi,
          functionName: 'deposit',
          args: [rewardUnits]
        })
      } else if (action === 'withdraw') {
        // Withdraw USDC from GatewayVault
        await writeContractAsync({
          address: GATEWAY_VAULT_ADDRESS,
          abi: gatewayVaultAbi,
          functionName: 'withdraw',
          args: [rewardUnits]
        })
      }

      // Sync with local database
      const res = await fetch('/api/microtask/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: amountStr, action })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server updates failed')

      toast.success(`${action} succeeded!`, { id: tid })
      fetchBalances()
    } catch (err: any) {
      toast.error(err.message || 'Operation failed', { id: tid })
    } finally {
      setVaultLoading(false)
    }
  }

  // Stream Nanopayments loop
  const toggleStreaming = async () => {
    if (isStreaming) {
      // Stop stream
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
      setIsStreaming(false)
      toast('Streaming paused', { icon: '⏸️' })
    } else {
      // Validate vault balance before starting
      if (!address) {
        toast.error('Connect wallet first')
        return
      }
      if (buyerVault <= 0) {
        toast.error('Vault balance is 0.00. Please deposit USDC first.')
        return
      }

      let privKey = sessionPrivateKey
      let authSig = authSignature

      if (!privKey || !authSig) {
        const tid = toast.loading('Authorizing payment session... Please sign message in your wallet.')
        try {
          const generatedKey = generatePrivateKey()
          const account = privateKeyToAccount(generatedKey)
          const sessionAddr = account.address

          const authMsg = `Authorize JobChain Session: ${sessionAddr.toLowerCase()} for Buyer: ${address.toLowerCase()}`
          const signedAuth = await signMessageAsync({ message: authMsg })

          setSessionPrivateKey(generatedKey)
          setAuthSignature(signedAuth)

          privKey = generatedKey
          authSig = signedAuth
          toast.success('Session authorized successfully!', { id: tid })
        } catch (err: any) {
          toast.error(`Session authorization failed: ${err.message || err}`, { id: tid })
          return
        }
      }

      setIsStreaming(true)
      toast.success('Micro-job payment stream started!')

      // Start interval loop
      const buyerAddr = address.toLowerCase()
      const agentReceiver = '0x8004B663056A597Dffe9eCcC1965A193B7388713' // seller agent target
      const increment = 0.000001

      streamIntervalRef.current = setInterval(async () => {
        // Generate cryptographic-receipt payload
        const nonce = `${Date.now()}_${Math.floor(Math.random() * 100000)}`

        try {
          const account = privateKeyToAccount(privKey as `0x${string}`)
          const msg = `x402-nanopayment:${buyerAddr}:${agentReceiver}:${increment.toFixed(6)}:${nonce}`
          const signature = await account.signMessage({ message: msg })

          const receipt = {
            buyer: buyerAddr,
            receiver: agentReceiver,
            amount: increment.toFixed(6),
            nonce,
            signature,
            sessionAddress: account.address,
            authSignature: authSig
          }

          const base64Receipt = Buffer.from(JSON.stringify(receipt)).toString('base64')

          const res = await fetch('/api/microtask/request', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'PAYMENT-SIGNATURE': base64Receipt
            }
          })

          const data = await res.json()

          if (res.status === 402) {
            // Depleted balance
            toast.error('Vault balance exhausted. Stream stopped.')
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current)
              streamIntervalRef.current = null
            }
            setIsStreaming(false)
            fetchBalances()
            return
          }

          if (res.ok) {
            const timeStr = new Date().toLocaleTimeString() + '.' + String(Date.now() % 1000).padStart(3, '0')
            setLogs((prev) => [
              ...prev.slice(-49), // cap local logs history at 50
              {
                timestamp: timeStr,
                amount: increment,
                status: '200 OK',
                txHash: signature.slice(0, 16) + '...',
                output: data.output
              }
            ])
            setCumulativeEarned((prev) => prev + increment)
            setTotalRequests((prev) => prev + 1)

            // Randomly update chart rolling volume
            setChartData((prev) => [...prev.slice(-11), Math.floor(Math.random() * 20) + 15])
            
            // Adjust vault preview instantly to feel smooth
            setBuyervault((prev) => Math.max(0, prev - increment))
            setAgentEarnings((prev) => prev + increment)
          } else {
            console.error('Nanopayment stream error:', data.error)
          }
        } catch (err) {
          console.error('Request failed:', err)
        }
      }, streamSpeed)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
      }
    }
  }, [])

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/micro-streams</span>
        <span style={{ color: 'var(--warp-text)' }}> ./nanopayments-dash</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        Circle Gateway Nanopayments (x402 Protocol) — High-Frequency Agent Billing
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* ── Vault Operations ── */}
        <div className="card" style={{ border: '1px solid var(--warp-cyan)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warp-cyan)' }}>
            <Wallet size={16} /> Gateway Vault Ledger
          </h3>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div style={{ background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42' }}>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', marginBottom: 2 }}>BUYER DEPOSIT VAULT</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--warp-success)', fontVariantNumeric: 'tabular-nums' }}>
                ${buyerVault.toFixed(6)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginLeft: 4 }}>USDC</span>
            </div>

            <div style={{ background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42' }}>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', marginBottom: 2 }}>AGENT CLAIMABLE EARNINGS</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--warp-cyan)', fontVariantNumeric: 'tabular-nums' }}>
                ${agentEarnings.toFixed(6)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginLeft: 4 }}>USDC</span>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="warp-input"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                placeholder="5.00"
              />
              <button
                className="warp-btn"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={() => handleVaultAction('deposit')}
                disabled={vaultLoading}
              >
                <Plus size={14} style={{ marginRight: 4 }} /> Deposit to Vault
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="warp-input"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                placeholder="5.00"
              />
              <button
                className="warp-btn secondary"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={() => handleVaultAction('withdraw')}
                disabled={vaultLoading}
              >
                <ArrowDown size={14} style={{ marginRight: 4 }} /> Withdraw Deposit
              </button>
            </div>

            <button
              className="warp-btn"
              style={{ background: 'var(--warp-magenta)', width: '100%', justifyContent: 'center', fontSize: 12, marginTop: 4 }}
              onClick={() => handleVaultAction('withdraw-earnings')}
              disabled={vaultLoading || agentEarnings <= 0}
            >
              <Coins size={14} style={{ marginRight: 6 }} /> Claim &amp; Settle Agent Earnings
            </button>
          </div>
        </div>

        {/* ── Stream Controller ── */}
        <div className="card" style={{ border: '1px solid var(--warp-magenta)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warp-magenta)' }}>
            <Zap size={16} /> Micro-Job Payment Stream Controller
          </h3>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42' }}>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', marginBottom: 2 }}>STREAMED REVENUE</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--warp-success)', fontVariantNumeric: 'tabular-nums' }}>
                ${cumulativeEarned.toFixed(6)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginLeft: 4 }}>USDC</span>
            </div>

            <div style={{ flex: 1, background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42' }}>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', display: 'block', marginBottom: 2 }}>TOTAL MICROTASKS</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#7AA2F7', fontVariantNumeric: 'tabular-nums' }}>
                {totalRequests}
              </span>
              <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginLeft: 4 }}>tasks</span>
            </div>
          </div>

          {/* Stream configuration controls */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--warp-muted)', marginBottom: 6 }}>
              <span>Stream speed / request rate:</span>
              <span style={{ color: 'var(--warp-cyan)' }}>{streamSpeed}ms per request</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={streamSpeed}
              onChange={(e) => setStreamSpeed(Number(e.target.value))}
              disabled={isStreaming}
              style={{ width: '100%', accentColor: 'var(--warp-cyan)', cursor: 'pointer' }}
            />
          </div>

          <button
            className={`warp-btn ${isStreaming ? 'danger' : 'success'}`}
            style={{ width: '100%', justifyContent: 'center', background: isStreaming ? 'var(--warp-danger)' : 'var(--warp-success)', color: '#1A1B26' }}
            onClick={toggleStreaming}
          >
            {isStreaming ? (
              <>
                <Square size={14} style={{ marginRight: 6 }} /> Stop Payment Stream
              </>
            ) : (
              <>
                <Play size={14} style={{ marginRight: 6 }} /> Start Payment Stream ($0.000001/req)
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Throughput Rolling Chart & Logs ── */}
      <div className="grid-2">
        {/* Rolling Bar Chart */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={15} style={{ color: 'var(--warp-cyan)' }} /> Microtask Throughput (tasks/sec)
          </h3>
          <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 6, background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42' }}>
            {chartData.map((val, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${(val / 50) * 120}px`,
                    background: 'linear-gradient(180deg, var(--warp-cyan) 0%, var(--warp-primary) 100%)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.3s ease'
                  }}
                />
                <span style={{ fontSize: 9, color: 'var(--warp-muted)', marginTop: 4 }}>{idx + 1}s</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live streaming text feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={isStreaming ? 'spin' : ''} style={{ color: 'var(--warp-success)' }} /> Live x402 Nanopayment Receipt Stream
          </h3>
          <div style={{
            flex: 1,
            height: 160,
            overflowY: 'auto',
            background: '#15161E',
            padding: 8,
            borderRadius: 8,
            border: '1px solid #292E42',
            fontFamily: 'monospace',
            fontSize: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--warp-muted)', textAlign: 'center', paddingTop: 60 }}>
                Awaiting active payments stream...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 4, whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--warp-muted)' }}>[{log.timestamp}]</span>
                  <span style={{ color: 'var(--warp-success)' }}>➜ Paid ${log.amount.toFixed(6)}</span>
                  <span style={{ color: 'var(--warp-cyan)' }}>({log.status})</span>
                  <span style={{ color: 'var(--warp-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.output}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
