'use client'

import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Briefcase, Play, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  EURC_ADDRESS_ARC,
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi,
  JOB_AUCTION_MANAGER_ADDRESS,
  jobAuctionManagerAbi,
  JOB_DISPUTE_MANAGER_ADDRESS,
  jobDisputeManagerAbi
} from '@/lib/contracts'
import { useCCTP, CCTP_CHAINS } from '@/hooks/useCCTP'
import { BridgeStatusTracker } from '@/components/BridgeStatusTracker'
import { VerificationHelper } from '@/components/VerificationHelper'
import { AuctionCard } from '@/components/AuctionCard'
import { DependencyTree } from '@/components/DependencyTree'

const STATUS_LABELS = ['Open', 'InProgress', 'Submitted', 'Completed', 'Failed', 'Cancelled', 'Disputed'] as const
const STATUS_COLORS: Record<string, string> = {
  Open: 'var(--warp-primary)', InProgress: 'var(--warp-warning)',
  Submitted: 'var(--warp-cyan)', Completed: 'var(--warp-success)',
  Failed: 'var(--warp-error)', Cancelled: 'var(--warp-muted)', Disputed: 'var(--warp-magenta)'
}

interface JobData {
  id: number; poster: string; description: string; requiredCapabilities: string
  reward: bigint; deadline: number; assignedAgent: number
  status: number; resultHash: string; rating: number; createdAt: number; paymentToken: string; failedAt: number
  exchangeRateAtDeposit?: bigint;
  agentExchangeRateAtPickup?: bigint;
  depositedInPool?: boolean;
  stakeDepositedInPool?: boolean;
  rewardYield?: bigint;
  stakeYield?: bigint;
  auctionType?: number;
  startPrice?: bigint;
  floorPrice?: bigint;
  decayPeriod?: bigint;
  parentJobId?: number;
  hasParent?: boolean;
}

