'use client'

import { useState } from 'react'
import { Search, Loader2, ArrowRight, Activity, Calendar, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface Entry {
  address: string
  delta: string
}

interface DecodedBatchData {
  txHash: string
  blockNumber: string
  blockTimestamp: number
  batchId: string
  relayer: string
  entriesCount: number
  entries: Entry[]
  settlements: any[]
}

export function BatchDecoderTab() {
  const [txHash, setTxHash] = useState('0x6730303030303030303030303030303030303030303030303030303030303030') // default dummy or example hash
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DecodedBatchData | null>(null)

  const handleDecode = async (hashToUse?: string) => {
    const hash = hashToUse || txHash
    if (!hash.trim() || !hash.startsWith('0x')) {
      toast.error('Invalid transaction hash. Must start with 0x.')
      return
    }

    setLoading(true)
    const tid = toast.loading('Fetching & decoding batch calldata from Arc Testnet...')
    try {
      const res = await fetch(`/api/batch-decoder?hash=${hash}`)
      const resJson = await res.json()

      if (!res.ok) throw new Error(resJson.error || 'Failed to decode transaction')

      setData(resJson)
      toast.success('Transaction calldata decoded successfully!', { id: tid })
    } catch (err: any) {
      toast.error(err.message || 'Decoding failed', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/job-chain</span>
        <span style={{ color: 'var(--warp-text)' }}> ./x402-batch-decoder</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        Diagnostic Tool — Inspect on-chain submitBatch(...) transactions and trace off-chain Circle Gateway settlements.
      </div>

      <div className="card" style={{ border: '1px solid var(--warp-cyan)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} className="color-primary" />
          <span>Search submitBatch Transaction</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <input
            type="text"
            className="warp-input"
            style={{ flex: 1, fontFamily: 'monospace' }}
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="Enter submitBatch tx hash starting with 0x"
          />
          <button
            className="warp-btn"
            style={{ marginTop: 0 }}
            onClick={() => handleDecode()}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Decode Batch'}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--warp-muted)' }}>
          <span>Example Hashes (Arc Testnet): </span>
          <button
            onClick={() => {
              setTxHash('0x384a51e18bbfa1229a43a05a0198031d2ba7768a884de63bc1a28a3068fefc2a')
              handleDecode('0x384a51e18bbfa1229a43a05a0198031d2ba7768a884de63bc1a28a3068fefc2a')
            }}
            style={{ background: 'none', border: 'none', color: 'var(--warp-cyan)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'monospace', padding: 0, marginRight: 12 }}
          >
            0x384a...fc2a (Demo Batch)
          </button>
        </div>
      </div>

      {data && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Metadata Grid */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">Batch Metadata</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, fontSize: 12, fontFamily: 'monospace' }}>
                <div><span style={{ color: 'var(--warp-muted)' }}>Batch ID:</span> {data.batchId}</div>
                <div><span style={{ color: 'var(--warp-muted)' }}>Relayer:</span> <a href={`https://testnet.arcscan.app/address/${data.relayer}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warp-cyan)' }}>{data.relayer}</a></div>
                <div><span style={{ color: 'var(--warp-muted)' }}>Block Number:</span> {data.blockNumber}</div>
                <div><span style={{ color: 'var(--warp-muted)' }}>Timestamp:</span> {data.blockTimestamp ? new Date(data.blockTimestamp * 1000).toLocaleString() : 'N/A'}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">Facilitator Settlement Match</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, fontSize: 12 }}>
                {data.settlements && data.settlements.length > 0 ? (
                  data.settlements.map((s: any, idx: number) => (
                    <div key={idx} style={{ padding: 8, background: 'rgba(0,255,255,0.05)', border: '1px solid var(--warp-cyan)', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>
                      <div>UUID: {s.id}</div>
                      <div>Amount: {s.amount} USDC</div>
                      <div>Status: <span style={{ color: 'var(--warp-success)' }}>{s.status}</span></div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warp-muted)', fontSize: 11, fontFamily: 'monospace' }}>
                    <ShieldAlert size={14} />
                    No direct facilitator matching settlements found in block window. Displaying on-chain deltas only.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Balance Deltas */}
          <div className="card">
            <div className="card-header">On-Chain Balance Deltas ({data.entriesCount} addresses settled)</div>
            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--warp-border)', color: 'var(--warp-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>ADDRESS</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>DELTA (USDC)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, idx) => {
                    const isPositive = !entry.delta.startsWith('-')
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--warp-text)' }}>
                          <a href={`https://testnet.arcscan.app/address/${entry.address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            {entry.address}
                          </a>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: isPositive ? 'var(--warp-success)' : 'var(--warp-error)' }}>
                          {isPositive ? '+' : ''}{entry.delta}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
