'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Briefcase, Play, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { JOBCHAIN_CONTRACT_ADDRESS, USDC_ADDRESS_ARC, jobChainAbi, usdcAbi } from '@/lib/contracts'

const STATUS_LABELS = ['Open', 'InProgress', 'Submitted', 'Completed', 'Failed', 'Cancelled'] as const
const STATUS_COLORS: Record<string, string> = {
  Open: 'var(--warp-primary)', InProgress: 'var(--warp-warning)',
  Submitted: 'var(--warp-cyan)', Completed: 'var(--warp-success)',
  Failed: 'var(--warp-error)', Cancelled: 'var(--warp-muted)',
}

interface JobData {
  id: number; poster: string; description: string; requiredCapabilities: string
  reward: bigint; deadline: number; assignedAgent: number
  status: number; resultHash: string; rating: number; createdAt: number
}

export function JobsTab() {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [jobs, setJobs] = useState<JobData[]>([])
  const [loading, setLoading] = useState(false)
  const [desc, setDesc] = useState('')
  const [skills, setSkills] = useState('')
  const [reward, setReward] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [pickupJobId, setPickupJobId] = useState('')
  const [pickupAgentId, setPickupAgentId] = useState('')
  const [submitJobId, setSubmitJobId] = useState('')
  const [resultHash, setResultHash] = useState('')
  const [approveJobId, setApproveJobId] = useState('')
  const [rating, setRating] = useState('5')

  const { data: nextJobId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId',
  })

  useEffect(() => {
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
          list.push({
            id: i, poster: d[0], description: d[1], requiredCapabilities: d[2],
            reward: d[3], deadline: Number(d[4]), assignedAgent: Number(d[5]),
            status: Number(d[6]), resultHash: d[7], rating: Number(d[8]), createdAt: Number(d[9]),
          })
        } catch { /* skip */ }
      }
      setJobs(list)
    }
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
      toast.error(err?.shortMessage || 'Failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handlePostJob = () => txToast('Posting job...', async () => {
    const amount = parseUnits(reward, 6)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600)
    await writeContractAsync({ address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve', args: [JOBCHAIN_CONTRACT_ADDRESS, amount] })
    const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'postJob', args: [desc, skills, amount, deadline] })
    setDesc(''); setSkills(''); setReward('')
    return hash
  })

  const handlePickup = () => txToast('Claiming job...', async () => {
    return await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'pickupJob', args: [BigInt(pickupJobId), BigInt(pickupAgentId)] })
  })

  const handleSubmit = () => txToast('Submitting result...', async () => {
    return await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'submitResult', args: [BigInt(submitJobId), resultHash] })
  })

  const handleApprove = () => txToast('Releasing payment...', async () => {
    return await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'approveAndRelease', args: [BigInt(approveJobId), parseInt(rating)] })
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
        ERC-8183 Job Protocol — Post, Claim, Submit, Approve | Total: {nextJobId?.toString() || '0'}
      </div>

      {/* ── Job Queue Table ── */}
      {jobs.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            <Briefcase size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            JOB QUEUE
          </div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Description</th><th>Skills</th><th>Reward</th><th>Deadline</th><th>Agent</th><th>Status</th></tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td style={{ color: 'var(--warp-primary)' }}>#{j.id}</td>
                  <td style={{ color: 'var(--warp-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description}</td>
                  <td>{j.requiredCapabilities.split(',').map((c, i) => <span key={i} className="tag">{c.trim()}</span>)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-success)' }}>
                    {formatUnits(j.reward, 6)} <span style={{ fontSize: 10, color: 'var(--warp-muted)' }}>USDC</span>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                    {timeLeft(j.deadline)}
                  </td>
                  <td>{j.status > 0 ? <span style={{ color: 'var(--warp-magenta)' }}>#{j.assignedAgent}</span> : <span style={{ color: 'var(--warp-muted)' }}>—</span>}</td>
                  <td><span className="status-badge" style={{ color: STATUS_COLORS[getStatusLabel(j.status)] }}>{getStatusLabel(j.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Forms ── */}
      <div className="form-grid">
        <div className="form-card">
          <div className="form-title"><Briefcase size={16} /> Post Job</div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-magenta)'}}>DESCRIPTION</label><input className="warp-input" placeholder="Analyze sentiment of 100 tweets" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-warning)'}}>CAPABILITIES</label><input className="warp-input" placeholder="nlp,sentiment" value={skills} onChange={e=>setSkills(e.target.value)}/></div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>REWARD_USDC</label><input className="warp-input" placeholder="5.00" type="number" value={reward} onChange={e=>setReward(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>DEADLINE_H</label><input className="warp-input" type="number" value={deadlineHours} onChange={e=>setDeadlineHours(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handlePostJob} disabled={!isConnected||loading||!desc||!skills||!reward}><Briefcase size={14}/> {loading?'Processing...':'Post Job'}</button>
        </div>

        <div className="form-card">
          <div className="form-title"><Play size={16} /> Claim Job</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={pickupJobId} onChange={e=>setPickupJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-magenta)'}}>AGENT_ID</label><input className="warp-input" type="number" value={pickupAgentId} onChange={e=>setPickupAgentId(e.target.value)}/></div>
          </div>
          <button className="warp-btn secondary" onClick={handlePickup} disabled={!isConnected||loading}><Play size={14}/> Claim</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Submit Result</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={submitJobId} onChange={e=>setSubmitJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:2}}><label className="field-label" style={{color:'var(--warp-warning)'}}>RESULT_HASH</label><input className="warp-input" placeholder="QmHash..." value={resultHash} onChange={e=>setResultHash(e.target.value)}/></div>
          </div>
          <button className="warp-btn secondary" onClick={handleSubmit} disabled={!isConnected||loading}><CheckCircle size={14}/> Submit</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Approve &amp; Pay</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={approveJobId} onChange={e=>setApproveJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>RATING (1-5)</label><input className="warp-input" type="number" min="1" max="5" value={rating} onChange={e=>setRating(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handleApprove} disabled={!isConnected||loading} style={{background:'var(--warp-success)'}}><CheckCircle size={14}/> Release USDC</button>
        </div>
      </div>
    </div>
  )
}
