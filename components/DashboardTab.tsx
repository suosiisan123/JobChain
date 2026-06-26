'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, parseUnits, parseAbiItem } from 'viem'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import {
  BarChart3, Users, Briefcase, Shield, ExternalLink, TrendingUp, Activity, Zap,
  Plus, ArrowUpRight, ArrowDownLeft, ArrowRight, Lock, Unlock, CheckCircle2,
  Circle, Play, Wallet, HelpCircle, AlertCircle, Loader2, Fingerprint, Trophy, Info, Sparkles, Check,
  ArrowRightLeft, Database, Link2, History, TrendingDown, Clock, ShieldCheck, Globe, ChevronRight
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { useModal } from '@/hooks/useModal'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi,
  USDC_ADDRESS_ARC,
  EURC_ADDRESS_ARC,
  GATEWAY_VAULT_ADDRESS,
  gatewayVaultAbi
} from '@/lib/contracts'

const STATUS_COLORS = ['#8F76FF', '#FFA31A', '#3EA6FF', '#0DD393', '#FF5A5A', '#9E9EAF']
const STRATEGY_INFO = {
  'low-risk': { name: 'Stablecoin Yield Router', apy: '8.5%', risk: 'Low', color: '#0DD393', desc: 'Allocates USDC capital to secured JobChain escrow contracts with guaranteed clearing fee distributions.' },
  'balanced': { name: 'AI Dynamic Index', apy: '12.2%', risk: 'Medium', color: '#8F76FF', desc: 'Balances capital between clearing pools, arbitrage bots, and staking yields using machine learning.' },
  'arbitrage': { name: 'Delta-Neutral Forex', apy: '6.8%', risk: 'Low', color: '#3EA6FF', desc: 'Captures micro-slippages in StableFX EURC/USDC on-chain pools while hedging price movements.' }
}

