import { NextResponse } from 'next/server'
import { circleClient, hasCircleConfig } from '@/lib/circle-client'
import { getAgentWallet } from '@/lib/agent-wallets-db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const walletId = searchParams.get('walletId')
    const agentId = searchParams.get('agentId')

    let activeWalletId = walletId

    if (agentId) {
      const agentWallet = getAgentWallet(agentId)
      if (agentWallet) {
        activeWalletId = agentWallet.walletId
      }
    }

    if (!activeWalletId) {
      return NextResponse.json({ error: 'Missing walletId or agentId' }, { status: 400 })
    }

    if (!hasCircleConfig || !circleClient) {
      // Return simulated balances if Circle API config is not present
      return NextResponse.json({
        simulated: true,
        tokenBalances: [
          {
            token: {
              id: 'usdc-token-id',
              blockchain: 'ARC-TESTNET',
              name: 'USD Coin',
              symbol: 'USDC',
              decimals: 6,
              isNative: false,
            },
            amount: '500.00',
            updateDate: new Date().toISOString()
          },
          {
            token: {
              id: 'native-token-id',
              blockchain: 'ARC-TESTNET',
              name: 'USDC Gas Token',
              symbol: 'USDC',
              decimals: 18,
              isNative: true,
            },
            amount: '125.50',
            updateDate: new Date().toISOString()
          }
        ]
      })
    }

    const response = await circleClient.getWalletTokenBalance({
      id: activeWalletId,
      includeAll: true,
    })

    const tokenBalances = response.data?.tokenBalances || []

    return NextResponse.json({
      simulated: false,
      tokenBalances,
    })
  } catch (err: any) {
    console.error('Error fetching wallet balance:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
