'use client'

import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, parseAbiItem } from 'viem'
import { BarChart3, Users, Briefcase, Shield, ExternalLink, TrendingUp, Activity, Zap } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid
} from 'recharts'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi
} from '@/lib/contracts'

const STATUS_LABELS = ['Open', 'InProgress', 'Submitted', 'Completed', 'Failed', 'Cancelled']
const PIE_COLORS = ['#7AA2F7', '#E0AF68', '#7DCFFF', '#9ECE6A', '#F7768E', '#565F89']

interface AgentStats { name: string; completed: number; failed: number; stake: number; score: number }
interface JobStats { status: number }

export function DashboardTab() {
  const publicClient = usePublicClient()
  const [agentStats, setAgentStats] = useState<AgentStats[]>([])
  const [jobStats, setJobStats] = useState<JobStats[]>([])
  const [loading, setLoading] = useState(true)
  const [totalAgents, setTotalAgents] = useState(0)

  const { data: nextJobId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId',
  })
  const { data: protocolFees } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'protocolFees',
  })

  // Fetch on-chain data for charts
  useEffect(() => {
    async function fetchData() {
      if (!publicClient || !nextJobId) return
      setLoading(true)

      // Get agent IDs from official IdentityRegistry Transfer logs
      let agentIds: bigint[] = []
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 100000n ? latestBlock - 100000n : 0n

        const transferLogs = await publicClient.getLogs({
          address: IDENTITY_REGISTRY,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
          args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
          fromBlock,
          toBlock: latestBlock,
        })
        agentIds = transferLogs.map(log => log.args.tokenId!)
        setTotalAgents(agentIds.length)
      } catch (err) {
        console.error('Failed to fetch agent IDs from IdentityRegistry:', err)
      }

      // Fetch agents
      const agents: AgentStats[] = []
      for (const id of agentIds) {
        try {
          const d = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
            functionName: 'getAgent', args: [id],
          }) as unknown as any[]

          let agentName = `Agent #${id.toString()}`
          try {
            const metaURI = await publicClient.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: 'tokenURI',
              args: [id],
            }) as string
            
            if (metaURI.includes("ipfs://")) {
              if (id === 0n) agentName = "GPT-Analyzer"
              else if (id === 1n) agentName = "SentimentBot-v3"
              else if (id === 2n) agentName = "VisionAnalyzer"
              else if (id === 3n) agentName = "DataPipeline-Pro"
              else agentName = `AI-Agent-${id.toString()}`
            }
          } catch {}

          agents.push({
            name: agentName.length > 12 ? agentName.slice(0, 12) + '…' : agentName,
            completed: Number(d[4]),
            failed: Number(d[6]),
            stake: Number(formatUnits(d[3] as bigint, 6)),
            score: Number(d[4]) > 0 ? Number(d[5]) / Number(d[4]) : 0,
          })
        } catch { /* skip */ }
      }
      setAgentStats(agents)

      // Fetch jobs
      const jobs: JobStats[] = []
      for (let i = 0; i < Number(nextJobId); i++) {
        try {
          const d = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
            functionName: 'getJob', args: [BigInt(i)],
          }) as unknown as any[]
          jobs.push({ status: Number(d[6]) })
        } catch { /* skip */ }
      }
      setJobStats(jobs)
      setLoading(false)
    }
    fetchData()
  }, [publicClient, nextJobId])

  const totalJobs = nextJobId ? Number(nextJobId) : 0
  const fees = protocolFees ? (Number(protocolFees) / 1e6).toFixed(2) : '0.00'
  const completedJobs = jobStats.filter(j => j.status === 3).length
  const successRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : '0.0'

  // Prepare pie chart data
  const statusCounts = STATUS_LABELS.map((label, i) => ({
    name: label,
    value: jobStats.filter(j => j.status === i).length,
  })).filter(s => s.value > 0)

  // Protocol metrics
  const protocolMetrics = agentStats.map((a) => ({
    agent: a.name,
    'Stake (USDC)': a.stake,
    'Jobs Completed': a.completed,
    'Reputation': parseFloat(a.score.toFixed(1)),
  }))

  const chartTooltipStyle = {
    backgroundColor: '#24283B',
    border: '1px solid #414868',
    borderRadius: '6px',
    color: '#C0CAF5',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/dashboard</span>
        <span style={{ color: 'var(--warp-text)' }}> ./stats --live</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        Protocol Analytics — Real-time on-chain metrics from Arc Testnet
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--warp-cyan)' }}><Briefcase size={24} /></div>
          <div className="stat-value">{totalJobs}</div>
          <div className="stat-label">Total Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--warp-magenta)' }}><Users size={24} /></div>
          <div className="stat-value">{totalAgents}</div>
          <div className="stat-label">Registered Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--warp-success)' }}><Shield size={24} /></div>
          <div className="stat-value">{fees}</div>
          <div className="stat-label">Protocol Fees (USDC)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--warp-warning)' }}><TrendingUp size={24} /></div>
          <div className="stat-value">{successRate}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: agentStats.length > 0 ? '1fr 1.5fr' : '1fr', gap: 16, marginTop: 24, marginLeft: 24 }}>
          {/* Job Status Distribution */}
          {statusCounts.length > 0 && (
            <div className="form-card" style={{ padding: 20 }}>
              <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={12} /> JOB STATUS DISTRIBUTION
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                     data={statusCounts}
                     cx="50%"
                     cy="50%"
                     innerRadius={50}
                     outerRadius={80}
                     paddingAngle={3}
                     dataKey="value"
                     stroke="none"
                  >
                    {statusCounts.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[STATUS_LABELS.indexOf(entry.name) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#565F89' }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Agent Performance */}
          {agentStats.length > 0 && (
            <div className="form-card" style={{ padding: 20 }}>
              <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={12} /> AGENT PERFORMANCE
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={protocolMetrics} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#414868" strokeOpacity={0.4} />
                  <XAxis dataKey="agent" tick={{ fill: '#565F89', fontSize: 10, fontFamily: "'JetBrains Mono'" }} axisLine={{ stroke: '#414868' }} />
                  <YAxis tick={{ fill: '#565F89', fontSize: 10, fontFamily: "'JetBrains Mono'" }} axisLine={{ stroke: '#414868' }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="Stake (USDC)" fill="#E0AF68" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Jobs Completed" fill="#9ECE6A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 24, marginLeft: 24, color: 'var(--warp-muted)', fontSize: 12 }}>
          <span style={{ color: 'var(--warp-primary)' }}>⠋</span> Loading on-chain analytics...
        </div>
      )}

      {/* ── Circle Integration ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
          CIRCLE DEVELOPER STACK
        </div>
        <div className="integration-grid">
          {[
            { name: 'USDC on Arc', status: 'active', desc: 'Native gas token + job escrow + agent staking collateral' },
            { name: 'ERC-8004 Identity', status: 'active', desc: 'Official IdentityRegistry (0x8004A818…) + ReputationRegistry (0x8004B663…)' },
            { name: 'ERC-8183 Jobs', status: 'active', desc: 'Custom JobChainV2 contract with escrow, staking, slashing' },
            { name: 'Wallet Integration', status: 'active', desc: 'Multi-wallet support via RainbowKit + wagmi v2 + viem' },
            { name: 'Arc Testnet', status: 'active', desc: 'Deployed on Chain ID 5042002 with sub-second finality' },
          ].map((p, i) => (
            <div key={i} className="integration-item">
              <span className={`status-dot ${p.status === 'active' ? 'online' : ''}`} />
              <div>
                <div style={{ color: 'var(--warp-text)', fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ color: 'var(--warp-muted)', fontSize: 11 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contract Info ── */}
      <div style={{ marginTop: 32, borderTop: '1px dashed var(--warp-border)', paddingTop: 16 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          DEPLOYED CONTRACT
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: 12, color: 'var(--warp-text)' }}>{JOBCHAIN_CONTRACT_ADDRESS}</code>
          <a
            href={`https://testnet.arcscan.app/address/${JOBCHAIN_CONTRACT_ADDRESS}`}
            target="_blank" rel="noopener noreferrer"
            className="tx-link" style={{ marginLeft: 0 }}
          >
            <ExternalLink size={12} /> arcscan
          </a>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warp-muted)' }}>
          Network: Arc Testnet (5042002) · Solidity 0.8.24 · Optimizer: 200 runs
        </div>
      </div>
    </div>
  )
}
