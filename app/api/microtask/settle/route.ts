import { NextRequest, NextResponse } from 'next/server'
import { gatewayDb } from '@/lib/gateway-db'
import { recoverMessageAddress } from 'viem'

export async function POST(req: NextRequest) {
  try {
    const { buyer, receiver, amount, nonce, signature } = await req.json()

    if (!buyer || !receiver || !amount || !nonce || !signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // 1. Verify EIP-191 cryptographic signature
    const msg = `x402-nanopayment:${buyer.toLowerCase()}:${receiver.toLowerCase()}:${amount}:${nonce}`
    let isSignatureValid = false
    try {
      const recovered = await recoverMessageAddress({
        message: msg,
        signature: signature as `0x${string}`
      })
      isSignatureValid = (recovered.toLowerCase() === buyer.toLowerCase())
    } catch (err) {
      // Graceful support for UI simulated signatures
      if (signature.startsWith('0x_mock_')) {
        isSignatureValid = true
      }
    }

    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Invalid signature. x402 verification failed.' }, { status: 401 })
    }

    // 2. Replay Protection / Double-spend prevention
    const isNewReceipt = gatewayDb.registerReceipt({
      signature,
      nonce: String(nonce),
      amount: numericAmount,
      timestamp: Date.now()
    })

    if (!isNewReceipt) {
      return NextResponse.json({ error: 'Double-spending detected. Receipt signature replay rejected.' }, { status: 409 })
    }

    // 3. Settle balances (debit buyer, credit seller agent)
    const nextBuyerBal = gatewayDb.adjustDeposit(buyer, -numericAmount)
    const nextAgentBal = gatewayDb.adjustAgentBalance(receiver, numericAmount)

    // Generate simulated/real finality transaction hash on Arc Testnet
    const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

    return NextResponse.json({
      message: 'Settlement confirmed',
      buyerBalance: nextBuyerBal,
      agentBalance: nextAgentBal,
      txHash: mockTxHash
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