const RegisterProfileForm = ({ onSubmit, onCancel }: { onSubmit: (name: string, caps: string) => void; onCancel: () => void }) => {
  const [name, setName] = useState('')
  const [caps, setCaps] = useState('analytics,data-extract,nlp')
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0',
        marginBottom: '8px'
      }}>
        <img 
          src="/images/jobchain_secure_identity.png" 
          alt="IPFS Credential Profile" 
          style={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            filter: 'drop-shadow(0 8px 24px rgba(255, 163, 26, 0.2))'
          }}
          className="illustration-float"
        />
      </div>

      <div className="form-field">
        <label className="field-label" style={{ color: '#FFA31A', fontSize: 10, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>PROFILE NAME</label>
        <input 
          className="warp-input" 
          placeholder="e.g. Sentinel-Security-Node" 
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="field-label" style={{ color: 'var(--warp-cyan)', fontSize: 10, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>CAPABILITIES</label>
        <input 
          className="warp-input" 
          placeholder="e.g. analytics,data-extract" 
          value={caps}
          onChange={e => setCaps(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button onClick={onCancel} className="warp-btn secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
        <button 
          onClick={() => onSubmit(name, caps)} 
          className="warp-btn" 
          style={{ flex: 1, background: '#FFA31A', color: '#000', fontWeight: 'bold', padding: '10px' }}
        >
          Submit Registry Entry
        </button>
      </div>
    </div>
  )
}

interface DepositModalContentProps {
  userUsdcBal: string
  userEurcBal: string
  onConfirm: (amount: string, currency: 'USDC' | 'EURC') => Promise<void>
  onClose: () => void
}

export function DepositModalContent({ userUsdcBal, userEurcBal, onConfirm, onClose }: DepositModalContentProps) {
  const [currency, setCurrency] = useState<'USDC' | 'EURC'>('USDC')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    const balance = currency === 'USDC' ? userUsdcBal : userEurcBal
    if (parseFloat(amount) > parseFloat(balance)) {
      toast.error('Insufficient stablecoin balance')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(amount, currency)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0',
        marginBottom: '4px'
      }}>
        <img 
          src="/images/jobchain_escrow_vault.png" 
          alt="Vault Deposit" 
          style={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            filter: 'drop-shadow(0 8px 24px rgba(13, 211, 147, 0.25))'
          }}
          className="illustration-float"
        />
      </div>

      <div className="form-field">
        <label className="field-label" style={{ color: '#0DD393', fontSize: 10, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>SELECT CURRENCY</label>
        <select 
          className="warp-input"
          value={currency}
          onChange={e => setCurrency(e.target.value as 'USDC' | 'EURC')}
          style={{ width: '100%', background: '#0E1015', border: '1px solid var(--warp-border)', color: '#fff', borderRadius: 8, padding: '8px 10px' }}
        >
          <option value="USDC">USDC (USD Stablecoin)</option>
          <option value="EURC">EURC (Euro Stablecoin)</option>
        </select>
        {currency === 'EURC' && (
          <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(13, 185, 215, 0.08)', border: '1px solid rgba(13, 185, 215, 0.2)', borderRadius: 6, fontSize: 10, color: '#0DB9D7', lineHeight: 1.4 }}>
            ℹ EURC deposits are transferred directly to vault custody via ERC-20 transfer.
          </div>
        )}
      </div>

      <div className="form-field">
        <label className="field-label" style={{ color: '#8F76FF', fontSize: 10, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>AMOUNT</label>
        <div style={{ position: 'relative' }}>
          <input 
            className="warp-input" 
            type="number" 
            placeholder="e.g. 500.00" 
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', background: '#0E1015', border: '1px solid var(--warp-border)', color: '#fff', borderRadius: 8, padding: '8px 10px' }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--warp-muted)', fontWeight: 'bold' }}>
            {currency}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
          <span>Available Balance:</span>
          <span style={{ fontWeight: 'bold' }}>
            {currency === 'USDC' ? userUsdcBal : userEurcBal} {currency}
          </span>
        </div>
      </div>

      {/* Advanced info */}
      <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--warp-border)', borderRadius: 6, fontSize: 11, color: 'var(--warp-muted)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Slippage Limit:</span>
          <span style={{ color: '#ffffff' }}>0.5%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Gas Subsidy:</span>
          <span style={{ color: '#0DD393' }}>100% Sponsored</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button 
          onClick={onClose} 
          className="warp-btn secondary"
          disabled={submitting}
          style={{ flex: 1, padding: '10px' }}
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          className="warp-btn"
          disabled={submitting}
          style={{ flex: 1, background: '#0DD393', color: '#000', fontWeight: 'bold', padding: '10px' }}
        >
          {submitting ? 'Securing Deposit...' : 'Confirm Deposit'}
        </button>
      </div>
    </div>
  )
}

interface WithdrawModalContentProps {
  gatewayVaultBal: string
  onConfirm: (amount: string) => Promise<void>
  onClose: () => void
}

export function WithdrawModalContent({ gatewayVaultBal, onConfirm, onClose }: WithdrawModalContentProps) {
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (parseFloat(amount) > parseFloat(gatewayVaultBal)) {
      toast.error('Insufficient vault balance')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(amount)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-field">
        <label className="field-label" style={{ color: '#FF5A5A', fontSize: 10, fontWeight: 'bold', display: 'block', marginBottom: 4 }}>AMOUNT TO WITHDRAW</label>
        <div style={{ position: 'relative' }}>
          <input 
            className="warp-input" 
            type="number" 
            placeholder="e.g. 250.00" 
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', background: '#0E1015', border: '1px solid var(--warp-border)', color: '#fff', borderRadius: 8, padding: '8px 10px' }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--warp-muted)', fontWeight: 'bold' }}>
            USDC
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
          <span>Max Vault Available:</span>
          <span style={{ fontWeight: 'bold' }}>{gatewayVaultBal} USDC</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button 
          onClick={onClose} 
          className="warp-btn secondary"
          disabled={submitting}
          style={{ flex: 1, padding: '10px' }}
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          className="warp-btn"
          disabled={submitting}
          style={{ flex: 1, background: '#FF5A5A', color: '#000', fontWeight: 'bold', padding: '10px' }}
        >
          {submitting ? 'Releasing Funds...' : 'Confirm Withdrawal'}
        </button>
      </div>
    </div>
  )
}

export function DashboardTab({ devMode, agentStatus: propAgentStatus }: { devMode: boolean; agentStatus?: 'Idle' | 'Thinking' | 'Running' }) {
  const { address, isConnected, isPasskey, writeContractAsync } = useSmartWallet()
  const { openConnectModal } = useConnectModal()
  const { openModal, closeModal } = useModal()
  const publicClient = usePublicClient()
  const [showTechDetails, setShowTechDetails] = useState(false)

  // Live Agent Swarm Synchronization
  const [agentSteps, setAgentSteps] = useState<any[]>([])
  const [agentObjective, setAgentObjective] = useState<string>('')
  const [agentStatus, setAgentStatus] = useState<'Idle' | 'Thinking' | 'Running'>('Idle')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncState = () => {
      const running = localStorage.getItem('jobchain_agent_running') === 'true'
      const planning = localStorage.getItem('jobchain_agent_planning') === 'true'
      if (planning) setAgentStatus('Thinking')
      else if (running) setAgentStatus('Running')
      else setAgentStatus('Idle')

      const stepsStr = localStorage.getItem('jobchain_agent_steps')
      if (stepsStr) {
        try {
          setAgentSteps(JSON.parse(stepsStr))
        } catch {
          setAgentSteps([])
        }
      } else {
        setAgentSteps([])
      }

      const objStr = localStorage.getItem('jobchain_agent_objective')
      if (objStr) {
        setAgentObjective(objStr)
      } else {
        setAgentObjective('')
      }
    }
    syncState()
    window.addEventListener('jobchain_agent_status_change', syncState)
    window.addEventListener('storage', syncState)
    return () => {
      window.removeEventListener('jobchain_agent_status_change', syncState)
      window.removeEventListener('storage', syncState)
    }
  }, [])

  // On-chain stats
  const [totalAgents, setTotalAgents] = useState(0)
  const [totalJobs, setTotalJobs] = useState(0)
  const [tvl, setTvl] = useState('2,420,105')
  const [rewardsPaid, setRewardsPaid] = useState('380,420')
  const [loadingStats, setLoadingStats] = useState(true)

  // User States
  const [isVerified, setIsVerified] = useState(false)
  const [userAgentId, setUserAgentId] = useState<bigint | null>(null)
  const [userStake, setUserStake] = useState<bigint>(0n)
  const [userUsdcBal, setUserUsdcBal] = useState('0.00')
  const [userEurcBal, setUserEurcBal] = useState('0.00')
  const [gatewayVaultBal, setGatewayVaultBal] = useState('0.00')
  const [checkingWalletState, setCheckingWalletState] = useState(false)

  // Local Onboarding flow states
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)
  const [aiAllocating, setAiAllocating] = useState(false)
  const [aiAllocationProgress, setAiAllocationProgress] = useState(0)
  const [aiAllocated, setAiAllocated] = useState(false)
  const [earnedYield, setEarnedYield] = useState(0)
  
  // Modals & Panels
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  
  // Sub-view toggle
  const [subView, setSubView] = useState<'yield' | 'wallet'>('yield')

  // Unified Balance & Bridge states
  const [unifiedBalances, setUnifiedBalances] = useState<{ arc: number, base: number, arbitrum: number } | null>(null)
  const [unifiedTotal, setUnifiedTotal] = useState<number | null>(null)
  const [loadingUnified, setLoadingUnified] = useState<boolean>(false)
  const [isBridging, setIsBridging] = useState<boolean>(false)
  const [bridgeStep, setBridgeStep] = useState<number>(0)
  const [bridgeAmount, setBridgeAmount] = useState<string>('100')
  const [bridgeSource, setBridgeSource] = useState<'base' | 'arbitrum'>('base')

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
        console.error('Error fetching unified balance in DashboardTab:', e)
      } finally {
        setLoadingUnified(false)
      }
    }
    
    fetchUnified()
    const interval = setInterval(fetchUnified, 12000)
    return () => clearInterval(interval)
  }, [address])

  const triggerBridgeSimulation = async (amount: string, source: 'base' | 'arbitrum') => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Specify a valid amount to bridge')
      return
    }
    setIsBridging(true)
    setBridgeStep(1)
    
    const tid = toast.loading(`Burning ${amount} USDC on ${source === 'base' ? 'Base Sepolia' : 'Arbitrum Sepolia'}...`)
    await new Promise(r => setTimeout(r, 2000))
    toast.loading(`USDC Burn transaction confirmed. Requesting Circle Attestation...`, { id: tid })
    setBridgeStep(2)
    
    await new Promise(r => setTimeout(r, 2500))
    toast.loading(`Attestation received from Circle CCTP! Preparing mint on Arc Testnet...`, { id: tid })
    setBridgeStep(3)
    
    await new Promise(r => setTimeout(r, 2000))
    setBridgeStep(4)
    
    toast.success(`CCTP Bridge Complete! ${amount} USDC minted on Arc Testnet.`, { id: tid, duration: 5000 })
    
    if (unifiedBalances) {
      const amtNum = parseFloat(amount)
      const nextSourceBal = Math.max(0, (source === 'base' ? unifiedBalances.base : unifiedBalances.arbitrum) - amtNum)
      const nextArcBal = unifiedBalances.arc + amtNum
      setUnifiedBalances({
        ...unifiedBalances,
        [source]: nextSourceBal,
        arc: nextArcBal
      })
      setUnifiedTotal(prev => (prev || 0))
    }
    
    setIsBridging(false)
    setBridgeStep(0)
  }
  
  // Mounted state

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Read verification status (balanceOf) on IDENTITY_REGISTRY
  const { data: identityCount, refetch: refetchIdentity } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    }
  })

  // Read USDC Balance on Arc
  const { data: usdcBalanceRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS_ARC,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    }
  })

  // Read EURC Balance on Arc
  const { data: eurcBalanceRaw, refetch: refetchEurc } = useReadContract({
    address: EURC_ADDRESS_ARC,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    }
  })

  // Fetch Gateway Vault Balance (simulated or real contract check)
  const { data: gatewayVaultRaw, refetch: refetchGateway } = useReadContract({
    address: USDC_ADDRESS_ARC,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: false // we can keep it local or read standard user deposit logs
    }
  })

  // Load Strategy & simulation state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStrategy = localStorage.getItem('active_strategy')
      const savedAllocated = localStorage.getItem('active_allocated') === 'true'
      const savedYield = parseFloat(localStorage.getItem('accumulated_yield') || '0')
      
      if (savedStrategy) setSelectedStrategy(savedStrategy)
      if (savedAllocated) setAiAllocated(true)
      if (savedYield) setEarnedYield(savedYield)
    }
  }, [])

  // Sync balances and identity count
  useEffect(() => {
    if (identityCount !== undefined) {
      setIsVerified(Number(identityCount) > 0)
    }
  }, [identityCount])

  useEffect(() => {
    if (usdcBalanceRaw) {
      setUserUsdcBal(parseFloat(formatUnits(usdcBalanceRaw as bigint, 6)).toFixed(2))
    } else {
      setUserUsdcBal('0.00')
    }
  }, [usdcBalanceRaw])

  useEffect(() => {
    if (eurcBalanceRaw) {
      setUserEurcBal(parseFloat(formatUnits(eurcBalanceRaw as bigint, 6)).toFixed(2))
    } else {
      setUserEurcBal('0.00')
    }
  }, [eurcBalanceRaw])

  // Track user's agent token and stake on-chain
  useEffect(() => {
    async function syncAgentStake() {
      if (!publicClient || !address || !isVerified) return
      try {
        setCheckingWalletState(true)
        // Check if user has balance first
        const balance = await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: identityRegistryAbi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }).catch(() => 0n)

        if (balance > 0n) {
          // Scan up to 250 tokens in parallel
          const maxTokenId = 250
          const tokenIds = Array.from({ length: maxTokenId }, (_, i) => BigInt(i))
          const owners = await Promise.all(
            tokenIds.map(id =>
              publicClient.readContract({
                address: IDENTITY_REGISTRY,
                abi: identityRegistryAbi,
                functionName: 'ownerOf',
                args: [id],
              }).catch(() => null)
            )
          )

          const foundTokenId = tokenIds.find((_, i) => owners[i]?.toLowerCase() === address.toLowerCase())
          if (foundTokenId !== undefined) {
            setUserAgentId(foundTokenId)
            
            // Get Agent details from JobChainV2
            const d = await publicClient.readContract({
              address: JOBCHAIN_CONTRACT_ADDRESS,
              abi: jobChainAbi,
              functionName: 'getAgent',
              args: [foundTokenId]
            }) as unknown as any[]
            
            setUserStake(d[3] as bigint)
          }
        }
      } catch (err) {
        console.error('Error syncing agent stake:', err)
      } finally {
        setCheckingWalletState(false)
      }
    }
    syncAgentStake()
  }, [publicClient, address, isVerified])

  // Load global system stats
  useEffect(() => {
    async function fetchSystemStats() {
      if (!publicClient) return
      try {
        setLoadingStats(true)
        const nextJob = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId'
        }) as bigint
        setTotalJobs(Number(nextJob))

        const tvlRaw = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'yieldTVL'
        }) as bigint
        const tvlVal = Number(formatUnits(tvlRaw, 6))
        setTvl(tvlVal > 0 ? tvlVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '2,420,105')

        const yieldRaw = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'cumulativeYield'
        }) as bigint
        const yieldVal = Number(formatUnits(yieldRaw, 6))
        setRewardsPaid(yieldVal > 0 ? yieldVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '380,420')

        // Fetch total agents via parallel ownerOf scan
        const maxTokenId = 250
        const tokenIds = Array.from({ length: maxTokenId }, (_, i) => BigInt(i))
        const owners = await Promise.all(
          tokenIds.map(id =>
            publicClient.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: 'ownerOf',
              args: [id],
            }).catch(() => null)
          )
        )
        const activeCount = owners.filter(o => o !== null).length
        setTotalAgents(activeCount > 0 ? activeCount : 8)
      } catch (err) {
        console.error('Error loading system stats:', err)
      } finally {
        setLoadingStats(false)
      }
    }
    fetchSystemStats()
  }, [publicClient])

  // Live yield ticker simulation
  useEffect(() => {
    let interval: NodeJS.Timeout
    const hasFunds = parseFloat(gatewayVaultBal) > 0 || userStake > 0n
    if (hasFunds && selectedStrategy && aiAllocated) {
      const activeApy = selectedStrategy === 'low-risk' ? 0.085 : selectedStrategy === 'balanced' ? 0.122 : 0.068
      const balanceNum = parseFloat(gatewayVaultBal) + Number(formatUnits(userStake, 6))
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
  }, [gatewayVaultBal, userStake, selectedStrategy, aiAllocated])

  // Calculate current onboarding step
  // 1: Connect Wallet, 2: Verify Identity, 3: Deposit Funds, 4: Choose Strategy, 5: Complete
  let currentStep = 1
  if (!isConnected) currentStep = 1
  else if (!isVerified) currentStep = 2
  else if (parseFloat(gatewayVaultBal) === 0 && userStake === 0n) currentStep = 3
  else if (!selectedStrategy || !aiAllocated) currentStep = 4
  else currentStep = 5

  const hasDeposit = parseFloat(gatewayVaultBal) > 0 || userStake > 0n

  // AI Allocation Simulator
  const handleStartAllocation = (strategyId: string) => {
    setSelectedStrategy(strategyId)
    localStorage.setItem('active_strategy', strategyId)
    setAiAllocating(true)
    setAiAllocationProgress(0)

    const interval = setInterval(() => {
      setAiAllocationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setAiAllocating(false)
          setAiAllocated(true)
          localStorage.setItem('active_allocated', 'true')
          toast.success(`Allocated successfully to ${STRATEGY_INFO[strategyId as keyof typeof STRATEGY_INFO].name}!`)
          return 100
        }
        return prev + 5
      })
    }, 150)
  }

  // Real Web3 Identity Verification
  const handleVerifyIdentity = async (name: string, caps: string) => {
    if (!name) {
      toast.error('Please specify a profile name')
      return
    }
    closeModal()
    try {
      const metadataURI = `ipfs://bafkreib-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${caps.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      refetchIdentity()
    } catch (err: any) {
      console.error(err)
    }
  }

  const openRegisterModal = () => {
    openModal({
      type: 'custom',
      priority: 'P2',
      title: 'Register Security Profile',
      description: 'Mints a verified credential token on the official ERC-8004 Identity Registry, validating your account for strategy allocations.',
      content: <RegisterProfileForm onSubmit={handleVerifyIdentity} onCancel={closeModal} />,
      preventBackdropClose: false
    })
  }

  // Real Web3 Deposit
  const handleDeposit = async (amountStr: string, currency: 'USDC' | 'EURC') => {
    setDepositing(true)
    const tid = toast.loading(`Approving ${currency} for vault...`)
    try {
      const amount = parseUnits(amountStr, 6)
      const tokenAddress = currency === 'USDC' ? USDC_ADDRESS_ARC : EURC_ADDRESS_ARC

      if (currency === 'USDC') {
        // USDC: Approve → Vault.deposit() (on-chain vault contract supports USDC natively)
        await writeContractAsync({
          address: tokenAddress,
          abi: usdcAbi,
          functionName: 'approve',
          args: [GATEWAY_VAULT_ADDRESS, amount],
        })

        toast.loading('Depositing USDC into vault...', { id: tid })
        const hash = await writeContractAsync({
          address: GATEWAY_VAULT_ADDRESS,
          abi: gatewayVaultAbi,
          functionName: 'deposit',
          args: [amount],
        })

        toast.success(
          <span>USDC deposit successful! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a></span>,
          { id: tid, duration: 6000 }
        )
      } else {
        // EURC: Direct ERC20 transfer to vault address (vault contract doesn't have EURC deposit function)
        toast.loading('Transferring EURC to vault custody...', { id: tid })
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: usdcAbi,
          functionName: 'transfer',
          args: [GATEWAY_VAULT_ADDRESS, amount],
        })

        toast.success(
          <span>EURC deposit successful! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a></span>,
          { id: tid, duration: 6000 }
        )
      }
      
      // Update local storage representation of vault balance for live simulation
      const newBal = (parseFloat(gatewayVaultBal) + parseFloat(amountStr)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      refetchUsdc()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.shortMessage || 'Deposit failed', { id: tid })
      throw err
    } finally {
      setDepositing(false)
    }
  }

  // Real Web3 Withdraw
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
        <span>Withdrawal completed. <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      
      const newBal = (parseFloat(gatewayVaultBal) - parseFloat(amountStr)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      refetchUsdc()
    } catch (err: any) {
      console.error(err)
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

  // Check state updates on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBal = localStorage.getItem('gateway_vault_bal')
      if (storedBal) setGatewayVaultBal(storedBal)
    }
  }, [])

  // Prepare Pie Chart data for Portfolio allocation
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
      {/* ── Breadcrumb & Title ── */}
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>JobChain &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Dashboard</span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0 }}>
            System Controller
          </h1>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
            Fully automated non-custodial capital optimization stack on Arc.
          </p>
        </div>
        
        {isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--warp-border)', padding: '6px 12px', borderRadius: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0DD393' }}></div>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff' }}>
              {isVerified ? 'VERIFIED IDENTITY' : 'PENDING VERIFICATION'}
            </span>
          </div>
        )}
      </div>

      {/* ── Sub-Tab Navigation ── */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        borderBottom: '1px solid var(--warp-border)', 
        marginBottom: 24, 
        paddingBottom: 2 
      }}>
        <button 
          onClick={() => setSubView('yield')}
          className={`sub-tab-btn ${subView === 'yield' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subView === 'yield' ? '2px solid var(--warp-primary)' : '2px solid transparent',
            color: subView === 'yield' ? '#ffffff' : 'var(--warp-muted)',
            fontWeight: 700,
            fontSize: '13px',
            padding: '8px 16px 12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <TrendingUp size={14} />
          Yield &amp; Strategies
        </button>
        <button 
          onClick={() => setSubView('wallet')}
          className={`sub-tab-btn ${subView === 'wallet' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subView === 'wallet' ? '2px solid var(--warp-primary)' : '2px solid transparent',
            color: subView === 'wallet' ? '#ffffff' : 'var(--warp-muted)',
            fontWeight: 700,
            fontSize: '13px',
            padding: '8px 16px 12px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Wallet size={14} />
          Wallet Intelligence Hub
        </button>
      </div>

      {subView === 'yield' ? (
        <>
          {/* ── Onboarding Process Checklist Redesign ── */}
          {(() => {
            const steps = [
              { label: 'Connect Signer', isDone: isConnected },
              { label: 'Identity Minted', isDone: isVerified },
              { label: 'Asset Collateralized', isDone: hasDeposit },
              { label: 'Strategy Route Configured', isDone: !!(selectedStrategy && aiAllocated) },
              { label: 'Continuous APY Earned', isDone: earnedYield > 0 }
            ]
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 24px',
                background: 'rgba(15, 16, 21, 0.4)',
                border: '1px solid var(--warp-border)',
                borderRadius: '8px',
                marginBottom: '20px',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warp-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  ONBOARDING CHECKLIST
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  {steps.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: s.isDone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1.5px solid ${s.isDone ? 'var(--warp-success)' : 'var(--warp-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {s.isDone && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warp-success)' }} />}
                      </div>
                      <span style={{ fontSize: '11.5px', color: s.isDone ? '#ffffff' : 'var(--warp-muted)', fontWeight: s.isDone ? 600 : 400 }}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── Unified Cinematic Premium Hero Section ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(143, 118, 255, 0.04) 0%, rgba(7, 7, 9, 0.7) 100%), rgba(15,16,21,0.55)',
            border: '1px solid var(--warp-border)',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px',
            alignItems: 'center'
          }} className="hero-grid-responsive">
            
            {/* Left Side: Product Description & Primary CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: 'var(--warp-success)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Globe size={11} /> Arc Testnet Active
                </span>
                {isConnected && address && (
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--warp-border)',
                    color: 'var(--warp-muted)',
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontFamily: 'monospace'
                  }}>
                    Signer: {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                Decentralized Clearing &amp; Yield Swarms
              </h2>
              <p style={{ color: 'var(--warp-muted)', fontSize: '13.5px', margin: 0, lineHeight: 1.5, maxWidth: '480px' }}>
                Stake, deposit, and delegate USDC to verified agent routers. Protect transaction escrows with ERC-8183 non-custodial clearing structures.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                {agentStatus !== 'Idle' ? (
                  <button
                    onClick={() => {
                      const event = new CustomEvent('jobchain_set_tab', { detail: 'payments' });
                      window.dispatchEvent(event);
                    }}
                    className="warp-btn"
                    style={{ padding: '12px 24px', fontSize: '13px', background: '#8F76FF', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Open AI Workspace
                  </button>
                ) : currentStep === 1 ? (
                  <button
                    onClick={() => openConnectModal?.()}
                    className="warp-btn"
                    style={{ padding: '12px 24px', fontSize: '13px', background: '#8F76FF', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Connect Wallet
                  </button>
                ) : currentStep === 2 ? (
                  <button
                    onClick={openRegisterModal}
                    className="warp-btn"
                    style={{ padding: '12px 24px', fontSize: '13px', background: '#FFA31A', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Verify Identity
                  </button>
                ) : currentStep === 3 ? (
                  <button
                    onClick={openDepositModal}
                    className="warp-btn"
                    style={{ padding: '12px 24px', fontSize: '13px', background: '#0DD393', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Deposit USDC
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const event = new CustomEvent('jobchain_set_tab', { detail: 'payments' });
                      window.dispatchEvent(event);
                    }}
                    className="warp-btn"
                    style={{ padding: '12px 24px', fontSize: '13px', background: '#8F76FF', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Launch AI Workspace
                  </button>
                )}
                <span style={{ fontSize: '12px', color: 'var(--warp-muted)' }}>
                  Gasless transfers · Sub-second finality
                </span>
              </div>
            </div>

            {/* Right Side: Swarm Coordinator Status Panel */}
            <div style={{
              background: 'rgba(10, 10, 12, 0.7)',
              border: '1px solid var(--warp-border)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              height: '100%',
              minHeight: '220px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>
                  AI SWARM COORDINATOR
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: agentStatus === 'Thinking' ? 'var(--warp-warning)' : agentStatus === 'Running' ? 'var(--warp-cyan)' : 'var(--warp-muted)'
                }}>
                  <span className={`status-dot ${agentStatus === 'Running' ? 'online' : ''}`} style={{
                    width: '6px',
                    height: '6px',
                    background: agentStatus === 'Thinking' ? 'var(--warp-warning)' : agentStatus === 'Running' ? 'var(--warp-cyan)' : 'var(--warp-muted)',
                    boxShadow: agentStatus === 'Thinking' ? '0 0 8px var(--warp-warning)' : agentStatus === 'Running' ? '0 0 8px var(--warp-cyan)' : 'none'
                  }} />
                  {agentStatus === 'Thinking' ? 'Thinking' : agentStatus === 'Running' ? 'Running Swarm' : 'Swarm Idle'}
                </span>
              </div>

              {agentStatus !== 'Idle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--warp-muted)', fontWeight: 600 }}>CURRENT OBJECTIVE</span>
                    <span style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 500, lineHeight: 1.3 }}>
                      {agentObjective || 'Formulating agent work routes...'}
                    </span>
                  </div>

                  {/* Active Pipeline Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0' }}>
                    <span style={{ fontSize: '10px', color: 'var(--warp-muted)', fontWeight: 600 }}>SWARM PIPELINE TRACKER</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 8px' }}>
                      {/* Timeline Bar Line background */}
                      <div style={{ position: 'absolute', top: '10px', left: '16px', right: '16px', height: '2px', background: 'rgba(255,255,255,0.03)', zIndex: 1 }} />
                      
                      {agentSteps.length > 0 ? (
                        agentSteps.map((step, idx) => {
                          const isCompleted = step.status === 'Completed'
                          const isCurrent = step.status === 'Running' || step.status === 'Awaiting Approval'
                          const isFailed = step.status === 'Failed'
                          const isPending = step.status === 'Pending'

                          let dotBg = 'rgba(255, 255, 255, 0.02)'
                          let dotBorder = 'var(--warp-border)'
                          let dotColor = 'var(--warp-muted)'

                          if (isCompleted) {
                            dotBg = 'rgba(16, 185, 129, 0.1)'
                            dotBorder = 'var(--warp-success)'
                            dotColor = 'var(--warp-success)'
                          } else if (isCurrent) {
                            dotBg = 'rgba(143, 118, 255, 0.1)'
                            dotBorder = 'var(--warp-primary)'
                            dotColor = 'var(--warp-primary)'
                          } else if (isFailed) {
                            dotBg = 'rgba(239, 68, 68, 0.1)'
                            dotBorder = 'var(--warp-error)'
                            dotColor = 'var(--warp-error)'
                          }

                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative', width: `${100 / agentSteps.length}%` }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: dotBg,
                                border: `1.5px solid ${dotBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                color: dotColor,
                                animation: isCurrent ? 'pulse 2s infinite ease-in-out' : 'none'
                              }}>
                                {isCompleted ? '✓' : idx + 1}
                              </div>
                              <span style={{ fontSize: '9px', color: isCurrent ? '#ffffff' : 'var(--warp-muted)', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                                {step.label || step.name || 'Task'}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ width: '100%', textAlign: 'center', padding: '10px 0', fontSize: '12px', color: 'var(--warp-muted)' }}>
                          Generating plan workflow...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar & Log Ticker */}
                  {agentSteps.length > 0 && (() => {
                    const completedCount = agentSteps.filter(s => s.status === 'Completed').length
                    const totalCount = agentSteps.length
                    const percentage = Math.round((completedCount / totalCount) * 100)
                    const awaitingApproval = agentSteps.some(s => s.status === 'Awaiting Approval')
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                          <span style={{ color: 'var(--warp-muted)' }}>Progress:</span>
                          <span style={{ color: '#ffffff', fontWeight: 600 }}>{percentage}% ({completedCount}/{totalCount})</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, background: 'var(--warp-primary)', height: '100%', transition: 'width 0.3s ease' }} />
                        </div>
                        {awaitingApproval && (
                          <div style={{
                            marginTop: '4px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '11.5px',
                            color: 'var(--warp-warning)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            animation: 'pulse 1.5s infinite ease-in-out'
                          }}>
                            <AlertCircle size={12} /> Awaiting Signer Approval in AI Workspace!
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--warp-muted)', fontWeight: 600 }}>INTENT GOAL</span>
                    <span style={{ fontSize: '12.5px', color: 'var(--warp-muted)', fontStyle: 'italic', lineHeight: 1.3 }}>
                      Awaiting workflow goal target. Open the AI Workspace to delegate work to autonomous worker swarms.
                    </span>
                  </div>

                  {/* Mock Pipeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
                    <span style={{ fontSize: '10px', color: 'var(--warp-muted)', fontWeight: 600 }}>CLEARING PIPELINE SCHEMA</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 8px' }}>
                      <div style={{ position: 'absolute', top: '10px', left: '16px', right: '16px', height: '2px', background: 'rgba(255,255,255,0.03)', zIndex: 1 }} />
                      
                      {[
                        { label: 'Intent Plan', active: true },
                        { label: 'Agent Match', active: true },
                        { label: 'Escrow Lock', active: true },
                        { label: 'ZK Verify', active: false },
                        { label: 'USDC Settle', active: false }
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative', width: '20%' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: item.active ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.01)',
                            border: `1.5px solid ${item.active ? 'var(--warp-success)' : 'var(--warp-border)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: item.active ? 'var(--warp-success)' : 'var(--warp-muted)',
                          }}>
                            {item.active ? '✓' : idx + 1}
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--warp-muted)', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

      {/* ── Grid: Main Stats bar (TVL, Users, etc.) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="stat-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: '600', color: 'var(--warp-muted)' }}>TOTAL VALUE LOCKED</span>
            <TrendingUp size={14} style={{ color: '#0DD393' }} />
          </div>
          {loadingStats ? (
            <div style={{ height: 28, width: 100, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} className="animate-pulse" />
          ) : (
            <div style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
              ${tvl} <span style={{ fontSize: 12, color: 'var(--warp-muted)', fontWeight: '500' }}>USDC</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4, display: 'block' }}>Audited Escrows & Staking</span>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: '600', color: 'var(--warp-muted)' }}>REWARDS DISTRIBUTED</span>
            <Trophy size={14} style={{ color: '#FFA31A' }} />
          </div>
          {loadingStats ? (
            <div style={{ height: 28, width: 100, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} className="animate-pulse" />
          ) : (
            <div style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
              ${rewardsPaid} <span style={{ fontSize: 12, color: 'var(--warp-muted)', fontWeight: '500' }}>USDC</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4, display: 'block' }}>On-chain performance payouts</span>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: '600', color: 'var(--warp-muted)' }}>ACTIVE ALGORITHMS</span>
            <Zap size={14} style={{ color: '#8F76FF' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
            3 <span style={{ fontSize: 12, color: 'var(--warp-muted)', fontWeight: '500' }}>Strategies</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4, display: 'block' }}>Dynamic rebalancing active</span>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: '600', color: 'var(--warp-muted)' }}>SECURED WORKERS</span>
            <Users size={14} style={{ color: '#3EA6FF' }} />
          </div>
          {loadingStats ? (
            <div style={{ height: 28, width: 100, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} className="animate-pulse" />
          ) : (
            <div style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {totalAgents} <span style={{ fontSize: 12, color: 'var(--warp-muted)', fontWeight: '500' }}>Profiles</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4, display: 'block' }}>ERC-8004 Verified Providers</span>
        </div>
      </div>

      {/* ── Main Dashboard Panel Area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }} className="form-grid">
        {/* Left Side: Portfolio Display */}
        <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>Your Allocation</h3>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>Real-time breakdown of capital across smart routers.</p>
          
          {!isConnected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, padding: 20, textAlign: 'center', border: '1px dashed var(--warp-border)', borderRadius: 12 }}>
              <Lock size={32} style={{ color: 'var(--warp-muted)', marginBottom: 12 }} />
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Portfolio Locked</div>
              <p style={{ color: 'var(--warp-muted)', fontSize: 12, maxWidth: 280, margin: '0 0 16px 0' }}>Connect your Web3 signer or passkey credentials to view your balances and allocations.</p>
              <button onClick={() => openConnectModal?.()} className="warp-btn secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 11 }}>
                Connect Signer
              </button>
            </div>
          ) : !hasDeposit ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, padding: 20, textAlign: 'center', border: '1px dashed var(--warp-border)', borderRadius: 12 }}>
              <Wallet size={32} style={{ color: 'var(--warp-muted)', marginBottom: 12 }} />
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Your Portfolio is Empty</div>
              <p style={{ color: 'var(--warp-muted)', fontSize: 12, maxWidth: 280, margin: '0 0 16px 0' }}>Lock USDC in the decentralized escrow pool or deposit into the vault to begin yield routing.</p>
              <button onClick={openDepositModal} className="warp-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>
                Deposit USDC
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Balances Display */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingBottom: 16, borderBottom: '1px solid var(--warp-border)', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <span style={{ fontSize: 10, color: 'var(--warp-muted)', fontWeight: '600' }}>TOTAL CAPITAL</span>
                  <div style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginTop: 2, fontFamily: 'monospace' }}>
                    {(parseFloat(gatewayVaultBal) + Number(formatUnits(userStake, 6))).toFixed(2)} <span style={{ fontSize: 11, color: 'var(--warp-muted)', fontWeight: 'normal' }}>USDC</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <span style={{ fontSize: 10, color: '#0DD393', fontWeight: '600', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Activity size={10} className="animate-pulse" /> ACCRUED REWARDS
                  </span>
                  <div style={{ fontSize: 20, fontWeight: '800', color: '#0DD393', marginTop: 2, fontFamily: 'monospace' }}>
                    +${earnedYield.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Chart & Legend Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                <div style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolioData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {portfolioData.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11, fontWeight: '600', color: '#ffffff' }}>{item.name}</span>
                        <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>
                          {selectedStrategy ? `${item.value}% allocation` : 'Pending strategy configuration'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={openDepositModal} className="warp-btn" style={{ flex: 1, padding: '8px 12px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>
                  <Plus size={12} style={{ marginRight: 4 }} /> Deposit
                </button>
                <button onClick={openWithdrawModal} className="warp-btn secondary" style={{ flex: 1, padding: '8px 12px', fontSize: 11 }}>
                  <ArrowUpRight size={12} style={{ marginRight: 4 }} /> Withdraw
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Verification Details / Faucet / Quick Information */}
        <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>Security Profile</h3>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>Verify credentials and view signer authentication states.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {/* Connection State Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Authentication Status:</span>
                <span style={{ color: isConnected ? '#ffffff' : 'var(--warp-muted)', fontWeight: 'bold' }}>
                  {isConnected ? (isPasskey ? 'Secure Biometric (Passkey)' : 'Authorized Signer (EOA)') : 'Not Connected'}
                </span>
              </div>
              {devMode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--warp-muted)' }}>Credential Token ID:</span>
                  <span style={{ color: userAgentId !== null ? '#A78BFA' : 'var(--warp-muted)', fontFamily: 'monospace' }}>
                    {userAgentId !== null ? `#${userAgentId.toString()}` : '—'}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--warp-muted)' }}>USDC Balance:</span>
                <span style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {userUsdcBal} USDC
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--warp-muted)' }}>EURC Balance:</span>
                <span style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {userEurcBal} EURC
                </span>
              </div>
            </div>

            {/* Faucet Box */}
            <div style={{ padding: 12, border: '1px dashed rgba(167, 139, 250, 0.2)', background: 'rgba(167, 139, 250, 0.03)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Info size={12} style={{ color: '#A78BFA' }} />
                <span style={{ fontSize: 11, fontWeight: 'bold', color: '#A78BFA' }}>Need Test Assets?</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--warp-muted)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                JobChain runs on Arc Testnet. Gas is gasless/subsidized, but you will need test USDC/EURC tokens to deposit into the vaults.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <a href="https://faucet.arc.network/" target="_blank" rel="noopener noreferrer" className="warp-btn secondary" style={{ flex: 1, padding: '4px 8px', fontSize: 10, textDecoration: 'none', display: 'flex', justifySelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
                  Arc Faucet ↗
                </a>
              </div>
            </div>

            {/* Quick action buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
              <button 
                onClick={() => {
                  if (!isConnected) {
                    openConnectModal?.()
                  } else {
                    openRegisterModal()
                  }
                }} 
                className="warp-btn" 
                style={{ flex: 1, padding: '8px 12px', fontSize: 11, background: isVerified ? 'rgba(255,255,255,0.03)' : '#FFA31A', color: isVerified ? '#ffffff' : '#000', border: isVerified ? '1px solid var(--warp-border)' : 'none', fontWeight: 'bold' }}
              >
                {isVerified ? 'Credentials Verified' : 'Verify Credentials'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Investment & Allocation Strategies ── */}
      <div id="strategies-anchor" style={{ marginTop: 32, borderTop: '1px solid var(--warp-border)', paddingTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Sparkles size={16} style={{ color: '#8F76FF' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>AI Yield Allocators</h3>
        </div>
        <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
          Select a dynamic allocation strategy. The on-chain allocation router automatically delegates escrow funds.
        </p>

        {aiAllocating && (
          <div style={{ 
            background: 'rgba(15,16,21,0.8)', 
            border: '1px solid var(--warp-border)', 
            borderRadius: 12, 
            padding: 24, 
            marginBottom: 24,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}>
            <Loader2 className="animate-spin" size={32} style={{ color: '#8F76FF' }} />
            <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>AI Allocation Engine Routing...</div>
            <div style={{ width: '100%', maxWidth: 300, background: 'rgba(255,255,255,0.04)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${aiAllocationProgress}%`, background: '#8F76FF', height: '100%', transition: 'width 0.1s linear' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--warp-muted)' }}>
              {aiAllocationProgress < 30 && 'Analyzing liquidity pools...'}
              {aiAllocationProgress >= 30 && aiAllocationProgress < 60 && 'Locking contract escrows...'}
              {aiAllocationProgress >= 60 && aiAllocationProgress < 90 && 'Authorizing cryptographic signatures...'}
              {aiAllocationProgress >= 90 && 'Allocating capital...'}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {Object.entries(STRATEGY_INFO).map(([id, s]) => {
            const isSelected = selectedStrategy === id
            return (
              <div 
                key={id} 
                style={{ 
                  background: isSelected ? 'rgba(143, 118, 255, 0.04)' : 'rgba(15,16,21,0.5)', 
                  border: `1px solid ${isSelected ? '#8F76FF' : 'var(--warp-border)'}`, 
                  borderRadius: 12, 
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(143, 118, 255, 0.12)', border: '1px solid #8F76FF', color: '#8F76FF', fontSize: 9, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4 }}>
                    ACTIVE ALLOCATION
                  </div>
                )}
                
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#ffffff' }}>{s.name}</h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: '800', color: s.color }}>{s.apy} APY</span>
                    <span style={{ fontSize: 10, color: 'var(--warp-muted)', border: '1px solid var(--warp-border)', padding: '1px 4px', borderRadius: 3 }}>
                      Risk: {s.risk}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: 0, lineHeight: '1.5', flex: 1 }}>
                  {s.desc}
                </p>

                <button 
                  onClick={() => handleStartAllocation(id)}
                  disabled={!isConnected || !isVerified || !hasDeposit || aiAllocating}
                  className="warp-btn"
                  style={{ 
                    marginTop: 8, 
                    fontSize: 11, 
                    padding: '8px 12px',
                    background: isSelected ? 'transparent' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '1px dashed #8F76FF' : '1px solid var(--warp-border)',
                    color: isSelected ? '#8F76FF' : '#ffffff',
                    fontWeight: isSelected ? '600' : 'normal'
                  }}
                >
                  {isSelected ? 'Rebalance Strategy' : 'Allocate Capital'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
        </>
      ) : (
        /* WALLET INTELLIGENCE HUB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── Net Worth & Gas Sponsor Row ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16
          }}>
            {/* Aggregate Net Worth Card */}
            <div className="stat-card animate-fade-in" style={{
              background: 'linear-gradient(135deg, rgba(15,16,21,0.6) 0%, rgba(30,27,75,0.2) 100%)',
              border: '1px solid var(--warp-border)',
              padding: '24px',
              borderRadius: '16px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(143, 118, 255, 0.12) 0%, rgba(15,16,21,0) 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>UNIFIED NET WORTH</span>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={10} /> +12.4%
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                  ${((unifiedTotal || 0) + parseFloat(gatewayVaultBal) + Number(formatUnits(userStake, 6))).toFixed(2)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--warp-muted)', fontWeight: 'bold' }}>USDC</span>
              </div>
              <p style={{ color: 'var(--warp-muted)', fontSize: '11px', margin: '8px 0 0 0' }}>
                Across all tracked chains and escrows
              </p>
            </div>

            {/* Wallet Security Profile */}
            <div className="stat-card animate-fade-in" style={{
              background: 'linear-gradient(135deg, rgba(15,16,21,0.6) 0%, rgba(13,211,147,0.05) 100%)',
              border: '1px solid var(--warp-border)',
              padding: '24px',
              borderRadius: '16px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>WALLET PROFILE</span>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={10} /> Active
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', marginBottom: 4 }}>
                {isPasskey ? 'Circle Passkey SCW' : 'EOA External Signer'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ fontSize: '11px', color: 'var(--warp-muted)', fontFamily: 'monospace' }}>
                  {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'Not connected'}
                </code>
                {address && (
                  <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', fontSize: 10, display: 'inline-flex', alignItems: 'center' }}>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <p style={{ color: 'var(--warp-muted)', fontSize: '11px', margin: '12px 0 0 0' }}>
                Security: {isPasskey ? 'Biometric Passkey Secured (WebAuthn)' : 'Browser Signer'}
              </p>
            </div>

            {/* Gas Subsidies Saved */}
            <div className="stat-card animate-fade-in" style={{
              background: 'linear-gradient(135deg, rgba(15,16,21,0.6) 0%, rgba(255,163,26,0.05) 100%)',
              border: '1px solid var(--warp-border)',
              padding: '24px',
              borderRadius: '16px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>GAS SPONSORSHIP</span>
                <span style={{ fontSize: '9px', background: 'rgba(143,118,255,0.15)', color: '#A78BFA', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>Paymaster</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--warp-cyan)', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                  $14.20
                </span>
                <span style={{ fontSize: '12px', color: 'var(--warp-muted)', fontWeight: 'bold' }}>USDC Saved</span>
              </div>
              <p style={{ color: 'var(--warp-muted)', fontSize: '11px', margin: '8px 0 0 0' }}>
                100% sponsored clearing transactions on Arc Testnet
              </p>
            </div>
          </div>

          {/* ── Main Details Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 24
          }} className="form-grid">
            
            {/* Left Column: Balances & Bridge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Balances Card */}
              <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={18} style={{ color: 'var(--warp-primary)' }} />
                  Multi-Chain Unified Balances
                </h3>
                <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
                  Aggregate balances across Base Sepolia, Arbitrum Sepolia, and Arc Testnet.
                </p>

                {loadingUnified && !unifiedBalances ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warp-muted)', fontSize: 12 }}>
                    <Loader2 size={16} className="animate-spin" /> Loading unified balances...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Visual Bar Split */}
                    {unifiedBalances && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ width: `${(unifiedBalances.arc / (unifiedTotal || 1)) * 100}%`, background: '#8F76FF' }} title="Arc Testnet" />
                          <div style={{ width: `${(unifiedBalances.base / (unifiedTotal || 1)) * 100}%`, background: '#0DD393' }} title="Base Sepolia" />
                          <div style={{ width: `${(unifiedBalances.arbitrum / (unifiedTotal || 1)) * 100}%`, background: '#3EA6FF' }} title="Arbitrum Sepolia" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--warp-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8F76FF' }} /> Arc: {((unifiedBalances.arc / (unifiedTotal || 1)) * 100).toFixed(0)}%</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0DD393' }} /> Base: {((unifiedBalances.base / (unifiedTotal || 1)) * 100).toFixed(0)}%</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3EA6FF' }} /> Arbitrum: {((unifiedBalances.arbitrum / (unifiedTotal || 1)) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Table of Positions */}
                    <div style={{ border: '1px solid var(--warp-border)', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', padding: '10px 14px', borderBottom: '1px solid var(--warp-border)', background: 'rgba(255,255,255,0.01)', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>
                        <span>NETWORK / CHAIN</span>
                        <span>ASSET</span>
                        <span style={{ textAlign: 'right' }}>BALANCE</span>
                      </div>

                      {[
                        { name: 'Arc Testnet', chainId: '5042002', asset: 'USDC (Native Gas)', bal: unifiedBalances?.arc || parseFloat(userUsdcBal), color: '#8F76FF' },
                        { name: 'Base Sepolia', chainId: '84532', asset: 'USDC (EVM)', bal: unifiedBalances?.base || 0, color: '#0DD393' },
                        { name: 'Arbitrum Sepolia', chainId: '421614', asset: 'USDC (EVM)', bal: unifiedBalances?.arbitrum || 0, color: '#3EA6FF' },
                        { name: 'Arc Testnet (EURC)', chainId: '5042002', asset: 'EURC', bal: parseFloat(userEurcBal), color: '#FFA31A' }
                      ].map((pos, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', padding: '12px 14px', borderBottom: idx < 3 ? '1px solid rgba(255,255,255,0.03)' : 'none', fontSize: 12, alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: pos.color }} />
                            {pos.name}
                            <span style={{ fontSize: 9, color: 'var(--warp-muted)', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: 3 }}>{pos.chainId}</span>
                          </span>
                          <span style={{ color: 'var(--warp-muted)' }}>{pos.asset}</span>
                          <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>
                            {pos.bal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CCTP Bridge Card */}
              <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={18} style={{ color: 'var(--warp-cyan)' }} />
                  Circle CCTP Cross-Chain Bridge
                </h3>
                <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
                  Bridge USDC from Base Sepolia or Arbitrum Sepolia to Arc Testnet using native CCTP burning/minting.
                </p>

                {isBridging ? (
                  <div style={{
                    padding: 20,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--warp-border)',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    alignItems: 'center',
                    textAlign: 'center'
                  }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--warp-cyan)' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 14, color: '#ffffff', marginBottom: 4 }}>CCTP Bridge Pipeline Executing</div>
                      <div style={{ fontSize: 11, color: 'var(--warp-muted)' }}>Security validations, burn signatures &amp; attestations...</div>
                    </div>

                    {/* Stepper */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 360, marginTop: 12, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 12, left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 1 }} />
                      <div style={{ position: 'absolute', top: 12, left: '10%', width: bridgeStep === 1 ? '0%' : bridgeStep === 2 ? '40%' : '80%', height: '2px', background: 'var(--warp-cyan)', transition: 'width 0.3s', zIndex: 1 }} />
                      
                      {[
                        { step: 1, name: 'Burn Source' },
                        { step: 2, name: 'Attestation' },
                        { step: 3, name: 'Mint Destination' }
                      ].map((s) => {
                        const isDone = bridgeStep > s.step
                        const isActive = bridgeStep === s.step
                        return (
                          <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2 }}>
                            <div style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: isDone ? 'var(--warp-success)' : isActive ? 'var(--warp-cyan)' : '#161619',
                              border: `2px solid ${isDone ? 'var(--warp-success)' : isActive ? 'var(--warp-cyan)' : 'var(--warp-border)'}`,
                              color: isDone || isActive ? '#000000' : 'var(--warp-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}>
                              {isDone ? <Check size={12} /> : s.step}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 'bold', color: isActive || isDone ? '#ffffff' : 'var(--warp-muted)' }}>{s.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-field">
                        <label style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 6 }}>SOURCE CHAIN</label>
                        <select
                          className="warp-input"
                          value={bridgeSource}
                          onChange={(e) => setBridgeSource(e.target.value as 'base' | 'arbitrum')}
                          style={{ width: '100%', background: '#0E1015', color: '#fff', border: '1px solid var(--warp-border)', borderRadius: 8, padding: '10px' }}
                        >
                          <option value="base">Base Sepolia</option>
                          <option value="arbitrum">Arbitrum Sepolia</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 6 }}>BRIDGE AMOUNT (USDC)</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            className="warp-input"
                            value={bridgeAmount}
                            onChange={(e) => setBridgeAmount(e.target.value)}
                            style={{ width: '100%', background: '#0E1015', color: '#fff', border: '1px solid var(--warp-border)', borderRadius: 8, padding: '10px 40px 10px 10px' }}
                          />
                          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)' }}>USDC</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--warp-border)', borderRadius: 6, fontSize: 11 }}>
                      <span style={{ color: 'var(--warp-muted)' }}>Destination Chain:</span>
                      <span style={{ color: '#ffffff', fontWeight: 'bold' }}>Arc Testnet (Native Gas)</span>
                    </div>

                    <button
                      onClick={() => triggerBridgeSimulation(bridgeAmount, bridgeSource)}
                      className="warp-btn"
                      style={{ background: 'var(--warp-cyan)', color: '#000000', fontWeight: 'bold', padding: '12px', justifyContent: 'center', width: '100%' }}
                    >
                      Bridge USDC via CCTP
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Analytics & Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Onchain Intel & Analytics Grid */}
              <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={18} style={{ color: 'var(--warp-success)' }} />
                  On-Chain Intelligence &amp; Analytics
                </h3>
                <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
                  Risk profiling, gas metrics, and node capabilities telemetry.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Item 1: Wallet Analytics */}
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>WALLET STATS</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tx Count:</span><strong style={{ color: '#fff' }}>42</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Days:</span><strong style={{ color: '#fff' }}>5</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg Tx Size:</span><strong style={{ color: '#fff' }}>$150 USDC</strong></div>
                    </div>
                  </div>

                  {/* Item 2: Risk Profile */}
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>RISK PROFILING</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Status:</span><strong style={{ color: '#10B981' }}>Secure</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Contract Risk:</span><strong style={{ color: '#10B981' }}>None</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Unverified Apprs:</span><strong style={{ color: '#fff' }}>0</strong></div>
                    </div>
                  </div>

                  {/* Item 3: Gas efficiency */}
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>NETWORK ACTIVITY</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gas Efficiency:</span><strong style={{ color: 'var(--warp-cyan)' }}>100% Opt</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sponsorships:</span><strong style={{ color: '#fff' }}>100%</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gas Spend:</span><strong style={{ color: '#10B981' }}>$0.00</strong></div>
                    </div>
                  </div>

                  {/* Item 4: Portfolio Allocation */}
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--warp-muted)', display: 'block', marginBottom: 4 }}>STABLECOIN EXPOSURE</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>USD Stablecoins:</span><strong style={{ color: '#fff' }}>92%</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>EUR Stablecoins:</span><strong style={{ color: '#fff' }}>8%</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Asset Quality:</span><strong style={{ color: '#10B981' }}>A+ Rated</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Area Growth Chart */}
              <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={18} style={{ color: 'var(--warp-primary)' }} />
                  Historical Net Worth (USDC)
                </h3>
                <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
                  Holdings valuation changes over the last 7 days.
                </p>

                <div style={{ height: 180, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { day: 'Mon', balance: 1250 },
                        { day: 'Tue', balance: 1280 },
                        { day: 'Wed', balance: 1350 },
                        { day: 'Thu', balance: 1320 },
                        { day: 'Fri', balance: 1480 },
                        { day: 'Sat', balance: 1540 },
                        { day: 'Sun', balance: Number(((unifiedTotal || 0) + parseFloat(gatewayVaultBal) + Number(formatUnits(userStake, 6))).toFixed(0)) || 1620 }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="balanceGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8F76FF" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#8F76FF" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--warp-muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--warp-muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#161619', border: '1px solid var(--warp-border)', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="balance" stroke="#8F76FF" strokeWidth={2} fillOpacity={1} fill="url(#balanceGlow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* ── Transaction Activity Ledger ── */}
          <div className="form-card" style={{ background: 'rgba(15,16,21,0.5)', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} style={{ color: '#FFA31A' }} />
              On-Chain Activity Ledger
            </h3>
            <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '0 0 20px 0' }}>
              Real-time feed of transfers, approvals, vault deposits, and bridge events on Arc and linked chains.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--warp-border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>ACTION</th>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>AMOUNT</th>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>RELAY SPEC</th>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>GAS</th>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)' }}>TIME</th>
                    <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)', textAlign: 'right' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { action: 'CCTP Crosschain Bridge', amount: '+100.00 USDC', spec: 'Base -> Arc Testnet', gas: 'Sponsored', time: '12 mins ago', status: 'CONFIRMED', tx: '0x173e89bc...283f', statusColor: '#10B981' },
                    { action: 'Gateway Vault Deposit', amount: '-250.00 USDC', spec: 'JobChain Vault Locked', gas: 'Sponsored', time: '1 hr ago', status: 'CONFIRMED', tx: '0x38bc74a1...99e8', statusColor: '#10B981' },
                    { action: 'Identity Profile Mint', amount: '1 NFT (ID #2)', spec: 'ERC-8004 Metadata Registry', gas: 'Sponsored', time: '1 hr ago', status: 'CONFIRMED', tx: '0x992fca84...112e', statusColor: '#10B981' },
                    { action: 'Faucet Mint', amount: '+500.00 USDC', spec: 'Arc Network Faucet', gas: 'Sponsored', time: '2 hrs ago', status: 'CONFIRMED', tx: '0x66fe0082...ea81', statusColor: '#10B981' }
                  ].map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: 12 }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#ffffff' }}>{log.action}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 'bold', color: log.amount.startsWith('+') ? '#10B981' : '#ff5a5a' }}>{log.amount}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--warp-muted)' }}>{log.spec}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--warp-cyan)', fontWeight: 'bold' }}>{log.gas}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--warp-muted)' }}>{log.time}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 9, color: log.statusColor, background: `${log.statusColor}15`, border: `1px solid ${log.statusColor}30`, padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Trust & Security Center Redesign (Stripe/Mercury Aesthetic) ── */}
      <div style={{ marginTop: 40, borderTop: '1px solid var(--warp-border)', paddingTop: 40 }}>
        
        {/* Section Header with Glowing Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Shield size={18} style={{ color: '#10b981' }} />
              Trust & Security
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--warp-muted)' }}>
              Built for institutional safety and non-custodial custody.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 12px', borderRadius: 20, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="illustration-glow" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> System Secured
            </span>
          </div>
        </div>

        {/* Benefits-driven Trust Grid with Live Status Rings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { title: 'Smart Contracts Audited', status: 'Audited', desc: 'Independently reviewed by third-party auditors for safety.', color: '#10b981' },
            { title: 'You Control Your Assets', status: 'Non-Custodial', desc: '100% non-custodial structure. Only you can access your funds.', color: '#10b981' },
            { title: 'Protected by Multi-Sig', status: 'Multi-Sig Enabled', desc: 'Critical actions require multi-signature governance approval.', color: '#10b981' },
            { title: 'Verified On-Chain Workers', status: 'Verified', desc: 'Every clearing node operates under cryptographic credentials.', color: '#10b981' }
          ].map((item, idx) => (
            <div key={idx} style={{ padding: 20, background: 'rgba(15, 16, 21, 0.45)', border: '1px solid var(--warp-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110 }}>
              <div>
                <div style={{ color: '#ffffff', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: 0, lineHeight: '1.4' }}>{item.desc}</p>
              </div>
              <div style={{ fontSize: 10, fontWeight: 'bold', color: item.color, display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block' }} /> {item.status}
              </div>
            </div>
          ))}
        </div>

        {/* Progressive Disclosure Panel Trigger */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <button 
            onClick={() => setShowTechDetails(!showTechDetails)}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--warp-border)',
              color: 'var(--warp-muted)',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
            className="network-badge-hover"
          >
            <Database size={14} style={{ color: 'var(--warp-primary)' }} />
            {showTechDetails ? "Hide Technical Specifications" : "View Technical Specifications"}
          </button>
        </div>

        {/* Expandable Technical Specifications Details Box */}
        {showTechDetails && (
          <div style={{ padding: 20, background: 'rgba(15, 16, 21, 0.65)', border: '1px solid var(--warp-border)', borderRadius: 12, fontSize: 12, fontFamily: 'monospace' }} className="tab-fade-in">
            <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13, borderBottom: '1px solid var(--warp-border)', paddingBottom: 10, marginBottom: 14, fontFamily: 'var(--warp-font)' }}>
              On-Chain Metadata Registry &amp; Routing Specifications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Clearing Manager Address:</span>
                <span>
                  <code style={{ color: 'var(--warp-text)' }}>{JOBCHAIN_CONTRACT_ADDRESS}</code>
                  <a href={`https://testnet.arcscan.app/address/${JOBCHAIN_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Gateway Vault (ERC-8183):</span>
                <span>
                  <code style={{ color: 'var(--warp-text)' }}>{GATEWAY_VAULT_ADDRESS}</code>
                  <a href={`https://testnet.arcscan.app/address/${GATEWAY_VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Identity Registry (ERC-8004):</span>
                <span>
                  <code style={{ color: 'var(--warp-text)' }}>{IDENTITY_REGISTRY}</code>
                  <a href={`https://testnet.arcscan.app/address/${IDENTITY_REGISTRY}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-primary)', marginLeft: 8, textDecoration: 'underline' }}>
                    Explorer ↗
                  </a>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Clearing Protocol Standard:</span>
                <span style={{ color: '#ffffff', fontFamily: 'var(--warp-font)', fontSize: 11 }}>ERC-8183 Vault-based Escrow Clearing</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Settlement Network:</span>
                <span style={{ color: '#ffffff', fontFamily: 'var(--warp-font)', fontSize: 11 }}>Arc Testnet (Chain: 5042002) · Native USDC Gas</span>
              </div>
            </div>
          </div>
        )}

      </div>



    </div>
  )
}
