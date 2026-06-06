'use client'

import { useCCTP, BridgeStep, CCTP_CHAINS } from '@/hooks/useCCTP'
import { CheckCircle2, Circle, AlertCircle, Loader2, ArrowRight, ExternalLink, HelpCircle } from 'lucide-react'

interface BridgeStatusTrackerProps {
  bridgeState: ReturnType<typeof useCCTP>['bridgeState']
  onClose: () => void
}

export function BridgeStatusTracker({ bridgeState, onClose }: BridgeStatusTrackerProps) {
  const { step, sourceChainId, amount, burnTxHash, messageHash, mintTxHash, jobTxHash, error } = bridgeState
  const sourceChain = CCTP_CHAINS.find((c) => c.id === sourceChainId)

  const steps: { key: BridgeStep[]; label: string; desc: string }[] = [
    {
      key: ['APPROVING', 'APPROVED', 'BURNING'],
      label: '1. Initiate CCTP Burn',
      desc: `Approve and burn ${amount} USDC on ${sourceChain?.name || 'source chain'}.`
    },
    {
      key: ['BURNED', 'WAITING_FOR_ATTESTATION'],
      label: '2. Retrieve Circle Attestation',
      desc: 'Polling Circle\'s API for cross-chain burn proof attestation.'
    },
    {
      key: ['ATTESTATION_RECEIVED', 'MINTING', 'MINTED'],
      label: '3. Mint USDC on Arc Testnet',
      desc: 'Submitting burn proof to Arc CCTP contract to release stablecoins.'
    },
    {
      key: ['CREATING_JOB', 'SUCCESS'],
      label: '4. Fund Job Escrow',
      desc: 'Call JobChainV2 contract to deposit USDC and post the task.'
    }
  ]

  const getStepStatus = (stepKeys: BridgeStep[]) => {
    if (step === 'ERROR') return 'error'
    if (step === 'SUCCESS') return 'completed'

    const currentIndex = steps.findIndex((s) => s.key.includes(step))
    const itemIndex = steps.findIndex((s) => s.key === stepKeys)

    if (itemIndex < currentIndex) return 'completed'
    if (itemIndex === currentIndex) return 'active'
    return 'pending'
  }

  const getPercentage = () => {
    switch (step) {
      case 'APPROVING': return 10
      case 'APPROVED': return 25
      case 'BURNING': return 40
      case 'BURNED': return 50
      case 'WAITING_FOR_ATTESTATION': return 65
      case 'ATTESTATION_RECEIVED': return 75
      case 'MINTING': return 85
      case 'MINTED': return 90
      case 'CREATING_JOB': return 95
      case 'SUCCESS': return 100
      default: return 0
    }
  }

  return (
    <div className="card" style={{ border: '1px solid var(--warp-cyan)', position: 'relative', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} className="spin" /> Cross-Chain Escrow Orchestrator
        </h3>
        {step === 'SUCCESS' || step === 'ERROR' ? (
          <button className="warp-btn border" onClick={onClose} style={{ padding: '4px 8px', fontSize: 11 }}>
            Close Tracker
          </button>
        ) : null}
      </div>

      {/* Progress Bar */}
      <div style={{ background: '#1A1B26', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 20, border: '1px solid #292E42' }}>
        <div
          style={{
            background: 'linear-gradient(90deg, var(--warp-cyan) 0%, var(--warp-success) 100%)',
            height: '100%',
            width: `${getPercentage()}%`,
            transition: 'width 0.4s ease'
          }}
        />
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        {steps.map((s, idx) => {
          const status = getStepStatus(s.key)
          return (
            <div key={idx} style={{ display: 'flex', gap: 12 }}>
              <div style={{ marginTop: 2 }}>
                {status === 'completed' && <CheckCircle2 size={18} style={{ color: 'var(--warp-success)' }} />}
                {status === 'active' && <Loader2 size={18} className="spin" style={{ color: 'var(--warp-cyan)' }} />}
                {status === 'pending' && <Circle size={18} style={{ color: 'var(--warp-muted)' }} />}
                {status === 'error' && <AlertCircle size={18} style={{ color: 'var(--warp-danger)' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: status === 'active' ? 600 : 500,
                  color: status === 'active' ? 'var(--warp-cyan)' : status === 'completed' ? 'var(--warp-text)' : 'var(--warp-muted)'
                }}>
                  {s.label}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--warp-muted)', marginTop: 2 }}>
                  {s.desc}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Transaction Details & Logs */}
      <div style={{ background: '#1A1B26', padding: 12, borderRadius: 8, border: '1px solid #292E42', fontSize: 11, fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'var(--warp-muted)' }}>USDC Amount:</span>
          <span style={{ color: 'var(--warp-success)' }}>{amount} USDC</span>
        </div>

        {burnTxHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--warp-muted)' }}>CCTP Burn Hash:</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${burnTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {burnTxHash.slice(0, 8)}...{burnTxHash.slice(-6)} <ExternalLink size={10} />
            </a>
          </div>
        )}

        {messageHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--warp-muted)' }}>Message Hash:</span>
            <span style={{ color: '#7AA2F7' }}>{messageHash.slice(0, 14)}...</span>
          </div>
        )}

        {mintTxHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--warp-muted)' }}>Arc Mint Hash:</span>
            <a
              href={`https://testnet.arcscan.app/tx/${mintTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {mintTxHash.slice(0, 8)}...{mintTxHash.slice(-6)} <ExternalLink size={10} />
            </a>
          </div>
        )}

        {jobTxHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--warp-muted)' }}>Arc Job Creation Hash:</span>
            <a
              href={`https://testnet.arcscan.app/tx/${jobTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--warp-cyan)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {jobTxHash.slice(0, 8)}...{jobTxHash.slice(-6)} <ExternalLink size={10} />
            </a>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 8, padding: 8, background: 'rgba(247, 118, 142, 0.1)', border: '1px solid #F7768E44', borderRadius: 4, color: 'var(--warp-danger)' }}>
            Error: {error}
          </div>
        )}
      </div>
    </div>
  )
}
