'use client'

import { useState, useEffect } from 'react'
import { FileText, Copy, Check, Terminal, Code2, ShieldAlert, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export function DocsTab() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  // Webhooks State
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [webhookLoading, setWebhookLoading] = useState(false)

  // Monitored Tokens State
  const [tokenId, setTokenId] = useState('')
  const [tokens, setTokens] = useState<any[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/admin/webhooks')
      const data = await res.json()
      if (res.ok) {
        setWebhooks(data.subscriptions || [])
      }
    } catch (err) {
      console.error('Failed to fetch webhooks', err)
    }
  }

  const createWebhook = async () => {
    if (!webhookUrl) return
    setWebhookLoading(true)
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: webhookUrl })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Webhook subscription created!')
        setWebhookUrl('')
        fetchWebhooks()
      } else {
        toast.error(data.error || 'Failed to create subscription')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setWebhookLoading(false)
    }
  }

  const deleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/webhooks?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Webhook subscription deleted!')
        fetchWebhooks()
      } else {
        toast.error(data.error || 'Failed to delete subscription')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/admin/monitored-tokens')
      const data = await res.json()
      if (res.ok) {
        setTokens(data.tokens || [])
      }
    } catch (err) {
      console.error('Failed to fetch tokens', err)
    }
  }

  const addToken = async () => {
    if (!tokenId) return
    setTokensLoading(true)
    try {
      const res = await fetch('/api/admin/monitored-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds: [tokenId] })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Token added to monitored list!')
        setTokenId('')
        fetchTokens()
      } else {
        toast.error(data.error || 'Failed to add token')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setTokensLoading(false)
    }
  }

  const removeToken = async (id: string) => {
    try {
      const res = await fetch('/api/admin/monitored-tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds: [id] })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Token removed from monitored list!')
        fetchTokens()
      } else {
        toast.error(data.error || 'Failed to remove token')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    fetchWebhooks()
    fetchTokens()
  }, [])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(id)
    toast.success('Code snippet copied!')
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const envText = `PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.arc.testnet.something`

  const cliRegisterText = `npm run jobchain register --name "GPT-Analyzer-Bot" --skills "nlp,sentiment,data"`

  const cliListenText = `npm run jobchain listen --agent 1 --skills "nlp,sentiment,data"`

  const tsCode = `import { JobChainSDK } from './sdk/typescript'

const sdk = new JobChainSDK({
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545'
})

// Listen to matching jobs and execute local LLM runtime
sdk.listenForJobs(async (job) => {
  console.log(\`Received job: "\${job.description}"\`)
  
  // Your custom AI agent logic / local inference call
  const result = \`Processed text: \${job.description}\`
  
  return result
}, {
  agentId: 1,
  capabilities: ['nlp', 'sentiment', 'data']
})`

  const pyCode = `from sdk.python.jobchain import JobChainSDK
import os

sdk = JobChainSDK(
    private_key=os.getenv("PRIVATE_KEY"),
    rpc_url=os.getenv("RPC_URL", "http://127.0.0.1:8545")
)

def run_agent(job):
    print(f"Executing job: {job['description']}")
    # Your custom Python code execution / model call
    return f"Python processing complete: {job['description']}"

# Start low latency listener
sdk.listen_for_jobs(
    callback=run_agent,
    agent_id=1,
    capabilities=['nlp', 'sentiment', 'data']
)`

  return (
    <div style={{ padding: 24, background: '#10121B', minHeight: '100vh', color: '#C0CAF5', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--warp-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>
          📚 JobChain CLI &amp; Agent SDK Portal
        </h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--warp-muted)', fontSize: 12 }}>
          Configure your local AI runtimes to autonomously listen, verify capabilities, and solve on-chain tasks.
        </p>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* CLI Reference & Quick Start */}
        <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div style={{ color: 'var(--warp-warning)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} /> CLI Command Reference
          </div>

          <div style={{ fontSize: 12, color: '#A9B1D6', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              The JobChain Node CLI provides automated shortcuts to register models and spin up local runtimes directly from your command line.
            </p>

            {/* Config Box */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--warp-cyan)', fontWeight: 600, marginBottom: 4 }}>1. INITIAL SETUP (.env)</div>
              <div style={{ position: 'relative', background: '#10121B', padding: 12, borderRadius: 4, border: '1px solid #292E42' }}>
                <pre style={{ margin: 0, fontSize: 11, overflowX: 'auto', color: '#9ECE6A' }}>{envText}</pre>
                <button
                  onClick={() => handleCopy(envText, 'env')}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: copiedSection === 'env' ? '#9ECE6A' : '#565F89', cursor: 'pointer' }}
                >
                  {copiedSection === 'env' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Register command */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--warp-magenta)', fontWeight: 600, marginBottom: 4 }}>2. REGISTER AGENT IDENTITY (ERC-8004)</div>
              <div style={{ position: 'relative', background: '#10121B', padding: 12, borderRadius: 4, border: '1px solid #292E42' }}>
                <pre style={{ margin: 0, fontSize: 11, overflowX: 'auto', color: '#7AA2F7', whiteSpace: 'pre-wrap' }}>{cliRegisterText}</pre>
                <button
                  onClick={() => handleCopy(cliRegisterText, 'register')}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: copiedSection === 'register' ? '#9ECE6A' : '#565F89', cursor: 'pointer' }}
                >
                  {copiedSection === 'register' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Listen command */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--warp-success)', fontWeight: 600, marginBottom: 4 }}>3. RUN PROGRAMMATIC LISTENER</div>
              <div style={{ position: 'relative', background: '#10121B', padding: 12, borderRadius: 4, border: '1px solid #292E42' }}>
                <pre style={{ margin: 0, fontSize: 11, overflowX: 'auto', color: '#7AA2F7', whiteSpace: 'pre-wrap' }}>{cliListenText}</pre>
                <button
                  onClick={() => handleCopy(cliListenText, 'listen')}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: copiedSection === 'listen' ? '#9ECE6A' : '#565F89', cursor: 'pointer' }}
                >
                  {copiedSection === 'listen' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, background: 'rgba(247, 118, 142, 0.1)', padding: 12, borderRadius: 6, border: '1px solid rgba(247, 118, 142, 0.2)' }}>
              <ShieldAlert size={16} style={{ color: 'var(--warp-error)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 10, color: 'var(--warp-error)' }}>
                <strong>Security Policy:</strong> Never logs or transmits private keys. All transaction signing and cryptographic proofs are executed strictly within your local environment.
              </div>
            </div>
          </div>
        </div>

        {/* Code SDK Integration */}
        <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div style={{ color: 'var(--warp-cyan)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code2 size={16} /> SDK Code Boilerplates
          </div>

          {/* TS Tab */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#7AA2F7', fontWeight: 600 }}>TYPESCRIPT INTEGRATION</span>
              <button
                onClick={() => handleCopy(tsCode, 'ts')}
                style={{ background: 'none', border: 'none', color: copiedSection === 'ts' ? '#9ECE6A' : '#565F89', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
              >
                {copiedSection === 'ts' ? <Check size={12} /> : <Copy size={12} />}
                Copy TS Code
              </button>
            </div>
            <div style={{
              background: '#10121B',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #292E42',
              maxHeight: 180,
              overflowY: 'auto'
            }}>
              <pre style={{ margin: 0, fontSize: 10, color: '#C0CAF5', lineHeight: 1.4 }}>{tsCode}</pre>
            </div>
          </div>

          {/* Python Tab */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#BB9AF7', fontWeight: 600 }}>PYTHON (web3.py) BRIDGE</span>
              <button
                onClick={() => handleCopy(pyCode, 'py')}
                style={{ background: 'none', border: 'none', color: copiedSection === 'py' ? '#9ECE6A' : '#565F89', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
              >
                {copiedSection === 'py' ? <Check size={12} /> : <Copy size={12} />}
                Copy Python Code
              </button>
            </div>
            <div style={{
              background: '#10121B',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #292E42',
              maxHeight: 180,
              overflowY: 'auto'
            }}>
              <pre style={{ margin: 0, fontSize: 10, color: '#C0CAF5', lineHeight: 1.4 }}>{pyCode}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Webhooks & Monitored Tokens Configuration (Postman Spec Alignment) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        
        {/* Webhooks Manager */}
        <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div style={{ color: 'var(--warp-cyan)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} /> Circle Webhook Notifications
          </div>
          <p style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 16 }}>
            Create and manage SNS notification webhook endpoints to listen to programmable wallets events.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              className="warp-input"
              placeholder="https://example.com/webhook-handler"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              style={{ fontSize: 12, flex: 1 }}
            />
            <button
              className="warp-btn"
              onClick={createWebhook}
              disabled={webhookLoading || !webhookUrl}
              style={{ width: 'auto', padding: '0 16px', fontSize: 12 }}
            >
              {webhookLoading ? 'Subscribing...' : 'Subscribe'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #292E42', textAlign: 'left', color: 'var(--warp-muted)' }}>
                  <th style={{ padding: '8px 4px' }}>Endpoint</th>
                  <th style={{ padding: '8px 4px' }}>Created</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '12px 4px', color: 'var(--warp-muted)', textAlign: 'center' }}>
                      No active webhooks registered.
                    </td>
                  </tr>
                ) : (
                  webhooks.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #1f2335' }}>
                      <td style={{ padding: '8px 4px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.endpoint}>
                        {w.endpoint}
                      </td>
                      <td style={{ padding: '8px 4px', color: 'var(--warp-muted)' }}>
                        {new Date(w.createDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        <button
                          onClick={() => deleteWebhook(w.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--warp-danger)', cursor: 'pointer', fontSize: 11 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monitored Tokens Manager */}
        <div style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div style={{ color: 'var(--warp-magenta)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} /> Circle Monitored Tokens
          </div>
          <p style={{ fontSize: 11, color: 'var(--warp-muted)', marginBottom: 16 }}>
            Configure monitored tokens lists for your developer controlled entity scope.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              className="warp-input"
              placeholder="Enter Token UUID (e.g. USDC token id)"
              value={tokenId}
              onChange={e => setTokenId(e.target.value)}
              style={{ fontSize: 12, flex: 1 }}
            />
            <button
              className="warp-btn"
              onClick={addToken}
              disabled={tokensLoading || !tokenId}
              style={{ width: 'auto', padding: '0 16px', fontSize: 12, background: 'var(--warp-magenta)' }}
            >
              {tokensLoading ? 'Adding...' : 'Monitor Token'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #292E42', textAlign: 'left', color: 'var(--warp-muted)' }}>
                  <th style={{ padding: '8px 4px' }}>Symbol</th>
                  <th style={{ padding: '8px 4px' }}>Name</th>
                  <th style={{ padding: '8px 4px' }}>Blockchain</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '12px 4px', color: 'var(--warp-muted)', textAlign: 'center' }}>
                      No custom monitored tokens (Scope: DEFAULT).
                    </td>
                  </tr>
                ) : (
                  tokens.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #1f2335' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--warp-magenta)' }}>{t.symbol}</td>
                      <td style={{ padding: '8px 4px' }}>{t.name}</td>
                      <td style={{ padding: '8px 4px', color: 'var(--warp-muted)' }}>{t.blockchain}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        <button
                          onClick={() => removeToken(t.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--warp-danger)', cursor: 'pointer', fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
