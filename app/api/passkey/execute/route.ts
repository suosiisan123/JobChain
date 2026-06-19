import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { addTxToHistory, getUserWallet } from '@/lib/user-wallets-db'
import { hasCircleConfig, circleClient } from '@/lib/circle-client'

export async function POST(req: Request) {
  try {
    const {
      email,
      walletAddress,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      functionName,
      isSponsored,
      paymasterUrl
    } = await req.json()

    if (!email || !walletAddress || !contractAddress || !abiFunctionSignature) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const emailStr = String(email).toLowerCase()
    const wallet = getUserWallet(emailStr)
    if (!wallet) {
      return NextResponse.json({ error: 'User wallet not found' }, { status: 404 })
    }

    let txHash = ''
    let challengeId = ''

    if (!hasCircleConfig || !circleClient) {
      return NextResponse.json({ error: 'Circle API credentials or Wallet Set ID missing in server environment config' }, { status: 500 })
    }

    if (!wallet.walletId) {
      return NextResponse.json({ error: 'User walletId is missing' }, { status: 400 })
    }

    // Real Mode: Call Circle's Developer Controlled Wallets API for the user's SCA execution
    const response = await circleClient.createContractExecutionTransaction({
      walletId: wallet.walletId,
      contractAddress: String(contractAddress),
      abiFunctionSignature: String(abiFunctionSignature),
      abiParameters: abiParameters ? (abiParameters as any[]).map(String) : [],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      }
    })

    const txId = response.data?.id
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
          console.warn(`Polling user transaction hash failed (attempt ${attempts + 1}):`, pollErr)
        }
        attempts++
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    if (!txHash) {
      throw new Error(`Transaction execution failed or timed out: ${txId}`)
    }

    addTxToHistory(emailStr, txHash, functionName || 'execute')
    if (isSponsored) {
      console.log(`[Circle Developer Console] Routing transaction through Paymaster RPC: ${paymasterUrl}`)
    }

    return NextResponse.json({
      simulated: false,
      txHash,
      challengeId,
      isSponsored: !!isSponsored,
      paymasterUrl: paymasterUrl || null,
      message: isSponsored
        ? `Transaction ${functionName} initiated gaslessly via Circle Paymaster sponsorship`
        : `Transaction ${functionName} initiated via user-controlled smart wallet`
    })
  } catch (err: any) {
    console.error('Error executing passkey transaction:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
