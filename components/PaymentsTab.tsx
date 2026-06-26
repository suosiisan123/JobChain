'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Lock, Unlock, CheckCircle2,
  TrendingUp, RefreshCw, Sparkles, Loader2, ArrowRight, Shield, Layers, HelpCircle
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { useModal } from '@/hooks/useModal'
import { DepositModalContent, WithdrawModalContent } from './DashboardTab'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  usdcAbi,
  GATEWAY_VAULT_ADDRESS,
  gatewayVaultAbi,
  EURC_ADDRESS_ARC
} from '@/lib/contracts'

const STRATEGY_INFO = {
  'low-risk': { name: 'Stablecoin Yield Router', apy: '8.5%', risk: 'Low', color: '#0DD393', desc: 'Allocates USDC capital to secured JobChain escrow contracts with guaranteed clearing fee distributions.' },
  'balanced': { name: 'AI Dynamic Index', apy: '12.2%', risk: 'Medium', color: '#8F76FF', desc: 'Balances capital between clearing pools, arbitrage bots, and staking yields using machine learning.' },
  'arbitrage': { name: 'Delta-Neutral Forex', apy: '6.8%', risk: 'Low', color: '#3EA6FF', desc: 'Captures micro-slippages in StableFX EURC/USDC on-chain pools while hedging price movements.' }
}

interface PaymentsTabProps {
  devMode: boolean
}

