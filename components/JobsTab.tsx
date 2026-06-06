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
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi
} from '@/lib/contracts'
import { useCCTP, CCTP_CHAINS } from '@/hooks/useCCTP'
import { BridgeStatusTracker } from '@/components/BridgeStatusTracker'

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
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const [jobs, setJobs] = useState<JobData[]>([])
  const [loading, setLoading] = useState(false)
  const [desc, setDesc] = useState('')
  const [skills, setSkills] = useState('')
  const [reward, setReward] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('24')

  // CCTP Bridge configurations
  const [selectedChainId, setSelectedChainId] = useState<number>(5042002) // default Arc Testnet Direct
  const [isSimulated, setIsSimulated] = useState(true)
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
      toast.error(err?.shortMessage || err?.message || 'Failed', { id: tid })
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

  const handlePostJobWrapper = async () => {
    if (selectedChainId === 5042002) {
      handlePostJob()
    } else {
      await startBridgeAndEscrow({
        sourceChainId: selectedChainId,
        amount: reward,
        description: desc,
        requiredCapabilities: skills,
        deadlineHours,
        isSimulated
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
      {bridgeState.step !== 'IDLE' && (
        <div style={{ marginLeft: 24, marginRight: 24, marginBottom: 24 }}>
          <BridgeStatusTracker bridgeState={bridgeState} onClose={resetBridge} />
        </div>
      )}

      <div className="form-grid">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #1F2335', paddingTop: 8 }}>
                <input
                  type="checkbox"
                  id="simToggle"
                  checked={isSimulated}
                  onChange={(e) => setIsSimulated(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="simToggle" style={{ fontSize: 10, color: 'var(--warp-warning)', cursor: 'pointer', fontWeight: 500 }}>
                  Use Sandbox Attestation Simulator
                </label>
              </div>
            </div>
          )}

          <div className="form-field"><label className="field-label" style={{color:'var(--warp-magenta)'}}>DESCRIPTION</label><input className="warp-input" placeholder="Analyze sentiment of 100 tweets" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-warning)'}}>CAPABILITIES</label><input className="warp-input" placeholder="nlp,sentiment" value={skills} onChange={e=>setSkills(e.target.value)}/></div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>REWARD_USDC</label><input className="warp-input" placeholder="5.00" type="number" value={reward} onChange={e=>setReward(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>DEADLINE_H</label><input className="warp-input" type="number" value={deadlineHours} onChange={e=>setDeadlineHours(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handlePostJobWrapper} disabled={!isConnected||loading||!desc||!skills||!reward}><Briefcase size={14}/> {loading?'Processing...':'Post Job'}</button>
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
