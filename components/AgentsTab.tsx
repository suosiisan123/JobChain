'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits } from 'viem'
import { UserPlus, Shield, Zap } from 'lucide-react'
import { JOBCHAIN_CONTRACT_ADDRESS, USDC_ADDRESS_ARC, jobChainAbi, usdcAbi } from '@/lib/contracts'

export function AgentsTab() {
  const { address, isConnected } = useAccount()
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [stakeAgentId, setStakeAgentId] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [output, setOutput] = useState<string[]>([])

  const { writeContractAsync } = useWriteContract()

  const { data: nextAgentId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS,
    abi: jobChainAbi,
    functionName: 'nextAgentId',
  })

  const addLog = (msg: string) => setOutput(prev => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`])

  const handleRegister = async () => {
    if (!isConnected || !name || !capabilities) {
      addLog('ERROR: Connect wallet and fill all fields')
      return
    }
    try {
      addLog(`> registerAgent("${name}", "${capabilities}")`)
      const hash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS,
        abi: jobChainAbi,
        functionName: 'registerAgent',
        args: [name, capabilities],
      })
      addLog(`TX: ${hash}`)
      addLog('SUCCESS: Agent registered ✓')
      setName('')
      setCapabilities('')
    } catch (err: any) {
      addLog(`ERROR: ${err?.shortMessage || err?.message || 'Failed'}`)
    }
  }

  const handleStake = async () => {
    if (!isConnected || !stakeAgentId || !stakeAmount) {
      addLog('ERROR: Fill agent ID and stake amount')
      return
    }
    try {
      const amount = parseUnits(stakeAmount, 6) // USDC = 6 decimals
      addLog(`> Approving ${stakeAmount} USDC for escrow...`)
      
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS_ARC,
        abi: usdcAbi,
        functionName: 'approve',
        args: [JOBCHAIN_CONTRACT_ADDRESS, amount],
      })
      addLog(`Approve TX: ${approveHash}`)

      addLog(`> stakeCollateral(agentId=${stakeAgentId}, amount=${stakeAmount} USDC)`)
      const stakeHash = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS,
        abi: jobChainAbi,
        functionName: 'stakeCollateral',
        args: [BigInt(stakeAgentId), amount],
      })
      addLog(`Stake TX: ${stakeHash}`)
      addLog('SUCCESS: Collateral staked ✓')
      setStakeAmount('')
    } catch (err: any) {
      addLog(`ERROR: ${err?.shortMessage || err?.message || 'Failed'}`)
    }
  }

  return (
    <div>
      <div className="prompt-line">
        <span style={{ color: 'var(--warp-success)' }}>➜</span>
        <span style={{ color: 'var(--warp-cyan)' }}>~/agent-registry</span>
        <span style={{ color: 'var(--warp-text)' }}> ./manage-agents</span>
      </div>
      <div className="prompt-output" style={{ color: 'var(--warp-muted)', marginBottom: 24 }}>
        ERC-8004 Agent Identity — Register, Stake, Build Reputation
        <br />Total Registered: {nextAgentId?.toString() || '0'} agents
      </div>

      <div className="form-grid">
        {/* Register Agent */}
        <div className="form-card">
          <div className="form-title"><UserPlus size={16} /> Register New Agent</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-magenta)' }}>AGENT_NAME</label>
            <input className="warp-input" placeholder="GPT-Analyzer" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-warning)' }}>CAPABILITIES (comma-separated)</label>
            <input className="warp-input" placeholder="nlp,sentiment,summarize" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
          </div>
          <button className="warp-btn" onClick={handleRegister} disabled={!isConnected}>
            <UserPlus size={14} /> Register Agent (ERC-8004)
          </button>
        </div>

        {/* Stake Collateral */}
        <div className="form-card">
          <div className="form-title"><Shield size={16} /> Stake Collateral</div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-cyan)' }}>AGENT_ID</label>
            <input className="warp-input" placeholder="0" type="number" value={stakeAgentId} onChange={e => setStakeAgentId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="field-label" style={{ color: 'var(--warp-success)' }}>STAKE_AMOUNT_USDC</label>
            <input className="warp-input" placeholder="5.00" type="number" step="0.01" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} />
          </div>
          <button className="warp-btn secondary" onClick={handleStake} disabled={!isConnected}>
            <Shield size={14} /> Stake USDC Collateral
          </button>
        </div>
      </div>

      {/* Output Log */}
      {output.length > 0 && (
        <div className="output-log">
          <div style={{ color: 'var(--warp-muted)', fontSize: 12, marginBottom: 8 }}>STDOUT:</div>
          {output.map((line, i) => (
            <div key={i} style={{ color: line.includes('ERROR') ? 'var(--warp-error)' : line.includes('SUCCESS') ? 'var(--warp-success)' : 'var(--warp-text)', fontSize: 13 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
