'use client'

import { useReadContract } from 'wagmi'
import { BarChart3, Users, Briefcase, Shield } from 'lucide-react'
import { JOBCHAIN_CONTRACT_ADDRESS, jobChainAbi } from '@/lib/contracts'

export function DashboardTab() {
  const { data: nextJobId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextJobId',
  })
  const { data: nextAgentId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'nextAgentId',
  })
  const { data: protocolFees } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi, functionName: 'protocolFees',
  })

  const totalJobs = nextJobId ? Number(nextJobId) : 0
  const totalAgents = nextAgentId ? Number(nextAgentId) : 0
  const fees = protocolFees ? (Number(protocolFees) / 1e6).toFixed(2) : '0.00'

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/dashboard</span>
        <span style={{ color: 'var(--warp-text)' }}> ./stats --live</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        Protocol Analytics — Real-time on-chain metrics
      </div>

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
          <div className="stat-icon" style={{ color: 'var(--warp-warning)' }}><BarChart3 size={24} /></div>
          <div className="stat-value">2.5%</div>
          <div className="stat-label">Fee Rate</div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 12, marginBottom: 12, fontWeight: 700, letterSpacing: '0.5px' }}>
          CIRCLE PRODUCTS INTEGRATED
        </div>
        <div className="integration-grid">
          {[
            { name: 'USDC on Arc', status: 'active', desc: 'Escrow + Settlement + Staking' },
            { name: 'ERC-8004', status: 'active', desc: 'Agent Identity NFTs' },
            { name: 'ERC-8183', status: 'active', desc: 'Job Contract Protocol' },
            { name: 'App Kit Send', status: 'active', desc: 'Payment Execution' },
            { name: 'App Kit Bridge', status: 'active', desc: 'Cross-Chain Job Intake' },
            { name: 'CCTP', status: 'active', desc: 'Multi-Chain USDC Bridge' },
            { name: 'Circle Wallets', status: 'active', desc: 'RainbowKit Integration' },
            { name: 'Gateway', status: 'active', desc: 'Treasury Routing' },
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

      <div style={{ marginTop: 32, borderTop: '1px dashed var(--warp-border)', paddingTop: 16 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 12, marginBottom: 8 }}>CONTRACT_ADDRESS:</div>
        <a href={`https://testnet.arcscan.app/address/${JOBCHAIN_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="tx-link" style={{ fontSize: 13 }}>
          {JOBCHAIN_CONTRACT_ADDRESS} ↗
        </a>
      </div>
    </div>
  )
}
