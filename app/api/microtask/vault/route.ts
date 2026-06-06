import { NextRequest, NextResponse } from 'next/server'
import { gatewayDb } from '@/lib/gateway-db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 })
  }

  const deposit = gatewayDb.getDeposit(address)
  const earnings = gatewayDb.getAgentBalance(address)

  return NextResponse.json({
    deposit,
    earnings
  })
}

export async function POST(req: NextRequest) {
  try {
    const { address, amount, action } = await req.json()

    if (!address || !amount || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (action === 'deposit') {
      const nextBal = gatewayDb.adjustDeposit(address, numAmount)
      return NextResponse.json({ message: 'Deposit successful', balance: nextBal })
    } else if (action === 'withdraw') {
      const nextBal = gatewayDb.adjustDeposit(address, -numAmount)
      return NextResponse.json({ message: 'Withdrawal successful', balance: nextBal })
    } else if (action === 'withdraw-earnings') {
      const currentEarnings = gatewayDb.getAgentBalance(address)
      if (currentEarnings < numAmount) {
        return NextResponse.json({ error: 'Insufficient earnings balance' }, { status: 400 })
      }
      const nextBal = gatewayDb.adjustAgentBalance(address, -numAmount)
      return NextResponse.json({ message: 'Earnings withdrawal successful', balance: nextBal })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
