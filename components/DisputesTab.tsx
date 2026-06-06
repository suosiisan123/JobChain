'use client'

import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem } from 'viem'
import { Scale, Vote, AlertTriangle, RefreshCw, CheckCircle, ShieldAlert, Clock, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  EURC_ADDRESS_ARC,
  USDC_ADDRESS_ARC
} from '@/lib/contracts'

interface DisputeData {
  jobId: number
  description: string
  reward: bigint
  paymentToken: string
  assignedAgent: number
  disputedAt: number
  approveWeight: number
  rejectWeight: number
  resolved: boolean
  failedTime: number
  voterCount: number
}

interface AgentValidatorData {
  agentId: number
  name: string
  completedJobs: number
  totalScore: number
  isActive: boolean
  isEligible: boolean
  avgRating: string
}

export function DisputesTab() {
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const [loading, setLoading] = useState(false)
  
  // Lists
  const [activeDisputes, setActiveDisputes] = useState<DisputeData[]>([])
  const [myAgents, setMyAgents] = useState<AgentValidatorData[]>([])
  
  // Manual form inputs
  const [manualJobId, setManualJobId] = useState('')
  const [manualAgentId, setManualAgentId] = useState('')
  const [voteChoice, setVoteChoice] = useState<'approve' | 'reject'>('approve')
  const [resolveJobIdInput, setResolveJobIdInput] = useState('')

  const { data: nextJobId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId',
  })

  // Fetch disputes
  async function fetchDisputes() {
    if (!publicClient || !nextJobId) return
    try {
      const count = Number(nextJobId)
      const list: DisputeData[] = []
      for (let i = 0; i < count; i++) {
        try {
          const job = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            functionName: 'getJob',
            args: [BigInt(i)]
          }) as unknown as any[]
          
          const status = Number(job[6])
          // status = 6 is Disputed
          if (status === 6) {
            const dispute = await publicClient.readContract({
              address: JOBCHAIN_CONTRACT_ADDRESS,
              abi: jobChainAbi,
              functionName: 'getDispute',
              args: [BigInt(i)]
            }) as unknown as any[]
            
            list.push({
              jobId: i,
              description: job[1],
              reward: job[3],
              paymentToken: job[10],
              assignedAgent: Number(job[5]),
              disputedAt: Number(dispute[0]),
              approveWeight: Number(dispute[1]) / 100, // divided by 100 as weight is (score * 100) / completed
              rejectWeight: Number(dispute[2]) / 100,
              resolved: dispute[3],
              failedTime: Number(dispute[4]),
              voterCount: Number(dispute[5])
            })
          }
        } catch (err) {
          console.error(`Failed to read job/dispute #${i}:`, err)
        }
      }
      setActiveDisputes(list)
    } catch (err) {
      console.error('Failed to fetch disputes:', err)
    }
  }

  // Fetch my validator agents
  async function fetchMyValidatorAgents() {
    if (!publicClient || !address) return
    try {
      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock > 100000n ? latestBlock - 100000n : 0n

      const logs = await publicClient.getLogs({
        address: IDENTITY_REGISTRY,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        fromBlock,
        toBlock: latestBlock
      })

      const myAgentIds = new Set<number>()
      for (const log of logs) {
        if (log.args.to?.toLowerCase() === address.toLowerCase()) {
          myAgentIds.add(Number(log.args.tokenId))
        }
      }

      const list: AgentValidatorData[] = []
      for (const aid of Array.from(myAgentIds)) {
        try {
          const agent = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            functionName: 'getAgent',
            args: [BigInt(aid)]
          }) as unknown as any[]
          
          const completed = Number(agent[4])
          const totalScore = Number(agent[5])
          const isActive = agent[7] as boolean
          
          // isEligible: isActive && completed > 10 && average rating > 4
          const avg = completed > 0 ? (totalScore / completed).toFixed(2) : '0.00'
          const isEligible = isActive && completed > 10 && (totalScore > completed * 4)

          list.push({
            agentId: aid,
            name: agent[1] || `Agent #${aid}`,
            completedJobs: completed,
            totalScore,
            isActive,
            isEligible,
            avgRating: avg
          })
        } catch (err) {
          console.error(`Failed to fetch agent #${aid}:`, err)
        }
      }
      setMyAgents(list)
    } catch (err) {
      console.error('Failed to fetch validator agents:', err)
    }
  }

  useEffect(() => {
    fetchDisputes()
    fetchMyValidatorAgents()
  }, [publicClient, nextJobId, address])

  const txToast = async (label: string, fn: () => Promise<string>) => {
    setLoading(true)
    const tid = toast.loading(label)
    try {
      const hash = await fn()
      toast.success(
        <span>Done! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      fetchDisputes()
      fetchMyValidatorAgents()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleVote = (jobId: number, agentId: number, support: boolean) => txToast('Casting vote...', async () => {
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'castVote',
      args: [BigInt(jobId), BigInt(agentId), support]
    })
  })

  const handleResolve = (jobId: number) => txToast('Resolving dispute...', async () => {
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'resolveDispute',
      args: [BigInt(jobId)]
    })
  })

  const getVoteCountdown = (disputedAt: number) => {
    const end = disputedAt + 48 * 3600
    const diff = end - Math.floor(Date.now() / 1000)
    if (diff <= 0) return 'Voting Closed'
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    return `${h}h ${m}m remaining`
  }

  const isVotingExpired = (disputedAt: number) => {
    const end = disputedAt + 48 * 3600
    return Math.floor(Date.now() / 1000) >= end
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/disputes</span>
        <span style={{ color: 'var(--warp-text)' }}> ./dispute-panel</span>
        <button
          onClick={() => { fetchDisputes(); fetchMyValidatorAgents(); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--warp-cyan)', cursor: 'pointer', marginLeft: 12 }}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        Decentralized Multi-Agent Dispute Resolution &amp; Arbitration Registry
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginLeft: 24, marginRight: 24 }}>
        
        {/* Left Column: Active Disputes */}
        <div>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
            <ShieldAlert size={14} style={{ marginRight: 6 }} />
            ACTIVE DISPUTES ({activeDisputes.length})
          </div>

          {activeDisputes.length === 0 ? (
            <div style={{ background: '#1A1B26', border: '1px dashed #292E42', padding: 32, borderRadius: 8, textAlign: 'center', color: 'var(--warp-muted)' }}>
              <Scale size={32} style={{ margin: '0 auto 12px', color: '#3B4261' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warp-text)' }}>No Active Disputes</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Agents have a 24-hour window to dispute job failures marked by posters.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeDisputes.map(d => {
                const votingExpired = isVotingExpired(d.disputedAt)
                return (
                  <div key={d.jobId} style={{ background: '#1A1B26', border: '1px solid #292E42', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1F2335', paddingBottom: 8, marginBottom: 12 }}>
                      <div>
                        <span style={{ color: 'var(--warp-primary)', fontWeight: 'bold' }}>Job #{d.jobId}</span>
                        <span style={{ color: 'var(--warp-muted)', fontSize: 11, marginLeft: 8 }}>{d.description}</span>
                      </div>
                      <span style={{ color: 'var(--warp-success)', fontWeight: 'bold' }}>
                        {formatUnits(d.reward, 6)} {d.paymentToken.toLowerCase() === EURC_ADDRESS_ARC.toLowerCase() ? 'EURC' : 'USDC'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      {/* Left: Voting stats */}
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>VOTE TALLY</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                          <div>
                            <span style={{ color: 'var(--warp-success)', fontSize: 11 }}>Approve (Agent): </span>
                            <span style={{ color: 'var(--warp-text)', fontWeight: 'bold' }}>{d.approveWeight.toFixed(2)}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--warp-error)', fontSize: 11 }}>Reject (Poster): </span>
                            <span style={{ color: 'var(--warp-text)', fontWeight: 'bold' }}>{d.rejectWeight.toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
                          Total Votes: {d.voterCount}
                        </div>
                      </div>

                      {/* Right: Timing info */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>VOTING WINDOW</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, color: votingExpired ? 'var(--warp-error)' : 'var(--warp-warning)' }}>
                          <Clock size={12} />
                          <span style={{ fontSize: 11, fontWeight: 'bold' }}>{getVoteCountdown(d.disputedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Voting Actions */}
                    {!votingExpired ? (
                      <div style={{ background: '#1F2335', border: '1px solid #3B4261', borderRadius: 6, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-cyan)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Vote size={12} /> Cast Vote on behalf of your agent
                        </div>
                        {myAgents.filter(a => a.isEligible).length === 0 ? (
                          <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>
                            No eligible validator agents owned by your current address. (Requirement: Active, &gt; 10 completed jobs, &gt; 4.0 avg rating).
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <select
                              id={`vote-agent-select-${d.jobId}`}
                              className="warp-input"
                              style={{ flex: 1, background: '#1A1B26', border: '1px solid #292E42', borderRadius: 4, padding: 6, fontSize: 11, color: '#C0CAF5' }}
                            >
                              {myAgents.filter(a => a.isEligible).map(a => (
                                <option key={a.agentId} value={a.agentId}>
                                  {a.name} (Id: {a.agentId}, Score: {a.avgRating})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const el = document.getElementById(`vote-agent-select-${d.jobId}`) as HTMLSelectElement
                                if (el) handleVote(d.jobId, Number(el.value), true)
                              }}
                              className="warp-btn"
                              style={{ background: 'var(--warp-success)', padding: '6px 12px', fontSize: 11 }}
                              disabled={loading}
                            >
                              Approve Agent
                            </button>
                            <button
                              onClick={() => {
                                const el = document.getElementById(`vote-agent-select-${d.jobId}`) as HTMLSelectElement
                                if (el) handleVote(d.jobId, Number(el.value), false)
                              }}
                              className="warp-btn"
                              style={{ background: 'var(--warp-error)', padding: '6px 12px', fontSize: 11 }}
                              disabled={loading}
                            >
                              Reject Agent
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(122, 162, 247, 0.05)', border: '1px solid rgba(122, 162, 247, 0.2)', padding: 12, borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--warp-muted)' }}>Voting is closed. Anyone can now trigger consensus resolution.</span>
                        <button
                          onClick={() => handleResolve(d.jobId)}
                          className="warp-btn"
                          style={{ background: 'var(--warp-cyan)', padding: '6px 12px', fontSize: 11 }}
                          disabled={loading}
                        >
                          Resolve Dispute
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Validator list & manuals */}
        <div>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
            <UserCheck size={14} style={{ marginRight: 6 }} />
            MY VALIDATORS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* My Agents Panel */}
            <div className="form-card" style={{ margin: 0 }}>
              <div className="form-title" style={{ fontSize: 12, color: 'var(--warp-cyan)' }}>Active Signer Agents</div>
              
              {myAgents.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--warp-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No agents owned by this address.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myAgents.map(a => (
                    <div key={a.agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1F2335', padding: 8, borderRadius: 4, border: '1px solid #3B4261' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-text)' }}>{a.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--warp-muted)', marginTop: 2 }}>
                          Jobs: {a.completedJobs} | Rating: {a.avgRating}
                        </div>
                      </div>
                      <span
                        className="status-badge"
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: a.isEligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(247, 118, 142, 0.15)',
                          color: a.isEligible ? 'var(--warp-success)' : 'var(--warp-error)',
                          border: `1px solid ${a.isEligible ? 'var(--warp-success)' : 'var(--warp-error)'}`
                        }}
                      >
                        {a.isEligible ? 'Eligible' : 'Ineligible'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Voting Card */}
            <div className="form-card" style={{ margin: 0 }}>
              <div className="form-title" style={{ fontSize: 12 }}><Vote size={14} /> Manual Vote / Actions</div>
              
              <div className="form-field">
                <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>JOB ID</label>
                <input className="warp-input" type="number" value={manualJobId} onChange={e => setManualJobId(e.target.value)} placeholder="0" />
              </div>
              <div className="form-field">
                <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>VALIDATOR AGENT ID</label>
                <input className="warp-input" type="number" value={manualAgentId} onChange={e => setManualAgentId(e.target.value)} placeholder="1" />
              </div>
              <div className="form-field">
                <label className="field-label" style={{ color: 'var(--warp-success)' }}>VOTE DIRECTION</label>
                <select
                  className="warp-input"
                  value={voteChoice}
                  onChange={e => setVoteChoice(e.target.value as 'approve' | 'reject')}
                  style={{ background: '#1A1B26', color: 'var(--warp-text)', border: '1px solid #292E42', borderRadius: 4, padding: 6 }}
                >
                  <option value="approve">Approve (Agent Wins)</option>
                  <option value="reject">Reject (Poster Wins)</option>
                </select>
              </div>

              <button
                className="warp-btn secondary"
                onClick={() => handleVote(Number(manualJobId), Number(manualAgentId), voteChoice === 'approve')}
                disabled={loading || !manualJobId || !manualAgentId}
              >
                Cast Manual Vote
              </button>

              <div style={{ borderTop: '1px solid #292E42', marginTop: 12, paddingTop: 12 }}>
                <div className="form-field">
                  <label className="field-label" style={{ color: 'var(--warp-warning)' }}>RESOLVE JOB ID</label>
                  <input className="warp-input" type="number" value={resolveJobIdInput} onChange={e => setResolveJobIdInput(e.target.value)} placeholder="0" />
                </div>
                <button
                  className="warp-btn"
                  onClick={() => handleResolve(Number(resolveJobIdInput))}
                  disabled={loading || !resolveJobIdInput}
                  style={{ background: 'var(--warp-cyan)', width: '100%' }}
                >
                  Trigger Resolution
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
