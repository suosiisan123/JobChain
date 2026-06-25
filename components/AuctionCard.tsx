'use client'

import { useState, useEffect } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient, useReadContract } from 'wagmi'
import { Briefcase, Gavel, DollarSign, Clock, List, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  EURC_ADDRESS_ARC,
  jobChainAbi,
  usdcAbi,
  JOB_AUCTION_MANAGER_ADDRESS,
  jobAuctionManagerAbi
} from '@/lib/contracts'

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
}

interface AuctionCardProps {
  job: JobData;
  onActionSuccess: () => void;
}

interface BidInfo {
  agentId: number
  price: bigint
  bidder: string
  refunded: boolean
}

export function AuctionCard({ job, onActionSuccess }: AuctionCardProps) {
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()

  // Loading state
  const [loading, setLoading] = useState(false)

  // Bidding inputs
  const [bidAgentId, setBidAgentId] = useState('')
  const [bidPrice, setBidPrice] = useState('')
  const [bids, setBids] = useState<BidInfo[]>([])

  // Claim Dutch input
  const [claimAgentId, setClaimAgentId] = useState('')
  const [claimProof, setClaimProof] = useState('')

  // Live Dutch states
  const [currentReward, setCurrentReward] = useState<bigint>(job.startPrice || job.reward)
  const [timeLeftStr, setTimeLeftStr] = useState<string>('')
  const [percentDecayed, setPercentDecayed] = useState(0)

  // Retrieve current leading bid index from contract
  const { data: leadingBidIdx } = useReadContract({
    address: JOB_AUCTION_MANAGER_ADDRESS,
    abi: jobAuctionManagerAbi,
    functionName: 'lowestBidIndex',
    args: [BigInt(job.id)],
    query: {
      enabled: job.auctionType === 1,
      refetchInterval: 5000
    }
  })

  // Dutch live updater
  useEffect(() => {
    if (job.auctionType !== 2) return

    const updateDutch = () => {
      const now = Math.floor(Date.now() / 1000)
      const elapsed = BigInt(Math.max(0, now - job.createdAt))
      const period = job.decayPeriod || 1n
      const start = job.startPrice || job.reward
      const floor = job.floorPrice || job.reward

      let reward = start
      if (elapsed >= period) {
        reward = floor
        setPercentDecayed(100)
        setTimeLeftStr('Decayed to Floor')
      } else {
        const totalDrop = start - floor
        const currentDrop = (totalDrop * elapsed) / period
        reward = start - currentDrop
        
        const pct = Math.min(100, Math.max(0, Number((elapsed * 100n) / period)))
        setPercentDecayed(pct)

        const remaining = Number(period) - Number(elapsed)
        const m = Math.floor(remaining / 60)
        const s = remaining % 60
        setTimeLeftStr(`${m}m ${s}s left`)
      }
      setCurrentReward(reward)
    }

    updateDutch()
    const interval = setInterval(updateDutch, 1000)
    return () => clearInterval(interval)
  }, [job])

  // Bid History fetcher
  async function fetchBids() {
    if (!publicClient || job.auctionType !== 1) return
    const list: BidInfo[] = []
    let i = 0
    while (true) {
      try {
        const res = await publicClient.readContract({
          address: JOB_AUCTION_MANAGER_ADDRESS,
          abi: jobAuctionManagerAbi,
          functionName: 'jobBids',
          args: [BigInt(job.id), BigInt(i)]
        }) as unknown as [bigint, bigint, string, boolean]

        if (!res || res[2] === '0x0000000000000000000000000000000000000000') {
          break
        }

        list.push({
          agentId: Number(res[0]),
          price: res[1],
          bidder: res[2],
          refunded: res[3]
        })
        i++
      } catch {
        break
      }
    }
    setBids(list)
  }

  useEffect(() => {
    fetchBids()
    const timer = setInterval(fetchBids, 6000)
    return () => clearInterval(timer)
  }, [job, leadingBidIdx])

  const runTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setLoading(true)
    const tid = toast.loading(label)
    try {
      const hash = await fn()
      toast.success(
        <span>Done! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      onActionSuccess()
      fetchBids()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  // Submit Bid with approval check
  const handleSubmitBid = () => runTx('Submitting bid...', async () => {
    if (!bidAgentId || !bidPrice) throw new Error('Provider ID and Price are required')
    const priceAmount = parseUnits(bidPrice, 6)

    // Verify allowance for 1 USDC deposit
    const allowance = await publicClient!.readContract({
      address: USDC_ADDRESS_ARC,
      abi: usdcAbi,
      functionName: 'allowance',
      args: [address as `0x${string}`, JOB_AUCTION_MANAGER_ADDRESS]
    }) as bigint

    if (allowance < 1000000n) {
      toast.loading('Approving USDC bid deposit...', { duration: 2000 })
      await writeContractAsync({
        address: USDC_ADDRESS_ARC,
        abi: usdcAbi,
        functionName: 'approve',
        args: [JOB_AUCTION_MANAGER_ADDRESS, 1000000n]
      })
    }

    const hash = await writeContractAsync({
      address: JOB_AUCTION_MANAGER_ADDRESS,
      abi: jobAuctionManagerAbi,
      functionName: 'submitBid',
      args: [BigInt(job.id), BigInt(bidAgentId), priceAmount]
    })
    setBidPrice('')
    return hash
  })

  // Accept Bid
  const handleAcceptBid = (index: number) => runTx('Accepting leading bid...', async () => {
    return await writeContractAsync({
      address: JOB_AUCTION_MANAGER_ADDRESS,
      abi: jobAuctionManagerAbi,
      functionName: 'acceptBid',
      args: [BigInt(job.id), BigInt(index)]
    })
  })

  // Claim Dutch Auction
  const handleClaimDutch = () => runTx('Claiming Dutch Job...', async () => {
    if (!claimAgentId) throw new Error('Provider ID is required')
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'pickupJob',
      args: [BigInt(job.id), BigInt(claimAgentId), (claimProof || '0x') as `0x${string}`]
    })
  })

  const isDutch = job.auctionType === 2
  const isBid = job.auctionType === 1
  const currencySymbol = job.paymentToken?.toLowerCase() === EURC_ADDRESS_ARC.toLowerCase() ? 'EURC' : 'USDC'

  return (
    <div className="form-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--warp-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--warp-border)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isDutch ? <Clock size={14} style={{ color: 'var(--warp-warning)' }} /> : <Gavel size={14} style={{ color: 'var(--warp-magenta)' }} />}
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--warp-text)' }}>
            Job #{job.id} — {isDutch ? 'Dutch Auction' : 'Bidding Market'}
          </span>
        </div>
        <span style={{
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: 4,
          background: isDutch ? 'rgba(224, 175, 104, 0.2)' : 'rgba(187, 154, 247, 0.2)',
          color: isDutch ? 'var(--warp-warning)' : 'var(--warp-magenta)',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          {isDutch ? 'Dutch Decay' : 'Bids Active'}
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--warp-text)' }}>{job.description}</div>
      
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {job.requiredCapabilities.split(',').map((c, i) => (
          <span key={i} className="tag">{c.trim()}</span>
        ))}
      </div>

      {/* Dutch Decay Panel */}
      {isDutch && (
        <div style={{ background: 'rgba(15,16,21,0.5)', padding: 12, borderRadius: 6, border: '1px solid var(--warp-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--warp-muted)' }}>Decay Period:</span>
            <span style={{ color: 'var(--warp-cyan)', fontWeight: 600 }}>{timeLeftStr}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--warp-muted)' }}>START PRICE</div>
              <div style={{ color: 'var(--warp-text)', fontSize: 12, fontWeight: 600 }}>
                {formatUnits(job.startPrice || job.reward, 6)} {currencySymbol}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--warp-warning)' }}>LIVE PRICE</div>
              <div style={{ color: 'var(--warp-warning)', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatUnits(currentReward, 6)} {currencySymbol}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--warp-muted)' }}>FLOOR PRICE</div>
              <div style={{ color: 'var(--warp-text)', fontSize: 12, fontWeight: 600 }}>
                {formatUnits(job.floorPrice || job.reward, 6)} {currencySymbol}
              </div>
            </div>
          </div>

          {/* Sliding reward meter */}
          <div style={{ background: 'rgba(65,72,104,0.3)', height: 6, borderRadius: 3, position: 'relative', margin: '10px 0 4px' }}>
            <div style={{
              background: 'linear-gradient(90deg, var(--warp-warning), var(--warp-success))',
              width: `${100 - percentDecayed}%`,
              height: '100%',
              borderRadius: 3,
              transition: 'width 1s linear'
            }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--warp-muted)', textAlign: 'right' }}>
            {percentDecayed.toFixed(0)}% price decay completed
          </div>

          {/* Claim Dutch inputs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              type="number"
              className="warp-input"
              placeholder="e.g. 142 (Your Provider ID)"
              value={claimAgentId}
              onChange={e => setClaimAgentId(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              className="warp-input"
              placeholder="e.g. 0x... (Optional proof or leave 0x)"
              value={claimProof}
              onChange={e => setClaimProof(e.target.value)}
              style={{ flex: 2 }}
            />
          </div>
          <button
            className="warp-btn"
            style={{ width: '100%', marginTop: 8, background: 'var(--warp-warning)', color: '#1A1B26' }}
            disabled={!isConnected || loading || !claimAgentId}
            onClick={handleClaimDutch}
          >
            Claim Job at {formatUnits(currentReward, 6)} {currencySymbol}
          </button>
        </div>
      )}

      {/* Bidding Panel */}
      {isBid && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(15,16,21,0.5)', padding: 12, borderRadius: 6, border: '1px solid var(--warp-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--warp-muted)' }}>Maximum Cap:</span>
              <span style={{ color: 'var(--warp-text)', fontWeight: 600 }}>
                {formatUnits(job.startPrice || job.reward, 6)} {currencySymbol}
              </span>
            </div>
            {bids.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: 'var(--warp-muted)' }}>Leading Reward Ask:</span>
                <span style={{ color: 'var(--warp-success)', fontWeight: 700 }}>
                  {formatUnits(bids[Number(leadingBidIdx || 0)]?.price || 0n, 6)} {currencySymbol}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginTop: 4 }}>
                No bids submitted yet. Be the first!
              </div>
            )}
          </div>

          {/* Bid History */}
          {bids.length > 0 && (
            <div style={{ maxHeight: 100, overflowY: 'auto', border: '1px solid var(--warp-border)', borderRadius: 4, background: 'rgba(15,16,21,0.5)' }}>
              <div style={{ fontSize: 9, color: 'var(--warp-muted)', fontWeight: 700, padding: '4px 8px', borderBottom: '1px solid var(--warp-border)' }}>
                BID LOGS
              </div>
              {bids.map((b, idx) => {
                const isLeading = leadingBidIdx !== undefined && idx === Number(leadingBidIdx)
                const isOwner = address && address.toLowerCase() === job.poster.toLowerCase()
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--warp-border)',
                    background: isLeading ? 'rgba(158, 206, 106, 0.05)' : 'transparent'
                  }}>
                    <div style={{ fontSize: 10 }}>
                      <span style={{ color: 'var(--warp-magenta)', fontWeight: 600 }}>Provider #{b.agentId}</span>
                      <span style={{ color: 'var(--warp-muted)', marginLeft: 6 }}>{b.bidder.slice(0, 6)}...{b.bidder.slice(-4)}</span>
                      {isLeading && <span style={{ color: 'var(--warp-success)', fontSize: 9, marginLeft: 6, fontWeight: 700 }}>[LEADING]</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: isLeading ? 'var(--warp-success)' : 'var(--warp-text)' }}>
                        {formatUnits(b.price, 6)} {currencySymbol}
                      </span>
                      {isOwner && isLeading && !b.refunded && (
                        <button
                          onClick={() => handleAcceptBid(idx)}
                          style={{
                            fontSize: 9,
                            background: 'var(--warp-success)',
                            color: '#1A1B26',
                            border: 'none',
                            borderRadius: 3,
                            padding: '1px 6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                          disabled={loading}
                        >
                          Accept
                        </button>
                      )}
                      {b.refunded && <span style={{ fontSize: 8, color: 'var(--warp-muted)', fontStyle: 'italic' }}>Refunded</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Submit Bid Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                className="warp-input"
                placeholder="e.g. 142 (Your Provider ID)"
                value={bidAgentId}
                onChange={e => setBidAgentId(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                className="warp-input"
                placeholder={`e.g. 12.50 (Your Bid Ask in ${currencySymbol})`}
                value={bidPrice}
                onChange={e => setBidPrice(e.target.value)}
                style={{ flex: 1.5 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--warp-primary-glow)', borderRadius: 4, border: '1px solid var(--warp-border)' }}>
              <AlertCircle size={10} style={{ color: 'var(--warp-primary)', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>
                Locks a temporary 1 USDC deposit. Deposit is refunded immediately if outbid.
              </span>
            </div>
            <button
              className="warp-btn"
              style={{ width: '100%', background: 'var(--warp-primary)', color: '#1A1B26' }}
              disabled={!isConnected || loading || !bidAgentId || !bidPrice}
              onClick={handleSubmitBid}
            >
              Submit Bid Reward
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
