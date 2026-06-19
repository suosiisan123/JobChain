import { NextRequest, NextResponse } from 'next/server'
import { gatewayDb } from '@/lib/gateway-db'

export async function POST(req: NextRequest) {
  try {
    const paymentSignatureHeader = req.headers.get('PAYMENT-SIGNATURE')

    // 1. If payment signature is missing, return 402 Payment Required
    if (!paymentSignatureHeader) {
      const paymentReq = {
        amount: '0.000001',
        currency: 'USD',
        token: 'USDC',
        network: 'Arc Testnet',
        receiver: '0x8004B663056A597Dffe9eCcC1965A193B7388713' // Default agent/seller receiver address
      }
      const paymentReqBase64 = Buffer.from(JSON.stringify(paymentReq)).toString('base64')

      return new NextResponse(
        JSON.stringify({ error: 'Payment Required', code: 402, message: 'Microtask execution requires x402 payment.' }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'PAYMENT-REQUIRED': paymentReqBase64
          }
        }
      )
    }

    // 2. Decode the payment signature payload
    let receipt: any
    try {
      const decoded = Buffer.from(paymentSignatureHeader, 'base64').toString('utf-8')
      receipt = JSON.parse(decoded)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid PAYMENT-SIGNATURE encoding' }, { status: 400 })
    }

    const { buyer, receiver, amount, nonce, signature, sessionAddress, authSignature } = receipt
    if (!buyer || !receiver || !amount || !nonce || !signature || !sessionAddress || !authSignature) {
      return NextResponse.json({ error: 'Malformed PAYMENT-SIGNATURE payload' }, { status: 400 })
    }

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    // 3. Verify buyer's vault deposit balance
    const deposit = gatewayDb.getDeposit(buyer)
    if (deposit < numericAmount) {
      return new NextResponse(
        JSON.stringify({ error: 'Insufficient vault balance', code: 402 }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // 4. Send payment to seller gateway (/api/microtask/settle)
    const settleUrl = `${new URL(req.url).origin}/api/microtask/settle`
    const settleRes = await fetch(settleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ buyer, receiver, amount: numericAmount, nonce, signature, sessionAddress, authSignature })
    })

    const settleData = await settleRes.json()
    if (!settleRes.ok) {
      return NextResponse.json({ error: settleData.error || 'Settlement failed' }, { status: settleRes.status })
    }

    // 5. Simulate micro-job task execution (e.g. data token parsing)
    const tokenCount = Math.floor(Math.random() * 50) + 10
    const mockOutput = `Processed ${tokenCount} rows of NLP sentiment analysis successfully.`
    const responsePayload = {
      status: 'success',
      output: mockOutput,
      tokensUsed: tokenCount,
      streamedAmount: numericAmount,
      timestamp: Date.now()
    }

    const paymentResponseObj = {
      txHash: settleData.txHash || '0x_simulated_gateway_settlement',
      amount: numericAmount,
      settled: true
    }
    const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponseObj)).toString('base64')

    return new NextResponse(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-RESPONSE': paymentResponseBase64
        }
      }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
