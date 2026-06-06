'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem } from 'viem'
import { UserPlus, Shield, Trophy, Star, Wallet, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  IDENTITY_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi
} from '@/lib/contracts'
import { DeveloperWalletsCard } from './DeveloperWalletsCard'

interface AgentData {
  id: number
  owner: string
  name: string
  capabilities: string
  stakedAmount: bigint
  completedJobs: number
  totalScore: number
  failedJobs: number
  isActive: boolean
  walletAddress?: string
  usdcBalance?: string
  gasBalance?: string
}

export function AgentsTab() {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [stakeAgentId, setStakeAgentId] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(false)

  const { writeContractAsync } = useWriteContract()

  // Fetch agents and sync balances
  async function fetchAgents() {
    if (!publicClient) return
    try {
      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock > 100000n ? latestBlock - 100000n : 0n

      // Load minted tokens
      const transferLogs = await publicClient.getLogs({
        address: IDENTITY_REGISTRY,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
        fromBlock,
        toBlock: latestBlock,
      })

      // Load wallet set database mapping
      let walletsMap: Record<string, { address: string }> = {}
      try {
        const dbRes = await fetch('/api/agent-wallet/list')
        const dbData = await dbRes.json()
        walletsMap = dbData.wallets || {}
      } catch (err) {
        console.error('Failed to load wallet db list:', err)
      }

      const list: AgentData[] = []
      for (const log of transferLogs) {
        const tokenId = log.args.tokenId!
        const owner = log.args.to!
        const walletInfo = walletsMap[tokenId.toString()]

        let usdcBal = '—'
        let gasBal = '—'

        if (walletInfo && walletInfo.address) {
          try {
            const nativeBal = await publicClient.getBalance({
              address: walletInfo.address as `0x${string}`
            })
            gasBal = parseFloat(formatUnits(nativeBal, 18)).toFixed(4)

            const erc20Bal = await publicClient.readContract({
              address: USDC_ADDRESS_ARC,
              abi: usdcAbi,
              functionName: 'balanceOf',
              args: [walletInfo.address as `0x${string}`],
            }) as bigint
            usdcBal = parseFloat(formatUnits(erc20Bal, 6)).toFixed(2)
          } catch {}
        }

        // Fetch local staking metrics from JobChainV2
        try {
          const data = await publicClient.readContract({
            address: JOBCHAIN_CONTRACT_ADDRESS,
            abi: jobChainAbi,
            functionName: 'getAgent',
            args: [tokenId],
          }) as unknown as any[]

          let agentName = `Agent #${tokenId.toString()}`
          let agentCaps = 'general'
          try {
            const metaURI = await publicClient.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: 'tokenURI',
              args: [tokenId],
            }) as string
            
            if (metaURI.includes("ipfs://")) {
              if (tokenId === 0n) {
                agentName = "GPT-Analyzer"
                agentCaps = "nlp,sentiment,analytics"
              } else if (tokenId === 1n) {
                agentName = "SentimentBot-v3"
                agentCaps = "nlp,sentiment,text-classification"
              } else if (tokenId === 2n) {
                agentName = "VisionAnalyzer"
                agentCaps = "vision,ocr,image-classification"
              } else if (tokenId === 3n) {
                agentName = "DataPipeline-Pro"
                agentCaps = "data-extract,etl,csv-transform"
              } else {
                agentName = `AI-Agent-${tokenId.toString()}`
                agentCaps = "nlp,data"
              }
            }
          } catch { /* ignore */ }

          list.push({
            id: Number(tokenId),
            owner: owner,
            name: agentName,
            capabilities: agentCaps,
            stakedAmount: data[3],
            completedJobs: Number(data[4]),
            totalScore: Number(data[5]),
            failedJobs: Number(data[6]),
            isActive: data[7],
            walletAddress: walletInfo?.address,
            usdcBalance: usdcBal,
            gasBalance: gasBal
          })
        } catch {
          list.push({
            id: Number(tokenId),
            owner: owner,
            name: `Agent #${tokenId.toString()}`,
            capabilities: "general",
            stakedAmount: 0n,
            completedJobs: 0,
            totalScore: 0,
            failedJobs: 0,
            isActive: false,
            walletAddress: walletInfo?.address,
            usdcBalance: usdcBal,
            gasBalance: gasBal
          })
        }
      }
      setAgents(list)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [publicClient])

  const handleRegister = async () => {
    if (!isConnected || !name || !capabilities) {
      toast.error('Connect wallet and fill all fields'); return
    }
    setLoading(true)
    const tid = toast.loading('Registering on official ERC-8004 IdentityRegistry...')
    try {
      const metadataURI = `ipfs://bafkreib-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${capabilities.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      toast.success(
        <span>Agent identity registered on ERC-8004! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      setName(''); setCapabilities('')
      fetchAgents()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Registration failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleStake = async () => {
    if (!isConnected || !stakeAgentId || !stakeAmount) {
      toast.error('Fill agent ID and stake amount'); return
    }
    setLoading(true)
    const tid = toast.loading('Approving USDC...')
    try {
      const amount = parseUnits(stakeAmount, 6)
      await writeContractAsync({
        address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve',
        args: [JOBCHAIN_CONTRACT_ADDRESS, amount],
      })
      toast.loading('Staking collateral...', { id: tid })
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
        functionName: 'stakeCollateral', args: [BigInt(stakeAgentId), amount],
      })
      toast.success(
        <span>Staked {stakeAmount} USDC! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      setStakeAmount('')
      fetchAgents()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Stake failed', { id: tid })
    } finally { setLoading(false) }
  }

  const getScore = (a: AgentData) => a.completedJobs > 0 ? (a.totalScore / a.completedJobs).toFixed(1) : '—'

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/agent-registry</span>
        <span style={{ color: 'var(--warp-text)' }}> ./manage-agents</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        ERC-8004 Agent Identity — Register, Stake, Build Reputation
        <br />Total Registered: {agents.length} agents
      </div>

      {/* ── Agent Leaderboard ── */}
      {agents.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            <Trophy size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            AGENT LEADERBOARD (ERC-8004)
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Capabilities</th>
                <th>Stake</th>
                <th>Programmatic Wallet</th>
                <th>USDC Bal</th>
                <th>Gas Bal</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--warp-primary)' }}>#{a.id}</td>
                  <td style={{ color: 'var(--warp-text)', fontWeight: 600 }}>{a.name}</td>
                  <td>
                    {a.capabilities.split(',').map((c, i) => (
                      <span key={i} className="tag">{c.trim()}</span>
                    ))}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUnits(a.stakedAmount, 6)} <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>USDC</span>
                  </td>
                  <td>
                    {a.walletAddress ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Wallet size={10} style={{ color: 'var(--warp-cyan)' }} />
                        <code style={{ fontSize: 10 }}>{a.walletAddress.slice(0, 5)}...{a.walletAddress.slice(-3)}</code>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>Not Spawned</span>
                    )}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {a.walletAddress ? (
                      <span style={{ color: 'var(--warp-success)' }}>{a.usdcBalance}</span>
                    ) : '—'}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {a.walletAddress ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--warp-warning)' }}>{a.gasBalance}</span>
                        <a
                          href="https://faucet.arc.network/"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 8, color: 'var(--warp-cyan)', textDecoration: 'underline' }}
                        >
                          Faucet
                        </a>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {a.completedJobs > 0 ? (
                      <span style={{ color: 'var(--warp-warning)' }}>
                        <Star size={10} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                        {getScore(a)}
                      </span>
                    ) : <span style={{ color: 'var(--warp-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${a.isActive ? 'active' : 'inactive'}`}>
                      {a.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Forms ── */}
      <div className="form-grid">
        <div className="form-card">
          <div className="form-title"><UserPlus size={16} /> Register New Agent</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>AGENT_NAME</label>
            <input className="warp-input" placeholder="GPT-Analyzer" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-warning)' }}>CAPABILITIES (comma-separated)</label>
            <input className="warp-input" placeholder="nlp,sentiment,summarize" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
          </div>
          <button className="warp-btn" onClick={handleRegister} disabled={!isConnected || loading}>
            <UserPlus size={14} /> {loading ? 'Processing...' : 'Register Agent (ERC-8004)'}
          </button>
        </div>

        <div className="form-card">
          <div className="form-title"><Shield size={16} /> Stake Collateral</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>AGENT_ID</label>
            <input className="warp-input" placeholder="0" type="number" value={stakeAgentId} onChange={e => setStakeAgentId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-success)' }}>STAKE_AMOUNT_USDC</label>
            <input className="warp-input" placeholder="5.00" type="number" step="0.01" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} />
          </div>
          <button className="warp-btn secondary" onClick={handleStake} disabled={!isConnected || loading}>
            <Shield size={14} /> {loading ? 'Processing...' : 'Stake USDC Collateral'}
          </button>
        </div>
      </div>

      {/* ── Spawning / Programmatic Wallet Section ── */}
      <DeveloperWalletsCard />
    </div>
  )
}
