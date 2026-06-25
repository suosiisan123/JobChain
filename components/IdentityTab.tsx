'use client'

import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, keccak256, toHex } from 'viem'
import { Fingerprint, ShieldCheck, Award, ExternalLink, CheckCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import {
  IDENTITY_REGISTRY, REPUTATION_REGISTRY,
  identityRegistryAbi, reputationRegistryAbi,
} from '@/lib/contracts'

interface RegisteredAgent {
  tokenId: bigint
  owner: string
  metadataURI: string
}

export function IdentityTab() {
  const { address, isConnected, isPasskey, writeContractAsync, checkSponsorshipEligibility } = useSmartWallet()
  const publicClient = usePublicClient()
  const [loading, setLoading] = useState(false)
  const [metadataURI, setMetadataURI] = useState('ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei')
  const [agentIdForReputation, setAgentIdForReputation] = useState('')
  const [reputationScore, setReputationScore] = useState('85')
  const [reputationTag, setReputationTag] = useState('successful_job')
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredAgent[]>([])
  const [myAgentCount, setMyAgentCount] = useState<number>(0)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [sponsorshipStatus, setSponsorshipStatus] = useState<{ eligible: boolean; reason?: string; paymasterUrl?: string } | null>(null)

  useEffect(() => {
    if (address && checkSponsorshipEligibility) {
      checkSponsorshipEligibility('register', IDENTITY_REGISTRY)
        .then(res => setSponsorshipStatus(res))
        .catch(() => setSponsorshipStatus({ eligible: false, reason: 'Failed to verify eligibility' }))
    } else {
      setSponsorshipStatus(null)
    }
  }, [address, checkSponsorshipEligibility])

  // Load recent registrations from IdentityRegistry Transfer events
  useEffect(() => {
    async function fetchRegistrations() {
      if (!publicClient) return
      setLoadingAgents(true)
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 9900n ? latestBlock - 9900n : 0n

        const transferLogs = await publicClient.getLogs({
          address: IDENTITY_REGISTRY,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
          args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
          fromBlock,
          toBlock: latestBlock,
        })

        const agents: RegisteredAgent[] = []
        for (const log of transferLogs.slice(-20)) { // last 20 registrations
          const tokenId = log.args.tokenId!
          const owner = log.args.to!
          let metaURI = '—'
          try {
            metaURI = await publicClient.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: 'tokenURI',
              args: [tokenId],
            }) as string
          } catch { /* skip */ }
          agents.push({ tokenId, owner, metadataURI: metaURI })
        }
        setRegisteredAgents(agents.reverse())

        // Check if connected wallet has agents
        if (address) {
          try {
            const balance = await publicClient.readContract({
              address: IDENTITY_REGISTRY,
              abi: identityRegistryAbi,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            }) as bigint
            setMyAgentCount(Number(balance))
          } catch { /* skip */ }
        }
      } catch (err) {
        console.error('Failed to fetch registrations:', err)
      }
      setLoadingAgents(false)
    }
    fetchRegistrations()
  }, [publicClient, address])

  const handleRegisterIdentity = async () => {
    if (!isConnected || !metadataURI) {
      toast.error('Connect wallet and provide metadata URI'); return
    }
    setLoading(true)
    const tid = toast.loading('Registering on ERC-8004 IdentityRegistry...')
    try {
      const hash = await writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [metadataURI],
      })
      toast.success(
        <span>Credentials profile registered on ERC-8004! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 8000 }
      )
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Registration failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleGiveFeedback = async () => {
    if (!isConnected || !agentIdForReputation) {
      toast.error('Connect wallet and provide profile ID'); return
    }
    setLoading(true)
    const tid = toast.loading('Recording reputation on ERC-8004 ReputationRegistry...')
    try {
      const feedbackHash = keccak256(toHex(reputationTag))
      const hash = await writeContractAsync({
        address: REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [
          BigInt(agentIdForReputation),
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
        <span>Reputation recorded! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 8000 }
      )
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Feedback failed', { id: tid })
    } finally { setLoading(false) }
  }

  const truncateAddr = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`
  const truncateURI = (uri: string) => uri.length > 40 ? uri.slice(0, 40) + '…' : uri

  return (
    <div>
      <div className="prompt-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warp-muted)', fontSize: 13 }}>Directory &gt;</span>
        <span style={{ color: 'var(--warp-text)', fontSize: 13, fontWeight: 'bold' }}>Provider Credentials</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 8, fontSize: 12 }}>
        Verified Provider Credentials &amp; Performance Board
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24, fontSize: 11 }}>
        <span style={{ color: 'var(--warp-success)' }}>■</span> Credentials Ledger: <a href={`https://testnet.arcscan.app/address/${IDENTITY_REGISTRY}`} target="_blank" rel="noopener noreferrer" className="tx-link" style={{ marginLeft: 0 }}>{IDENTITY_REGISTRY.slice(0, 14)}…</a>
        <br />
        <span style={{ color: 'var(--warp-warning)' }}>■</span> Performance Directory: <a href={`https://testnet.arcscan.app/address/${REPUTATION_REGISTRY}`} target="_blank" rel="noopener noreferrer" className="tx-link" style={{ marginLeft: 0 }}>{REPUTATION_REGISTRY.slice(0, 14)}…</a>
        {isConnected && myAgentCount > 0 && (
          <><br /><span style={{ color: 'var(--warp-magenta)' }}>■</span> Your registered profiles: <span style={{ color: 'var(--warp-success)', fontWeight: 700 }}>{myAgentCount}</span></>
        )}
      </div>

      {/* ── Registered Agents on Official Registry ── */}
      {loadingAgents ? (
        <div style={{ marginLeft: 24, marginBottom: 24, color: 'var(--warp-muted)', fontSize: 12 }}>
          <span style={{ color: 'var(--warp-primary)' }}>⠋</span> Loading credential profiles...
        </div>
      ) : registeredAgents.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Fingerprint size={12} /> VERIFIED CREDENTIAL PROFILES
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Profile ID</th>
                <th>Owner</th>
                <th>Profile Specification URI</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {registeredAgents.map(a => (
                <tr key={a.tokenId.toString()}>
                  <td style={{ color: 'var(--warp-primary)', fontWeight: 600 }}>#{a.tokenId.toString()}</td>
                  <td style={{ fontFamily: 'var(--warp-font)', fontSize: 11 }}>
                    <a
                      href={`https://testnet.arcscan.app/address/${a.owner}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--warp-text)', textDecoration: 'none' }}
                    >
                      {truncateAddr(a.owner)}
                    </a>
                    {a.owner.toLowerCase() === address?.toLowerCase() && (
                      <span style={{ color: 'var(--warp-success)', fontSize: 10, marginLeft: 4 }}>(you)</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--warp-muted)' }}>{truncateURI(a.metadataURI)}</td>
                  <td>
                    <a
                      href={`https://testnet.arcscan.app/address/${IDENTITY_REGISTRY}`}
                      target="_blank" rel="noopener noreferrer"
                      className="tx-link" style={{ marginLeft: 0 }}
                    >
                      <ExternalLink size={10} /> explorer
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ── Paymaster Gas Sponsorship Hub ── */}
      <div className="form-card" style={{ marginLeft: 24, marginRight: 24, marginBottom: 24, background: 'rgba(16, 185, 129, 0.04)', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: 'var(--warp-success)' }} />
            <span style={{ fontWeight: 'bold', fontSize: 12, color: 'var(--warp-text)', letterSpacing: '0.05em' }}>PAYMASTER GAS SPONSORSHIP HUB</span>
          </div>
          <span style={{ fontSize: 9, color: 'var(--warp-muted)', textTransform: 'uppercase', fontFamily: 'monospace' }}>Arc Protocol Engine</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', lineHeight: 1.6 }}>
            On-chain transaction gas fees can be abstracted and sponsored by the network paymaster on Arc. 
            Smart Accounts using biometrics are eligible for sponsored registration and staking.
          </div>
          
          <div style={{ background: '#13141B', border: '1px solid #232535', borderRadius: 6, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--warp-muted)', fontWeight: 'bold', letterSpacing: '0.03em' }}>SPONSORSHIP ELIGIBILITY</div>
            {isConnected ? (
              sponsorshipStatus ? (
                sponsorshipStatus.eligible ? (
                  <div>
                    <div style={{ color: 'var(--warp-success)', fontWeight: 'bold', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={10} /> Sponsoring Active
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--warp-muted)', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      URL: {sponsorshipStatus.paymasterUrl}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: 'var(--warp-error)', fontWeight: 'bold', fontSize: 11 }}>Self-Paid Gas Required</div>
                    <div style={{ fontSize: 8, color: 'var(--warp-muted)', marginTop: 2 }}>{sponsorshipStatus.reason}</div>
                  </div>
                )
              ) : (
                <div style={{ fontSize: 10, color: 'var(--warp-muted)' }}>Analyzing network payload...</div>
              )
            ) : (
              <div style={{ color: 'var(--warp-warning)', fontSize: 10, fontWeight: 'bold' }}>Connect wallet or sign in to verify</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Forms ── */}
      <div className="form-grid">
        <div className="form-card">
          <div className="form-title"><Fingerprint size={16} /> Register Provider Profile</div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Establish a secure profile on the provider registry. This generates a unique credentials certificate.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>PROFILE SPECIFICATION URI</label>
            <input
              className="warp-input"
              placeholder="e.g. https://api.yourcompany.com/profiles/agent-01 (URL or resource identifier containing provider credentials)"
              value={metadataURI}
              onChange={e => setMetadataURI(e.target.value)}
            />
            <div style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
              URL or resource identifier containing provider credentials (name, capabilities, version)
            </div>
          </div>
          <button className="warp-btn" onClick={handleRegisterIdentity} disabled={!isConnected || loading} style={{ background: 'var(--warp-magenta)' }}>
            <Fingerprint size={14} /> {loading ? 'Processing...' : 'Submit Credentials Profile'}
          </button>
        </div>

        <div className="form-card">
          <div className="form-title"><Award size={16} /> Log Performance Feedback</div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Submit objective performance ratings to the verified Performance directory. Self-rating is locked to ensure system integrity.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>PROVIDER PROFILE ID</label>
            <input className="warp-input" placeholder="e.g. 142 (Unique provider registration ID to rate)" type="number" value={agentIdForReputation} onChange={e => setAgentIdForReputation(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-success)' }}>RATING SCORE (-100 to 100)</label>
              <input className="warp-input" type="number" min="-128" max="127" placeholder="e.g. 95 (Rating score from -100 to 100)" value={reputationScore} onChange={e => setReputationScore(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 2 }}>
              <label className="field-label" style={{ color: 'var(--warp-warning)' }}>PERFORMANCE TAG</label>
              <input className="warp-input" placeholder="e.g. fast_delivery (Performance tag identifier)" value={reputationTag} onChange={e => setReputationTag(e.target.value)} />
            </div>
          </div>
          <button className="warp-btn secondary" onClick={handleGiveFeedback} disabled={!isConnected || loading}>
            <Award size={14} /> {loading ? 'Processing...' : 'Submit Reputation'}
          </button>
        </div>
      </div>

      {/* ── Protocol Info ── */}
      <div className="form-card" style={{ marginTop: 24, marginLeft: 24, padding: 16, background: 'rgba(36,40,59,0.3)' }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={12} /> CREDENTIAL STANDARD OVERVIEW
        </div>
        <div style={{ fontSize: 11, color: 'var(--warp-muted)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>Credentials Ledger</strong> — Issue unique credential profiles with secure metadata</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>Performance Directory</strong> — Record verified observer ratings and score performance</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>Clearing Verification</strong> — Automated multi-party request &amp; response credentials validation</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>Sybil Resistance</strong> — Self-rating is locked to ensure authentic performance metrics</span>
          </div>
        </div>
      </div>
    </div>
  )
}
