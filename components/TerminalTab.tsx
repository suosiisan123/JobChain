'use client'

import { useEffect, useState, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, formatUnits } from 'viem'
import { 
  JOBCHAIN_CONTRACT_ADDRESS, 
  IDENTITY_REGISTRY, 
  jobChainAbi,
  USDC_ADDRESS_ARC
} from '@/lib/contracts'
import { 
  Activity, Shield, Wallet, Play, RefreshCw, Send, CheckCircle, 
  AlertTriangle, Cpu, Globe, Zap, ArrowRight, ShieldAlert, Award,
  Sparkles, Layers, Layers2, Users, Search, HelpCircle, HardDrive
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
  nodeId?: string // associated node ID
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
  lastActive: number // timestamp
}

export function TerminalTab() {
  const publicClient = usePublicClient()
  
  // State for events & nodes
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [activeFilter, setActiveFilter] = useState<string>('ALL')
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

  // Scroll to bottom of ledger logs
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
      case 'IDENTITY': return '#BB9AF7' // purple
      case 'TASK': return '#7AA2F7' // blue
      case 'ASSIGN': return '#E0AF68' // orange
      case 'SUBMIT': return '#0DB9D7' // cyan
      case 'PAYMENT': return '#9ECE6A' // green
      case 'PENALTY': return '#F7768E' // red
      case 'APPROVED': return '#2AC3DE' // teal
      case 'SYSTEM': return '#A9B1D6' // grey
      default: return '#565F89'
    }
  }

  // Helper to add telemetry event
  const addEvent = (
    type: TelemetryEvent['type'], 
    message: string, 
    txHash?: string, 
    blockNum: number = 0,
    nodeId?: string
  ) => {
    const timestamp = new Date().toLocaleTimeString()
    setEvents(prev => [
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
    ])

    // Trigger visual pulse animation and update node status
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
      
      // Setup connection pulse
      setSimulatedPulse({
        source: nodeId,
        target: 'escrow',
        color: getBadgeColor(type)
      })
      setTimeout(() => setSimulatedPulse(null), 1500)
    }
  }

  // Load initial logs & subscribe
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
          message: 'JobChain Core Ledger Telemetry system initialized successfully.',
          badgeColor: '#BB9AF7'
        },
        {
          id: 'init-2',
          timestamp: ts,
          blockNumber: 104201,
          type: 'SYSTEM',
          message: 'Socket connection synced with Arc testnet (Chain ID: 5042002). Watching smart contracts...',
          badgeColor: '#A9B1D6'
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
            addEvent('IDENTITY', `Registered Credentials Profile #${tId} for Address ${args.to.slice(0, 6)}...`, log.transactionHash, Number(log.blockNumber), 'prov-1')
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
            addEvent('TASK', `New Task #${args.jobId} published. Locked reward: ${reward} USDC.`, log.transactionHash, Number(log.blockNumber), 'client-1')
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
          addEvent('IDENTITY', `New security provider credentials issued for Profile #${args.tokenId}.`, log.transactionHash, Number(log.blockNumber), 'prov-2')
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
          addEvent('TASK', `Escrow deposit completed for Task #${args.jobId}. Value: ${reward} USDC.`, log.transactionHash, Number(log.blockNumber), 'client-1')
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
          addEvent('ASSIGN', `Task #${args.jobId} picked up by Provider #${args.agentId}. Capability proof verified.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
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
          addEvent('SUBMIT', `Clearing solution compiled for Task #${args.jobId}. Signature registered.`, log.transactionHash, Number(log.blockNumber), 'prov-2')
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
          addEvent('PAYMENT', `Clearing finalized! Settle payment of ${amount} USDC released to Provider #${args.agentId}.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
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
          addEvent('PENALTY', `Collateral penalty applied! Slashed ${slash} USDC from Provider #${args.agentId} for: "${args.reason}".`, log.transactionHash, Number(log.blockNumber), 'prov-2')
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
          addEvent('APPROVED', `Job #${args.jobId} clearance approved with rating ★${Number(args.rating)}.`, log.transactionHash, Number(log.blockNumber), 'prov-1')
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
        addEvent('IDENTITY', 'Simulated: New Identity credential profile issued via Passkey biometric verification.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Provider Identity Issue')
        break
      case 'TASK':
        addEvent('TASK', 'Simulated: Client published clearance task #4088. locked 45.00 USDC in Escrow.', mockHash, mockBlock, 'client-2')
        toast.success('Simulated Escrow Task Publication')
        break
      case 'ASSIGN':
        addEvent('ASSIGN', 'Simulated: Task #4088 claimed by Provider #2. Dynamic Gas sponsored via Arc.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Task Assignment Pickup')
        break
      case 'SUBMIT':
        addEvent('SUBMIT', 'Simulated: Provider #1 submitted completion proof. Awaiting consensus verification.', mockHash, mockBlock, 'prov-1')
        toast.success('Simulated Work Proof Submission')
        break
      case 'PAYMENT':
        addEvent('PAYMENT', 'Simulated: Automated clearing complete. Paid 45.00 USDC to Provider #2.', mockHash, mockBlock, 'prov-2')
        toast.success('Simulated Clearing Settlement')
        break
      case 'PENALTY':
        addEvent('PENALTY', 'Simulated: Slashed 10.00 USDC from Provider #1 for failing verification timeout.', mockHash, mockBlock, 'prov-1')
        toast.error('Simulated Slashed Stake Penalty')
        break
      default:
        break
    }
  }

  // Filtered event lists
  const filteredEvents = events.filter(e => {
    if (activeFilter === 'ALL') return true
    if (activeFilter === 'CREDENTIALS') return e.type === 'IDENTITY'
    if (activeFilter === 'CLEARANCES') return e.type === 'ASSIGN' || e.type === 'SUBMIT' || e.type === 'APPROVED'
    if (activeFilter === 'PAYMENTS') return e.type === 'PAYMENT'
    if (activeFilter === 'PENALTY') return e.type === 'PENALTY'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24, background: '#0F1015', minHeight: '85vh', color: '#D4D4D8', fontFamily: 'var(--warp-font)' }}>
      
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
        .scrollbar-custom::-webkit-scrollbar {
          width: 5px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(22, 22, 25, 0.2);
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #2D313E;
          border-radius: 4px;
        }
      `}</style>

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#F4F4F5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={20} className="spin-animation" style={{ color: 'var(--warp-cyan)' }} />
            ARC TOPOLOGY RADAR &amp; TELEMETRY LEDGER
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--warp-muted)', fontSize: 12 }}>
            Real-time visual consensus nodes, verification pathways, and automated stablecoin settlements.
          </p>
        </div>

        {/* Faucet / Control Panel */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="warp-btn secondary"
            onClick={() => {
              setEvents([])
              if (typeof window !== 'undefined') {
                localStorage.removeItem('jobchain_telemetry_events')
              }
            }}
            style={{ padding: '6px 12px', fontSize: 11, height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Clear Ledger
          </button>
        </div>
      </div>

      {/* Two Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: 24, flex: 1 }}>
        
        {/* LEFT COLUMN: SVG Node Network Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-card" style={{ background: '#14151B', padding: 16, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} style={{ color: 'var(--warp-cyan)' }} />
                <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>CONSENSUS NETWORK MAP</span>
              </div>
              <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontSize: 9 }}>
                LIVE FEED ACTIVE
              </span>
            </div>

            {/* SVG Canvas wrapper */}
            <div style={{ flex: 1, background: '#0D0E13', border: '1px solid #1E1F29', borderRadius: 6, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 400 320" width="100%" height="100%">
                <defs>
                  <filter id="glow-svg" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Nodes connection links */}
                {nodes.map(n => {
                  if (n.id === 'escrow') return null
                  const isPulse = simulatedPulse && (simulatedPulse.source === n.id || simulatedPulse.target === n.id)
                  const linkColor = isPulse ? simulatedPulse!.color : '#222533'
                  const linkWidth = isPulse ? 2 : 1
                  
                  return (
                    <g key={n.id}>
                      {/* Connection Line */}
                      <line 
                        x1={n.x} 
                        y1={n.y} 
                        x2={200} 
                        y2={160} 
                        stroke={linkColor} 
                        strokeWidth={linkWidth}
                        className={isPulse ? 'glowing-link' : ''}
                        style={{ transition: 'stroke 0.4s' }}
                      />
                      
                      {/* Interactive data particles travelling along the path */}
                      {isPulse && (
                        <circle r="3" fill={simulatedPulse!.color} filter="url(#glow-svg)">
                          <animateMotion 
                            dur="1.2s" 
                            repeatCount="indefinite" 
                            path={`M ${n.x} ${n.y} L 200 160`} 
                          />
                        </circle>
                      )}
                    </g>
                  )
                })}

                {/* Render Nodes */}
                {nodes.map(n => {
                  const isSelected = selectedNode?.id === n.id
                  const isEscrow = n.type === 'escrow'
                  const isProvider = n.type === 'provider'
                  
                  // Color Scheme
                  let color = '#7AA2F7' // client - blue
                  if (isEscrow) color = '#BB9AF7' // purple
                  if (isProvider) color = '#9ECE6A' // provider - green
                  if (n.status === 'Penalized') color = '#F7768E' // penalty - red

                  return (
                    <g key={n.id} onClick={() => setSelectedNode(n)}>
                      {/* Pulse Circle backings */}
                      {(isSelected || n.status === 'Online' || isEscrow) && (
                        <circle 
                          cx={n.x} 
                          cy={n.y} 
                          r={isEscrow ? 18 : 13} 
                          fill="none" 
                          stroke={color} 
                          strokeWidth="1" 
                          opacity="0.5"
                          className="pulse-circle"
                          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                        />
                      )}

                      {/* Main Node Point */}
                      <circle 
                        cx={n.x} 
                        cy={n.y} 
                        r={isEscrow ? 14 : 10} 
                        fill="#12131A" 
                        stroke={color} 
                        strokeWidth={isSelected ? 3 : 1.5}
                        className="node-circle"
                        style={{ 
                          '--shadow-color': color,
                          filter: isSelected ? 'url(#glow-svg)' : 'none'
                        } as any}
                      />

                      {/* Micro Inner status dot */}
                      <circle 
                        cx={n.x} 
                        cy={n.y} 
                        r={isEscrow ? 6 : 4} 
                        fill={color} 
                      />

                      {/* Node Text labels */}
                      <text 
                        x={n.x} 
                        y={n.y + (isEscrow ? 28 : 22)} 
                        fill={isSelected ? '#F4F4F5' : '#71717A'} 
                        fontSize="9" 
                        fontWeight={isSelected || isEscrow ? 'bold' : 'normal'}
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {n.label}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Node Overlay Helper */}
              <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 8, color: 'var(--warp-muted)', display: 'flex', gap: 8, background: 'rgba(15,16,21,0.8)', padding: '4px 8px', borderRadius: 4, border: '1px solid #1E1F29' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ color: '#BB9AF7' }}>●</span> Core Contract</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ color: '#9ECE6A' }}>●</span> Security Provider</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ color: '#7AA2F7' }}>●</span> Clients</span>
              </div>
            </div>

            {/* Selected Node Details Drawer */}
            <div className="form-card" style={{ background: '#1A1B24', padding: 12, marginTop: 12, minHeight: 90 }}>
              {selectedNode ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Cpu size={12} style={{ color: 'var(--warp-cyan)' }} />
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: '#F4F4F5' }}>{selectedNode.label}</span>
                      <span style={{ 
                        fontSize: 8, 
                        background: selectedNode.status === 'Online' ? 'rgba(16,185,129,0.1)' : selectedNode.status === 'Penalized' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', 
                        color: selectedNode.status === 'Online' ? '#10B981' : selectedNode.status === 'Penalized' ? '#EF4444' : '#F59E0B', 
                        padding: '1px 5px', 
                        borderRadius: 3 
                      }}>
                        {selectedNode.status}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>Rep: <strong style={{ color: '#10B981' }}>{selectedNode.reputation}%</strong></span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, fontSize: 10, color: 'var(--warp-muted)' }}>
                    <div>
                      Address: <code style={{ color: '#C0CAF5', fontSize: 9 }}>{selectedNode.address.slice(0, 8)}...{selectedNode.address.slice(-6)}</code>
                    </div>
                    <div>
                      USDC Balance: <span style={{ color: 'var(--warp-success)', fontWeight: 600 }}>{selectedNode.balance}</span>
                    </div>
                    <div>
                      Gas Credit: <span style={{ color: 'var(--warp-warning)', fontWeight: 600 }}>{selectedNode.gas}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>Capabilities:</span>
                    {selectedNode.capabilities.map((cap, i) => (
                      <span key={i} style={{ fontSize: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#C0CAF5', padding: '1px 4px', borderRadius: 3 }}>
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 66, color: 'var(--warp-muted)', fontSize: 11 }}>
                  <Search size={14} style={{ marginBottom: 4, color: '#565F89' }} />
                  Select a node on the canvas to inspect real-time credentials &amp; wallet telemetry.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Live Ledger & Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-card" style={{ background: '#14151B', padding: 16, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 440 }}>
            
            {/* Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #1F202B', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} style={{ color: 'var(--warp-magenta)' }} />
                <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--warp-muted)', letterSpacing: '0.05em' }}>CLEARING LEDGER STREAM</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
              {['ALL', 'CREDENTIALS', 'CLEARANCES', 'PAYMENTS', 'PENALTY'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  style={{
                    background: activeFilter === filter ? '#242735' : 'transparent',
                    border: '1px solid ' + (activeFilter === filter ? '#3E445E' : 'transparent'),
                    color: activeFilter === filter ? '#F4F4F5' : 'var(--warp-muted)',
                    padding: '3px 8px',
                    fontSize: 9,
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: activeFilter === filter ? 'bold' : 'normal',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Events Log Stream */}
            <div ref={ledgerContainerRef} className="scrollbar-custom" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 290, paddingRight: 4 }}>
              {filteredEvents.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 180, color: 'var(--warp-muted)', fontSize: 11 }}>
                  <Layers2 size={16} style={{ marginBottom: 6, color: '#565F89' }} />
                  No events recorded matching the filter in recent blocks.
                </div>
              ) : (
                filteredEvents.map((e) => (
                  <div key={e.id} className="live-line-entry" style={{ 
                    background: '#1A1B24', 
                    border: '1px solid #282A3A', 
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ 
                          fontSize: 8, 
                          fontWeight: 'bold', 
                          background: e.badgeColor + '1a', 
                          color: e.badgeColor, 
                          border: '1px solid ' + e.badgeColor + '30',
                          padding: '1px 5px',
                          borderRadius: 3,
                          letterSpacing: '0.02em'
                        }}>
                          {e.type}
                        </span>
                        {e.blockNumber > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontFamily: 'monospace' }}>
                            Block #{e.blockNumber}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--warp-muted)', fontFamily: 'monospace' }}>
                        {e.timestamp}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: '#C0CAF5', lineHeight: 1.4 }}>
                      {e.message}
                    </div>

                    {/* Meta info / Arc Scan Links */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #202230', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 8, color: 'var(--warp-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Zap size={9} style={{ color: 'var(--warp-success)' }} />
                        Sponsor Covered Gas (0.00 USDC)
                      </span>
                      {e.txHash && (
                        <a 
                          href={`https://testnet.arcscan.app/tx/${e.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 9, color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                        >
                          ArcScan explorer ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Test Simulation Controls */}
            <div style={{ borderTop: '1px solid #1F202B', marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--warp-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={11} style={{ color: 'var(--warp-cyan)' }} />
                SIMULATE TELEMETRY EVENT INJECTION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('IDENTITY')}>
                  + Identity Issued
                </button>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('TASK')}>
                  + Task Posted
                </button>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('ASSIGN')}>
                  + Task Claimed
                </button>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('SUBMIT')}>
                  + Work Submitted
                </button>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('PAYMENT')}>
                  + Paid Settlement
                </button>
                <button className="warp-btn secondary" style={{ fontSize: 9, padding: '4px 6px', height: 26 }} onClick={() => handleSimulate('PENALTY')}>
                  + Slash Penalty
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}
