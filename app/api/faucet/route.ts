import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { address } = await req.json()
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing in environment' }, { status: 500 })
    }

    console.log(`[Circle Faucet] Requesting Arc Testnet drip for address: ${address}`)
    const response = await fetch('https://api.circle.com/v1/faucet/drips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        address,
        blockchain: 'ARC-TESTNET',
        native: true,
        usdc: true,
        eurc: false
      })
    })

    if (response.status === 204) {
      return NextResponse.json({
        success: true,
        message: `Successfully requested testnet tokens for ${address}. They will arrive shortly.`
      })
    }

    const errorText = await response.text()
    let errorMessage = 'Faucet request failed'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.message || errorMessage
    } catch {
      if (errorText) errorMessage = errorText
    }

    console.error(`[Circle Faucet] Request failed with status ${response.status}: ${errorMessage}`)
    return NextResponse.json({ error: errorMessage }, { status: response.status })
  } catch (err: any) {
    console.error('Error in faucet endpoint:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
