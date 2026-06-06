import { NextResponse } from 'next/server'
import { circleClient, hasCircleConfig } from '@/lib/circle-client'
import { getAgentWallet } from '@/lib/agent-wallets-db'
import { JOBCHAIN_CONTRACT_ADDRESS } from '@/lib/contracts'

export async function POST(req: Request) {
  try {
    const { agentId, functionName, args } = await req.json()
    if (!agentId || !functionName || !args) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const agentIdStr = String(agentId)
    const agentWallet = getAgentWallet(agentIdStr)
    if (!agentWallet) {
      return NextResponse.json({ error: `No wallet found for agent ID ${agentIdStr}` }, { status: 404 })
    }

    let abiFunctionSignature = ''
    let abiParameters: string[] = []

    if (functionName === 'pickupJob') {
      abiFunctionSignature = 'pickupJob(uint256,uint256,bytes)'
      abiParameters = [String(args[0]), String(args[1]), String(args[2] || '0x')]
    } else if (functionName === 'submitResult') {
      abiFunctionSignature = 'submitResult(uint256,string,bytes)'
      abiParameters = [String(args[0]), String(args[1]), String(args[2] || '0x')]
    } else {
      return NextResponse.json({ error: `Unsupported function name: ${functionName}` }, { status: 400 })
    }

    if (!hasCircleConfig || !circleClient) {
      console.warn('[Circle Wallet] CIRCLE config is missing. Simulating contract execution.')
      const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
      return NextResponse.json({
        simulated: true,
        txHash: mockTxHash,
        message: `Simulated transaction ${functionName} for agent #${agentIdStr}`
      })
    }

    const response = await circleClient.createContractExecutionTransaction({
      walletId: agentWallet.walletId,
      contractAddress: JOBCHAIN_CONTRACT_ADDRESS,
      abiFunctionSignature,
      abiParameters,
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      }
    })

    const txId = response.data?.id
    let txHash = ''

    if (txId) {
      let attempts = 0
      const maxAttempts = 15
      const delayMs = 1000

      while (attempts < maxAttempts) {
        try {
          const txStatus = await circleClient.getTransaction({ id: txId })
          const txObj = txStatus.data?.transaction
          if (txObj?.txHash) {
            txHash = txObj.txHash
            break
          }
          if (txObj?.state === 'FAILED' || txObj?.state === 'CANCELLED' || txObj?.state === 'DENIED') {
            break
          }
        } catch (pollErr) {
          console.warn(`Polling transaction hash failed (attempt ${attempts + 1}):`, pollErr)
        }
        attempts++
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    return NextResponse.json({
      simulated: false,
      txId,
      txHash,
      message: `Transaction initiated via Circle: ID ${txId}`
    })
  } catch (err: any) {
    console.error('Error executing contract transaction:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
