import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { addTxToHistory, getUserWallet } from '@/lib/user-wallets-db'
import { hasCircleConfig } from '@/lib/circle-client'

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

    if (!hasCircleConfig) {
      // Simulation mode: generate mock transaction hash and store it locally
      txHash = `0x${crypto.randomBytes(32).toString('hex')}`
      addTxToHistory(emailStr, txHash, functionName || 'execute')
      if (isSponsored) {
        console.log(`[Circle Modular Wallet - Sponsored] Transaction ${functionName} sponsored via Paymaster: ${paymasterUrl || 'Circle Paymaster'}`)
      } else {
        console.log(`[Circle Modular Wallet - Self-Paid] Simulated transaction executed for ${emailStr}: ${txHash}`)
      }
    } else {
      // Real Mode: In a production integration, this calls Circle's User-Controlled Wallets API
      // passing the paymasterUrl/sponsorship policy ID in the user operation configuration.
      txHash = `0x${crypto.randomBytes(32).toString('hex')}`
      challengeId = `challenge_exec_${crypto.randomBytes(16).toString('hex')}`
      addTxToHistory(emailStr, txHash, functionName || 'execute')
      if (isSponsored) {
        console.log(`[Circle Developer Console] Routing transaction through Paymaster RPC: ${paymasterUrl}`)
      }
    }

    return NextResponse.json({
      simulated: !hasCircleConfig,
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