export function JobsTab() {
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const [jobs, setJobs] = useState<JobData[]>([])
  const [loading, setLoading] = useState(false)
  const [desc, setDesc] = useState('')
  const [skills, setSkills] = useState('')
  const [reward, setReward] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('24')

  // Auction & Bidding states
  const [auctionType, setAuctionType] = useState<'Fixed' | 'Dutch' | 'Bid'>('Fixed')
  const [floorPrice, setFloorPrice] = useState('')
  const [decayPeriodMinutes, setDecayPeriodMinutes] = useState('30')

  // Recursive sub-job delegation states
  const [subParentJobId, setSubParentJobId] = useState('')
  const [subDesc, setSubDesc] = useState('')
  const [subReward, setSubReward] = useState('')
  const [subDeadlineHours, setSubDeadlineHours] = useState('24')

  // Multi-currency & Forex states
  const [paymentCurrency, setPaymentCurrency] = useState<'USDC' | 'EURC'>('USDC')
  const [forexRate, setForexRate] = useState<number>(1.0825)
  const [forexLoading, setForexLoading] = useState(false)
  const [prefAgentId, setPrefAgentId] = useState('')
  const [prefToken, setPrefToken] = useState<'USDC' | 'EURC'>('USDC')

  // Fetch live Forex quote from StableFX
  useEffect(() => {
    async function fetchQuote() {
      try {
        setForexLoading(true)
        const res = await fetch('/api/forex/quote?base=EURC&target=USDC')
        const data = await res.json()
        if (res.ok) {
          setForexRate(data.rate)
        }
      } catch (err) {
        console.error('Failed to fetch forex quote:', err)
      } finally {
        setForexLoading(false)
      }
    }
    fetchQuote()
    const timer = setInterval(fetchQuote, 10000)
    return () => clearInterval(timer)
  }, [])

  // CCTP Bridge configurations
  const [selectedChainId, setSelectedChainId] = useState<number>(5042002) // default Arc Testnet Direct
  const { bridgeState, startBridgeAndEscrow, resetBridge } = useCCTP()
  const selectedChain = CCTP_CHAINS.find(c => c.id === selectedChainId)

  // Retrieve source chain balance if CCTP is selected
  const { data: sourceBalanceRaw } = useReadContract({
    address: selectedChain?.usdcAddress as `0x${string}` | undefined,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: selectedChainId !== 5042002 ? selectedChainId : undefined,
    query: {
      enabled: !!address && selectedChainId !== 5042002 && !!selectedChain,
    }
  })

  const sourceBalance = sourceBalanceRaw
    ? parseFloat(formatUnits(sourceBalanceRaw as bigint, 6)).toFixed(2)
    : '250.00' // realistic fallback balance

  const [pickupJobId, setPickupJobId] = useState('')
  const [pickupAgentId, setPickupAgentId] = useState('')
  const [pickupProof, setPickupProof] = useState('')
  const [submitJobId, setSubmitJobId] = useState('')
  const [resultHash, setResultHash] = useState('')
  const [submitProof, setSubmitProof] = useState('')
  const [approveJobId, setApproveJobId] = useState('')
  const [rating, setRating] = useState('5')
  const [failJobId, setFailJobId] = useState('')
  const [failReason, setFailReason] = useState('')

  const { data: nextJobId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId',
  })

  async function fetchJobs() {
    if (!publicClient || !nextJobId) return
    const count = Number(nextJobId)
    const list: JobData[] = []
    for (let i = 0; i < count; i++) {
      try {
        const d = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
          functionName: 'getJob', args: [BigInt(i)],
        }) as unknown as any[]

        let yieldInfo: any[] = [0n, 0n, false, false, 0n, 0n]
        try {
          yieldInfo = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            functionName: 'getJobYield',
            args: [BigInt(i)],
          }) as unknown as any[]
        } catch (err) {
          console.warn('Failed to fetch job yield info:', err)
        }

        list.push({
          id: i, poster: d[0], description: d[1], requiredCapabilities: d[2],
          reward: d[3], deadline: Number(d[4]), assignedAgent: Number(d[5]),
          status: Number(d[6]), resultHash: d[7], rating: Number(d[8]), createdAt: Number(d[9]),
          paymentToken: d[10] || USDC_ADDRESS_ARC,
          failedAt: Number(d[11] || 0),
          auctionType: Number(d[12] || 0),
          startPrice: d[13] || d[3],
          floorPrice: d[14] || d[3],
          decayPeriod: d[15] || 0n,
          parentJobId: d[16] ? Number(d[16]) : 0,
          hasParent: !!d[17],
          exchangeRateAtDeposit: yieldInfo[0],
          agentExchangeRateAtPickup: yieldInfo[1],
          depositedInPool: yieldInfo[2],
          stakeDepositedInPool: yieldInfo[3],
          rewardYield: yieldInfo[4],
          stakeYield: yieldInfo[5],
        })
      } catch { /* skip */ }
    }
    setJobs(list)
  }

  useEffect(() => {
    fetchJobs()
  }, [publicClient, nextJobId])

  const txToast = async (label: string, fn: () => Promise<string>) => {
    setLoading(true)
    const tid = toast.loading(label)
    try {
      const hash = await fn()
      toast.success(
        <span>Done! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handlePostJob = () => txToast('Posting job...', async () => {
    const tokenAddress = paymentCurrency === 'USDC' ? USDC_ADDRESS_ARC : EURC_ADDRESS_ARC
    
    if (auctionType === 'Fixed') {
      const amount = parseUnits(reward, 6)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600)
      await writeContractAsync({ address: tokenAddress, abi: usdcAbi, functionName: 'approve', args: [JOBCHAIN_CONTRACT_ADDRESS, amount] })
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS,
        abi: jobChainAbi,
        functionName: 'postJob',
        args: [desc, skills, amount, deadline, tokenAddress]
      })
      setDesc(''); setSkills(''); setReward('')
      return hash
    } else {
      const startPriceAmount = parseUnits(reward, 6)
      const floorPriceAmount = auctionType === 'Dutch' ? parseUnits(floorPrice, 6) : 0n
      const decaySec = auctionType === 'Dutch' ? BigInt(parseInt(decayPeriodMinutes) * 60) : 0n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600)
      const typeEnum = auctionType === 'Dutch' ? 2 : 1 // 1: Bid, 2: Dutch
      
      await writeContractAsync({ address: tokenAddress, abi: usdcAbi, functionName: 'approve', args: [JOB_AUCTION_MANAGER_ADDRESS, startPriceAmount] })
      
      const hash = await writeContractAsync({
        address: JOB_AUCTION_MANAGER_ADDRESS,
        abi: jobAuctionManagerAbi,
        functionName: 'postJobAuction',
        args: [
          desc,
          skills,
          deadline,
          tokenAddress,
          typeEnum,
          startPriceAmount,
          floorPriceAmount,
          decaySec
        ]
      })
      setDesc(''); setSkills(''); setReward(''); setFloorPrice('')
      return hash
    }
  })

  const handlePostJobWrapper = async () => {
    if (selectedChainId === 5042002) {
      handlePostJob()
    } else {
      await startBridgeAndEscrow({
        sourceChainId: selectedChainId,
        amount: reward,
        description: desc,
        requiredCapabilities: skills,
        deadlineHours
      })
    }
  }

  // Clear inputs when CCTP bridge succeeds
  useEffect(() => {
    if (bridgeState.step === 'SUCCESS') {
      setDesc('')
      setSkills('')
      setReward('')
    }
  }, [bridgeState.step])

  const handlePickup = () => txToast('Claiming job...', async () => {
    if (!pickupAgentId) throw new Error('Agent ID is required')
    
    // Validate agent ID on the official IdentityRegistry
    try {
      const owner = await publicClient!.readContract({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'ownerOf',
        args: [BigInt(pickupAgentId)],
      }) as string

      if (!owner || owner === '0x0000000000000000000000000000000000000000') {
        throw new Error('Agent ID is not registered')
      }
    } catch (err) {
      throw new Error('Agent ID is not registered on official ERC-8004 IdentityRegistry')
    }

    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'pickupJob',
      args: [BigInt(pickupJobId), BigInt(pickupAgentId), (pickupProof || '0x') as `0x${string}`]
    })
  })

  const handleSetPreference = () => txToast('Updating agent payout preference...', async () => {
    if (!prefAgentId) throw new Error('Agent ID is required')
    const tokenAddress = prefToken === 'USDC' ? USDC_ADDRESS_ARC : EURC_ADDRESS_ARC
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'setAgentPayoutToken',
      args: [BigInt(prefAgentId), tokenAddress]
    })
  })

  const handleSubmit = () => txToast('Submitting result...', async () => {
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'submitResult',
      args: [BigInt(submitJobId), resultHash, (submitProof || '0x') as `0x${string}`]
    })
  })

  const handlePostSubJob = () => txToast('Delegating sub-job...', async () => {
    if (!subParentJobId) throw new Error('Parent Job ID is required')
    const parentId = BigInt(subParentJobId)
    const amount = parseUnits(subReward, 6)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(subDeadlineHours) * 3600)
    const hash = await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'postSubJob',
      args: [parentId, subDesc, amount, deadline]
    })
    setSubDesc(''); setSubReward(''); setSubParentJobId('')
    fetchJobs()
    return hash
  })

  const handleApprove = () => txToast('Releasing payment...', async () => {
    const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'approveAndRelease', args: [BigInt(approveJobId), parseInt(rating)] })
    fetchJobs()
    return hash
  })

  const handleFail = () => txToast('Marking job as failed...', async () => {
    const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'failJob', args: [BigInt(failJobId), failReason] })
    setFailJobId(''); setFailReason('')
    fetchJobs()
    return hash
  })

  const handleOpenDispute = (jobId: number) => txToast('Opening dispute...', async () => {
    const hash = await writeContractAsync({ address: JOB_DISPUTE_MANAGER_ADDRESS, abi: jobDisputeManagerAbi, functionName: 'openDispute', args: [BigInt(jobId)] })
    fetchJobs()
    return hash
  })

  const handleClaimRefund = (jobId: number) => txToast('Claiming refund...', async () => {
    const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'claimFailedRefund', args: [BigInt(jobId)] })
    fetchJobs()
    return hash
  })

  const getStatusLabel = (s: number) => STATUS_LABELS[s] || 'Unknown'
  const timeLeft = (deadline: number) => {
    const diff = deadline - Math.floor(Date.now() / 1000)
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / 3600)
    return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/job-queue</span>
        <span style={{ color: 'var(--warp-text)' }}> ./manage-jobs</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        ERC-8183 Job Protocol — Post, Claim, Submit, Approve | Total: {jobs.length} jobs
      </div>

      {/* ── Job Queue Table ── */}
      {jobs.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            <Briefcase size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            JOB QUEUE (ERC-8183)
          </div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Description</th><th>Skills</th><th>Reward</th><th>Deadline</th><th>Agent</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td style={{ color: 'var(--warp-primary)' }}>#{j.id}</td>
                  <td style={{ color: 'var(--warp-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description}</td>
                  <td>{j.requiredCapabilities.split(',').map((c, i) => <span key={i} className="tag">{c.trim()}</span>)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-success)' }}>
                    <div style={{ fontWeight: 600 }}>
                      {formatUnits(j.reward, 6)} <span style={{ fontSize: 10, color: 'var(--warp-muted)' }}>
                        {j.paymentToken?.toLowerCase() === EURC_ADDRESS_ARC.toLowerCase() ? 'EURC' : 'USDC'}
                      </span>
                    </div>
                    {j.depositedInPool && (
                      <div style={{ fontSize: 9, color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                        <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--warp-cyan)' }}></span>
                        accruing yield (8.5% APY)
                      </div>
                    )}
                    {j.rewardYield !== undefined && j.rewardYield > 0n && (
                      <div style={{ fontSize: 9, color: 'var(--warp-success)', marginTop: 2, fontFamily: 'monospace' }}>
                        + {formatUnits(j.rewardYield, 6)} yield accrued
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                    {timeLeft(j.deadline)}
                  </td>
                  <td>
                    {j.status > 0 ? (
                      <div>
                        <span style={{ color: 'var(--warp-magenta)', fontWeight: 600 }}>#{j.assignedAgent}</span>
                        {j.stakeDepositedInPool && (
                          <div style={{ fontSize: 9, color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                            <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--warp-cyan)' }}></span>
                            stake earning yield
                          </div>
                        )}
                        {j.stakeYield !== undefined && j.stakeYield > 0n && (
                          <div style={{ fontSize: 9, color: 'var(--warp-success)', marginTop: 2, fontFamily: 'monospace' }}>
                            + {formatUnits(j.stakeYield, 6)} USDC stake yield
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--warp-muted)' }}>—</span>
                    )}
                  </td>
                  <td><span className="status-badge" style={{ color: STATUS_COLORS[getStatusLabel(j.status)] }}>{getStatusLabel(j.status)}</span></td>
                  <td>
                    {j.status === 4 && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleOpenDispute(j.id)}
                          style={{ fontSize: 9, background: 'rgba(255, 0, 127, 0.2)', border: '1px solid var(--warp-magenta)', color: 'var(--warp-magenta)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                          disabled={loading}
                        >
                          Dispute
                        </button>
                        <button
                          onClick={() => handleClaimRefund(j.id)}
                          style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--warp-success)', color: 'var(--warp-success)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                          disabled={loading}
                        >
                          Refund (24h)
                        </button>
                      </div>
                    )}
                    {j.status !== 4 && <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16 }}>
            {jobs.filter(j => !j.hasParent).map(j => (
              <DependencyTree key={j.id} jobs={jobs} rootJobId={j.id} />
            ))}
          </div>
        </div>
      )}

      {/* ── Active Auctions & Bidding Market ── */}
      {jobs.filter(j => (j.auctionType === 1 || j.auctionType === 2) && j.status === 0).length > 0 && (
        <div style={{ marginLeft: 24, marginRight: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--warp-warning)' }}></span>
            ACTIVE AUCTIONS & BIDDING MARKET
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
            {jobs.filter(j => (j.auctionType === 1 || j.auctionType === 2) && j.status === 0).map(j => (
              <AuctionCard key={j.id} job={j} onActionSuccess={fetchJobs} />
            ))}
          </div>
        </div>
      )}

      {/* ── Forms ── */}
      {bridgeState.step !== 'IDLE' && (
        <div style={{ marginLeft: 24, marginRight: 24, marginBottom: 24 }}>
          <BridgeStatusTracker bridgeState={bridgeState} onClose={resetBridge} />
        </div>
      )}

      <div className="form-grid">
        <div style={{ gridColumn: '1 / -1', marginBottom: 16 }}>
          <VerificationHelper />
        </div>

        <div className="form-card">
          <div className="form-title"><Briefcase size={16} /> Post Job</div>
          
          <div className="form-field">
            <label className="field-label" style={{color:'var(--warp-cyan)'}}>FUNDING SOURCE CHAIN</label>
            <select
              className="warp-input"
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(Number(e.target.value))}
              style={{ background: '#1A1B26', color: 'var(--warp-text)', border: '1px solid #292E42', borderRadius: 4, padding: '8px 12px' }}
            >
              <option value={5042002}>Arc Testnet (Direct - Gas in USDC)</option>
              <option value={11155111}>Ethereum Sepolia (Circle CCTP)</option>
              <option value={421614}>Arbitrum Sepolia (Circle CCTP)</option>
              <option value={84532}>Base Sepolia (Circle CCTP)</option>
            </select>
          </div>

          {selectedChainId === 5042002 && (
            <>
              <div className="form-field">
                <label className="field-label" style={{color:'var(--warp-magenta)'}}>AUCTION PROTOCOL</label>
                <select
                  className="warp-input"
                  value={auctionType}
                  onChange={(e) => setAuctionType(e.target.value as 'Fixed' | 'Dutch' | 'Bid')}
                  style={{ background: '#1A1B26', color: 'var(--warp-text)', border: '1px solid #292E42', borderRadius: 4, padding: '8px 12px' }}
                >
                  <option value="Fixed">Fixed Reward Escrow</option>
                  <option value="Dutch">Dutch Decay Auction</option>
                  <option value="Bid">Bidding & Bid Marketplace</option>
                </select>
              </div>

              {auctionType === 'Dutch' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="field-label" style={{ color: 'var(--warp-warning)' }}>FLOOR PRICE ({paymentCurrency})</label>
                    <input
                      className="warp-input"
                      placeholder="2.00"
                      type="number"
                      value={floorPrice}
                      onChange={e => setFloorPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>DECAY DURATION (MINS)</label>
                    <input
                      className="warp-input"
                      placeholder="30"
                      type="number"
                      value={decayPeriodMinutes}
                      onChange={e => setDecayPeriodMinutes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-field">
                <label className="field-label" style={{color:'var(--warp-success)'}}>PAYMENT CURRENCY</label>
                <select
                  className="warp-input"
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value as 'USDC' | 'EURC')}
                  style={{ background: '#1A1B26', color: 'var(--warp-text)', border: '1px solid #292E42', borderRadius: 4, padding: '8px 12px' }}
                >
                  <option value="USDC">USDC (USD Stablecoin)</option>
                  <option value="EURC">EURC (Euro Stablecoin)</option>
                </select>
              </div>
            </>
          )}

          {selectedChainId !== 5042002 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#1A1B26', borderRadius: 8, border: '1px solid #292E42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Estimated Bridging Time:</span>
                <span style={{ color: 'var(--warp-cyan)', fontWeight: 500 }}>
                  {CCTP_CHAINS.find(c => c.id === selectedChainId)?.estimatedTime}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--warp-muted)' }}>CCTP Protocol Fee:</span>
                <span style={{ color: 'var(--warp-success)', fontWeight: 500 }}>0.00 USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Source USDC Balance:</span>
                <span style={{ color: 'var(--warp-text)', fontWeight: 500 }}>
                  {sourceBalance} USDC
                </span>
              </div>
            </div>
          )}

          <div className="form-field"><label className="field-label" style={{color:'var(--warp-magenta)'}}>DESCRIPTION</label><input className="warp-input" placeholder="Analyze sentiment of 100 tweets" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-warning)'}}>CAPABILITIES</label><input className="warp-input" placeholder="nlp,sentiment" value={skills} onChange={e=>setSkills(e.target.value)}/></div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}>
              <label className="field-label" style={{color:'var(--warp-success)'}}>
                {auctionType === 'Fixed' ? 'REWARD' : auctionType === 'Dutch' ? 'START PRICE' : 'REWARD CAP'} ({selectedChainId === 5042002 ? paymentCurrency : 'USDC'})
              </label>
              <input className="warp-input" placeholder="5.00" type="number" value={reward} onChange={e=>setReward(e.target.value)}/>
            </div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>DEADLINE_H</label><input className="warp-input" type="number" value={deadlineHours} onChange={e=>setDeadlineHours(e.target.value)}/></div>
          </div>

          {selectedChainId === 5042002 && reward && parseFloat(reward) > 0 && (
            <div style={{ margin: '12px 0', padding: 10, background: '#1F2335', borderRadius: 6, border: '1px solid #3B4261', fontSize: 11 }}>
              <span style={{ color: 'var(--warp-cyan)', fontWeight: 600 }}>StableFX Exchange Preview:</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Deposit Escrow:</span>
                <span style={{ color: 'var(--warp-success)', fontWeight: 'bold' }}>{reward} {paymentCurrency}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Estimated Payout:</span>
                <span style={{ color: 'var(--warp-text)' }}>
                  {paymentCurrency === 'EURC'
                    ? `~${(parseFloat(reward) * forexRate).toFixed(4)} USDC`
                    : `~${(parseFloat(reward) / forexRate).toFixed(4)} EURC`
                  }
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Slippage Min Out (5%):</span>
                <span style={{ color: 'var(--warp-warning)' }}>
                  {paymentCurrency === 'EURC'
                    ? `~${(parseFloat(reward) * forexRate * 0.95).toFixed(4)} USDC`
                    : `~${(parseFloat(reward) / forexRate * 0.95).toFixed(4)} EURC`
                  }
                </span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--warp-muted)', marginTop: 6, fontStyle: 'italic' }}>
                * StableFX feed rate: 1 EURC = {forexRate.toFixed(4)} USDC
              </div>
            </div>
          )}

          <button className="warp-btn" onClick={handlePostJobWrapper} disabled={!isConnected||loading||!desc||!skills||!reward}><Briefcase size={14}/> {loading?'Processing...':'Post Job'}</button>
        </div>

        <div className="form-card">
          <div className="form-title"><Play size={16} /> Claim Job</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={pickupJobId} onChange={e=>setPickupJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-magenta)'}}>AGENT_ID</label><input className="warp-input" type="number" value={pickupAgentId} onChange={e=>setPickupAgentId(e.target.value)}/></div>
          </div>
          <div className="form-field" style={{marginTop:8}}>
            <label className="field-label" style={{color:'var(--warp-success)'}}>CAPABILITY ATTESTATION (OR '0x')</label>
            <input className="warp-input" placeholder="0x..." value={pickupProof} onChange={e=>setPickupProof(e.target.value)}/>
          </div>
          <button className="warp-btn secondary" onClick={handlePickup} disabled={!isConnected||loading} style={{marginTop:8}}><Play size={14}/> Claim</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Submit Result</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={submitJobId} onChange={e=>setSubmitJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:2}}><label className="field-label" style={{color:'var(--warp-warning)'}}>RESULT_HASH</label><input className="warp-input" placeholder="QmHash..." value={resultHash} onChange={e=>setResultHash(e.target.value)}/></div>
          </div>
          <div className="form-field" style={{marginTop:8}}>
            <label className="field-label" style={{color:'var(--warp-success)'}}>ZK/EXECUTION PROOF (OR '0x')</label>
            <input className="warp-input" placeholder="0x..." value={submitProof} onChange={e=>setSubmitProof(e.target.value)}/>
          </div>
          <button className="warp-btn secondary" onClick={handleSubmit} disabled={!isConnected||loading} style={{marginTop:8}}><CheckCircle size={14}/> Submit</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Approve &amp; Pay</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={approveJobId} onChange={e=>setApproveJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>RATING (1-5)</label><input className="warp-input" type="number" min="1" max="5" value={rating} onChange={e=>setRating(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handleApprove} disabled={!isConnected||loading} style={{background:'var(--warp-success)'}}><CheckCircle size={14}/> Release Payment</button>
        </div>

        <div className="form-card">
          <div className="form-title" style={{color:'var(--warp-error)'}}><CheckCircle size={16} /> Fail Job</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={failJobId} onChange={e=>setFailJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:2}}><label className="field-label" style={{color:'var(--warp-error)'}}>REASON</label><input className="warp-input" placeholder="Failed to deliver on time" value={failReason} onChange={e=>setFailReason(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handleFail} disabled={!isConnected||loading} style={{background:'var(--warp-error)'}}><CheckCircle size={14}/> Fail Job</button>
        </div>

        <div className="form-card">
          <div className="form-title" style={{color:'var(--warp-cyan)'}}><Briefcase size={16} /> Agent Payout preference</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>AGENT_ID</label><input className="warp-input" type="number" placeholder="1" value={prefAgentId} onChange={e=>setPrefAgentId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}>
              <label className="field-label" style={{color:'var(--warp-success)'}}>PREFERENCE</label>
              <select
                className="warp-input"
                value={prefToken}
                onChange={(e) => setPrefToken(e.target.value as 'USDC' | 'EURC')}
                style={{ background: '#1A1B26', color: 'var(--warp-text)', border: '1px solid #292E42', borderRadius: 4, padding: '8px 12px' }}
              >
                <option value="USDC">USDC Payout</option>
                <option value="EURC">EURC Payout</option>
              </select>
            </div>
          </div>
          <button className="warp-btn secondary" onClick={handleSetPreference} disabled={!isConnected||loading}><Briefcase size={14}/> Set Preference</button>
        </div>

        <div className="form-card">
          <div className="form-title" style={{color:'var(--warp-warning)'}}><Briefcase size={16} /> Delegate Sub-Job</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>PARENT_JOB_ID</label><input className="warp-input" type="number" placeholder="0" value={subParentJobId} onChange={e=>setSubParentJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>SUB-REWARD</label><input className="warp-input" type="number" placeholder="2.50" value={subReward} onChange={e=>setSubReward(e.target.value)}/></div>
          </div>
          <div className="form-field" style={{marginTop:8}}><label className="field-label" style={{color:'var(--warp-warning)'}}>DESCRIPTION</label><input className="warp-input" placeholder="Coding subtask" value={subDesc} onChange={e=>setSubDesc(e.target.value)}/></div>
          <div className="form-field" style={{marginTop:8}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>DEADLINE (HOURS)</label><input className="warp-input" type="number" value={subDeadlineHours} onChange={e=>setSubDeadlineHours(e.target.value)}/></div>
          <button className="warp-btn" onClick={handlePostSubJob} disabled={!isConnected||loading||!subParentJobId||!subDesc||!subReward} style={{background:'var(--warp-warning)',color:'#000'}}><Briefcase size={14}/> Delegate Subtask</button>
        </div>
      </div>
    </div>
  )
}
