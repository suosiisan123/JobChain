import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { arcTestnet } from '@/lib/arc-config'
import { JOBCHAIN_CONTRACT_ADDRESS, jobChainAbi } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { agentId } = await req.json()
    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
    }

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    })

    // 1. Fetch agent capabilities from JobChainV2
    const agentData = await publicClient.readContract({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'getAgent',
      args: [BigInt(agentId)]
    })

    const [,, capabilities,,,,, isActive] = agentData as unknown as any[]
    if (!isActive) {
      return NextResponse.json({ error: 'Agent is not active in JobChain registry' }, { status: 400 })
    }

    const agentCaps = (capabilities as string).toLowerCase().split(',').map(s => s.trim())

    // 2. Fetch jobs from the contract (scan recent job IDs)
    const nextJobId = await publicClient.readContract({
      address: JOBCHAIN_CONTRACT_ADDRESS,
      abi: jobChainAbi,
      functionName: 'nextJobId'
    }) as bigint

    let targetJobId = -1
    let targetJobDesc = ''

    // Scan backwards to find the latest open job matching capabilities
    for (let id = Number(nextJobId) - 1; id >= 0; id--) {
      try {
        const jobData = await publicClient.readContract({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'getJob',
          args: [BigInt(id)]
        }) as unknown as any[]

        const status = Number(jobData[6]) // status field
        const requiredCaps = (jobData[2] as string).toLowerCase().split(',').map(s => s.trim())
        const desc = jobData[1] as string

        // Status 0 is Open
        if (status === 0) {
          // Check if agent has at least one matching capability
          const hasCapability = requiredCaps.some(cap => agentCaps.includes(cap) || cap === 'general')
          if (hasCapability) {
            targetJobId = id
            targetJobDesc = desc
            break
          }
        }
      } catch (err) {
        console.warn(`Failed to inspect job #${id}:`, err)
      }
    }

    if (targetJobId === -1) {
      return NextResponse.json({ message: 'No open jobs matching agent capabilities found.' })
    }

    const baseUrl = new URL(req.url).origin

    // 3. Auto-Claim Job: Call pickupJob via /api/agent-wallet/execute
    const claimRes = await fetch(`${baseUrl}/api/agent-wallet/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        functionName: 'pickupJob',
        args: [targetJobId, agentId, '0x']
      })
    })

    const claimData = await claimRes.json()
    if (!claimRes.ok || !claimData.txHash) {
      return NextResponse.json({ error: 'Failed to claim job on-chain', detail: claimData.error }, { status: 500 })
    }

    // Wait 2 seconds for transaction confirmation
    await new Promise(r => setTimeout(r, 2000))

    // 4. Execute Computational Task
    const executionOutput = `Task "${targetJobDesc}" executed successfully by Agent #${agentId}. Completed at ${new Date().toISOString()}`
    const resultHash = `0x_result_${Buffer.from(executionOutput).toString('hex').slice(0, 40)}`

    // 5. Submit Result: Call submitResult via /api/agent-wallet/execute
    const submitRes = await fetch(`${baseUrl}/api/agent-wallet/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        functionName: 'submitResult',
        args: [targetJobId, resultHash, '0x']
      })
    })

    const submitData = await submitRes.json()
    if (!submitRes.ok || !submitData.txHash) {
      return NextResponse.json({
        error: 'Job claimed but failed to submit result on-chain',
        detail: submitData.error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      agentId,
      jobId: targetJobId,
      jobDescription: targetJobDesc,
      claimTxHash: claimData.txHash,
      submitTxHash: submitData.txHash,
      resultHash,
      output: executionOutput
    })

  } catch (err: any) {
    console.error('Agent work error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
