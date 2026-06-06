'use client'

import { useState } from 'react'
import { FileText, Copy, Check, Terminal, Code2, ShieldAlert, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export function DocsTab() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

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
    </div>
  )
}
