'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { UserPlus, Shield, Trophy, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { JOBCHAIN_CONTRACT_ADDRESS, USDC_ADDRESS_ARC, jobChainAbi, usdcAbi } from '@/lib/contracts'

interface AgentData {
  id: number
  owner: string
  name: string
  capabilities: string
  stakedAmount: bigint
  completedJobs: number
  totalScore: number
  failedJobs: number
  isActive: boolean
}

export function AgentsTab() {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [stakeAgentId, setStakeAgentId] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(false)

  const { writeContractAsync } = useWriteContract()
  const { data: nextAgentId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextAgentId',
  })

  // Fetch all agents from chain
  useEffect(() => {
    async function fetchAgents() {
      if (!publicClient || !nextAgentId) return
      const count = Number(nextAgentId)
      const list: AgentData[] = []
      for (let i = 0; i < count; i++) {
        try {
          const data = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
            functionName: 'getAgent', args: [BigInt(i)],
          }) as unknown as any[]
          list.push({
            id: i, owner: data[0], name: data[1], capabilities: data[2],
            stakedAmount: data[3], completedJobs: Number(data[4]),
            totalScore: Number(data[5]), failedJobs: Number(data[6]), isActive: data[7],
          })
        } catch { /* skip */ }
      }
      setAgents(list)
    }
    fetchAgents()
  }, [publicClient, nextAgentId])

  const handleRegister = async () => {
    if (!isConnected || !name || !capabilities) {
      toast.error('Connect wallet and fill all fields'); return
    }
    setLoading(true)
    const tid = toast.loading('Broadcasting registerAgent...')
    try {
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
        functionName: 'registerAgent', args: [name, capabilities],
      })
      toast.success(
        <span>Agent registered! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      setName(''); setCapabilities('')
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Transaction failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleStake = async () => {
    if (!isConnected || !stakeAgentId || !stakeAmount) {
      toast.error('Fill agent ID and stake amount'); return
    }
    setLoading(true)
    const tid = toast.loading('Approving USDC...')
    try {
      const amount = parseUnits(stakeAmount, 6)
      await writeContractAsync({
        address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve',
        args: [JOBCHAIN_CONTRACT_ADDRESS, amount],
      })
      toast.loading('Staking collateral...', { id: tid })
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
        functionName: 'stakeCollateral', args: [BigInt(stakeAgentId), amount],
      })
      toast.success(
        <span>Staked {stakeAmount} USDC! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      setStakeAmount('')
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Stake failed', { id: tid })
    } finally { setLoading(false) }
  }

  const getScore = (a: AgentData) => a.completedJobs > 0 ? (a.totalScore / a.completedJobs).toFixed(1) : '—'

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/agent-registry</span>
        <span style={{ color: 'var(--warp-text)' }}> ./manage-agents</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        ERC-8004 Agent Identity — Register, Stake, Build Reputation
        <br />Total Registered: {nextAgentId?.toString() || '0'} agents
      </div>

      {/* ── Agent Leaderboard ── */}
      {agents.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            <Trophy size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            AGENT LEADERBOARD
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Capabilities</th>
                <th>Stake</th>
                <th>Jobs</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--warp-primary)' }}>#{a.id}</td>
                  <td style={{ color: 'var(--warp-text)', fontWeight: 600 }}>{a.name}</td>
                  <td>
                    {a.capabilities.split(',').map((c, i) => (
                      <span key={i} className="tag">{c.trim()}</span>
                    ))}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUnits(a.stakedAmount, 6)} <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>USDC</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--warp-success)' }}>{a.completedJobs}</span>
                    {a.failedJobs > 0 && <span style={{ color: 'var(--warp-error)', marginLeft: 4 }}>/{a.failedJobs}✗</span>}
                  </td>
                  <td>
                    {a.completedJobs > 0 ? (
                      <span style={{ color: 'var(--warp-warning)' }}>
                        <Star size={10} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                        {getScore(a)}
                      </span>
                    ) : <span style={{ color: 'var(--warp-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${a.isActive ? 'active' : 'inactive'}`}>
                      {a.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Forms ── */}
      <div className="form-grid">
        <div className="form-card">
          <div className="form-title"><UserPlus size={16} /> Register New Agent</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>AGENT_NAME</label>
            <input className="warp-input" placeholder="GPT-Analyzer" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-warning)' }}>CAPABILITIES (comma-separated)</label>
            <input className="warp-input" placeholder="nlp,sentiment,summarize" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
          </div>
          <button className="warp-btn" onClick={handleRegister} disabled={!isConnected || loading}>
            <UserPlus size={14} /> {loading ? 'Processing...' : 'Register Agent (ERC-8004)'}
          </button>
        </div>

        <div className="form-card">
          <div className="form-title"><Shield size={16} /> Stake Collateral</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>AGENT_ID</label>
            <input className="warp-input" placeholder="0" type="number" value={stakeAgentId} onChange={e => setStakeAgentId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-success)' }}>STAKE_AMOUNT_USDC</label>
            <input className="warp-input" placeholder="5.00" type="number" step="0.01" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} />
          </div>
          <button className="warp-btn secondary" onClick={handleStake} disabled={!isConnected || loading}>
            <Shield size={14} /> {loading ? 'Processing...' : 'Stake USDC Collateral'}
          </button>
        </div>
      </div>
    </div>
  )
}
