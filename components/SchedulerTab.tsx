'use client'

import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Calendar, Play, RefreshCw, XCircle, Plus, Minus, DollarSign, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import {
  JOBCHAIN_CONTRACT_ADDRESS,
  USDC_ADDRESS_ARC,
  EURC_ADDRESS_ARC,
  jobChainAbi,
  usdcAbi
} from '@/lib/contracts'

interface ScheduleData {
  id: number
  poster: string
  description: string
  requiredCapabilities: string
  reward: bigint
  interval: bigint
  nextExecution: bigint
  fundedBalance: bigint
  maxExecutions: bigint
  executionsCount: bigint
  paymentToken: string
  active: boolean
}

export function SchedulerTab() {
  const { address, writeContractAsync, isConnected } = useSmartWallet()
  const publicClient = usePublicClient()
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<ScheduleData[]>([])

  // Creation form states
  const [desc, setDesc] = useState('')
  const [skills, setSkills] = useState('')
  const [reward, setReward] = useState('')
  const [intervalSec, setIntervalSec] = useState('86400') // 1 day in seconds
  const [maxExecutions, setMaxExecutions] = useState('5')
  const [paymentCurrency, setPaymentCurrency] = useState<'USDC' | 'EURC'>('USDC')

  // Replenish / Withdraw / Cancel states
  const [targetScheduleId, setTargetScheduleId] = useState('')
  const [actionAmount, setActionAmount] = useState('')

  // Read count of schedules from contract
  const { data: nextScheduleId, refetch: refetchNextScheduleId } = useReadContract({
    address: JOBCHAIN_CONTRACT_ADDRESS,
    abi: jobChainAbi,
    functionName: 'nextScheduleId',
  })

  async function fetchSchedules() {
    if (!publicClient || nextScheduleId === undefined) return
    const count = Number(nextScheduleId)
    const list: ScheduleData[] = []
    for (let i = 0; i < count; i++) {
      try {
        const d = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'getSchedule',
          args: [BigInt(i)],
        }) as unknown as any[]

        list.push({
          id: i,
          poster: d[0],
          description: d[1],
          requiredCapabilities: d[2],
          reward: d[3],
          interval: d[4],
          nextExecution: d[5],
          fundedBalance: d[6],
          maxExecutions: d[7],
          executionsCount: d[8],
          paymentToken: d[9],
          active: d[10]
        })
      } catch (err) {
        console.error(`Failed to fetch schedule ${i}:`, err)
      }
    }
    setSchedules(list)
  }

  useEffect(() => {
    fetchSchedules()
  }, [publicClient, nextScheduleId])

  const txToast = async (label: string, fn: () => Promise<string>) => {
    setLoading(true)
    const tid = toast.loading(label)
    try {
      const hash = await fn()
      toast.success(
        <span>Done! <a href={`https://testnet.arcscan.app/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#7AA2F7',textDecoration:'underline'}}>View ↗</a></span>,
        { id: tid, duration: 6000 }
      )
      await refetchNextScheduleId()
      await fetchSchedules()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSchedule = () => txToast('Registering recurring schedule...', async () => {
    const tokenAddress = paymentCurrency === 'USDC' ? USDC_ADDRESS_ARC : EURC_ADDRESS_ARC
    const rewardVal = parseUnits(reward, 6)
    const executionsVal = BigInt(maxExecutions)
    const totalBudget = rewardVal * executionsVal
    const intervalVal = BigInt(intervalSec)

    // Approve contract to pull total budget
    await writeContractAsync({
      address: tokenAddress,
      abi: usdcAbi,
      functionName: 'approve',
      args: [JOBCHAIN_CONTRACT_ADDRESS, totalBudget]
    })

    // Register schedule
    const hash = await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'registerSchedule',
      args: [desc, skills, intervalVal, rewardVal, executionsVal, tokenAddress]
    })

    setDesc('')
    setSkills('')
    setReward('')
    return hash
  })

  const handleExecuteSchedule = (id: number) => txToast('Executing schedule job...', async () => {
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'executeScheduledJob',
      args: [BigInt(id)]
    })
  })

  const handleCancelSchedule = (id: number) => txToast('Cancelling schedule...', async () => {
    return await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'cancelSchedule',
      args: [BigInt(id)]
    })
  })

  const handleReplenish = () => txToast('Replenishing schedule budget...', async () => {
    const sId = BigInt(targetScheduleId)
    const sched = schedules.find(s => s.id === Number(sId))
    if (!sched) throw new Error('Schedule not found')

    const tokenAddress = sched.paymentToken as `0x${string}`
    const amountVal = parseUnits(actionAmount, 6)

    await writeContractAsync({
      address: tokenAddress,
      abi: usdcAbi,
      functionName: 'approve',
      args: [JOBCHAIN_CONTRACT_ADDRESS, amountVal]
    })

    const hash = await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'replenishSchedule',
      args: [sId, amountVal]
    })

    setTargetScheduleId('')
    setActionAmount('')
    return hash
  })

  const handleWithdraw = () => txToast('Withdrawing from schedule budget...', async () => {
    const sId = BigInt(targetScheduleId)
    const amountVal = parseUnits(actionAmount, 6)

    const hash = await writeContractAsync({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'withdrawSchedule',
      args: [sId, amountVal]
    })

    setTargetScheduleId('')
    setActionAmount('')
    return hash
  })

  return (
    <div style={{ padding: 24, background: '#10121B', minHeight: '100vh', color: '#C0CAF5', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--warp-warning)', textTransform: 'uppercase', letterSpacing: 1 }}>
            ⏰ Recurring CRON Job Automation
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--warp-muted)', fontSize: 12 }}>
            Register schedule retainer templates to automatically stream recurring jobs via keepers.
          </p>
        </div>
        <button
          onClick={() => { refetchNextScheduleId(); fetchSchedules() }}
          className="warp-btn secondary"
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh Queue
        </button>
      </div>

      {/* Grid Layout: Form and Top Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Create Schedule Card */}
        <div className="form-card" style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div className="form-title" style={{ color: 'var(--warp-warning)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} /> Register Job Schedule
          </div>
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label className="field-label" style={{ color: 'var(--warp-cyan)', display: 'block', fontSize: 10, marginBottom: 4 }}>DESCRIPTION</label>
            <input
              className="warp-input"
              style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
              placeholder="e.g. Daily system security audit report"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label className="field-label" style={{ color: 'var(--warp-magenta)', display: 'block', fontSize: 10, marginBottom: 4 }}>REQUIRED SKILLS</label>
            <input
              className="warp-input"
              style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
              placeholder="e.g. rust, audit, solidity"
              value={skills}
              onChange={e => setSkills(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-success)', display: 'block', fontSize: 10, marginBottom: 4 }}>REWARD PER RUN</label>
              <input
                className="warp-input"
                style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
                placeholder="5.00"
                value={reward}
                onChange={e => setReward(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-warning)', display: 'block', fontSize: 10, marginBottom: 4 }}>INTERVAL (SECONDS)</label>
              <select
                className="warp-input"
                style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
                value={intervalSec}
                onChange={e => setIntervalSec(e.target.value)}
              >
                <option value="60">1 Minute (Test Mode)</option>
                <option value="3600">1 Hour</option>
                <option value="86400">1 Day (Daily)</option>
                <option value="604800">1 Week (Weekly)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-cyan)', display: 'block', fontSize: 10, marginBottom: 4 }}>MAX RUNS (PRE-FUND)</label>
              <input
                className="warp-input"
                style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
                type="number"
                value={maxExecutions}
                onChange={e => setMaxExecutions(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="field-label" style={{ color: 'var(--warp-magenta)', display: 'block', fontSize: 10, marginBottom: 4 }}>CURRENCY</label>
              <select
                className="warp-input"
                style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
                value={paymentCurrency}
                onChange={e => setPaymentCurrency(e.target.value as 'USDC' | 'EURC')}
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
            </div>
          </div>
          <button
            className="warp-btn"
            style={{ width: '100%', padding: 12, background: 'var(--warp-warning)', color: '#000', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
            disabled={!isConnected || loading || !desc || !reward}
            onClick={handleRegisterSchedule}
          >
            Create &amp; Pre-Fund Schedule
          </button>
        </div>

        {/* Replenish & Withdraw Card */}
        <div className="form-card" style={{ background: '#1A1B26', border: '1px solid #292E42', padding: 20, borderRadius: 8 }}>
          <div className="form-title" style={{ color: 'var(--warp-cyan)', fontSize: 14, fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={16} /> Budget Management
          </div>
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label className="field-label" style={{ color: 'var(--warp-cyan)', display: 'block', fontSize: 10, marginBottom: 4 }}>SCHEDULE_ID</label>
            <input
              className="warp-input"
              style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
              placeholder="e.g. 0"
              value={targetScheduleId}
              onChange={e => setTargetScheduleId(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ marginBottom: 16 }}>
            <label className="field-label" style={{ color: 'var(--warp-success)', display: 'block', fontSize: 10, marginBottom: 4 }}>AMOUNT (USDC / EURC)</label>
            <input
              className="warp-input"
              style={{ width: '100%', padding: 10, background: '#10121B', border: '1px solid #292E42', borderRadius: 4, color: '#C0CAF5' }}
              placeholder="10.00"
              value={actionAmount}
              onChange={e => setActionAmount(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="warp-btn"
              style={{ flex: 1, padding: 10, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--warp-success)', color: 'var(--warp-success)', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
              disabled={!isConnected || loading || !targetScheduleId || !actionAmount}
              onClick={handleReplenish}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Replenish
            </button>
            <button
              className="warp-btn"
              style={{ flex: 1, padding: 10, background: 'rgba(245, 158, 11, 0.2)', border: '1px solid var(--warp-warning)', color: 'var(--warp-warning)', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
              disabled={!isConnected || loading || !targetScheduleId || !actionAmount}
              onClick={handleWithdraw}
            >
              <Minus size={14} style={{ marginRight: 4 }} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Schedules Queue */}
      <div style={{ background: '#1A1B26', border: '1px solid #292E42', borderRadius: 8, padding: 20 }}>
        <div style={{ color: 'var(--warp-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} /> ACTIVE SCHEDULE RETAINERS
        </div>

        {schedules.length === 0 ? (
          <div style={{ color: 'var(--warp-muted)', textAlign: 'center', padding: '24px 0' }}>No active CRON schedules registered yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #292E42', color: 'var(--warp-muted)', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>ID</th>
                  <th style={{ padding: 10 }}>DESCRIPTION</th>
                  <th style={{ padding: 10 }}>SKILLS</th>
                  <th style={{ padding: 10 }}>REWARD</th>
                  <th style={{ padding: 10 }}>INTERVAL</th>
                  <th style={{ padding: 10 }}>NEXT EXECUTION</th>
                  <th style={{ padding: 10 }}>BUDGET</th>
                  <th style={{ padding: 10 }}>RUNS</th>
                  <th style={{ padding: 10 }}>TOKEN</th>
                  <th style={{ padding: 10 }}>STATUS</th>
                  <th style={{ padding: 10 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => {
                  const tokenSymbol = s.paymentToken.toLowerCase() === USDC_ADDRESS_ARC.toLowerCase() ? 'USDC' : 'EURC'
                  const isReady = Date.now() / 1000 >= Number(s.nextExecution)
                  const remainingSecs = Math.max(0, Number(s.nextExecution) - Math.floor(Date.now() / 1000))

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #1f2335' }}>
                      <td style={{ padding: 10, color: 'var(--warp-cyan)', fontWeight: 'bold' }}>{s.id}</td>
                      <td style={{ padding: 10 }}>{s.description}</td>
                      <td style={{ padding: 10 }}>{s.requiredCapabilities}</td>
                      <td style={{ padding: 10, color: 'var(--warp-success)' }}>{formatUnits(s.reward, 6)} {tokenSymbol}</td>
                      <td style={{ padding: 10 }}>{Number(s.interval)}s</td>
                      <td style={{ padding: 10, color: isReady ? 'var(--warp-success)' : 'var(--warp-warning)' }}>
                        {isReady ? 'Ready for Trigger' : `${remainingSecs}s left`}
                      </td>
                      <td style={{ padding: 10, color: 'var(--warp-cyan)' }}>{formatUnits(s.fundedBalance, 6)} {tokenSymbol}</td>
                      <td style={{ padding: 10 }}>{Number(s.executionsCount)} / {Number(s.maxExecutions)}</td>
                      <td style={{ padding: 10, fontSize: 10, color: 'var(--warp-muted)' }}>{s.paymentToken.slice(0, 6)}...{s.paymentToken.slice(-4)}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 'bold',
                          background: s.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: s.active ? 'var(--warp-success)' : 'var(--warp-error)'
                        }}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleExecuteSchedule(s.id)}
                            style={{
                              fontSize: 9,
                              background: isReady && s.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${isReady && s.active ? 'var(--warp-success)' : 'var(--warp-muted)'}`,
                              color: isReady && s.active ? 'var(--warp-success)' : 'var(--warp-muted)',
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: isReady && s.active ? 'pointer' : 'not-allowed',
                              fontWeight: 'bold'
                            }}
                            disabled={!isReady || !s.active || loading}
                          >
                            <Play size={10} style={{ marginRight: 2 }} /> Trigger
                          </button>
                          <button
                            onClick={() => handleCancelSchedule(s.id)}
                            style={{
                              fontSize: 9,
                              background: s.active ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${s.active ? 'var(--warp-error)' : 'var(--warp-muted)'}`,
                              color: s.active ? 'var(--warp-error)' : 'var(--warp-muted)',
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: s.active ? 'pointer' : 'not-allowed',
                              fontWeight: 'bold'
                            }}
                            disabled={!s.active || loading}
                          >
                            <XCircle size={10} style={{ marginRight: 2 }} /> Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
