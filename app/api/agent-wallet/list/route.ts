import { NextResponse } from 'next/server'
import { getAllAgentWallets } from '@/lib/agent-wallets-db'
import { hasCircleConfig } from '@/lib/circle-client'

export async function GET() {
  try {
    const wallets = getAllAgentWallets()
    return NextResponse.json({ 
      wallets,
      simulated: !hasCircleConfig
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

