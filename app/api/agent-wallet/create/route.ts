import { NextResponse } from 'next/server'
import { circleClient, WALLET_SET_ID, hasCircleConfig } from '@/lib/circle-client'
import { getAgentWallet, saveAgentWallet } from '@/lib/agent-wallets-db'

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json()
    if (agentId === undefined || agentId === null) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
    }

    const agentIdStr = String(agentId)

    // Check if wallet already exists
    const existing = getAgentWallet(agentIdStr)
    if (existing) {
      return NextResponse.json({
        simulated: !hasCircleConfig,
        wallet: existing
      })
    }

    if (!hasCircleConfig || !circleClient) {
      console.warn('[Circle Wallet] CIRCLE credentials or Wallet Set ID missing. Running in Simulation mode.')
      // Generate simulated mock address
      const simulatedAddress = `0x${Array.from({ length: 40 }, (_, i) => ((i + parseInt(agentIdStr)) % 16).toString(16)).join('')}`
      const walletInfo = {
        walletId: `sim_wallet_${agentIdStr}`,
        address: simulatedAddress,
        blockchain: 'ARC-TESTNET',
        createdAt: new Date().toISOString()
      }
      saveAgentWallet(agentIdStr, walletInfo)
      return NextResponse.json({
        simulated: true,
        wallet: walletInfo
      })
    }

    // Call Circle API to create wallet
    const response = await circleClient.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId: WALLET_SET_ID,
      accountType: 'SCA'
    })

    const wallet = response.data?.wallets?.[0]
    if (!wallet) {
      return NextResponse.json({ error: 'Failed to create wallet on Circle Platform' }, { status: 500 })
    }

    const walletInfo = {
      walletId: wallet.id,
      address: wallet.address,
      blockchain: 'ARC-TESTNET',
      createdAt: wallet.createDate || new Date().toISOString()
    }

    saveAgentWallet(agentIdStr, walletInfo)

    return NextResponse.json({
      simulated: false,
      wallet: walletInfo
    })
  } catch (err: any) {
    console.error('Error creating agent wallet:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
    }
    const wallet = getAgentWallet(agentId)
    return NextResponse.json({ wallet })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
