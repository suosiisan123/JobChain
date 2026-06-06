import { NextResponse } from 'next/server'
import { getSponsorCount, addSponsorRecord } from '@/lib/gas-sponsor-db'

const WHITELISTED_FUNCTIONS = ['register', 'registerAgent', 'stakeCollateral']

export async function POST(req: Request) {
  try {
    const { userAddress, functionName, contractAddress, recaptchaToken, githubUser } = await req.json()

    if (!userAddress || !functionName || !contractAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Check whitelisted functions
    if (!WHITELISTED_FUNCTIONS.includes(functionName)) {
      return NextResponse.json({
        eligible: false,
        reason: `Function '${functionName}' is not eligible for gas sponsorship.`
      }, { status: 400 })
    }

    // 2. Determine Client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'

    // 3. Check sponsor limit (max 3 per IP or address)
    const count = getSponsorCount(userAddress, ip)
    if (count >= 3) {
      return NextResponse.json({
        eligible: false,
        reason: 'Sponsorship limit reached (max 3 sponsored transactions per user/IP).'
      }, { status: 403 })
    }

    // 4. (Optional) Validate recaptcha / OAuth if present
    if (recaptchaToken && recaptchaToken === 'error_token') {
      return NextResponse.json({
        eligible: false,
        reason: 'Security verification failed (Recaptcha invalid).'
      }, { status: 400 })
    }

    // 5. If eligible, record the sponsorship event
    addSponsorRecord(userAddress, ip, functionName)

    // Paymaster RPC Url setup: default to Circle's Arc Testnet paymaster URL if configured, or a sandbox simulator URL
    const paymasterUrl = process.env.CIRCLE_PAYMASTER_RPC_URL || 'https://paymaster.circle.com/v1/arc-testnet/sponsored'

    return NextResponse.json({
      eligible: true,
      paymasterUrl,
      txCount: count + 1,
      message: 'Transaction is eligible for gas sponsorship!'
    })
  } catch (err: any) {
    console.error('Error in gas-sponsor validate API:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
