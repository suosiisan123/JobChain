'use client'

import { useEffect, useState, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { 
  JOBCHAIN_CONTRACT_ADDRESS, 
  IDENTITY_REGISTRY, 
  jobChainAbi
} from '@/lib/contracts'
import { 
  Activity as ActivityIcon, Globe, Layers, AlertCircle, 
  CheckCircle2, DollarSign, ShieldAlert, Cpu, RefreshCw, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TelemetryEvent {
  id: string
  timestamp: string
  blockNumber: number
  type: 'IDENTITY' | 'TASK' | 'ASSIGN' | 'SUBMIT' | 'PAYMENT' | 'PENALTY' | 'APPROVED' | 'SYSTEM'
  message: string
  txHash?: string
  badgeColor: string
  nodeId?: string
}

interface NetworkNode {
  id: string
  label: string
  type: 'escrow' | 'provider' | 'client'
  x: number
  y: number
  address: string
  balance: string
  gas: string
  status: 'Online' | 'Idle' | 'Busy' | 'Penalized'
  capabilities: string[]
  reputation: number
  lastActive: number
}

interface ActivityTabProps {
  devMode: boolean
}

export function ActivityTab({ devMode }: ActivityTabProps) {
  const publicClient = usePublicClient()
  
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PAYMENTS' | 'JOBS' | 'SYSTEM' | 'ERRORS'>('ALL')
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [simulatedPulse, setSimulatedPulse] = useState<{ source: string; target: string; color: string } | null>(null)
  
  const [nodes, setNodes] = useState<NetworkNode[]>([
    {
      id: 'escrow',
      label: 'JobChain Core Escrow',
      type: 'escrow',
      x: 200,
      y: 160,
      address: JOBCHAIN_CONTRACT_ADDRESS,
      balance: '1,420.00 USDC',
      gas: '0.85 ARC',
      status: 'Online',
      capabilities: ['Escrow Ledger', 'Automated Dispute', 'Yield Pool'],
      reputation: 100,
      lastActive: Date.now()
    },
    {
      id: 'prov-1',
      label: 'Security Provider #1',
      type: 'provider',
      x: 70,
      y: 80,
      address: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
      balance: '150.00 USDC',
      gas: '0.24 ARC',
      status: 'Idle',
      capabilities: ['nlp', 'sentiment'],
      reputation: 98,
      lastActive: Date.now() - 300000
    },
    {
      id: 'prov-2',
      label: 'Security Provider #2',
      type: 'provider',
      x: 70,
      y: 240,
      address: '0x321aB02Cb00df43cdf581fe038dFeFF58DE999',
      balance: '84.50 USDC',
      gas: '0.12 ARC',
      status: 'Online',
      capabilities: ['data', 'analytics'],
      reputation: 100,
      lastActive: Date.now()
    },
    {
      id: 'client-1',
      label: 'Corporate Client Node',
      type: 'client',
      x: 330,
      y: 80,
      address: '0x888bC5FC3A02Cb00df43cdf581fe038dFeFF111',
      balance: '890.00 USDC',
      gas: '0.50 ARC',
      status: 'Online',
      capabilities: ['Task Requester'],
      reputation: 100,
      lastActive: Date.now() - 600000
    },
    {
      id: 'client-2',
      label: 'Dev Sandbox Node',
      type: 'client',
      x: 330,
      y: 240,
      address: '0x999c056A597Dffe9eCcC1965A193B7388713AAA',
      balance: '40.00 USDC',
      gas: '0.08 ARC',
      status: 'Idle',
      capabilities: ['Task Requester', 'Sandbox'],
      reputation: 95,
      lastActive: Date.now()
    }
  ])

  const ledgerContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ledgerContainerRef.current) {
      ledgerContainerRef.current.scrollTo({
        top: ledgerContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [events])

  const getBadgeColor = (type: TelemetryEvent['type']) => {
    switch (type) {
      case 'IDENTITY': return '#BB9AF7'
      case 'TASK': return '#7AA2F7'
      case 'ASSIGN': return '#E0AF68'
      case 'SUBMIT': return '#0DB9D7'
      case 'PAYMENT': return '#0DD393'
      case 'PENALTY': return '#FF5A5A'
      case 'APPROVED': return '#2AC3DE'
      case 'SYSTEM': return '#9E9EAF'
      default: return '#565F89'
    }
  }

  const addEvent = (
    type: TelemetryEvent['type'], 
    message: string, 
    txHash?: string, 
    blockNum: number = 0,
    nodeId?: string
  ) => {
    const timestamp = new Date().toLocaleTimeString()
    setEvents(prev => {
      // Avoid duplicate logs if they are loaded from historical fetches
      if (txHash && prev.some(e => e.txHash === txHash && e.type === type)) {
        return prev
      }
      return [
        ...prev,
        {
          id: Math.random().toString(),
          timestamp,
          blockNumber: blockNum,
          type,
          message,
          txHash,
          badgeColor: getBadgeColor(type),
          nodeId
        }
      ]
    })

    if (nodeId) {
      setNodes(prevNodes => 
        prevNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              status: type === 'PENALTY' ? 'Penalized' : type === 'ASSIGN' ? 'Busy' : 'Online',
              lastActive: Date.now()
            }
          }
          return node
        })
      )
      
      setSimulatedPulse({
        source: nodeId,
        target: 'escrow',
        color: getBadgeColor(type)
      })
      setTimeout(() => setSimulatedPulse(null), 1500)
    }
  }

  // Load initial logs & watch blockchain events
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('jobchain_telemetry_events') : null
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed)
        } else {
          setInitialEvents()
        }
      } catch (e) {
        setInitialEvents()
      }
    } else {
      setInitialEvents()
    }

    function setInitialEvents() {
      const ts = new Date().toLocaleTimeString()
      setEvents([
        {
          id: 'init-1',
          timestamp: ts,
          blockNumber: 104200,
          type: 'SYSTEM',
          message: 'Clearing ledger log observer active.',
          badgeColor: '#BB9AF7'
        },
        {
          id: 'init-2',
          timestamp: ts,
          blockNumber: 104201,
          type: 'SYSTEM',
          message: 'Listening for system settlements on Arc network.',
          badgeColor: '#9E9EAF'
        }
      ])
    }

    if (!publicClient || JOBCHAIN_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') return

    // Historical Fetch
    async function loadHistory() {
      try {
        const latestBlock = await publicClient!.getBlockNumber()
        const fromBlock = latestBlock > 500n ? latestBlock - 500n : 0n

        // Issue Registration Transfer events
        try {
          const agentLogs = await publicClient!.getLogs({
            address: IDENTITY_REGISTRY,
            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
            args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
            fromBlock,
            toBlock: latestBlock,
          })
          for (const log of agentLogs) {
            const args = log.args as any
            const tId = args.tokenId.toString()
            addEvent('IDENTITY', `Worker profile #${tId} registry credentials verified.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
          }
        } catch {}

        // JobPosted events
        try {
          const jobLogs = await publicClient!.getContractEvents({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            eventName: 'JobPosted',
            fromBlock,
            toBlock: latestBlock,
          })
          for (const log of jobLogs) {
            const args = log.args as any
            const reward = args.reward ? (Number(args.reward) / 1e6).toFixed(2) : '?'
            addEvent('TASK', `New clearing task #${args.jobId} posted. Secure escrow locked: ${reward} USDC.`, log.transactionHash, Number(log.blockNumber), 'client-1')
          }
        } catch {}

      } catch (err) {
        console.error('Failed fetching history telemetry:', err)
      }
    }
    loadHistory()

    // Real-time watchers
    const unwatchAgentReg = publicClient.watchEvent({
      address: IDENTITY_REGISTRY,
      event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
      args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          addEvent('IDENTITY', `Worker identity verification certificate issued for Profile #${args.tokenId}.`, log.transactionHash, Number(log.blockNumber), 'prov-2')
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
          addEvent('TASK', `Escrow payment locked for clearing Task #${args.jobId}. Reward: ${reward} USDC.`, log.transactionHash, Number(log.blockNumber), 'client-1')
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
          addEvent('ASSIGN', `Task #${args.jobId} assigned to worker #${args.agentId}. Capability verification active.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
        }
      },
    })

    const unwatchResult = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'ResultSubmitted',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          addEvent('SUBMIT', `Worker #${args.agentId} compiled settlement proof for Task #${args.jobId}.`, log.transactionHash, Number(log.blockNumber), 'prov-2')
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
          const amount = args.amount ? (Number(args.amount) / 1e6).toFixed(2) : '?'
          addEvent('PAYMENT', `Clearing approved! Release payment of ${amount} USDC disbursed to worker #${args.agentId}.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
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
          addEvent('PENALTY', `Safety collateral claim triggered! Reclaimed ${slash} USDC from worker #${args.agentId} for: "${args.reason}".`, log.transactionHash, Number(log.blockNumber), 'prov-2')
        }
      },
    })

    const unwatchApproved = publicClient.watchContractEvent({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      eventName: 'JobApproved',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any
          addEvent('APPROVED', `Task #${args.jobId} clearance settled successfully. Rating: ${Number(args.rating)}/5 stars.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
        }
      },
    })

    return () => {
      unwatchAgentReg()
      unwatchJobPosted()
      unwatchPickup()
      unwatchResult()
      unwatchPayment()
      unwatchSlash()
      unwatchApproved()
    }
  }, [publicClient])

  useEffect(() => {
    if (events && events.length > 0) {
      localStorage.setItem('jobchain_telemetry_events', JSON.stringify(events))
    }
  }, [events])

  // Simulation handler for demonstration / offline use
  const handleSimulate = (type: TelemetryEvent['type']) => {
    const mockHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const mockBlock = Math.floor(104202 + Math.random() * 1000)

    switch (type) {
      case 'IDENTITY':
        addEvent('IDENTITY', 'New worker identity credential profile registered via secure passkey.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Worker Registration')
        break
      case 'TASK':
        addEvent('TASK', 'Clearing client published task #4088. Locked 45.00 USDC in secure escrow.', mockHash, mockBlock, 'client-2')
        toast.success('Simulated Escrow Task')
        break
      case 'ASSIGN':
        addEvent('ASSIGN', 'Clearing task #4088 claimed by worker #2. Gas credit sponsored by paymaster.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Work Claim')
        break
      case 'SUBMIT':
        addEvent('SUBMIT', 'Worker #1 submitted settlement evidence hash. Verification compiler active.', mockHash, mockBlock, 'prov-1')
        toast.success('Simulated Result Submission')
        break
      case 'PAYMENT':
        addEvent('PAYMENT', 'Verification success! Released 45.00 USDC to worker #2.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Payout Settlement')
        break
      case 'PENALTY':
        addEvent('PENALTY', 'Safety collateral penalty applied. Claimed 10.00 USDC from worker #1 for delivery failure.', mockHash, mockBlock, 'prov-1')
        toast.error('Simulated Collateral Penalty')
        break
      default:
        break
    }
  }

  // Filter events
  const filteredEvents = events.filter(e => {
    if (activeFilter === 'ALL') return true
    if (activeFilter === 'PAYMENTS') return e.type === 'PAYMENT'
    if (activeFilter === 'JOBS') return e.type === 'TASK' || e.type === 'ASSIGN' || e.type === 'SUBMIT' || e.type === 'APPROVED'
    if (activeFilter === 'SYSTEM') return e.type === 'SYSTEM' || e.type === 'IDENTITY'
    if (activeFilter === 'ERRORS') return e.type === 'PENALTY'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, fontFamily: 'var(--warp-font)' }}>
      
      {/* Styles Injection */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes path-dash {
          to { stroke-dashoffset: -30; }
        }
        .node-circle {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .node-circle:hover {
          filter: drop-shadow(0 0 8px var(--shadow-color));
          r: 14;
        }
        .pulse-circle {
          animation: pulse-ring 2s infinite ease-out;
        }
        .glowing-link {
          stroke-dasharray: 6, 4;
          animation: path-dash 2s linear infinite;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ActivityIcon size={20} className="spin-animation" style={{ color: 'var(--warp-cyan)' }} />
            Activity Log &amp; Settlement Audit
          </h1>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
            {devMode 
              ? 'Real-time consensus topology nodes, verification pathways, and blockchain transactions logs.'
              : 'Audit logs of payment events, job completions, and worker credentials.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="warp-btn secondary"
            onClick={() => {
              setEvents([])
              if (typeof window !== 'undefined') {
                localStorage.removeItem('jobchain_telemetry_events')
              }
            }}
            style={{ padding: '6px 12px', fontSize: 11, marginTop: 0 }}
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Developer simulation controls and topology map */}
      {devMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: 24, minHeight: 380 }}>
          
          {/* Consensus Network Map */}
          <div className="form-card" style={{ background: '#14151B', padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={14} style={{ color: 'var(--warp-cyan)' }} />
                <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>CONSENSUS NETWORK MAP</span>
              </div>
              <span className="tag" style={{ background: 'rgba(13, 211, 147, 0.1)', color: 'var(--warp-success)', border: '1px solid rgba(13,211,147,0.2)', fontSize: 9 }}>
                LIVE FEED ACTIVE
              </span>
            </div>

            {/* SVG Canvas */}
            <div style={{ flex: 1, background: '#0D0E13', border: '1px solid #1E1F29', borderRadius: 6, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
              <svg viewBox="0 0 400 320" width="100%" height="100%">
                <defs>
                  <filter id="glow-svg" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {nodes.map(n => {
                  if (n.id === 'escrow') return null
                  const escrowNode = nodes.find(x => x.id === 'escrow')!
                  const isActivePulse = simulatedPulse && simulatedPulse.source === n.id
                  return (
                    <g key={`link-${n.id}`}>
                      <line 
                        x1={n.x} y1={n.y} 
                        x2={escrowNode.x} y2={escrowNode.y} 
                        stroke={isActivePulse ? simulatedPulse.color : '#232535'} 
                        strokeWidth={isActivePulse ? 2 : 1}
                        className={isActivePulse ? 'glowing-link' : ''}
                      />
                    </g>
                  )
                })}

                {nodes.map(n => {
                  const isSelected = selectedNode?.id === n.id
                  const isEscrow = n.type === 'escrow'
                  const color = isEscrow ? 'var(--warp-primary)' : n.type === 'provider' ? 'var(--warp-magenta)' : 'var(--warp-cyan)'
                  
                  return (
                    <g key={n.id} onClick={() => setSelectedNode(n)}>
                      {n.status === 'Online' && (
                        <circle 
                          cx={n.x} cy={n.y} r={14} 
                          fill="none" 
                          stroke={color} 
                          strokeWidth={1} 
                          className="pulse-circle" 
                          style={{ opacity: 0.4 }}
                        />
                      )}
                      
                      <circle 
                        cx={n.x} cy={n.y} r={isSelected ? 11 : 9} 
                        fill="#0D0E13" 
                        stroke={color} 
                        strokeWidth={isSelected ? 3 : 2} 
                        className="node-circle"
                        style={{ '--shadow-color': color } as any}
                      />
                      
                      <text 
                        x={n.x} y={n.y - 15} 
                        textAnchor="middle" 
                        fill={isSelected ? '#ffffff' : 'var(--warp-muted)'} 
                        fontSize="9" 
                        fontWeight={isSelected ? 'bold' : 'normal'}
                      >
                        {n.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Telemetry Trigger Controls */}
          <div className="form-card" style={{ background: '#14151B', padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Cpu size={14} style={{ color: 'var(--warp-magenta)' }} />
              <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>LEDGER SIMULATOR &amp; TESTING HOOKS</span>
            </div>
            
            <p style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 16 }}>
              Trigger mock blockchain events to evaluate routing logic and visual topology pulses.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
              <button onClick={() => handleSimulate('IDENTITY')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center' }}>
                Simulate Worker Registry
              </button>
              <button onClick={() => handleSimulate('TASK')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center' }}>
                Simulate Task Published
              </button>
              <button onClick={() => handleSimulate('ASSIGN')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center' }}>
                Simulate Task Pickup
              </button>
              <button onClick={() => handleSimulate('SUBMIT')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center' }}>
                Simulate Work Submission
              </button>
              <button onClick={() => handleSimulate('PAYMENT')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center' }}>
                Simulate Payout Release
              </button>
              <button onClick={() => handleSimulate('PENALTY')} className="warp-btn secondary" style={{ marginTop: 0, justifyContent: 'center', borderColor: 'rgba(255,90,90,0.3)', color: '#FF5A5A' }}>
                Simulate Stake Slash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Filter Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--warp-border)', gap: 12, paddingBottom: 2 }}>
        {(['ALL', 'JOBS', 'PAYMENTS', 'SYSTEM', 'ERRORS'] as const).map(tab => (
          <button
            key={tab}
            className={`btn-subtab ${activeFilter === tab ? 'active' : ''}`}
            onClick={() => setActiveFilter(tab)}
            style={{ fontSize: 12, textTransform: 'capitalize' }}
          >
            {tab === 'ALL' ? 'All Settlements' : tab === 'JOBS' ? 'Escrow & Tasks' : tab === 'PAYMENTS' ? 'Payments' : tab === 'SYSTEM' ? 'Registry & Identity' : 'Slashes & Penalties'}
          </button>
        ))}
      </div>

      {/* Events Log Render */}
      <div className="form-card" style={{
        background: 'rgba(15,16,21,0.45)',
        padding: 20
      }}>
        {filteredEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            color: 'var(--warp-muted)',
            fontSize: 12,
            background: 'rgba(7,7,9,0.2)',
            borderRadius: 8,
            border: '1px dashed var(--warp-border)'
          }}>
            No activity records matching filter criteria.
          </div>
        ) : (
          <div ref={ledgerContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto', paddingRight: 6 }}>
            {filteredEvents.map((evt, idx) => {
              const IconComp = evt.type === 'PAYMENT' ? DollarSign 
                            : evt.type === 'PENALTY' ? ShieldAlert 
                            : evt.type === 'SYSTEM' ? Cpu 
                            : evt.type === 'IDENTITY' ? CheckCircle2
                            : Layers
              return (
                <div key={evt.id || idx} className="live-line-entry" style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(7, 7, 9, 0.4)',
                  borderLeft: `3px solid ${evt.badgeColor}`,
                  border: '1px solid var(--warp-border)',
                  borderLeftColor: evt.badgeColor
                }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      marginTop: 2,
                      padding: 6,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: evt.badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <IconComp size={14} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 500 }}>
                        {evt.message}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--warp-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} /> {evt.timestamp}
                        </span>
                        {devMode && (
                          <>
                            <span>Block: {evt.blockNumber}</span>
                            {evt.txHash && (
                              <a 
                                href={`https://testnet.arcscan.app/tx/${evt.txHash}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: 'var(--warp-primary)', textDecoration: 'underline' }}
                              >
                                {evt.txHash.slice(0, 10)}... ↗
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 8,
                    fontWeight: 'bold',
                    color: evt.badgeColor,
                    border: `1px solid ${evt.badgeColor}40`,
                    background: `${evt.badgeColor}10`,
                    padding: '2px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {evt.type}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
