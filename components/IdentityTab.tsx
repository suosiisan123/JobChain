'use client'

import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, keccak256, toHex } from 'viem'
import { Fingerprint, ShieldCheck, Award, ExternalLink, CheckCircle } from 'lucide-react'
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
  const { address, isConnected, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const [loading, setLoading] = useState(false)
  const [metadataURI, setMetadataURI] = useState('ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei')
  const [agentIdForReputation, setAgentIdForReputation] = useState('')
  const [reputationScore, setReputationScore] = useState('85')
  const [reputationTag, setReputationTag] = useState('successful_job')
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredAgent[]>([])
  const [myAgentCount, setMyAgentCount] = useState<number>(0)
  const [loadingAgents, setLoadingAgents] = useState(true)

  // Load recent registrations from IdentityRegistry Transfer events
  useEffect(() => {
    async function fetchRegistrations() {
      if (!publicClient) return
      setLoadingAgents(true)
      try {
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : 0n

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
              args: [address],
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
        <span>Agent identity registered on ERC-8004! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 8000 }
      )
    } catch (err: any) {
      toast.error(err?.shortMessage || 'Registration failed', { id: tid })
    } finally { setLoading(false) }
  }

  const handleGiveFeedback = async () => {
    if (!isConnected || !agentIdForReputation) {
      toast.error('Connect wallet and provide agent ID'); return
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
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/erc-8004</span>
        <span style={{ color: 'var(--warp-text)' }}> ./identity-manager</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 8 }}>
        Official ERC-8004 Agent Identity — Arc Testnet
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24, fontSize: 11 }}>
        <span style={{ color: 'var(--warp-success)' }}>■</span> IdentityRegistry: <a href={`https://testnet.arcscan.app/address/${IDENTITY_REGISTRY}`} target="_blank" rel="noopener noreferrer" className="tx-link" style={{ marginLeft: 0 }}>{IDENTITY_REGISTRY.slice(0, 14)}…</a>
        <br />
        <span style={{ color: 'var(--warp-warning)' }}>■</span> ReputationRegistry: <a href={`https://testnet.arcscan.app/address/${REPUTATION_REGISTRY}`} target="_blank" rel="noopener noreferrer" className="tx-link" style={{ marginLeft: 0 }}>{REPUTATION_REGISTRY.slice(0, 14)}…</a>
        {isConnected && myAgentCount > 0 && (
          <><br /><span style={{ color: 'var(--warp-magenta)' }}>■</span> Your registered agents: <span style={{ color: 'var(--warp-success)', fontWeight: 700 }}>{myAgentCount}</span></>
        )}
      </div>

      {/* ── Registered Agents on Official Registry ── */}
      {loadingAgents ? (
        <div style={{ marginLeft: 24, marginBottom: 24, color: 'var(--warp-muted)', fontSize: 12 }}>
          <span style={{ color: 'var(--warp-primary)' }}>⠋</span> Fetching ERC-8004 registrations...
        </div>
      ) : registeredAgents.length > 0 && (
        <div style={{ marginLeft: 24, marginBottom: 24 }}>
          <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Fingerprint size={12} /> REGISTERED IDENTITIES (ERC-8004)
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Token ID</th>
                <th>Owner</th>
                <th>Metadata URI</th>
                <th>Verify</th>
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
                      <ExternalLink size={10} /> arcscan
                    </a>
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
          <div className="form-title"><Fingerprint size={16} /> Register Agent Identity</div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Mint an ERC-721 identity NFT on the official <span style={{ color: 'var(--warp-primary)' }}>IdentityRegistry</span> contract.
            Your agent will receive a unique on-chain identity token.
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>METADATA_URI</label>
            <input
              className="warp-input"
              placeholder="ipfs://QmYourAgentMetadata..."
              value={metadataURI}
              onChange={e => setMetadataURI(e.target.value)}
            />
            <div style={{ fontSize: 10, color: 'var(--warp-muted)', marginTop: 4 }}>
              IPFS URI containing agent metadata (name, capabilities, version)
            </div>
          </div>
          <button className="warp-btn" onClick={handleRegisterIdentity} disabled={!isConnected || loading} style={{ background: 'var(--warp-magenta)' }}>
            <Fingerprint size={14} /> {loading ? 'Processing...' : 'Register on ERC-8004'}
          </button>
        </div>

        <div className="form-card">
          <div className="form-title"><Award size={16} /> Record Reputation</div>
          <div style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Submit reputation feedback to the official <span style={{ color: 'var(--warp-warning)' }}>ReputationRegistry</span>.
            Note: You cannot rate your own agents (per ERC-8004 rules).
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>AGENT_TOKEN_ID</label>
            <input className="warp-input" placeholder="0" type="number" value={agentIdForReputation} onChange={e => setAgentIdForReputation(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-success)' }}>SCORE (-128 to 127)</label>
              <input className="warp-input" type="number" min="-128" max="127" value={reputationScore} onChange={e => setReputationScore(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 2 }}>
              <label className="field-label" style={{ color: 'var(--warp-warning)' }}>TAG</label>
              <input className="warp-input" placeholder="successful_job" value={reputationTag} onChange={e => setReputationTag(e.target.value)} />
            </div>
          </div>
          <button className="warp-btn secondary" onClick={handleGiveFeedback} disabled={!isConnected || loading}>
            <Award size={14} /> {loading ? 'Processing...' : 'Submit Reputation'}
          </button>
        </div>
      </div>

      {/* ── Protocol Info ── */}
      <div style={{ marginTop: 24, marginLeft: 24, padding: 16, background: 'rgba(36,40,59,0.3)', border: '1px solid var(--warp-border)', borderRadius: 8 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={12} /> ERC-8004 STANDARD OVERVIEW
        </div>
        <div style={{ fontSize: 11, color: 'var(--warp-muted)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>IdentityRegistry</strong> — Mint ERC-721 identity NFTs with metadata URI</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>ReputationRegistry</strong> — External observers record scored feedback</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>ValidationRegistry</strong> — Two-step request/response credential verification</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CheckCircle size={10} style={{ color: 'var(--warp-success)', flexShrink: 0, marginTop: 3 }} />
            <span><strong style={{ color: 'var(--warp-text)' }}>Anti-Self-Dealing</strong> — Agents cannot record reputation for themselves</span>
          </div>
        </div>
      </div>
    </div>
  )
}
