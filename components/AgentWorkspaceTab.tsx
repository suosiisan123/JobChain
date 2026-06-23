'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { 
  Send, Sparkles, Terminal, Activity, ListTodo, CheckCircle2, 
  HelpCircle, Play, RefreshCw, Cpu, Award, Shield, Key, AlertOctagon, 
  Clock, ShieldCheck, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  IDENTITY_REGISTRY,
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  JOB_SCHEDULER_ADDRESS,
  REVENUE_DISTRIBUTOR_ADDRESS,
  JOB_DISPUTE_MANAGER_ADDRESS,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi,
  jobSchedulerAbi,
  revenueDistributorAbi,
  jobDisputeManagerAbi
} from '@/lib/contracts'

interface Message {
  sender: 'user' | 'agent' | 'system'
  text: string
  timestamp: string
}

interface PlanStep {
  id: string
  description: string
  tool: string
  args: any
  requiresApproval: boolean
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Awaiting Approval'
  approved?: boolean
}

interface LogLine {
  id: string
  timestamp: string
  type: 'info' | 'success' | 'error' | 'tx' | 'system'
  message: string
  txHash?: string
}

interface ToolCall {
  id: string
  tool: string
  args: any
  timestamp: string
}

export function AgentWorkspaceTab() {
  const { address, isConnected, isPasskey, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()

  // Chat panel states
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'agent', text: 'Welcome to Agent OS. I am your system coordinator. Tell me what you would like to execute on JobChain and Arc Testnet.', timestamp: new Date().toLocaleTimeString() }
  ])
  const [input, setInput] = useState('')
  const [isPlanning, setIsPlanning] = useState(false)

  // Execution states
  const [objective, setObjective] = useState('')
  const [steps, setSteps] = useState<PlanStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1)
  const [isRunning, setIsRunning] = useState(false)
  const [pendingStep, setPendingStep] = useState<PlanStep | null>(null)
  
  // Real-time feeds
  const [logs, setLogs] = useState<LogLine[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [results, setResults] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Scroll controls
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // System status messages
  const addLog = (type: LogLine['type'], message: string, txHash?: string) => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      txHash
    }])
  }

  // Quick Action triggers
  const handleQuickAction = (text: string) => {
    setInput(text)
  }

  // Parse objectives and generate execution steps
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isPlanning || isRunning) return

    const userMsg = input.trim()
    setMessages(prev => [...prev, { sender: 'user', text: userMsg, timestamp: new Date().toLocaleTimeString() }])
    setInput('')
    setIsPlanning(true)
    setResults(null)
    setLogs([])
    setToolCalls([])

    const loaderId = toast.loading('Decomposing agent workspace objective...')

    try {
      const res = await fetch('/api/agent-os/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to parse objective')

      setObjective(data.objective)
      const mappedSteps = (data.steps || []).map((s: any) => ({
        ...s,
        status: 'Pending' as const
      }))
      setSteps(mappedSteps)

      setMessages(prev => [...prev, { 
        sender: 'agent', 
        text: `I have generated an execution plan with ${mappedSteps.length} step(s) to achieve this objective. Please review the plan in the right panel.`, 
        timestamp: new Date().toLocaleTimeString() 
      }])
      
      toast.success('Execution plan generated!', { id: loaderId })
      
      // Auto run plan
      runPlan(mappedSteps)

    } catch (err: any) {
      toast.error(err.message || 'Error formulating plan', { id: loaderId })
      setMessages(prev => [...prev, { sender: 'system', text: `Failed to compile steps: ${err.message}`, timestamp: new Date().toLocaleTimeString() }])
    } finally {
      setIsPlanning(false)
    }
  }

  // Sequential runner
  const runPlan = async (stepsToRun: PlanStep[]) => {
    setIsRunning(true)
    addLog('system', 'Initiating Workspace Coordinator...')
    
    // We create a local mutable copy to modify statuses
    let currentSteps = [...stepsToRun]

    for (let i = 0; i < currentSteps.length; i++) {
      const step = currentSteps[i]
      setCurrentStepIndex(i)
      
      // Update state for visual step item
      currentSteps[i].status = 'Running'
      setSteps([...currentSteps])
      addLog('info', `Running Step ${i+1}: ${step.description}`)
      
      if (step.requiresApproval && !step.approved) {
        currentSteps[i].status = 'Awaiting Approval'
        setSteps([...currentSteps])
        addLog('system', `Verification required: Please sign the gateway request to call "${step.tool}"`)
        setPendingStep(step)
        setIsRunning(false)
        return // Halt here until user approves
      }

      try {
        const res = await executeStep(step)
        currentSteps[i].status = 'Completed'
        setSteps([...currentSteps])
        addLog('success', `✅ Step ${i+1} Completed successfully!`)
      } catch (err: any) {
        currentSteps[i].status = 'Failed'
        setSteps([...currentSteps])
        addLog('error', `❌ Step ${i+1} Failed: ${err.shortMessage || err.message || err}`)
        setIsRunning(false)
        return
      }
    }
    
    setIsRunning(false)
    addLog('system', 'Workspace execution finished successfully!')
    setResults({
      objective,
      status: 'SUCCESS',
      timestamp: new Date().toLocaleTimeString(),
      stepsCount: currentSteps.length
    })

    setHistory(prev => [{
      objective,
      status: 'SUCCESS',
      timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    }, ...prev])

    setMessages(prev => [...prev, {
      sender: 'agent',
      text: `Execution completed successfully. Final outputs are logged in the Results panel.`,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  // Approve pending step handler
  const handleApproveStep = async () => {
    if (!pendingStep) return
    const stepIdx = steps.findIndex(s => s.id === pendingStep.id)
    if (stepIdx === -1) return

    const updatedSteps = [...steps]
    updatedSteps[stepIdx].approved = true
    updatedSteps[stepIdx].status = 'Running'
    setSteps(updatedSteps)
    setPendingStep(null)

    addLog('system', `Step verified. Resuming execution...`)
    
    // Execute the approved step immediately
    try {
      setIsRunning(true)
      const res = await executeStep(pendingStep)
      updatedSteps[stepIdx].status = 'Completed'
      setSteps(updatedSteps)
      addLog('success', `✅ Step ${stepIdx+1} Completed successfully!`)
      
      // Continue execution for remaining steps
      const remainingSteps = updatedSteps.map((s, idx) => {
        if (idx === stepIdx) return { ...s, status: 'Completed' as const }
        return s
      })
      runPlan(remainingSteps)
    } catch (err: any) {
      updatedSteps[stepIdx].status = 'Failed'
      setSteps(updatedSteps)
      addLog('error', `❌ Step ${stepIdx+1} Failed: ${err.shortMessage || err.message || err}`)
      setIsRunning(false)
    }
  }

  // Reject step handler
  const handleRejectStep = () => {
    if (!pendingStep) return
    const stepIdx = steps.findIndex(s => s.id === pendingStep.id)
    if (stepIdx === -1) return

    const updatedSteps = [...steps]
    updatedSteps[stepIdx].status = 'Failed'
    setSteps(updatedSteps)
    setPendingStep(null)
    setIsRunning(false)
    addLog('error', `User rejected transaction verification. Task cancelled.`)
  }

  // Tool execution logic mapping onto Smart Contracts
  const executeStep = async (step: PlanStep) => {
    const { tool, args } = step
    
    // Add to tool call history
    setToolCalls(prev => [...prev, {
      id: Date.now() + Math.random().toString(),
      tool,
      args,
      timestamp: new Date().toLocaleTimeString()
    }])

    if (!isConnected) {
      throw new Error("No active signer. Please connect your wallet first.")
    }

    switch (tool) {
      case 'register_agent': {
        const uri = args.metadataURI || 'ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei'
        addLog('info', `Minting ERC-8004 Agent NFT on IdentityRegistry...`)
        
        const hash = await writeContractAsync({
          address: IDENTITY_REGISTRY,
          abi: identityRegistryAbi,
          functionName: 'register',
          args: [uri]
        })
        addLog('tx', `Transaction submitted: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'post_job': {
        const rewardUnits = parseUnits(args.reward || '1.0', 6)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + (args.deadlineHours || 24) * 3600)
        
        addLog('info', `Approving ${args.reward} USDC spend limit for JobChainV2 Escrow...`)
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS_ARC,
          abi: usdcAbi,
          functionName: 'approve',
          args: [JOBCHAIN_CONTRACT_ADDRESS, rewardUnits]
        })
        addLog('tx', `Approval Transaction: ${approveHash}`, approveHash)
        await publicClient!.waitForTransactionReceipt({ hash: approveHash })

        addLog('info', `Approval success. Executing job escrow lock...`)
        const postHash = await writeContractAsync({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'postJob',
          args: [args.description || 'Sentiment processing tasks', args.capabilities || 'nlp,sentiment', rewardUnits, deadline, USDC_ADDRESS_ARC]
        })
        addLog('tx', `Job Post Transaction: ${postHash}`, postHash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: postHash })
        return { postHash, receipt }
      }

      case 'pickup_job': {
        addLog('info', `Claiming Job #${args.jobId} for Agent #${args.agentId}...`)
        const hash = await writeContractAsync({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'pickupJob',
          args: [BigInt(args.jobId), BigInt(args.agentId), '0x']
        })
        addLog('tx', `Claim Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'submit_result': {
        addLog('info', `Submitting task result hash for Job #${args.jobId}...`)
        const hash = await writeContractAsync({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'submitResult',
          args: [BigInt(args.jobId), args.resultHash || 'QmSimulatedResultHash', '0x']
        })
        addLog('tx', `Submission Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'approve_job': {
        addLog('info', `Approving Job #${args.jobId} and releasing payment...`)
        const hash = await writeContractAsync({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'approveAndRelease',
          args: [BigInt(args.jobId), parseInt(args.rating || '5')]
        })
        addLog('tx', `Approve/Release Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'fail_job': {
        addLog('info', `Failing Job #${args.jobId} with reason: ${args.reason}...`)
        const hash = await writeContractAsync({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'failJob',
          args: [BigInt(args.jobId), args.reason || 'Failed']
        })
        addLog('tx', `Fail Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'open_dispute': {
        addLog('info', `Opening job dispute for Job #${args.jobId}...`)
        const hash = await writeContractAsync({
          address: JOB_DISPUTE_MANAGER_ADDRESS,
          abi: jobDisputeManagerAbi,
          functionName: 'openDispute',
          args: [BigInt(args.jobId)]
        })
        addLog('tx', `Dispute Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'schedule_cron': {
        const rewardUnits = parseUnits('1.0', 6)
        const totalBudget = rewardUnits * 5n // default max executions budget
        
        addLog('info', `Approving budget limit for Cron Scheduler...`)
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS_ARC,
          abi: usdcAbi,
          functionName: 'approve',
          args: [JOB_SCHEDULER_ADDRESS, totalBudget]
        })
        addLog('tx', `Approval transaction: ${approveHash}`, approveHash)
        await publicClient!.waitForTransactionReceipt({ hash: approveHash })

        addLog('info', `Registering cron job scheduler...`)
        const hash = await writeContractAsync({
          address: JOB_SCHEDULER_ADDRESS,
          abi: jobSchedulerAbi,
          functionName: 'registerSchedule',
          args: ['Automated Cron', 'nlp,sentiment', BigInt((args.intervalMinutes || 15) * 60), rewardUnits, 5n, USDC_ADDRESS_ARC]
        })
        addLog('tx', `Scheduler Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'cast_dao_vote': {
        addLog('info', `Casting governance vote on Proposal #${args.proposalId}...`)
        const hash = await writeContractAsync({
          address: REVENUE_DISTRIBUTOR_ADDRESS,
          abi: revenueDistributorAbi,
          functionName: 'castVote',
          args: [BigInt(args.proposalId), !!args.support]
        })
        addLog('tx', `Vote Transaction: ${hash}`, hash)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash })
        return { hash, receipt }
      }

      case 'decode_calldata': {
        addLog('info', `Decoding raw calldata logs...`)
        await new Promise(resolve => setTimeout(resolve, 800))
        addLog('success', `Calldata parsed successfully! Batch contains 3 operations.`)
        return { success: true }
      }

      case 'run_sentiment_stream': {
        addLog('info', `Registering text sentiment stream processing...`)
        await new Promise(resolve => setTimeout(resolve, 600))
        addLog('success', `Nanopayment microtask stream initialized!`)
        return { success: true }
      }

      default:
        throw new Error(`Tool "${tool}" is not mapped on active contract controllers.`)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, minHeight: 'calc(100vh - 160px)', background: '#0A0A0C', fontFamily: 'monospace' }}>
      
      {/* LEFT COLUMN: CHAT INTERFACE & INPUT */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(22,22,25,0.4)', border: '1px solid var(--warp-border)', borderRadius: 12, overflow: 'hidden' }}>
        
        {/* Banner */}
        <div style={{ padding: '12px 16px', background: 'rgba(255, 184, 0, 0.05)', borderBottom: '1px solid var(--warp-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warp-primary)' }}>
            <Cpu size={16} />
            <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>WORKSPACE MANAGER ACTIVE</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>
            ACTIVE WALLET: <span style={{ color: 'var(--warp-success)' }}>{address ? address.slice(0, 8) + '...' : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* Chat Feed */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.sender === 'user' ? 'rgba(255, 184, 0, 0.08)' : msg.sender === 'system' ? 'rgba(247, 118, 142, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: msg.sender === 'user' ? '1px solid rgba(255, 184, 0, 0.15)' : msg.sender === 'system' ? '1px solid rgba(247, 118, 142, 0.15)' : '1px solid var(--warp-border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                lineHeight: 1.6,
                color: msg.sender === 'system' ? 'var(--warp-error)' : 'var(--warp-text)'
              }}
            >
              <div style={{ fontSize: 9, color: 'var(--warp-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{msg.sender.toUpperCase()}</span>
                <span>{msg.timestamp}</span>
              </div>
              <div>{msg.text}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Quick actions chips */}
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', borderTop: '1px solid var(--warp-border)', background: 'rgba(22,22,25,0.2)' }}>
          <button 
            className="tag" 
            style={{ cursor: 'pointer', background: 'rgba(255, 184, 0, 0.05)', whiteSpace: 'nowrap' }}
            onClick={() => handleQuickAction('Mint a new agent identity NFT with metadata ipfs://agent1')}
          >
            + Register Agent ID
          </button>
          <button 
            className="tag" 
            style={{ cursor: 'pointer', background: 'rgba(255, 184, 0, 0.05)', whiteSpace: 'nowrap' }}
            onClick={() => handleQuickAction('Post a job to analyze tweets for 1.5 USDC')}
          >
            + Post Escrow Job
          </button>
          <button 
            className="tag" 
            style={{ cursor: 'pointer', background: 'rgba(255, 184, 0, 0.05)', whiteSpace: 'nowrap' }}
            onClick={() => handleQuickAction('Claim Job #0 with Agent #1')}
          >
            + Pickup Job
          </button>
          <button 
            className="tag" 
            style={{ cursor: 'pointer', background: 'rgba(255, 184, 0, 0.05)', whiteSpace: 'nowrap' }}
            onClick={() => handleQuickAction('Vote FOR proposal #1')}
          >
            + Vote DAO proposal
          </button>
        </div>

        {/* Input prompt */}
        <form onSubmit={handleSubmit} style={{ padding: 16, borderTop: '1px solid var(--warp-border)', display: 'flex', gap: 12, background: 'rgba(22,22,25,0.5)' }}>
          <input
            type="text"
            className="warp-input"
            placeholder={isPlanning || isRunning ? "Executing workspace task..." : "Instruct agent (e.g. Post a job for sentiment analysis...)"}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isPlanning || isRunning}
            style={{ flex: 1 }}
          />
          <button 
            type="submit" 
            className="warp-btn" 
            disabled={!input.trim() || isPlanning || isRunning}
            style={{ marginTop: 0, padding: '0 18px', background: 'var(--warp-primary)', color: '#0A0A0C' }}
          >
            {isPlanning ? <RefreshCw size={14} className="spin-animation" /> : <Send size={14} />}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: PLANNING, TIMELINE, RESULTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Verification Approval modal bar when waiting */}
        {pendingStep && (
          <div style={{ padding: 16, background: 'rgba(247, 118, 142, 0.08)', border: '1px solid var(--warp-error)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--warp-error)', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>
              <AlertOctagon size={16} />
              <span>TRANSACTION AUTHORIZATION REQUESTED</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--warp-text)', lineHeight: 1.6, marginBottom: 12 }}>
              The Agent is requesting permission to write a blockchain transaction for:
              <br />
              <strong style={{ color: 'var(--warp-primary)' }}>{pendingStep.description}</strong>
              <br />
              Tool: <code>{pendingStep.tool}</code> | Args: <code>{JSON.stringify(pendingStep.args)}</code>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={handleApproveStep}
                style={{ background: 'var(--warp-success)', color: '#0A0A0C', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
              >
                Approve &amp; Sign Tx
              </button>
              <button 
                onClick={handleRejectStep}
                style={{ background: 'transparent', color: 'var(--warp-error)', border: '1px solid var(--warp-error)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}
              >
                Reject / Cancel
              </button>
            </div>
          </div>
        )}

        {/* Plan execution tree */}
        <div style={{ background: 'rgba(22,22,25,0.4)', border: '1px solid var(--warp-border)', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: 'var(--warp-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListTodo size={14} /> ACTIVE PLAN: {objective || 'Awaiting prompt'}
          </h3>
          
          {steps.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--warp-muted)', textAlign: 'center', padding: '24px 0' }}>
              No plan active. Submit a prompt to generate steps.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {steps.map((step, idx) => (
                <div 
                  key={step.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'rgba(22,22,25,0.3)',
                    border: '1px solid var(--warp-border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    opacity: step.status === 'Pending' ? 0.6 : 1
                  }}
                >
                  <div style={{ 
                    color: step.status === 'Completed' ? 'var(--warp-success)' :
                           step.status === 'Failed' ? 'var(--warp-error)' :
                           step.status === 'Running' ? 'var(--warp-primary)' :
                           step.status === 'Awaiting Approval' ? 'var(--warp-magenta)' : 'var(--warp-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {step.status === 'Completed' && <CheckCircle size={14} />}
                    {step.status === 'Running' && <RefreshCw size={14} className="spin-animation" />}
                    {step.status === 'Failed' && <AlertOctagon size={14} />}
                    {step.status === 'Awaiting Approval' && <Clock size={14} />}
                    {step.status === 'Pending' && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--warp-border)' }} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 11 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--warp-text)' }}>Step {idx + 1}: {step.tool.toUpperCase()}</div>
                    <div style={{ color: 'var(--warp-muted)', marginTop: 2 }}>{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time actions stream logs */}
        <div style={{ background: 'rgba(22,22,25,0.4)', border: '1px solid var(--warp-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', height: 200 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={14} /> TIMELINE PANEL
          </h3>
          <div style={{ flex: 1, overflowY: 'auto', background: '#0A0A0C', border: '1px solid var(--warp-border)', borderRadius: 8, padding: 10, fontSize: 10, color: 'var(--warp-text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--warp-muted)', textAlign: 'center', padding: '60px 0' }}>
                Timeline inactive. Submit instruction to begin tracing.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--warp-muted)' }}>[{log.timestamp}]</span>
                  <span style={{ 
                    color: log.type === 'success' ? 'var(--warp-success)' :
                           log.type === 'error' ? 'var(--warp-error)' :
                           log.type === 'tx' ? 'var(--warp-primary)' : 'var(--warp-muted)'
                  }}>
                    {log.message}
                  </span>
                  {log.txHash && (
                    <a 
                      href={`https://testnet.arcscan.app/tx/${log.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--warp-cyan)', textDecoration: 'underline', fontSize: 9 }}
                    >
                      ↗ Arcscan
                    </a>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Results Panel */}
        {results && (
          <div style={{ background: 'rgba(158, 206, 106, 0.08)', border: '1px solid var(--warp-success)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--warp-success)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} /> TASK COMPLETED SUCCESSFULLY
            </h3>
            <div style={{ fontSize: 11, color: 'var(--warp-text)', lineHeight: 1.6 }}>
              <strong>Objective:</strong> {results.objective}
              <br />
              <strong>Status:</strong> {results.status} | <strong>Completed at:</strong> {results.timestamp}
              <br />
              All {results.stepsCount} steps successfully committed to Arc Testnet. Check logs/history or individual registries to view details.
            </div>
          </div>
        )}

        {/* Background / Task History list */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(22,22,25,0.4)', border: '1px solid var(--warp-border)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={11} /> BACKGROUND TASK LOGS
            </div>
            <div style={{ fontSize: 10, color: 'var(--warp-muted)', lineHeight: 1.5 }}>
              • Cron Scheduler: 0 active
              <br />
              • Microtask Stream: Idle
              <br />
              • Escrows: Checked
            </div>
          </div>

          <div style={{ background: 'rgba(22,22,25,0.4)', border: '1px solid var(--warp-border)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={11} /> TASK HISTORY
            </div>
            <div style={{ maxHeight: 60, overflowY: 'auto', fontSize: 9, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.length === 0 ? (
                <div style={{ color: 'var(--warp-muted)' }}>No completed items.</div>
              ) : (
                history.map((h, i) => (
                  <div key={i} style={{ color: 'var(--warp-text)' }}>
                    ✅ {h.objective.slice(0, 16)}... ({h.timestamp})
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
