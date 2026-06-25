'use client'

import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem, keccak256, toHex } from 'viem'
import { UserPlus, Shield, Trophy, Star, Wallet, Award, CheckCircle, Fingerprint, RefreshCw, ToggleLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  identityRegistryAbi,
  jobChainAbi,
  usdcAbi,
  reputationRegistryAbi
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

interface WorkersTabProps {
  devMode: boolean
}

export function WorkersTab({ devMode }: WorkersTabProps) {
  const { isConnected, writeContractAsync, address } = useSmartWallet()
  const publicClient = usePublicClient()
  
  // Registration state
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  
  // Stake state
  const [stakeAgentId, setStakeAgentId] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  
  // Reputation feedback state
  const [feedbackAgentId, setFeedbackAgentId] = useState('')
  const [reputationScore, setReputationScore] = useState('85')
  const [reputationTag, setReputationTag] = useState('successful_job')

  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)

  const [isRegisterSponsored, setIsRegisterSponsored] = useState(true)
  const [isStakeSponsored, setIsStakeSponsored] = useState(true)
  const [sponsorshipRemaining, setSponsorshipRemaining] = useState<number | null>(null)

  // Fetch gas sponsorship remaining txs and eligibility
  async function checkSponsorStatus() {
    if (!address) return
    try {
      const res = await fetch('/api/gas-sponsor/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          functionName: 'register',
          contractAddress: IDENTITY_REGISTRY
        })
      })
      const data = await res.json()
      if (res.ok && data.eligible) {
        setIsRegisterSponsored(true)
        setSponsorshipRemaining(3 - (data.txCount - 1))
      } else {
        setIsRegisterSponsored(false)
        if (res.status === 403) {
          setSponsorshipRemaining(0)
        }
      }

      const resStake = await fetch('/api/gas-sponsor/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          functionName: 'stakeCollateral',
          contractAddress: JOBCHAIN_CONTRACT_ADDRESS
        })
      })
      const dataStake = await resStake.json()
      if (resStake.ok && dataStake.eligible) {
        setIsStakeSponsored(true)
      } else {
        setIsStakeSponsored(false)
      }
    } catch (err) {
      console.error('Error fetching sponsor status:', err)
    }
  }

  useEffect(() => {
    checkSponsorStatus()
  }, [address])

  // Fetch agents and sync balances
  async function fetchAgents() {
    if (!publicClient) return
    setLoadingAgents(true)
    try {
      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock > 9900n ? latestBlock - 9900n : 0n

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

          let agentName = `Worker #${tokenId.toString()}`
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
                agentName = "Sentinel Analyzer"
                agentCaps = "solidity, audit, security"
              } else if (tokenId === 1n) {
                agentName = "Sentiment Guardian"
                agentCaps = "nlp, sentiment, filtering"
              } else if (tokenId === 2n) {
                agentName = "Vision Verifier"
                agentCaps = "vision, ocr, matching"
              } else if (tokenId === 3n) {
                agentName = "Data Compliance Pipeline"
                agentCaps = "data-extract, etl, validation"
              } else {
                agentName = `Clearing Provider ${tokenId.toString()}`
                agentCaps = "data, clearing"
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
            name: `Worker #${tokenId.toString()}`,
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
      setAgents(list.reverse())
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoadingAgents(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [publicClient])

  const handleRegister = async () => {
    if (!isConnected || !name || !capabilities) {
      toast.error('Connect wallet and fill worker profile fields'); return
    }
    setLoading(true)
    const tid = toast.loading('Registering Worker Identity on ERC-8004 Registry...')
    try {
      const metadataURI = `ipfs://bafkreib-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${capabilities.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      toast.success(
        <span>Worker Identity verified & registered! {devMode && <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a>}</span>,
        { id: tid, duration: 6000 }
      )
      setName(''); setCapabilities('')
      fetchAgents()
      checkSponsorStatus()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Registration failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleStake = async () => {
    if (!isConnected || !stakeAgentId || !stakeAmount) {
      toast.error('Specify worker ID and security deposit amount'); return
    }
    setLoading(true)
    const tid = toast.loading('Authorizing security deposit funds (USDC)...')
    try {
      const amount = parseUnits(stakeAmount, 6)
      await writeContractAsync({
        address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve',
        args: [JOBCHAIN_CONTRACT_ADDRESS, amount],
      })
      toast.loading('Escrowing worker security deposit...', { id: tid })
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS, abi: jobChainAbi,
        functionName: 'stakeCollateral', args: [BigInt(stakeAgentId), amount],
      })
      toast.success(
        <span>Security deposit of {stakeAmount} USDC locked! {devMode && <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a>}</span>,
        { id: tid, duration: 6000 }
      )
      setStakeAmount('')
      fetchAgents()
      checkSponsorStatus()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Security deposit failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleGiveFeedback = async () => {
    if (!isConnected || !feedbackAgentId) {
      toast.error('Connect wallet and specify Worker ID'); return
    }
    setLoading(true)
    const tid = toast.loading('Submitting worker feedback review...')
    try {
      const feedbackHash = keccak256(toHex(reputationTag))
      const hash = await writeContractAsync({
        address: REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [
          BigInt(feedbackAgentId),
          BigInt(reputationScore),
          0, // category
          reputationTag,
          '', // comment
          '', // metadata
          '', // attestation
          feedbackHash,
        ],
      })
      toast.success(
        <span>Worker rating submitted! {devMode && <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a>}</span>,
        { id: tid, duration: 6000 }
      )
      setFeedbackAgentId('')
      fetchAgents()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Feedback submission failed', { id: tid })
    } finally { setLoading(false) }
  }

  const getScore = (a: AgentData) => a.completedJobs > 0 ? (a.totalScore / a.completedJobs).toFixed(1) : '—'
  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Breadcrumbs */}
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>JobChain &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Workers Directory</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0 }}>
            Workers &amp; Security Providers
          </h1>
          <p style={{ color: 'var(--warp-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
            Manage worker identities, track reputation logs, and deposit safety collateral.
          </p>
        </div>

        {address && (
          <div style={{ padding: '8px 12px', background: 'rgba(13, 211, 147, 0.05)', border: '1px solid rgba(13, 211, 147, 0.15)', borderRadius: 8, fontSize: 11, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warp-success)' }}></span>
            <span>Fee Sponsorship Subsidized</span>
            {sponsorshipRemaining !== null && (
              <span style={{ color: 'var(--warp-muted)' }}>({sponsorshipRemaining} / 3 remaining)</span>
            )}
          </div>
        )}
      </div>

      {/* ── Agent Leaderboard ── */}
      {loadingAgents ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--warp-muted)', fontSize: 12 }}>
          <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--warp-primary)' }} />
          Syncing verified worker list...
        </div>
      ) : agents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--warp-muted)',
          background: 'rgba(15,16,21,0.45)',
          borderRadius: 8,
          border: '1px dashed var(--warp-border)',
          fontSize: 12
        }}>
          No workers registered in the registry. Use the registration panel below to establish a new profile.
        </div>
      ) : (
        <div style={{ background: 'rgba(15,16,21,0.45)', border: '1px solid var(--warp-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={14} style={{ color: 'var(--warp-warning)' }} />
            VERIFIED WORKER DIRECTORY &amp; RANKINGS
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Worker Name</th>
                <th>Capabilities</th>
                <th>Security Deposit</th>
                {devMode && (
                  <>
                    <th>Owner (Key)</th>
                    <th>Wallet Address</th>
                    <th>USDC Balance</th>
                    <th>Gas Credit</th>
                  </>
                )}
                <th>Success Score</th>
                <th>Identity verification</th>
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
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {formatUnits(a.stakedAmount, 6)} <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>USDC</span>
                  </td>
                  {devMode && (
                    <>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{truncateAddr(a.owner)}</td>
                      <td>
                        {a.walletAddress ? (
                          <code style={{ fontSize: 10, color: 'var(--warp-cyan)' }}>{truncateAddr(a.walletAddress)}</code>
                        ) : (
                          <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>Not Configured</span>
                        )}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-success)' }}>
                        {a.walletAddress ? `${a.usdcBalance} USDC` : '—'}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-warning)' }}>
                        {a.walletAddress ? `${a.gasBalance} USDC` : '—'}
                      </td>
                    </>
                  )}
                  <td>
                    {a.completedJobs > 0 ? (
                      <span style={{ color: 'var(--warp-warning)', fontWeight: 600 }}>
                        <Star size={11} style={{ marginRight: 2, verticalAlign: 'middle', display: 'inline' }} />
                        {getScore(a)}/5.0
                      </span>
                    ) : <span style={{ color: 'var(--warp-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className="badge" style={{
                      fontSize: 9,
                      color: a.isActive ? 'var(--warp-cyan)' : 'var(--warp-muted)',
                      border: `1px solid ${a.isActive ? 'rgba(122, 162, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                      background: a.isActive ? 'rgba(122, 162, 247, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Shield size={10} style={{ color: a.isActive ? 'var(--warp-cyan)' : 'var(--warp-muted)' }} />
                      {a.isActive ? 'VERIFIED' : 'PENDING'}
                    </span>
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

      {/* ── Forms Grid ── */}
      <div className="form-grid">
        {/* Form 1: Register New Worker */}
        <div className="form-card">
          <div className="form-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={16} /> Register New Worker</span>
            {isRegisterSponsored && (
              <span style={{ fontSize: 9, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                Fee Subsidized
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Establish a verified worker identifier. This creates a secure profile tag on the system registry.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>WORKER NAME</label>
            <input className="warp-input" placeholder="e.g. sentiment-analysis-worker (lowercase, hyphenated name)" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-warning)' }}>CAPABILITIES (comma-separated)</label>
            <input className="warp-input" placeholder="e.g. nlp, sentiment, python (comma-separated skills)" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
          </div>
          <button className="warp-btn" onClick={handleRegister} disabled={!isConnected || loading} style={{ width: '100%', background: 'var(--warp-primary)', color: '#070709' }}>
            <UserPlus size={14} /> {loading ? 'Processing...' : 'Register Worker Profile'}
          </button>
        </div>

        {/* Form 2: Deposit Security Collateral */}
        <div className="form-card">
          <div className="form-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={16} /> Deposit Safety Collateral</span>
            {isStakeSponsored && (
              <span style={{ fontSize: 9, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                Fee Subsidized
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Deposit safety funds into the JobChain smart contract. Workers with active deposits gain system trust and access to larger clearing rewards.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>WORKER ID</label>
            <input className="warp-input" placeholder="e.g. 142 (Unique worker registration ID)" type="number" value={stakeAgentId} onChange={e => setStakeAgentId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-success)' }}>SAFETY COLLATERAL DEPOSIT (USDC)</label>
            <input className="warp-input" placeholder="e.g. 25.00 (Collateral amount in USDC to lock)" type="number" step="0.01" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} />
          </div>
          <button className="warp-btn secondary" onClick={handleStake} disabled={!isConnected || loading} style={{ width: '100%' }}>
            <Shield size={14} /> {loading ? 'Processing...' : 'Deposit Safety Funds'}
          </button>
        </div>

        {/* Form 3: Submit Reputation Review */}
        <div className="form-card">
          <div className="form-title"><Award size={16} /> Log Performance Rating</div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Submit score updates to the Performance Directory. Self-rating is locked to ensure unbiased ratings.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>WORKER PROFILE ID</label>
            <input className="warp-input" placeholder="e.g. 142 (Unique worker registration ID to review)" type="number" value={feedbackAgentId} onChange={e => setFeedbackAgentId(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-success)' }}>SCORE (-100 to 100)</label>
              <input className="warp-input" type="number" min="-100" max="100" placeholder="e.g. 85 (Rating score)" value={reputationScore} onChange={e => setReputationScore(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 2 }}>
              <label className="field-label" style={{ color: 'var(--warp-warning)' }}>PERFORMANCE TAG</label>
              <input className="warp-input" placeholder="e.g. successful_settlement (Action description tag)" value={reputationTag} onChange={e => setReputationTag(e.target.value)} />
            </div>
          </div>
          <button className="warp-btn secondary" onClick={handleGiveFeedback} disabled={!isConnected || loading} style={{ width: '100%' }}>
            <Award size={14} /> {loading ? 'Processing...' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* ── Spawning / Programmatic Vaults Card (Developer-controlled) ── */}
      {devMode && (
        <div style={{ borderTop: '1px dashed var(--warp-border)', paddingTop: 24 }}>
          <DeveloperWalletsCard />
        </div>
      )}
    </div>
  )
}
