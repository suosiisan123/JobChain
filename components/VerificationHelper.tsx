import { useState } from 'react'
import { Shield, CheckCircle, AlertCircle, Copy, Check, Cpu, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { readContract } from '@wagmi/core'
import { config } from '@/lib/web3-provider'
import { ZK_VERIFIER_CONTRACT_ADDRESS } from '@/lib/contracts'

interface VerificationHelperProps {
  onSignatureGenerated?: (sig: string) => void
}

const ZK_VERIFIER_ABI = [
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "capabilities", type: "string" },
      { name: "signature", type: "bytes" }
    ],
    name: "verifyCapability",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "resultHash", type: "string" },
      { name: "proof", type: "bytes" }
    ],
    name: "verifyExecution",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const

export function VerificationHelper({ onSignatureGenerated }: VerificationHelperProps) {
  const [activeTab, setActiveTab] = useState<'capability' | 'execution'>('capability')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  // Capability inputs
  const [agentId, setAgentId] = useState('1')
  const [caps, setCaps] = useState('nlp,sentiment,text-classification')
  
  // Execution inputs
  const [jobId, setJobId] = useState('1')
  const [resultHash, setResultHash] = useState('ipfs://QmXoypujjW3kj3FRZ8SScr1NvedjuvWEY6BXx9123456')

  // Outputs
  const [signature, setSignature] = useState('')
  const [isValidOnChain, setIsValidOnChain] = useState<boolean | null>(null)
  const [signerAddress, setSignerAddress] = useState('')

  const handleCopy = () => {
    navigator.clipboard.writeText(signature)
    setCopied(true)
    toast.success('Signature copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Generate ZK-attestation / signature from backend
  const handleGenerate = async () => {
    setLoading(true)
    setSignature('')
    setIsValidOnChain(null)
    setSignerAddress('')

    try {
      const payload = activeTab === 'capability' 
        ? { type: 'capability', agentId: Number(agentId), capabilities: caps }
        : { type: 'execution', jobId: Number(jobId), resultHash }

      const res = await fetch('/api/zk-proof/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setSignature(data.signature)
      setSignerAddress(data.signer)
      toast.success(`${activeTab === 'capability' ? 'Capability Attestation' : 'Execution Proof'} generated successfully!`)
      if (onSignatureGenerated) {
        onSignatureGenerated(data.signature)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to generate cryptographic proof')
    } finally {
      setLoading(false)
    }
  }

  // Check validity on-chain via ZKVerifier readContract
  const handleVerifyOnChain = async () => {
    if (!signature) return
    setVerifying(true)
    setIsValidOnChain(null)

    try {
      if (activeTab === 'capability') {
        const result = await readContract(config, {
          address: ZK_VERIFIER_CONTRACT_ADDRESS,
          abi: ZK_VERIFIER_ABI,
          functionName: 'verifyCapability',
          args: [BigInt(agentId), caps, signature as `0x${string}`]
        })
        setIsValidOnChain(result)
      } else {
        const result = await readContract(config, {
          address: ZK_VERIFIER_CONTRACT_ADDRESS,
          abi: ZK_VERIFIER_ABI,
          functionName: 'verifyExecution',
          args: [BigInt(jobId), resultHash, signature as `0x${string}`]
        })
        setIsValidOnChain(result)
      }
    } catch (err: any) {
      console.error('On-chain verification error:', err)
      setIsValidOnChain(false)
      toast.error(`On-chain verification failed: ${err.message || err}`)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="form-card" style={{ border: '1px solid var(--warp-border)', boxShadow: '0 0 15px rgba(143, 118, 255, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--warp-border)', paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} style={{ color: 'var(--warp-magenta)' }} />
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: '0.05em', color: 'var(--warp-text)' }}>CRYPTOGRAPHIC VERIFICATION COMPILER</h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            className={`btn-subtab ${activeTab === 'capability' ? 'active' : ''}`}
            onClick={() => { setActiveTab('capability'); setSignature(''); setIsValidOnChain(null); }}
          >
            Provider Credentials
          </button>
          <button 
            className={`btn-subtab ${activeTab === 'execution' ? 'active' : ''}`}
            onClick={() => { setActiveTab('execution'); setSignature(''); setIsValidOnChain(null); }}
          >
            Work Clearance
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--warp-muted)', margin: 0 }}>
          {activeTab === 'capability' 
            ? 'Generate a signed capability attestation for a security provider. The signature is registered on-chain during task pickup to verify credentials.'
            : 'Compile cryptographic proofs of execution. Ensures results are mathematically verified before releasing funds.'}
        </p>

        {activeTab === 'capability' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>PROVIDER ID</label>
              <input 
                type="number" 
                value={agentId} 
                onChange={(e) => setAgentId(e.target.value)} 
                className="warp-input" 
                placeholder="e.g. 3"
              />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>CAPABILITIES (COMMA-SEPARATED)</label>
              <input 
                type="text" 
                value={caps} 
                onChange={(e) => setCaps(e.target.value)} 
                className="warp-input" 
                placeholder="e.g. solidity,audit,security (comma-separated)"
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>ESCROW ID</label>
              <input 
                type="number" 
                value={jobId} 
                onChange={(e) => setJobId(e.target.value)} 
                className="warp-input" 
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ color: 'var(--warp-warning)' }}>RESULT HASH / IPFS URI</label>
              <input 
                type="text" 
                value={resultHash} 
                onChange={(e) => setResultHash(e.target.value)} 
                className="warp-input" 
                placeholder="e.g. ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
              />
            </div>
          </div>
        )}

        <button 
          onClick={handleGenerate} 
          disabled={loading}
          className="warp-btn" 
          style={{ width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#0A0A0C', background: 'var(--warp-primary)', marginTop: 8 }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="spin-animation" /> Generating Attestation...
            </>
          ) : (
            <>
              <Cpu size={14} /> Compute Cryptographic Attestation
            </>
          )}
        </button>

        {signature && (
          <div style={{ marginTop: 8, padding: 12, background: 'rgba(15,16,21,0.5)', borderRadius: 6, border: '1px solid var(--warp-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--warp-cyan)', fontWeight: 600 }}>COMPILED PROOF ATTRIBUTE:</span>
              <button 
                onClick={handleCopy} 
                style={{ background: 'none', border: 'none', color: copied ? 'var(--warp-success)' : 'var(--warp-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy Proof'}
              </button>
            </div>
            
            <div style={{ 
              fontFamily: 'monospace', 
              fontSize: 10, 
              background: '#070709', 
              padding: 8, 
              borderRadius: 4, 
              wordBreak: 'break-all', 
              color: 'var(--warp-text)',
              maxHeight: 60,
              overflowY: 'auto',
              border: '1px solid var(--warp-border)'
            }}>
              {signature}
            </div>

            <div style={{ fontSize: 9, color: 'var(--warp-muted)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div><strong>Authority Address:</strong> {signerAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'}</div>
              <div><strong>Status:</strong> Not verified on-chain yet</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button 
                onClick={handleVerifyOnChain} 
                disabled={verifying}
                className="warp-btn secondary"
                style={{ flex: 1, fontSize: 11, padding: '6px', justifyContent: 'center', marginTop: 0 }}
              >
                {verifying ? 'Running EVM Verification...' : 'Verify On-Chain'}
              </button>
            </div>

            {isValidOnChain !== null && (
              <div style={{ 
                marginTop: 10, 
                padding: '8px 12px', 
                borderRadius: 4, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                fontSize: 11,
                background: isValidOnChain ? 'rgba(13, 211, 147, 0.1)' : 'rgba(255, 90, 90, 0.1)',
                border: `1px solid ${isValidOnChain ? 'var(--warp-success)' : 'var(--warp-error)'}`
              }}>
                {isValidOnChain ? (
                  <>
                    <CheckCircle size={14} style={{ color: 'var(--warp-success)' }} />
                    <span style={{ color: 'var(--warp-success)', fontWeight: 600 }}>VERIFICATION SUCCESSFUL: Proof recovered to authorized authority key.</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} style={{ color: 'var(--warp-error)' }} />
                    <span style={{ color: 'var(--warp-error)', fontWeight: 600 }}>VERIFICATION FAILED: Recovered key signature mismatch.</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