export function PaymentsTab({ devMode }: PaymentsTabProps) {
  const { address, isConnected, isPasskey, writeContractAsync } = useSmartWallet()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { openModal, closeModal } = useModal()

  // Balance and Yield states
  const [userUsdcBal, setUserUsdcBal] = useState('0.00')
  const [userEurcBal, setUserEurcBal] = useState('0.00')
  const [gatewayVaultBal, setGatewayVaultBal] = useState('0.00')
  const [earnedYield, setEarnedYield] = useState(0)

  // Strategies & Simulation
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)
  const [aiAllocating, setAiAllocating] = useState(false)
  const [aiAllocationProgress, setAiAllocationProgress] = useState(0)
  const [aiAllocated, setAiAllocated] = useState(false)

  // Loading states for modals
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Bridge simulation states
  const [bridgeFromChain, setBridgeFromChain] = useState('Base')
  const [bridgeToChain, setBridgeToChain] = useState('Arc')
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridging, setBridging] = useState(false)

  // Fetch balances from on-chain
  const fetchBalances = async () => {
    if (!address || !publicClient) return
    try {
      const usdcRaw = await publicClient.readContract({
        address: USDC_ADDRESS_ARC,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint
      setUserUsdcBal(parseFloat(formatUnits(usdcRaw, 6)).toFixed(2))

      try {
        const eurcRaw = await publicClient.readContract({
          address: EURC_ADDRESS_ARC,
          abi: usdcAbi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint
        setUserEurcBal(parseFloat(formatUnits(eurcRaw, 6)).toFixed(2))
      } catch {}

      try {
        const vaultRaw = await publicClient.readContract({
          address: GATEWAY_VAULT_ADDRESS,
          abi: gatewayVaultAbi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint
        setGatewayVaultBal(parseFloat(formatUnits(vaultRaw, 6)).toFixed(2))
      } catch {}
    } catch (err) {
      console.warn('Failed to fetch on-chain balances inside Payments:', err)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [address, publicClient])

  // Accumulate yields locally for display
  useEffect(() => {
    let interval: NodeJS.Timeout
    const hasFunds = parseFloat(gatewayVaultBal) > 0
    if (hasFunds && selectedStrategy && aiAllocated) {
      const activeApy = selectedStrategy === 'low-risk' ? 0.085 : selectedStrategy === 'balanced' ? 0.122 : 0.068
      const balanceNum = parseFloat(gatewayVaultBal)
      const yieldPerSec = (balanceNum * activeApy) / (365 * 24 * 3600)
      
      interval = setInterval(() => {
        setEarnedYield(prev => {
          const next = prev + yieldPerSec
          localStorage.setItem('accumulated_yield', next.toString())
          return next
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [gatewayVaultBal, selectedStrategy, aiAllocated])

  // Sync state with storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBal = localStorage.getItem('gateway_vault_bal')
      if (storedBal) setGatewayVaultBal(storedBal)

      const activeStrat = localStorage.getItem('active_strategy')
      if (activeStrat) setSelectedStrategy(activeStrat)

      const isAlloc = localStorage.getItem('active_allocated')
      if (isAlloc === 'true') setAiAllocated(true)

      const storedYield = localStorage.getItem('accumulated_yield')
      if (storedYield) setEarnedYield(parseFloat(storedYield))
    }
  }, [])

  // Start AI Allocation Simulation
  const handleStartAllocation = (strategyId: string) => {
    setSelectedStrategy(strategyId)
    localStorage.setItem('active_strategy', strategyId)
    setAiAllocating(true)
    setAiAllocationProgress(0)

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
          clearInterval(interval)
          setAiAllocating(false)
          setAiAllocated(true)
          localStorage.setItem('active_allocated', 'true')
          toast.success(`Allocated successfully to ${STRATEGY_INFO[strategyId as keyof typeof STRATEGY_INFO].name}!`)
          setAiAllocationProgress(100)
      } else {
        setAiAllocationProgress(progress)
      }
    }, 200)
  }

  // Handle Deposit
  const handleDeposit = async (amountStr: string, currency: 'USDC' | 'EURC') => {
    setDepositing(true)
    const tid = toast.loading(`Approving ${currency} for vault...`)
    try {
      const amount = parseUnits(amountStr, 6)
      const tokenAddress = currency === 'USDC' ? USDC_ADDRESS_ARC : EURC_ADDRESS_ARC
      await writeContractAsync({
        address: tokenAddress,
        abi: usdcAbi,
        functionName: 'approve',
        args: [GATEWAY_VAULT_ADDRESS, amount],
      })

      toast.loading('Depositing funds into vault...', { id: tid })
      const hash = await writeContractAsync({
        address: GATEWAY_VAULT_ADDRESS,
        abi: gatewayVaultAbi,
        functionName: 'deposit',
        args: [amount],
      })

      toast.success(
        <span>Deposit successful! Funds locked. {devMode && <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a>}</span>,
        { id: tid, duration: 6000 }
      )
      
      const newBal = (parseFloat(gatewayVaultBal) + parseFloat(amountStr)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      fetchBalances()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Deposit failed', { id: tid })
      throw err
    } finally {
      setDepositing(false)
    }
  }

  // Handle Withdraw
  const handleWithdraw = async (amountStr: string) => {
    setWithdrawing(true)
    const tid = toast.loading('Initiating secure vault release...')
    try {
      const amount = parseUnits(amountStr, 6)
      const hash = await writeContractAsync({
        address: GATEWAY_VAULT_ADDRESS,
        abi: gatewayVaultAbi,
        functionName: 'withdraw',
        args: [amount],
      })

      toast.success(
        <span>Withdrawal completed. {devMode && <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a>}</span>,
        { id: tid, duration: 6000 }
      )
      
      const newBal = (parseFloat(gatewayVaultBal) - parseFloat(amountStr)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      fetchBalances()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Withdrawal failed', { id: tid })
      throw err
    } finally {
      setWithdrawing(false)
    }
  }

  const openDepositModal = () => {
    openModal({
      type: 'custom',
      priority: 'P2',
      title: 'Deposit Capital',
      description: 'Fund your automated yield optimization portfolio.',
      content: (
        <DepositModalContent 
          userUsdcBal={userUsdcBal} 
          userEurcBal={userEurcBal} 
          onConfirm={handleDeposit} 
          onClose={closeModal} 
        />
      ),
      preventBackdropClose: false
    })
  }

  const openWithdrawModal = () => {
    openModal({
      type: 'custom',
      priority: 'P2',
      title: 'Withdraw Capital',
      description: 'Return assets back to your external Web3 address.',
      content: (
        <WithdrawModalContent 
          gatewayVaultBal={gatewayVaultBal} 
          onConfirm={handleWithdraw} 
          onClose={closeModal} 
        />
      ),
      preventBackdropClose: false
    })
  }

  // Handle Bridge Simulation (Circle CCTP visual wrapper)
  const handleBridge = () => {
    if (!bridgeAmount || parseFloat(bridgeAmount) <= 0) {
      toast.error('Specify a valid transfer amount')
      return
    }
    setBridging(true)
    const tid = toast.loading(`Initiating crosschain mint via CCTP from ${bridgeFromChain} to ${bridgeToChain}...`)
    
    setTimeout(() => {
      toast.loading('Awaiting settlement attestation on target network...', { id: tid })
      setTimeout(() => {
        toast.success(`Cross-chain mint completed! ${bridgeAmount} USDC added to vault.`, { id: tid, duration: 5000 })
        const newBal = (parseFloat(gatewayVaultBal) + parseFloat(bridgeAmount)).toFixed(2)
        setGatewayVaultBal(newBal)
        localStorage.setItem('gateway_vault_bal', newBal)
        setBridgeAmount('')
        setBridging(false)
        fetchBalances()
      }, 2000)
    }, 2000)
  }

  const hasDeposit = parseFloat(gatewayVaultBal) > 0
  const portfolioData = selectedStrategy
    ? [
        { name: 'Stablecoin Yield Router', value: selectedStrategy === 'low-risk' ? 70 : 40, color: '#0DD393' },
        { name: 'AI Dynamic Index', value: selectedStrategy === 'balanced' ? 70 : 30, color: '#8F76FF' },
        { name: 'Delta-Neutral Forex', value: selectedStrategy === 'arbitrage' ? 70 : 30, color: '#3EA6FF' },
      ]
    : [
        { name: 'Yield Escrows', value: 50, color: '#414868' },
        { name: 'Unallocated Vault', value: 50, color: '#24283B' },
      ]

  return (
    <div style={{ fontFamily: 'var(--warp-font)', color: 'var(--warp-text)', paddingBottom: 40 }}>
      {/* Breadcrumbs */}
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>JobChain &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Payments &amp; Escrow</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0 }}>
            Payments &amp; Capital Allocator
          </h1>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
            Lock clearing funds, allocate stablecoins to smart vaults, or bridge crosschain assets.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: 24 }} className="form-grid">
        
        {/* Left Side: Financial Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card 1: Balance & Allocations */}
          <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>Vault Allocation</h3>
            <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>Breakdown of capital across yield strategies.</p>

            {!isConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, textAlign: 'center', border: '1px dashed var(--warp-border)', borderRadius: 8, padding: 20 }}>
                <Lock size={28} style={{ color: 'var(--warp-muted)', marginBottom: 8 }} />
                <div style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Portfolio Protected</div>
                <p style={{ color: 'var(--warp-muted)', fontSize: 11, maxWidth: 260, margin: '4px 0 16px' }}>Connect EOA or Passkey Smart account to unlock the clearing vault.</p>
                <button onClick={() => openConnectModal?.()} className="warp-btn secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 11 }}>Connect Wallet</button>
              </div>
            ) : !hasDeposit ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, textAlign: 'center', border: '1px dashed var(--warp-border)', borderRadius: 8, padding: 20 }}>
                <Wallet size={28} style={{ color: 'var(--warp-muted)', marginBottom: 8 }} />
                <div style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>No Capital Deposited</div>
                <p style={{ color: 'var(--warp-muted)', fontSize: 11, maxWidth: 260, margin: '4px 0 16px' }}>Securely deposit USDC into the vault to active AI routing strategies.</p>
                <button onClick={openDepositModal} className="warp-btn" style={{ width: 'auto', padding: '6px 12px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>Deposit Funds</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Balance Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--warp-border)' }}>
                  <div>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontWeight: 'bold' }}>VAULT CAPITAL</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginTop: 2, fontFamily: 'monospace' }}>
                      {gatewayVaultBal} <span style={{ fontSize: 10, color: 'var(--warp-muted)' }}>USDC</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: 'var(--warp-success)', fontWeight: 'bold' }}>ACCRUED YIELD</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warp-success)', marginTop: 2, fontFamily: 'monospace' }}>
                      +${earnedYield.toFixed(6)}
                    </div>
                  </div>
                </div>

                {/* Pie Chart Representation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 100, height: 100 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={42}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {portfolioData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {portfolioData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 10, fontWeight: '600', color: '#ffffff' }}>{item.name}</span>
                          <span style={{ fontSize: 8, color: 'var(--warp-muted)' }}>
                            {selectedStrategy ? `${item.value}% allocation` : 'Pending configuration'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={openDepositModal} className="warp-btn" style={{ flex: 1, padding: '8px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold', marginTop: 0 }}>
                    Deposit USDC
                  </button>
                  <button onClick={openWithdrawModal} className="warp-btn secondary" style={{ flex: 1, padding: '8px', fontSize: 11, marginTop: 0 }}>
                    Withdraw
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Wallet Assets */}
          <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>Assets In Secure Wallet</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.18)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2775CA', color: '#fff', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>$</div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>USD Coin (USDC)</span>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13 }}>{userUsdcBal} USDC</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.18)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#091540', color: '#00F5FF', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>€</div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Euro Coin (EURC)</span>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13 }}>{userEurcBal} EURC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Yield Routers & Bridging */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: AI Allocators */}
          <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} style={{ color: '#8F76FF' }} /> Yield Optimization Allocators
            </h3>
            <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 16px 0' }}>Deploy funds into smart yield aggregation strategies.</p>

            {aiAllocating && (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--warp-border)', borderRadius: 8, padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Loader2 className="animate-spin spin-animation" size={24} style={{ color: '#8F76FF' }} />
                <div style={{ fontSize: 12, fontWeight: 'bold' }}>Executing allocation route...</div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${aiAllocationProgress}%`, background: '#8F76FF', height: '100%', transition: 'width 0.1s linear' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(STRATEGY_INFO).map(([id, s]) => {
                const isSelected = selectedStrategy === id
                return (
                  <div key={id} style={{
                    padding: 14,
                    background: isSelected ? 'rgba(143, 118, 255, 0.04)' : 'rgba(0,0,0,0.18)',
                    border: `1px solid ${isSelected ? '#8F76FF' : 'var(--warp-border)'}`,
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>{s.name}</span>
                      <span style={{ fontSize: 12, fontWeight: '800', color: s.color }}>{s.apy} APY</span>
                    </div>
                    <p style={{ fontSize: 10.5, color: 'var(--warp-muted)', margin: '4px 0', lineHeight: 1.4 }}>{s.desc}</p>
                    <button
                      onClick={() => handleStartAllocation(id)}
                      disabled={!isConnected || !hasDeposit || aiAllocating}
                      className="warp-btn"
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        padding: '6px',
                        justifyContent: 'center',
                        background: isSelected ? 'rgba(143,118,255,0.1)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px dashed #8F76FF' : '1px solid var(--warp-border)',
                        color: isSelected ? '#8F76FF' : '#ffffff',
                        fontWeight: 600,
                        width: '100%'
                      }}
                    >
                      {isSelected ? 'Active Strategy (Rebalance)' : 'Deploy Capital'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 2: Circle CCTP Crosschain Bridge Simulator */}
          <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>Cross-Chain Bridge (CCTP)</h3>
            <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 16px 0' }}>Teleport USDC native assets instantly from other EVM chains using Circle CCTP.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>FROM SOURCE CHAIN</label>
                <select className="warp-input" value={bridgeFromChain} onChange={e => setBridgeFromChain(e.target.value)} style={{ padding: '8px' }}>
                  <option value="Base">Base</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="Arbitrum">Arbitrum</option>
                  <option value="Polygon">Polygon</option>
                  <option value="Solana">Solana</option>
                </select>
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>TO DESTINATION CHAIN</label>
                <select className="warp-input" value={bridgeToChain} onChange={e => setBridgeToChain(e.target.value)} style={{ padding: '8px' }} disabled>
                  <option value="Arc">Arc (Native Gas)</option>
                </select>
              </div>
            </div>

            <div className="form-field" style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ color: 'var(--warp-success)' }}>USDC AMOUNT TO TRANSFER</label>
              <input 
                className="warp-input" 
                placeholder="e.g. 100.00 (USDC amount to bridge via Circle CCTP)" 
                type="number" 
                value={bridgeAmount} 
                onChange={e => setBridgeAmount(e.target.value)} 
                disabled={bridging}
              />
            </div>

            <button 
              className="warp-btn" 
              onClick={handleBridge} 
              disabled={!isConnected || !bridgeAmount || bridging}
              style={{ width: '100%', background: 'var(--warp-primary)', color: '#070709', justifyContent: 'center' }}
            >
              {bridging ? 'Verifying CCTP message attestation...' : 'Initiate Secure Bridge Transfer'}
            </button>
          </div>
        </div>
      </div>



    </div>
  )
}
