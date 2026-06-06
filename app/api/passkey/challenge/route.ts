import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserWallet } from '@/lib/user-wallets-db'

// Temporary in-memory challenge store mapped to emails
const challengeStore = new Map<string, string>()

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailStr = String(email).toLowerCase()
    const existing = getUserWallet(emailStr)

    // Generate random 32-byte challenge
    const challengeBytes = crypto.randomBytes(32)
    const challengeBase64 = challengeBytes.toString('base64')

    // Store challenge
    challengeStore.set(emailStr, challengeBase64)

    // Generate deterministic userId based on email
    const userId = crypto.createHash('sha256').update(emailStr).digest('hex')

    return NextResponse.json({
      challenge: challengeBase64,
      userId,
      userExists: !!existing
    })
  } catch (err: any) {
    console.error('Error generating passkey challenge:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
