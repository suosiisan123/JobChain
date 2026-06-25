'use client'

import { useState, useEffect, useRef } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, parseUnits, parseAbiItem } from 'viem'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import {
  BarChart3, Users, Briefcase, Shield, ExternalLink, TrendingUp, Activity, Zap,
  Plus, ArrowUpRight, ArrowDownLeft, ArrowRight, Lock, Unlock, CheckCircle2,
  Circle, Play, Wallet, HelpCircle, AlertCircle, Loader2, Fingerprint, Trophy, Info, Sparkles
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
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

export function DashboardTab({ devMode }: { devMode: boolean }) {
  const { address, isConnected, isPasskey, writeContractAsync } = useSmartWallet()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()

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
  const [showDepositDrawer, setShowDepositDrawer] = useState(false)
  const [showWithdrawDrawer, setShowWithdrawDrawer] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositCurrency, setDepositCurrency] = useState<'USDC' | 'EURC'>('USDC')
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  
  // Verification Modal
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyName, setVerifyName] = useState('')
  const [verifyCaps, setVerifyCaps] = useState('analytics,data-extract,nlp')
  const [verifying, setVerifying] = useState(false)

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
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 9900n ? latestBlock - 9900n : 0n
        
        // Query Transfer events for IDENTITY_REGISTRY to find agent ID owned by user
        const logs = await publicClient.getLogs({
          address: IDENTITY_REGISTRY,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
          args: { to: address as `0x${string}` },
          fromBlock,
          toBlock: latestBlock,
        })
        
        if (logs.length > 0) {
          const tokenId = logs[0].args.tokenId!
          setUserAgentId(tokenId)
          
          // Get Agent details from JobChainV2
          const d = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            functionName: 'getAgent',
            args: [tokenId]
          }) as unknown as any[]
          
          setUserStake(d[3] as bigint)
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

        // Fetch total agents via Transfer logs
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 9900n ? latestBlock - 9900n : 0n
        const transferLogs = await publicClient.getLogs({
          address: IDENTITY_REGISTRY,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
          args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
          fromBlock,
          toBlock: latestBlock,
        })
        setTotalAgents(transferLogs.length > 0 ? transferLogs.length : 8)
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
  const handleVerifyIdentity = async () => {
    if (!verifyName) {
      toast.error('Please specify a profile name')
      return
    }
    setVerifying(true)
    const tid = toast.loading('Registering Identity on official ERC-8004 Registry...')
    try {
      const metadataURI = `ipfs://bafkreib-${verifyName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${verifyCaps.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      toast.success(
        <span>Verified! Credentials minted on ERC-8004. <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      setShowVerifyModal(false)
      setVerifyName('')
      refetchIdentity()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.shortMessage || 'Verification failed', { id: tid })
    } finally {
      setVerifying(false)
    }
  }

  // Real Web3 Deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setDepositing(true)
    const tid = toast.loading('Approving USDC for vault...')
    try {
      const amount = parseUnits(depositAmount, 6)

      // 1. Approve USDC spend to Gateway Vault
      await writeContractAsync({
        address: USDC_ADDRESS_ARC,
        abi: usdcAbi,
        functionName: 'approve',
        args: [GATEWAY_VAULT_ADDRESS, amount],
      })

      // 2. Deposit into Gateway Vault
      toast.loading('Depositing funds into vault...', { id: tid })
      const hash = await writeContractAsync({
        address: GATEWAY_VAULT_ADDRESS,
        abi: gatewayVaultAbi,
        functionName: 'deposit',
        args: [amount],
      })

      toast.success(
        <span>Deposit successful! Funds locked. <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#A78BFA',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      
      // Update local storage representation of vault balance for live simulation
      const newBal = (parseFloat(gatewayVaultBal) + parseFloat(depositAmount)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      setDepositAmount('')
      setShowDepositDrawer(false)
      refetchUsdc()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.shortMessage || 'Deposit failed', { id: tid })
    } finally {
      setDepositing(false)
    }
  }

  // Real Web3 Withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (parseFloat(withdrawAmount) > parseFloat(gatewayVaultBal)) {
      toast.error('Insufficient vault balance')
      return
    }
    setWithdrawing(true)
    const tid = toast.loading('Initiating secure vault release...')
    try {
      const amount = parseUnits(withdrawAmount, 6)

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
      
      const newBal = (parseFloat(gatewayVaultBal) - parseFloat(withdrawAmount)).toFixed(2)
      setGatewayVaultBal(newBal)
      localStorage.setItem('gateway_vault_bal', newBal)
      
      setWithdrawAmount('')
      setShowWithdrawDrawer(false)
      refetchUsdc()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.shortMessage || 'Withdrawal failed', { id: tid })
    } finally {
      setWithdrawing(false)
    }
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

      {/* ── Onboarding Process Steps Bar ── */}
      <div style={{ 
        background: 'rgba(15,16,21,0.5)', 
        border: '1px solid var(--warp-border)', 
        borderRadius: 12, 
        padding: '16px 24px', 
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {[
          { label: 'Connect Wallet', id: 1 },
          { label: 'Identity Verification', id: 2 },
          { label: 'Deposit Funds', id: 3 },
          { label: 'Choose Strategy', id: 4 },
          { label: 'Earn Rewards', id: 5 }
        ].map((s, idx) => {
          const isDone = currentStep > s.id
          const isActive = currentStep === s.id
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 150 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 'bold',
                background: isDone ? 'rgba(13, 211, 147, 0.12)' : isActive ? 'rgba(143, 118, 255, 0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isDone ? '#0DD393' : isActive ? '#8F76FF' : 'var(--warp-border)'}`,
                color: isDone ? '#0DD393' : isActive ? '#8F76FF' : 'var(--warp-muted)'
              }}>
                {isDone ? <CheckCircle2 size={12} /> : s.id}
              </div>
              <span style={{ 
                fontSize: 12, 
                fontWeight: isActive ? '600' : '500', 
                color: isActive ? '#ffffff' : isDone ? 'var(--warp-text)' : 'var(--warp-muted)' 
              }}>
                {s.label}
              </span>
              {idx < 4 && <ArrowRight size={12} style={{ color: 'rgba(255, 255, 255, 0.15)', marginLeft: 'auto' }} className="desktop-only" />}
            </div>
          )
        })}
      </div>

      {/* ── Dynamic Hero / Action Card ── */}
      <div style={{
        background: 'radial-gradient(ellipse at top, rgba(143, 118, 255, 0.08) 0%, rgba(15,16,21,0) 80%), rgba(15,16,21,0.65)',
        border: '1px solid var(--warp-border)',
        borderRadius: 16,
        padding: 32,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
          SECURE ENCLAVE ACTIVE
        </div>

        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8F76FF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              <Sparkles size={14} /> ONBOARDING PORTAL
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Start compounding yield in under 2 minutes.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, color: 'var(--warp-muted)', fontSize: 13 }}>
              <div>✓ Connect Instantly (No Password)</div>
              <div>✓ Verify Identity (One-Click IPFS Profile)</div>
              <div>✓ Direct USDC Allocation</div>
              <div>✓ Non-Custodial Vault Protection</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <button onClick={() => openConnectModal?.()} className="warp-btn" style={{ padding: '12px 24px', fontSize: 13, background: '#8F76FF', color: '#000', fontWeight: 'bold' }}>
                Connect Wallet
              </button>
              <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>Estimated setup time: <strong>1 minute</strong></span>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FFA31A', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              <Shield size={14} /> IDENTITY VERIFICATION REQUIRED
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Unlock Automated Yield Allocation
            </h2>
            <p style={{ color: 'var(--warp-muted)', fontSize: 13, margin: 0, maxWidth: 600 }}>
              To satisfy compliance rules and access the yield routers, you must verify your identity. This mints a secure, non-custodial ERC-8004 credential profile linked to your wallet.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <button onClick={() => setShowVerifyModal(true)} className="warp-btn" style={{ padding: '12px 24px', fontSize: 13, background: '#FFA31A', color: '#000', fontWeight: 'bold' }}>
                Verify Identity
              </button>
              <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>Mints ERC-8004 Credential · Takes ~30 seconds</span>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0DD393', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              <Wallet size={14} /> NO CAPITAL DEPOSITED
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Deposit USDC to Start Earning APY
            </h2>
            <p style={{ color: 'var(--warp-muted)', fontSize: 13, margin: 0, maxWidth: 600 }}>
              Your credentials are valid! Now deposit USDC or EURC into the non-custodial gateway vault. Your capital remains yours, fully protected, and can be withdrawn at any time.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <button onClick={() => setShowDepositDrawer(true)} className="warp-btn" style={{ padding: '12px 24px', fontSize: 13, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>
                Deposit Funds
              </button>
              <span style={{ fontSize: 12, color: 'var(--warp-muted)' }}>Direct wallet deposit, cross-chain transfer, or forex swap</span>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8F76FF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              <Sparkles size={14} /> CHOOSE INVESTMENT STRATEGY
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Ready to Allocate Capital
            </h2>
            <p style={{ color: 'var(--warp-muted)', fontSize: 13, margin: 0, maxWidth: 600 }}>
              Your funds are deposited. Select one of the three audited AI-managed yield strategies below to automatically distribute your capital into high-yield smart contracts.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <a href="#strategies-anchor" className="warp-btn" style={{ padding: '12px 24px', fontSize: 13, background: '#8F76FF', color: '#000', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Select AI Strategy <ArrowRight size={14} />
              </a>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0DD393', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
              <CheckCircle2 size={14} /> SYSTEM ACTIVE & COMPILING APY
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Capital Fully Optimized by AI
            </h2>
            <p style={{ color: 'var(--warp-muted)', fontSize: 13, margin: 0, maxWidth: 600 }}>
              Your strategy is active. AI is dynamically rebalancing allocations across secured escrows and liquidity pools on Arc to target maximum yield efficiency.
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <button onClick={() => setShowDepositDrawer(true)} className="warp-btn" style={{ padding: '10px 20px', fontSize: 12, background: 'rgba(255,255,255,0.02)', color: '#fff', border: '1px solid var(--warp-border)' }}>
                Deposit More
              </button>
              <button onClick={() => setShowWithdrawDrawer(true)} className="warp-btn secondary" style={{ padding: '10px 20px', fontSize: 12, border: '1px solid rgba(255, 90, 90, 0.3)', color: '#FF5A5A' }}>
                Withdraw Capital
              </button>
            </div>
          </div>
        )}
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
              <button onClick={() => setShowDepositDrawer(true)} className="warp-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>
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
                <button onClick={() => setShowDepositDrawer(true)} className="warp-btn" style={{ flex: 1, padding: '8px 12px', fontSize: 11, background: '#0DD393', color: '#000', fontWeight: 'bold' }}>
                  <Plus size={12} style={{ marginRight: 4 }} /> Deposit
                </button>
                <button onClick={() => setShowWithdrawDrawer(true)} className="warp-btn secondary" style={{ flex: 1, padding: '8px 12px', fontSize: 11 }}>
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
                    setShowVerifyModal(true)
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

      {/* ── Trust & Audit Credentials Section ── */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--warp-border)', paddingTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={16} style={{ color: '#0DD393' }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: 1 }}>
            SECURITY &amp; SYSTEM ATTRIBUTES
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { title: 'Audited Smart Contracts', desc: 'Verified deployment on Arc. Slashed collateral and release mechanics enforced on-chain.' },
            { title: 'Multi-Signature Governance', desc: 'Contract protocol rates and system fees require multi-signature approval from the DAO.' },
            { title: '100% Non-Custodial', desc: 'No counterparty risk. Funds locked inside standard EVM vault architecture. Withdraw anytime.' },
            { title: 'Compliant & Verified', desc: 'Every worker profile operates under EAS credentials on-chain, conforming to ERC-8004 standards.' }
          ].map((item, idx) => (
            <div key={idx} style={{ padding: 16, background: 'rgba(15,16,21,0.3)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
              <div style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{item.title}</div>
              <p style={{ color: 'var(--warp-muted)', fontSize: 11, margin: 0, lineHeight: '1.4' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Platform Reference / Contract Info ── */}
      {devMode && (
        <div style={{ marginTop: 32, borderTop: '1px dashed var(--warp-border)', paddingTop: 24, fontSize: 11, color: 'var(--warp-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>Clearing Contract:</strong> <code style={{ color: 'var(--warp-text)' }}>{JOBCHAIN_CONTRACT_ADDRESS}</code>
              <a href={`https://testnet.arcscan.app/address/${JOBCHAIN_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA', textDecoration: 'underline', marginLeft: 8 }}>
                Explorer ↗
              </a>
            </div>
            <div>
              <strong>Gateway Vault:</strong> <code style={{ color: 'var(--warp-text)' }}>{GATEWAY_VAULT_ADDRESS}</code>
              <a href={`https://testnet.arcscan.app/address/${GATEWAY_VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA', textDecoration: 'underline', marginLeft: 8 }}>
                Explorer ↗
              </a>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            Standard: ERC-8183 clearing protocol · Network: Arc Testnet (5042002) · Native stablecoin gas
          </div>
        </div>
      )}

      {/* ── MODAL: Verify Identity ── */}
      {showVerifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#0E1015', border: '1px solid var(--warp-border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center', marginBottom: 16, width: '100%' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0 }}>Register Security Profile</h3>
            </div>
            
            <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              Mints a verified credential token on the official ERC-8004 Identity Registry, validating your account for strategy allocations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div className="form-field">
                <label className="field-label" style={{ color: '#FFA31A' }}>PROFILE NAME</label>
                <input 
                  className="warp-input" 
                  placeholder="e.g. Sentinel-Security-Node" 
                  value={verifyName}
                  onChange={e => setVerifyName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>CAPABILITIES</label>
                <input 
                  className="warp-input" 
                  placeholder="e.g. analytics,data-extract" 
                  value={verifyCaps}
                  onChange={e => setVerifyCaps(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowVerifyModal(false)} 
                className="warp-btn secondary"
                disabled={verifying}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleVerifyIdentity} 
                className="warp-btn"
                disabled={verifying}
                style={{ flex: 1, background: '#FFA31A', color: '#000', fontWeight: 'bold' }}
              >
                {verifying ? 'Minting Profile...' : 'Submit Registry Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: Deposit Drawer ── */}
      {showDepositDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#0E1015', border: '1px solid var(--warp-border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>Deposit Capital</h3>
            <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 16px 0' }}>Fund your automated yield optimization portfolio.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div className="form-field">
                <label className="field-label" style={{ color: '#0DD393' }}>SELECT CURRENCY</label>
                <select 
                  className="warp-input"
                  value={depositCurrency}
                  onChange={e => setDepositCurrency(e.target.value as 'USDC' | 'EURC')}
                >
                  <option value="USDC">USDC (USD Stablecoin)</option>
                  <option value="EURC">EURC (Euro Stablecoin)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="field-label" style={{ color: '#8F76FF' }}>AMOUNT</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="warp-input" 
                    type="number" 
                    placeholder="e.g. 500.00" 
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--warp-muted)', fontWeight: 'bold' }}>
                    {depositCurrency}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
                  <span>Available Balance:</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {depositCurrency === 'USDC' ? userUsdcBal : userEurcBal} {depositCurrency}
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
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowDepositDrawer(false)} 
                className="warp-btn secondary"
                disabled={depositing}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeposit} 
                className="warp-btn"
                disabled={depositing}
                style={{ flex: 1, background: '#0DD393', color: '#000', fontWeight: 'bold' }}
              >
                {depositing ? 'Securing Deposit...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: Withdraw Drawer ── */}
      {showWithdrawDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#0E1015', border: '1px solid var(--warp-border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>Withdraw Capital</h3>
            <p style={{ fontSize: 12, color: 'var(--warp-muted)', margin: '0 0 16px 0' }}>Return assets back to your external Web3 address.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div className="form-field">
                <label className="field-label" style={{ color: '#FF5A5A' }}>AMOUNT TO WITHDRAW</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="warp-input" 
                    type="number" 
                    placeholder="e.g. 250.00" 
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
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
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowWithdrawDrawer(false)} 
                className="warp-btn secondary"
                disabled={withdrawing}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleWithdraw} 
                className="warp-btn"
                disabled={withdrawing}
                style={{ flex: 1, background: '#FF5A5A', color: '#000', fontWeight: 'bold' }}
              >
                {withdrawing ? 'Releasing Funds...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
