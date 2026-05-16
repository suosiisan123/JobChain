'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseUnits } from 'viem'
import { Briefcase, Play, CheckCircle } from 'lucide-react'
import { JOBCHAIN_CONTRACT_ADDRESS, USDC_ADDRESS_ARC, jobChainAbi, usdcAbi } from '@/lib/contracts'

export function JobsTab() {
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [output, setOutput] = useState<string[]>([])
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

  const addLog = (msg: string) => setOutput(prev => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`])

  const handlePostJob = async () => {
    if (!isConnected || !desc || !skills || !reward) { addLog('ERROR: Fill all fields'); return }
    try {
      const amount = parseUnits(reward, 6)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600)
      addLog(`> Approving ${reward} USDC...`)
      await writeContractAsync({ address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve', args: [JOBCHAIN_CONTRACT_ADDRESS, amount] })
      addLog(`> postJob("${desc}", "${skills}", ${reward} USDC)`)
      const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'postJob', args: [desc, skills, amount, deadline] })
      addLog(`TX: ${hash}`)
      addLog('SUCCESS: Job posted ✓')
      setDesc(''); setSkills(''); setReward('')
    } catch (err: any) { addLog(`ERROR: ${err?.shortMessage || err?.message}`) }
  }

  const handlePickup = async () => {
    if (!isConnected || !pickupJobId || !pickupAgentId) { addLog('ERROR: Fill IDs'); return }
    try {
      const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'pickupJob', args: [BigInt(pickupJobId), BigInt(pickupAgentId)] })
      addLog(`TX: ${hash}`); addLog('SUCCESS: Job claimed ✓')
    } catch (err: any) { addLog(`ERROR: ${err?.shortMessage || err?.message}`) }
  }

  const handleSubmit = async () => {
    if (!isConnected || !submitJobId || !resultHash) { addLog('ERROR: Fill fields'); return }
    try {
      const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'submitResult', args: [BigInt(submitJobId), resultHash] })
      addLog(`TX: ${hash}`); addLog('SUCCESS: Result submitted ✓')
    } catch (err: any) { addLog(`ERROR: ${err?.shortMessage || err?.message}`) }
  }

  const handleApprove = async () => {
    if (!isConnected || !approveJobId) { addLog('ERROR: Fill job ID'); return }
    try {
      const hash = await writeContractAsync({ address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'approveAndRelease', args: [BigInt(approveJobId), parseInt(rating)] })
      addLog(`TX: ${hash}`); addLog('SUCCESS: Payment released ✓')
    } catch (err: any) { addLog(`ERROR: ${err?.shortMessage || err?.message}`) }
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

      <div className="form-grid">
        <div className="form-card">
          <div className="form-title"><Briefcase size={16} /> Post Job</div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-magenta)'}}>DESCRIPTION</label><input className="warp-input" placeholder="Analyze sentiment..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-field"><label className="field-label" style={{color:'var(--warp-warning)'}}>CAPABILITIES</label><input className="warp-input" placeholder="nlp,sentiment" value={skills} onChange={e=>setSkills(e.target.value)}/></div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>REWARD_USDC</label><input className="warp-input" placeholder="5.00" type="number" value={reward} onChange={e=>setReward(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>DEADLINE_H</label><input className="warp-input" type="number" value={deadlineHours} onChange={e=>setDeadlineHours(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handlePostJob} disabled={!isConnected}><Briefcase size={14}/> Post Job</button>
        </div>

        <div className="form-card">
          <div className="form-title"><Play size={16} /> Claim Job</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={pickupJobId} onChange={e=>setPickupJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-magenta)'}}>AGENT_ID</label><input className="warp-input" type="number" value={pickupAgentId} onChange={e=>setPickupAgentId(e.target.value)}/></div>
          </div>
          <button className="warp-btn secondary" onClick={handlePickup} disabled={!isConnected}><Play size={14}/> Claim</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Submit Result</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={submitJobId} onChange={e=>setSubmitJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:2}}><label className="field-label" style={{color:'var(--warp-warning)'}}>RESULT_HASH</label><input className="warp-input" placeholder="QmHash..." value={resultHash} onChange={e=>setResultHash(e.target.value)}/></div>
          </div>
          <button className="warp-btn secondary" onClick={handleSubmit} disabled={!isConnected}><CheckCircle size={14}/> Submit</button>
        </div>

        <div className="form-card">
          <div className="form-title"><CheckCircle size={16} /> Approve &amp; Pay</div>
          <div style={{display:'flex',gap:12}}>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-cyan)'}}>JOB_ID</label><input className="warp-input" type="number" value={approveJobId} onChange={e=>setApproveJobId(e.target.value)}/></div>
            <div className="form-field" style={{flex:1}}><label className="field-label" style={{color:'var(--warp-success)'}}>RATING (1-5)</label><input className="warp-input" type="number" min="1" max="5" value={rating} onChange={e=>setRating(e.target.value)}/></div>
          </div>
          <button className="warp-btn" onClick={handleApprove} disabled={!isConnected} style={{background:'var(--warp-success)'}}><CheckCircle size={14}/> Release USDC</button>
        </div>
      </div>

      {output.length > 0 && (
        <div className="output-log">
          <div style={{color:'var(--warp-muted)',fontSize:12,marginBottom:8}}>STDOUT:</div>
          {output.map((l,i)=>(<div key={i} style={{color:l.includes('ERROR')?'var(--warp-error)':l.includes('SUCCESS')?'var(--warp-success)':'var(--warp-text)',fontSize:13}}>{l}</div>))}
        </div>
      )}
    </div>
  )
}
