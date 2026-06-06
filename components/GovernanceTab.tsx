'use client'

import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient
} from 'wagmi'
import { parseUnits, formatUnits, Address } from 'viem'
import {
  JOB_TOKEN_ADDRESS,
  REVENUE_DISTRIBUTOR_ADDRESS,
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  EURC_ADDRESS_ARC,
  jobTokenAbi,
  revenueDistributorAbi,
  jobChainAbi
} from '@/lib/contracts'
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  Scale,
  Vote,
  PlusCircle,
  FilePlus2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Proposal {
  id: number
  description: string
  newProtocolFeeBps: number
  forVotes: bigint
  againstVotes: bigint
  endBlock: number
  executed: boolean
  hasVoted?: boolean
}

export function GovernanceTab() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  // Staking & balance inputs
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [isStaking, setIsStaking] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)

  // Proposal inputs
  const [propDesc, setPropDesc] = useState('')
  const [propFee, setPropFee] = useState('')
  const [isSubmittingProp, setIsSubmittingProp] = useState(false)

  // Current block number state
  const [currentBlock, setCurrentBlock] = useState(0)

  // Fetch block number on load
  useEffect(() => {
    if (!publicClient) return
    publicClient.getBlockNumber().then((n) => setCurrentBlock(Number(n)))
    const interval = setInterval(() => {
      publicClient.getBlockNumber().then((n) => setCurrentBlock(Number(n)))
    }, 10000)
    return () => clearInterval(interval)
  }, [publicClient])

  // Read Contracts data
  const { data: jobBalance = 0n, refetch: refetchJobBal } = useReadContract({
    address: JOB_TOKEN_ADDRESS,
    abi: jobTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  const { data: userStakeData, refetch: refetchUserStake } = useReadContract({
    address: REVENUE_DISTRIBUTOR_ADDRESS,
    abi: revenueDistributorAbi,
    functionName: 'getUserStaked',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })
  const userStakedAmount = userStakeData ? (userStakeData as any)[0] : 0n
  const lastStakeTimestamp = userStakeData ? Number((userStakeData as any)[1]) : 0

  const { data: totalStaked = 0n, refetch: refetchTotalStaked } = useReadContract({
    address: REVENUE_DISTRIBUTOR_ADDRESS,
    abi: revenueDistributorAbi,
    functionName: 'totalStakedJOB'
  })

  const { data: pendingUsdc = 0n, refetch: refetchUsdc } = useReadContract({
    address: REVENUE_DISTRIBUTOR_ADDRESS,
    abi: revenueDistributorAbi,
    functionName: 'getPendingRevenue',
    args: address ? [address, USDC_ADDRESS_ARC] : undefined,
    query: { enabled: !!address }
  })

  const { data: pendingEurc = 0n, refetch: refetchEurc } = useReadContract({
    address: REVENUE_DISTRIBUTOR_ADDRESS,
    abi: revenueDistributorAbi,
    functionName: 'getPendingRevenue',
    args: address ? [address, EURC_ADDRESS_ARC] : undefined,
    query: { enabled: !!address }
  })

  const { data: currentBps = 0n, refetch: refetchBps } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS,
    abi: jobChainAbi,
    functionName: 'PROTOCOL_FEE_BPS'
  })

  const { data: nextProposalId = 0n, refetch: refetchNextProp } = useReadContract({
    address: REVENUE_DISTRIBUTOR_ADDRESS,
    abi: revenueDistributorAbi,
    functionName: 'nextProposalId'
  })

  // Proposal retrieval
  const [proposals, setProposals] = useState<Proposal[]>([])

  const loadProposals = async () => {
    if (!publicClient || !nextProposalId) return
    const temp: Proposal[] = []
    const count = Number(nextProposalId)
    for (let i = 0; i < count; i++) {
      try {
        const p = (await publicClient.readContract({
          address: REVENUE_DISTRIBUTOR_ADDRESS,
          abi: revenueDistributorAbi,
          functionName: 'getProposal',
          args: [BigInt(i)]
        })) as unknown as any[]

        let hasVoted = false
        if (address) {
          hasVoted = (await publicClient.readContract({
            address: REVENUE_DISTRIBUTOR_ADDRESS,
            abi: revenueDistributorAbi,
            functionName: 'getHasVoted',
            args: [BigInt(i), address]
          })) as boolean
        }

        temp.push({
          id: Number(p[0]),
          description: p[1],
          newProtocolFeeBps: Number(p[2]),
          forVotes: p[3],
          againstVotes: p[4],
          endBlock: Number(p[5]),
          executed: p[6],
          hasVoted
        })
      } catch (err) {
        console.error(err)
      }
    }
    setProposals(temp.reverse()) // newest first
  }

  useEffect(() => {
    loadProposals()
  }, [nextProposalId, address, currentBlock])

  const handleRefetch = () => {
    refetchJobBal()
    refetchUserStake()
    refetchTotalStaked()
    refetchUsdc()
    refetchEurc()
    refetchBps()
    refetchNextProp()
    loadProposals()
  }

  // Stake implementation
  const handleStake = async () => {
    if (!stakeAmount || !address) return
    setIsStaking(true)
    try {
      const amt = parseUnits(stakeAmount, 18)

      // Approve
      toast.loading('Approving governance token spend...', { id: 'stake' })
      const appTx = await writeContractAsync({
        address: JOB_TOKEN_ADDRESS,
        abi: jobTokenAbi,
        functionName: 'approve',
        args: [REVENUE_DISTRIBUTOR_ADDRESS, amt]
      })
      await publicClient?.waitForTransactionReceipt({ hash: appTx })

      // Stake
      toast.loading('Staking JOB in RevenueDistributor...', { id: 'stake' })
      const stakeTx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'stakeJOB',
        args: [amt]
      })
      await publicClient?.waitForTransactionReceipt({ hash: stakeTx })

      toast.success('Successfully staked JOB!', { id: 'stake' })
      setStakeAmount('')
      handleRefetch()
    } catch (err: any) {
      toast.error(`Staking failed: ${err.message || err}`, { id: 'stake' })
    } finally {
      setIsStaking(false)
    }
  }

  // Unstake implementation
  const handleUnstake = async () => {
    if (!unstakeAmount || !address) return
    setIsUnstaking(true)
    try {
      const amt = parseUnits(unstakeAmount, 18)
      toast.loading('Unstaking JOB tokens...', { id: 'unstake' })
      const tx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'unstakeJOB',
        args: [amt]
      })
      await publicClient?.waitForTransactionReceipt({ hash: tx })
      toast.success('Successfully unstaked JOB!', { id: 'unstake' })
      setUnstakeAmount('')
      handleRefetch()
    } catch (err: any) {
      toast.error(`Unstaking failed: ${err.message || err}`, { id: 'unstake' })
    } finally {
      setIsUnstaking(false)
    }
  }

  // Claim revenue implementation
  const handleClaim = async () => {
    if (!address) return
    setIsClaiming(true)
    try {
      toast.loading('Claiming accumulated protocol revenue...', { id: 'claim' })
      const tx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'claimRevenue'
      })
      await publicClient?.waitForTransactionReceipt({ hash: tx })
      toast.success('Successfully claimed revenue!', { id: 'claim' })
      handleRefetch()
    } catch (err: any) {
      toast.error(`Claim failed: ${err.message || err}`, { id: 'claim' })
    } finally {
      setIsClaiming(false)
    }
  }

  // Create proposal implementation
  const handleCreateProposal = async () => {
    if (!propDesc || !propFee || !address) return
    setIsSubmittingProp(true)
    try {
      const bps = BigInt(propFee)
      toast.loading('Submitting parameter proposal...', { id: 'prop' })
      const tx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'createProposal',
        args: [propDesc, bps]
      })
      await publicClient?.waitForTransactionReceipt({ hash: tx })
      toast.success('Proposal submitted successfully!', { id: 'prop' })
      setPropDesc('')
      setPropFee('')
      handleRefetch()
    } catch (err: any) {
      toast.error(`Proposal creation failed: ${err.message || err}`, { id: 'prop' })
    } finally {
      setIsSubmittingProp(false)
    }
  }

  // Cast vote implementation
  const handleVote = async (proposalId: number, support: boolean) => {
    if (!address) return
    try {
      toast.loading(`Casting vote ${support ? 'FOR' : 'AGAINST'}...`, { id: 'vote' })
      const tx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'castVote',
        args: [BigInt(proposalId), support]
      })
      await publicClient?.waitForTransactionReceipt({ hash: tx })
      toast.success('Vote cast successfully!', { id: 'vote' })
      handleRefetch()
    } catch (err: any) {
      toast.error(`Voting failed: ${err.message || err}`, { id: 'vote' })
    }
  }

  // Execute proposal implementation
  const handleExecute = async (proposalId: number) => {
    try {
      toast.loading('Executing approved proposal parameter changes...', { id: 'exec' })
      const tx = await writeContractAsync({
        address: REVENUE_DISTRIBUTOR_ADDRESS,
        abi: revenueDistributorAbi,
        functionName: 'executeProposal',
        args: [BigInt(proposalId)]
      })
      await publicClient?.waitForTransactionReceipt({ hash: tx })
      toast.success('Proposal executed successfully! Parameters updated.', { id: 'exec' })
      handleRefetch()
    } catch (err: any) {
      toast.error(`Execution failed: ${err.message || err}`, { id: 'exec' })
    }
  }

  return (
    <div style={{ padding: 24, background: '#10121B', minHeight: '100vh', color: '#C0CAF5', fontFamily: 'monospace' }}>
      {/* Header and Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--warp-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            🏛️ DAO Governance &amp; Revenue Sharing
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--warp-muted)', fontSize: 12 }}>
            Stake JOB to earn proportional protocol fees from JobChainV2 escrows and vote on parameter adjustments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: '10px 16px', borderRadius: 8, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>CURRENT FEE BPS</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--warp-cyan)' }}>
              {Number(currentBps) / 100}% ({Number(currentBps)} BPS)
            </div>
          </div>
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: '10px 16px', borderRadius: 8, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>CURRENT BLOCK</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--warp-warning)' }}>
              #{currentBlock}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Stake / Revenue Tab */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 24, marginBottom: 24 }}>
        
        {/* Left Column: Stake and Rewards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Staking Card */}
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
            <div style={{ color: 'var(--warp-success)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={16} /> Stake JOB Governance Token
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 12 }}>
              <span>Wallet JOB Balance:</span>
              <span style={{ color: 'var(--warp-cyan)' }}>{parseFloat(formatUnits(jobBalance, 18)).toFixed(2)} JOB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 16 }}>
              <span>Your Staked JOB:</span>
              <span style={{ color: 'var(--warp-magenta)' }}>{parseFloat(formatUnits(userStakedAmount, 18)).toFixed(2)} JOB</span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                type="number"
                placeholder="JOB Amount"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                style={{ flex: 1, padding: 8, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5', outline: 'none' }}
              />
              <button
                onClick={handleStake}
                disabled={isStaking || !stakeAmount}
                style={{ background: 'var(--warp-success)', border: 'none', color: '#10121B', padding: '0 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isStaking ? 'Staking...' : 'Stake'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                type="number"
                placeholder="JOB Amount"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                style={{ flex: 1, padding: 8, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5', outline: 'none' }}
              />
              <button
                onClick={handleUnstake}
                disabled={isUnstaking || !unstakeAmount}
                style={{ background: '#F7768E', border: 'none', color: '#10121B', padding: '0 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isUnstaking ? 'Unstaking...' : 'Unstake'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, background: 'rgba(255, 158, 100, 0.1)', padding: 10, borderRadius: 6, border: '1px solid rgba(255, 158, 100, 0.2)' }}>
              <Clock size={16} style={{ color: 'var(--warp-warning)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 10, color: 'var(--warp-warning)' }}>
                Staking lock: Unstaking / claims are locked for 1 hour after staking to prevent flash-loan vector manipulation.
              </div>
            </div>
          </div>

          {/* Revenue distribution claims */}
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
            <div style={{ color: 'var(--warp-cyan)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} /> Claimable Protocol Revenue
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
              <span>Total Staked JOB Pool:</span>
              <span style={{ color: 'var(--warp-primary)' }}>{parseFloat(formatUnits(totalStaked, 18)).toFixed(2)} JOB</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
              <span>Claimable USDC:</span>
              <span style={{ color: 'var(--warp-success)' }}>{parseFloat(formatUnits(pendingUsdc, 6)).toFixed(4)} USDC</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 20 }}>
              <span>Claimable EURC:</span>
              <span style={{ color: 'var(--warp-cyan)' }}>{parseFloat(formatUnits(pendingEurc, 6)).toFixed(4)} EURC</span>
            </div>

            <button
              onClick={handleClaim}
              disabled={isClaiming || (pendingUsdc === 0n && pendingEurc === 0n)}
              style={{
                width: '100%',
                background: 'var(--warp-primary)',
                border: 'none',
                color: '#10121B',
                padding: '10px 0',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Coins size={16} />
              {isClaiming ? 'Claiming Rewards...' : 'Claim Combined Revenue'}
            </button>
          </div>
        </div>

        {/* Right Column: Governance Proposal Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Submit Proposal form */}
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
            <div style={{ color: 'var(--warp-primary)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FilePlus2 size={16} /> Create Parameter Proposal
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <input
                  type="text"
                  placeholder="Proposal Description (e.g. Set Protocol Fee to 1.5%)"
                  value={propDesc}
                  onChange={(e) => setPropDesc(e.target.value)}
                  style={{ width: '100%', padding: 8, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  placeholder="New Fee BPS (e.g. 150)"
                  value={propFee}
                  onChange={(e) => setPropFee(e.target.value)}
                  style={{ width: '100%', padding: 8, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5', outline: 'none' }}
                />
              </div>
            </div>

            <button
              onClick={handleCreateProposal}
              disabled={isSubmittingProp || !propDesc || !propFee}
              style={{
                width: '100%',
                background: 'var(--warp-cyan)',
                border: 'none',
                color: '#10121B',
                padding: '10px 0',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <PlusCircle size={16} />
              Submit Proposal
            </button>
          </div>

          {/* Active / Inactive proposals */}
          <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8, flex: 1 }}>
            <div style={{ color: 'var(--warp-warning)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={16} /> Proposals Queue
            </div>

            {proposals.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--warp-muted)', fontSize: 12 }}>
                No active governance proposals detected on-chain.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 380, overflowY: 'auto', paddingRight: 6 }}>
                {proposals.map((prop) => {
                  const isActive = currentBlock < prop.endBlock
                  const hasEnded = currentBlock >= prop.endBlock
                  const meetsQuorum = (prop.forVotes + prop.againstVotes) >= (totalStaked * 10n) / 100n
                  const isWinning = prop.forVotes > prop.againstVotes
                  const isExecutable = hasEnded && !prop.executed && meetsQuorum && isWinning

                  return (
                    <div key={prop.id} style={{ background: '#10121B', border: '1px solid #292E42', padding: 14, borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--warp-cyan)', fontWeight: 'bold' }}>PROPOSAL #{prop.id}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {prop.executed ? (
                            <span style={{ fontSize: 9, background: 'rgba(158, 206, 106, 0.15)', color: '#9ECE6A', padding: '2px 6px', borderRadius: 4 }}>EXECUTED</span>
                          ) : isActive ? (
                            <span style={{ fontSize: 9, background: 'rgba(255, 158, 100, 0.15)', color: 'var(--warp-warning)', padding: '2px 6px', borderRadius: 4 }}>ACTIVE (Ends @ #{prop.endBlock})</span>
                          ) : isWinning && meetsQuorum ? (
                            <span style={{ fontSize: 9, background: 'rgba(122, 162, 247, 0.15)', color: '#7AA2F7', padding: '2px 6px', borderRadius: 4 }}>PASSED</span>
                          ) : (
                            <span style={{ fontSize: 9, background: 'rgba(247, 118, 142, 0.15)', color: '#F7768E', padding: '2px 6px', borderRadius: 4 }}>REJECTED</span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#C0CAF5', fontWeight: 'bold', marginBottom: 6 }}>
                        {prop.description}
                      </div>

                      <div style={{ fontSize: 10, color: 'var(--warp-muted)', marginBottom: 12 }}>
                        Updates Fee parameter to: <strong style={{ color: 'var(--warp-cyan)' }}>{prop.newProtocolFeeBps / 100}% ({prop.newProtocolFeeBps} BPS)</strong>
                      </div>

                      {/* Vote Metrics */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#A9B1D6', marginBottom: 12 }}>
                        <span>For: {parseFloat(formatUnits(prop.forVotes, 18)).toFixed(2)} JOB</span>
                        <span>Against: {parseFloat(formatUnits(prop.againstVotes, 18)).toFixed(2)} JOB</span>
                      </div>

                      {/* Interactive Actions */}
                      {isActive && (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => handleVote(prop.id, true)}
                            disabled={prop.hasVoted}
                            style={{
                              flex: 1,
                              background: prop.hasVoted ? '#292E42' : 'rgba(158, 206, 106, 0.15)',
                              border: '1px solid #9ECE6A',
                              color: '#9ECE6A',
                              padding: '6px 0',
                              borderRadius: 4,
                              cursor: prop.hasVoted ? 'default' : 'pointer',
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}
                          >
                            {prop.hasVoted ? 'Voted' : 'Vote For'}
                          </button>
                          <button
                            onClick={() => handleVote(prop.id, false)}
                            disabled={prop.hasVoted}
                            style={{
                              flex: 1,
                              background: prop.hasVoted ? '#292E42' : 'rgba(247, 118, 142, 0.15)',
                              border: '1px solid #F7768E',
                              color: '#F7768E',
                              padding: '6px 0',
                              borderRadius: 4,
                              cursor: prop.hasVoted ? 'default' : 'pointer',
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}
                          >
                            {prop.hasVoted ? 'Voted' : 'Vote Against'}
                          </button>
                        </div>
                      )}

                      {isExecutable && (
                        <button
                          onClick={() => handleExecute(prop.id)}
                          style={{
                            width: '100%',
                            background: '#7AA2F7',
                            border: 'none',
                            color: '#10121B',
                            padding: '8px 0',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <CheckCircle size={14} />
                          Execute Parameter Change
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
