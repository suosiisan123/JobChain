import { NextResponse } from 'next/server'
import { getAllAgentWallets } from '@/lib/agent-wallets-db'

export async function GET() {
  try {
    const wallets = getAllAgentWallets()
    return NextResponse.json({ wallets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
