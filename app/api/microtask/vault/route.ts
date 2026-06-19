import { NextRequest, NextResponse } from 'next/server'
import { gatewayDb } from '@/lib/gateway-db'
import { circleClient, hasCircleConfig } from '@/lib/circle-client'
import { getAllAgentWallets } from '@/lib/agent-wallets-db'

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
      
      let txHash = ''
      if (hasCircleConfig && circleClient) {
        try {
          const agentWallets = getAllAgentWallets()
          let agentWalletId = ''
          for (const agentId of Object.keys(agentWallets)) {
            agentWalletId = agentWallets[agentId].walletId
            break
          }

          if (agentWalletId) {
            const transferResponse = await circleClient.createTransaction({
              walletId: agentWalletId,
              tokenAddress: '0x3600000000000000000000000000000000000000', // USDC on Arc Testnet
              destinationAddress: address,
              amount: [numAmount.toFixed(6)],
              fee: {
                type: 'level',
                config: { feeLevel: 'MEDIUM' }
              }
            })
            const txId = transferResponse.data?.id
            if (txId) {
              let attempts = 0
              while (attempts < 10) {
                const txStatus = await circleClient.getTransaction({ id: txId })
                if (txStatus.data?.transaction?.txHash) {
                  txHash = txStatus.data.transaction.txHash
                  break
                }
                attempts++
                await new Promise(r => setTimeout(r, 1000))
              }
            }
          }
        } catch (err: any) {
          console.error('[x402] On-chain earnings payout failed/skipped:', err.message)
        }
      }

      const nextBal = gatewayDb.adjustAgentBalance(address, -numAmount)
      return NextResponse.json({ 
        message: 'Earnings withdrawal successful', 
        balance: nextBal, 
        txHash: txHash || undefined 
      })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
