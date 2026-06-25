'use client'

import { useState, useEffect } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import { formatUnits, parseAbiItem } from 'viem'
import { Shield, Wallet, Play, CheckCircle, RefreshCw, Copy, ExternalLink, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  IDENTITY_REGISTRY,
  usdcAbi
} from '@/lib/contracts'

interface WalletDBInfo {
  walletId: string
  address: string
  blockchain: string
  createdAt: string
}

interface AgentWalletDetails {
  id: number
  name: string
  walletInfo: WalletDBInfo | null
  usdcBalance: string
  gasBalance: string
  loading: boolean
}

export function DeveloperWalletsCard() {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [agents, setAgents] = useState<AgentWalletDetails[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const [drippingMap, setDrippingMap] = useState<Record<string, boolean>>({})

  // Testing inputs
  const [testJobId, setTestJobId] = useState('')
  const [testResultHash, setTestResultHash] = useState('QmSimulatedResultHash')
  const [executingMap, setExecutingMap] = useState<Record<string, boolean>>({})

  const handleRequestFaucet = async (address: string) => {
    setDrippingMap(prev => ({ ...prev, [address]: true }))
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Credit allocation requested!')
        setTimeout(loadWallets, 5000)
      } else {
        toast.error(data.error || 'Credit request failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request credits')
    } finally {
      setDrippingMap(prev => ({ ...prev, [address]: false }))
    }
  }

  // Load agents and their Circle wallets
  async function loadWallets() {
    if (!publicClient) return
    setGlobalLoading(true)
    try {
      // 1. Fetch all minted Agent IDs from the IdentityRegistry Transfer logs
      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock > 9900n ? latestBlock - 9900n : 0n

      const transferLogs = await publicClient.getLogs({
        address: IDENTITY_REGISTRY,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
        fromBlock,
        toBlock: latestBlock,
      })

      const uniqueIds = Array.from(new Set(transferLogs.map(log => log.args.tokenId!)))

      // 2. Fetch Circle wallets mappings from our database
      const dbRes = await fetch('/api/agent-wallet/list')
      const dbData = await dbRes.json()
      const walletsMap: Record<string, WalletDBInfo> = dbData.wallets || {}

      const list: AgentWalletDetails[] = []

      for (const id of uniqueIds) {
        const idStr = id.toString()
        const walletInfo = walletsMap[idStr] || null

        let usdcBal = '0.00'
        let gasBal = '0.0000'

        if (walletInfo && walletInfo.address) {
          try {
            // Fetch Native Gas Balance (18 decimals)
            const nativeBal = await publicClient.getBalance({
              address: walletInfo.address as `0x${string}`
            })
            gasBal = parseFloat(formatUnits(nativeBal, 18)).toFixed(4)

            // Fetch USDC Balance (6 decimals)
            const erc20Bal = await publicClient.readContract({
              address: USDC_ADDRESS_ARC,
              abi: usdcAbi,
              functionName: 'balanceOf',
              args: [walletInfo.address as `0x${string}`],
            }) as bigint
            usdcBal = parseFloat(formatUnits(erc20Bal, 6)).toFixed(2)
          } catch (err) {
            console.error(`Error fetching balances for ${walletInfo.address}:`, err)
          }
        }

        list.push({
          id: Number(id),
          name: `Provider #${idStr}`,
          walletInfo,
          usdcBalance: usdcBal,
          gasBalance: gasBal,
          loading: false
        })
      }

      setAgents(list)
    } catch (err) {
      console.error('Failed to load agent wallets:', err)
      toast.error('Failed to query agent wallets')
    } finally {
      setGlobalLoading(false)
    }
  }

  useEffect(() => {
    loadWallets()
  }, [publicClient])

  // Create wallet handler
  const handleCreateWallet = async (agentId: number) => {
    const tid = toast.loading(`Provisioning vault for Provider #${agentId}...`)
    try {
      const res = await fetch('/api/agent-wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create wallet')
      }
      toast.success(`Circle vault generated for Provider #${agentId}!`, { id: tid })
      loadWallets()
    } catch (err: any) {
      toast.error(err.message || 'Creation failed', { id: tid })
    }
  }

  // Execute manual test transaction
  const handleExecute = async (agentId: number, functionName: 'pickupJob' | 'submitResult') => {
    if (!testJobId) {
      toast.error('Specify Task ID')
      return
    }

    const key = `${agentId}-${functionName}`
    setExecutingMap(prev => ({ ...prev, [key]: true }))
    const tid = toast.loading(`Executing ${functionName === 'pickupJob' ? 'assignment' : 'completion'} proof...`)

    try {
      const args = functionName === 'pickupJob'
        ? [testJobId, agentId]
        : [testJobId, testResultHash]

      const res = await fetch('/api/agent-wallet/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          functionName,
          args
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Execution failed')
      }

      toast.success(
        <div>
          <span>Tx submitted successfully! </span>
          {data.txHash && (
            <a
              href={`https://testnet.arcscan.app/tx/${data.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#7AA2F7', textDecoration: 'underline' }}
            >
              View ↗
            </a>
          )}
        </div>,
        { id: tid, duration: 8000 }
      )
    } catch (err: any) {
      toast.error(err.message || 'Execution error', { id: tid })
    } finally {
      setExecutingMap(prev => ({ ...prev, [key]: false }))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Address copied!')
  }

  return (
    <div className="form-card" style={{ marginTop: 24, padding: 24 }}>
      <div className="form-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} style={{ color: 'var(--warp-magenta)' }} />
          <span>PROGRAMMATIC VAULTS</span>
        </div>
        <button
          onClick={loadWallets}
          disabled={globalLoading}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--warp-muted)',
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
        >
          <RefreshCw size={14} className={globalLoading ? 'spin-animation' : ''} />
        </button>
      </div>

      <div style={{ color: 'var(--warp-muted)', fontSize: 11, marginBottom: 20 }}>
        Manage secure developer-controlled smart vaults powered by Circle. Enable AI agents to perform autonomous settlements.
      </div>

      {agents.length === 0 ? (
        <div style={{ color: 'var(--warp-muted)', fontSize: 12, padding: '12px 0' }}>
          No registered security providers found. Register a provider first.
        </div>
      ) : (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Programmatic Vault (Circle)</th>
                <th>USDC Balance</th>
                <th>Gas Balance</th>
                <th>Clearance Execution Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, color: 'var(--warp-primary)' }}>#{a.id}</td>
                  <td>
                    {a.walletInfo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Wallet size={12} style={{ color: 'var(--warp-cyan)' }} />
                        <code style={{ fontSize: 11, color: 'var(--warp-text)' }}>
                          {a.walletInfo.address.slice(0, 6)}...{a.walletInfo.address.slice(-4)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(a.walletInfo!.address)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--warp-muted)', padding: 0 }}
                        >
                          <Copy size={10} />
                        </button>
                        <a
                          href={`https://testnet.arcscan.app/address/${a.walletInfo.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--warp-muted)' }}
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    ) : (
                      <button
                        className="warp-btn"
                        style={{ padding: '4px 10px', fontSize: 11, width: 'auto' }}
                        onClick={() => handleCreateWallet(a.id)}
                      >
                        Initialize Circle Vault
                      </button>
                    )}
                  </td>
                  <td>
                    {a.walletInfo ? (
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-success)' }}>
                        {a.usdcBalance} <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>USDC</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {a.walletInfo ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--warp-warning)' }}>
                          {a.gasBalance} <span style={{ fontSize: 9, color: 'var(--warp-muted)' }}>USDC</span>
                        </span>
                        <button
                          onClick={() => handleRequestFaucet(a.walletInfo!.address)}
                          disabled={drippingMap[a.walletInfo!.address]}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--warp-cyan)',
                            textDecoration: 'underline',
                            fontSize: 9,
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            marginTop: 2
                          }}
                        >
                          {drippingMap[a.walletInfo!.address] ? 'Requesting...' : 'Get Credits'}
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {a.walletInfo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="number"
                            className="warp-input"
                            placeholder="e.g. 2"
                            style={{ width: 60, padding: '3px 6px', fontSize: 11, height: 26 }}
                            value={testJobId}
                            onChange={e => setTestJobId(e.target.value)}
                          />
                        </div>
                        <button
                          className="warp-btn secondary"
                          style={{ padding: '3px 8px', fontSize: 10, height: 26, width: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleExecute(a.id, 'pickupJob')}
                          disabled={executingMap[`${a.id}-pickupJob`]}
                        >
                          <Play size={10} /> Assign
                        </button>
                        <button
                          className="warp-btn"
                          style={{ padding: '3px 8px', fontSize: 10, height: 26, width: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleExecute(a.id, 'submitResult')}
                          disabled={executingMap[`${a.id}-submitResult`]}
                        >
                          <CheckCircle size={10} /> Complete
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--warp-muted)', fontSize: 11 }}>Generate vault first</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
