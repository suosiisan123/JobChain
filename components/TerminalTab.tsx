'use client'

import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { JOBCHAIN_CONTRACT_ADDRESS, jobChainAbi } from '@/lib/contracts'

interface EventLine {
  id: number
  timestamp: string
  type: 'info' | 'success' | 'error' | 'event' | 'system'
  message: string
  txHash?: string
}

export function TerminalTab() {
  const publicClient = usePublicClient()
  const [lines, setLines] = useState<EventLine[]>([])
  const [initialized, setInitialized] = useState(false)

  const addLine = (type: EventLine['type'], message: string, txHash?: string) => {
    setLines(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString().slice(11, 19),
      type,
      message,
      txHash,
    }])
  }

  // Client-only initialization to avoid hydration mismatch
  useEffect(() => {
    if (!initialized) {
      const ts = new Date().toISOString().slice(11, 19)
      setLines([
        { id: 0, timestamp: ts, type: 'system', message: 'JobChain Event Stream v2.0.0' },
        { id: 1, timestamp: ts, type: 'system', message: 'Connected to Arc Testnet (wss://rpc.testnet.arc.network)' },
        { id: 2, timestamp: ts, type: 'info', message: 'Watching JobChainV2 contract events...' },
        { id: 3, timestamp: ts, type: 'info', message: `Contract: ${JOBCHAIN_CONTRACT_ADDRESS.slice(0, 10)}...${JOBCHAIN_CONTRACT_ADDRESS.slice(-6)}` },
      ])
      setInitialized(true)
    }
  }, [initialized])

  useEffect(() => {
    if (!publicClient || JOBCHAIN_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return
    }

    const unwatchAgentReg = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'AgentRegistered',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          addLine('event', `[AGENT] Registered: "${args.name}" | Capabilities: [${args.capabilities}] | Owner: ${(args.owner as string)?.slice(0, 8)}...`, log.transactionHash)
        }
      },
    })

    const unwatchJobPosted = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'JobPosted',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          const reward = args.reward ? (Number(args.reward) / 1e6).toFixed(2) : '?'
          addLine('event', `[JOB] Posted #${args.jobId} | Reward: ${reward} USDC | Skills: [${args.requiredCapabilities}]`, log.transactionHash)
        }
      },
    })

    const unwatchPickup = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'JobPickedUp',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          addLine('success', `[PICKUP] Agent #${args.agentId} claimed Job #${args.jobId}`, log.transactionHash)
        }
      },
    })

    const unwatchPayment = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'PaymentReleased',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          const amount = args.amount ? (Number(args.amount) / 1e6).toFixed(6) : '?'
          addLine('success', `[PAYMENT] ✅ ${amount} USDC released to Agent #${args.agentId} for Job #${args.jobId}`, log.transactionHash)
        }
      },
    })

    const unwatchSlash = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'AgentSlashed',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          const slash = args.slashAmount ? (Number(args.slashAmount) / 1e6).toFixed(2) : '?'
          addLine('error', `[SLASH] ⚠ Agent #${args.agentId} slashed ${slash} USDC — "${args.reason}"`, log.transactionHash)
        }
      },
    })

    return () => {
      unwatchAgentReg()
      unwatchJobPosted()
      unwatchPickup()
      unwatchPayment()
      unwatchSlash()
    }
  }, [publicClient])

  const getColor = (type: EventLine['type']) => {
    switch (type) {
      case 'success': return 'var(--warp-success)'
      case 'error': return 'var(--warp-error)'
      case 'event': return 'var(--warp-cyan)'
      case 'system': return 'var(--warp-magenta)'
      default: return 'var(--warp-muted)'
    }
  }

  return (
    <div className="terminal-view">
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/job-chain</span>
        <span style={{ color: 'var(--warp-muted)' }}>git:(</span>
        <span style={{ color: 'var(--warp-error)' }}>main</span>
        <span style={{ color: 'var(--warp-muted)' }}>) </span>
        <span style={{ color: 'var(--warp-text)' }}>./watch-events --live</span>
      </div>

      <div className="terminal-output">
        {lines.map(line => (
          <div key={line.id} className="terminal-line">
            <span style={{ color: 'var(--warp-muted)', marginRight: 8 }}>[{line.timestamp}]</span>
            <span style={{ color: getColor(line.type) }}>{line.message}</span>
            {line.txHash && (
              <a
                href={`https://testnet.arcscan.app/tx/${line.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                ↗ arcscan
              </a>
            )}
          </div>
        ))}
        <div className="cursor-blink">█</div>
      </div>
    </div>
  )
}
