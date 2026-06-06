import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const base = searchParams.get('base') || 'EURC'
    const target = searchParams.get('target') || 'USDC'

    // Mock StableFX exchange rate telemetry
    // 1 EURC is approximately 1.0825 USDC
    const baseEurcRate = 1.0825
    const fluctuation = (Math.random() - 0.5) * 0.002 // minor telemetry updates
    const finalRate = baseEurcRate + fluctuation

    const rate = base.toUpperCase() === 'EURC' ? finalRate : 1 / finalRate
    const bid = rate * 0.9998
    const ask = rate * 1.0002
    const slippage = 0.001 // 0.1% estimated slippage

    return NextResponse.json({
      base: base.toUpperCase(),
      target: target.toUpperCase(),
      rate: parseFloat(rate.toFixed(6)),
      bid: parseFloat(bid.toFixed(6)),
      ask: parseFloat(ask.toFixed(6)),
      slippage,
      timestamp: Date.now()
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
