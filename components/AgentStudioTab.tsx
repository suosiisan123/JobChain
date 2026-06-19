'use client'

import { useState } from 'react'
import { Brain, Play, CheckCircle, Cpu, Loader2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface TaskDecomposed {
  description: string
  requiredCapabilities: string
  reward: string
}

interface PostedJob {
  jobId: string
  txHash: string
  description: string
}

export function AgentStudioTab() {
  const [prompt, setPrompt] = useState('Scrape decentralized yields on Base and Arbitrum. Audit smart contract vulnerabilities on Arc. Generate ZK execution proof.')
  const [loading, setLoading] = useState(false)
  const [decomposed, setDecomposed] = useState<TaskDecomposed[]>([])
  const [posted, setPosted] = useState<PostedJob[]>([])

  // Worker execution states
  const [runningWorker, setRunningWorker] = useState(false)
  const [workerAgentId, setWorkerAgentId] = useState('1')
  const [workerResult, setWorkerResult] = useState<any>(null)

  const handleOrchestrate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a goal or task prompt')
      return
    }

    setLoading(true)
    const tid = toast.loading('Orchestrating agent workflow...')
    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Orchestration failed')

      setDecomposed(data.decomposedTasks || [])
      setPosted(data.postedJobs || [])
      toast.success('Tasks decomposed and posted on-chain successfully!', { id: tid })
    } catch (err: any) {
      toast.error(err.message || 'Orchestration failed', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const triggerWorkerAgent = async () => {
    if (!workerAgentId) {
      toast.error('Please enter an agent ID')
      return
    }

    setRunningWorker(true)
    const tid = toast.loading(`Starting Autonomous Worker Agent #${workerAgentId}...`)
    try {
      const res = await fetch('/api/agent/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: workerAgentId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Worker execution failed')

      setWorkerResult(data)
      if (data.success) {
        toast.success(`Agent #${workerAgentId} claimed and completed a job!`, { id: tid })
      } else {
        toast(data.message || 'Worker processed but no jobs completed.', { id: tid, icon: '💡' })
      }
    } catch (err: any) {
      toast.error(err.message || 'Worker processing failed', { id: tid })
    } finally {
      setRunningWorker(false)
    }
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/job-chain</span>
        <span style={{ color: 'var(--warp-text)' }}> ./orchestrator-studio</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        JobChain Orchestration Engine — Decompose goals, escrow USDC, and trigger workers autonomously.
      </div>

      <div className="grid-2">
        {/* Left: Input Console */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} className="color-primary" />
            <span>Orchestrator Prompt Console</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="warp-label">NATURAL LANGUAGE GOAL</label>
            <textarea
              className="warp-input"
              style={{ width: '100%', height: 120, resize: 'vertical', fontFamily: 'monospace' }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Decompose a security audit workflow..."
            />
          </div>

          <button
            className="warp-btn"
            style={{ width: '100%', marginTop: 16 }}
            onClick={handleOrchestrate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                Decomposing & Writing to Arc...
              </>
            ) : (
              <>
                <Play size={14} style={{ marginRight: 6 }} />
                Decompose & Post On-chain (USDC)
              </>
            )}
          </button>
        </div>

        {/* Right: Worker Daemon Control */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={16} className="color-success" />
            <span>Autonomous Worker Daemon Control</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="warp-label">WORKER AGENT ID (STAKED & ACTIVE)</label>
            <input
              type="number"
              className="warp-input"
              value={workerAgentId}
              onChange={(e) => setWorkerAgentId(e.target.value)}
              placeholder="Enter active Agent ID"
            />
          </div>

          <button
            className="warp-btn secondary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={triggerWorkerAgent}
            disabled={runningWorker}
          >
            {runningWorker ? (
              <>
                <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                Worker Executing Job Cycles...
              </>
            ) : (
              <>
                <Cpu size={14} style={{ marginRight: 6 }} />
                Trigger Autonomous Worker Loop
              </>
            )}
          </button>

          {workerResult && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 6, border: '1px solid var(--warp-border)' }}>
              <div style={{ fontWeight: 'bold', fontSize: 11, color: 'var(--warp-success)', marginBottom: 6 }}>LAST EXECUTION OUTPUT:</div>
              {workerResult.success ? (
                <div style={{ fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>🎯 Job Claimed: #{workerResult.jobId} ({workerResult.jobDescription})</div>
                  <div>🔑 Claim Tx: <a href={`https://testnet.arcscan.app/tx/${workerResult.claimTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-cyan)' }}>{workerResult.claimTxHash.slice(0, 14)}...</a></div>
                  <div>📝 Result Submit Tx: <a href={`https://testnet.arcscan.app/tx/${workerResult.submitTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-cyan)' }}>{workerResult.submitTxHash.slice(0, 14)}...</a></div>
                  <div style={{ color: 'var(--warp-muted)', marginTop: 4 }}>Output: {workerResult.output}</div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--warp-error)' }}>{workerResult.message || workerResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Decomposed Tasks Results */}
      {decomposed.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">Workflow Breakdown ({decomposed.length} sub-jobs)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {decomposed.map((task, idx) => {
              const postInfo = posted[idx]
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, border: '1px solid var(--warp-border)', borderRadius: 6 }}>
                  <div style={{ background: 'var(--warp-primary)', color: 'var(--warp-background)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold' }}>{task.description}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--warp-muted)', marginTop: 4 }}>
                      <span>Reqs: <code style={{ color: 'var(--warp-cyan)' }}>{task.requiredCapabilities}</code></span>
                      <span>Reward: <strong style={{ color: 'var(--warp-success)' }}>{task.reward} USDC</strong></span>
                    </div>
                  </div>
                  {postInfo && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--warp-success)' }}>On-Chain Job #{postInfo.jobId}</div>
                      <a href={`https://testnet.arcscan.app/tx/${postInfo.txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--warp-cyan)' }}>
                        Tx Link ↗
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
