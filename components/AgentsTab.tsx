'use client'

import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem } from 'viem'
import { UserPlus, Shield, Trophy, Star, Wallet, HelpCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
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
  const { isConnected, writeContractAsync, address } = useSmartWallet()
  const publicClient = usePublicClient()
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [stakeAgentId, setStakeAgentId] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(false)

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
        if (res.status === 403 || data.txCount >= 3 || !data.eligible) {
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
    try {
      // Scan up to 250 tokens in parallel (since Arc RPC restricts getLogs to 10k block range)
      const maxTokenId = 250
      const tokenIds = Array.from({ length: maxTokenId }, (_, i) => BigInt(i))
      const owners = await Promise.all(
        tokenIds.map(id =>
          publicClient.readContract({
            address: IDENTITY_REGISTRY,
            abi: identityRegistryAbi,
            functionName: 'ownerOf',
            args: [id],
          }).catch(() => null)
        )
      )

      // Filter tokenIds that actually exist
      const activeTokens = tokenIds
        .map((id, i) => ({ id, owner: owners[i] }))
        .filter(t => t.owner !== null)

      // Fetch metadata URIs in parallel
      const uris = await Promise.all(
        activeTokens.map(t =>
          publicClient.readContract({
            address: IDENTITY_REGISTRY,
            abi: identityRegistryAbi,
            functionName: 'tokenURI',
            args: [t.id],
          }).catch(() => '')
        )
      )

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
      for (let i = 0; i < activeTokens.length; i++) {
        const tokenId = activeTokens[i].id
        const owner = activeTokens[i].owner as string
        const metaURI = uris[i]
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
            
            if (metaURI.startsWith("ipfs://bafkreib-name-")) {
              const parts = metaURI.replace("ipfs://bafkreib-name-", "").split("-caps-")
              if (parts.length === 2) {
                agentName = decodeURIComponent(parts[0])
                agentCaps = decodeURIComponent(parts[1])
              }
            } else if (metaURI.includes("ipfs://")) {
              if (tokenId === 0n) {
                agentName = "Sentinel-Analyzer"
                agentCaps = "nlp,sentiment,analytics"
              } else if (tokenId === 1n) {
                agentName = "Sentiment-Bot"
                agentCaps = "nlp,sentiment,text-classification"
              } else if (tokenId === 2n) {
                agentName = "Vision-Verifier"
                agentCaps = "vision,ocr,image-classification"
              } else if (tokenId === 3n) {
                agentName = "Compliance-Pipeline"
                agentCaps = "data-extract,etl,csv-transform"
              } else {
                const cleanPart = metaURI.replace("ipfs://bafkreib-", "")
                const parts = cleanPart.split("-")
                if (parts.length >= 2) {
                  agentName = parts[0]
                  agentCaps = parts.slice(1).join(", ")
                } else {
                  agentName = `Clearing-Provider-${tokenId.toString()}`
                  agentCaps = "nlp,data"
                }
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
            name: `Provider #${tokenId.toString()}`,
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
    const tid = toast.loading('Registering on official ERC-8004 Credential Registry...')
    try {
      const metadataURI = `ipfs://bafkreib-name-${encodeURIComponent(name)}-caps-${encodeURIComponent(capabilities)}`
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      toast.success(
        <span>Credentials profile registered on ERC-8004! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
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
      toast.error('Fill provider ID and deposit amount'); return
    }
    setLoading(true)
    const tid = toast.loading('Approving USDC...')
    try {
      const amount = parseUnits(stakeAmount, 6)
      await writeContractAsync({
        address: USDC_ADDRESS_ARC, abi: usdcAbi, functionName: 'approve',
        args: [JOBCHAIN_CONTRACT_ADDRESS, amount],
      })
      toast.loading('Locking collateral...', { id: tid })
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
      checkSponsorStatus()
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Stake failed', { id: tid })
    } finally { setLoading(false) }
  }

  const getScore = (a: AgentData) => a.completedJobs > 0 ? (a.totalScore / a.completedJobs).toFixed(1) : '—'

  return (
    <div>
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>Directory &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Security Providers</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24, fontSize: 12 }}>
        Verified Providers — Register credentials, deposit collateral, and manage performance ratings
        <br />Total Registered: {agents.length} providers
        {address && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(122, 162, 247, 0.08)', borderRadius: 6, border: '1px solid rgba(122, 162, 247, 0.15)', fontSize: 11, color: 'var(--warp-text)' }}>
            <span style={{ color: 'var(--warp-cyan)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Zap size={11} /> Clearing Fee Sponsorship:
            </span>
            <span style={{ marginLeft: 6 }}>
              Onboarding actions (Provider Registration and Collateral Setup) are subsidized by the system coordinator.
              {sponsorshipRemaining !== null && (
                <span> You have <strong style={{ color: 'var(--warp-success)' }}>{sponsorshipRemaining} of 3</strong> sponsored transactions remaining.</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Agent Leaderboard ── */}
      {agents.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            <Trophy size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            VERIFIED PROVIDERS LEADERBOARD
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
                <th>Attest</th>
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
                      <span style={{ color: 'var(--warp-muted)', fontSize: 10 }}>Not Activated</span>
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
                          Get Credits
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

      {/* ── Forms ── */}
      <div className="form-grid">
        <div className="form-card">
          <div className="form-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={16} /> Register New Provider</span>
            {isRegisterSponsored && (
              <span className="badge" style={{ fontSize: 9, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                Fee Subsidized
              </span>
            )}
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>
              PROVIDER NAME
              {isRegisterSponsored && <span style={{ marginLeft: 8, fontSize: 8, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 4px', borderRadius: 3, verticalAlign: 'middle', background: 'rgba(16, 185, 129, 0.08)' }}>Sponsored</span>}
            </label>
            <input className="warp-input" placeholder="Sentinel-Analyzer" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-warning)' }}>CAPABILITIES (comma-separated)</label>
            <input className="warp-input" placeholder="nlp,sentiment,summarize" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
          </div>
          <button className="warp-btn" onClick={handleRegister} disabled={!isConnected || loading}>
            <UserPlus size={14} /> {loading ? 'Processing...' : 'Submit Registry Entry'}
          </button>
        </div>

        <div className="form-card">
          <div className="form-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={16} /> Deposit Collateral</span>
            {isStakeSponsored && (
              <span className="badge" style={{ fontSize: 9, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                Fee Subsidized
              </span>
            )}
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>PROVIDER ID</label>
            <input className="warp-input" placeholder="0" type="number" value={stakeAgentId} onChange={e => setStakeAgentId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-success)' }}>
              COLLATERAL_DEPOSIT_USDC
              {isStakeSponsored && <span style={{ marginLeft: 8, fontSize: 8, color: 'var(--warp-success)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 4px', borderRadius: 3, verticalAlign: 'middle', background: 'rgba(16, 185, 129, 0.08)' }}>Sponsored</span>}
            </label>
            <input className="warp-input" placeholder="5.00" type="number" step="0.01" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} />
          </div>
          <button className="warp-btn secondary" onClick={handleStake} disabled={!isConnected || loading}>
            <Shield size={14} /> {loading ? 'Processing...' : 'Lock Collateral Deposit'}
          </button>
        </div>
      </div>

      {/* ── Spawning / Programmatic Wallet Section ── */}
      <DeveloperWalletsCard />
    </div>
  )
}
