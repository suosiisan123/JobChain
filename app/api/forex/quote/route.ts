import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const base = searchParams.get('base') || 'EURC'
    const target = searchParams.get('target') || 'USDC'

    // Fetch real-time EUR exchange rates from Coinbase API
    let finalRate = 1.0825
    try {
      const coinBaseRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 30 } // cache for 30s
      })
      if (coinBaseRes.ok) {
        const coinBaseData = await coinBaseRes.json()
        const usdcRate = coinBaseData?.data?.rates?.USDC || coinBaseData?.data?.rates?.USD
        if (usdcRate) {
          finalRate = parseFloat(usdcRate)
        }
      }
    } catch (e) {
      console.warn('[Forex API] Failed to fetch live Coinbase quote, using fallback:', e)
    }

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
