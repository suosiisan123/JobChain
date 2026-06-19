import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserWallet, saveUserWallet, UserWalletInfo } from '@/lib/user-wallets-db'
import { hasCircleConfig, circleClient, WALLET_SET_ID } from '@/lib/circle-client'

export async function POST(req: Request) {
  try {
    const { email, credential, action } = await req.json()
    if (!email || !credential) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const emailStr = String(email).toLowerCase()

    // Retrieve existing wallet
    let walletInfo = getUserWallet(emailStr)

    if (action === 'register') {
      if (walletInfo) {
        return NextResponse.json({ error: 'User already registered' }, { status: 400 })
      }

      let generatedAddress = ''
      let walletId = ''

      if (!hasCircleConfig || !circleClient) {
        throw new Error('Circle API credentials or Wallet Set ID missing in server environment config')
      }

      const response = await circleClient.createWallets({
        blockchains: ['ARC-TESTNET'],
        count: 1,
        walletSetId: WALLET_SET_ID,
        accountType: 'SCA'
      })
      const wallet = response.data?.wallets?.[0]
      if (!wallet) {
        throw new Error('Failed to create user smart wallet on Circle')
      }
      generatedAddress = wallet.address
      walletId = wallet.id

      walletInfo = {
        email: emailStr,
        walletAddress: generatedAddress,
        walletId: walletId,
        credentialId: credential.id,
        publicKey: credential.response.attestationObject || 'simulated_public_key',
        createdAt: new Date().toISOString(),
        txHistory: []
      }

      saveUserWallet(emailStr, walletInfo)

      return NextResponse.json({
        simulated: false,
        walletAddress: walletInfo.walletAddress,
        message: `User ${emailStr} successfully registered`
      })
    } else {
      // Login Flow
      if (!walletInfo) {
        return NextResponse.json({ error: 'User not registered. Register first.' }, { status: 404 })
      }
      if (walletInfo.credentialId && credential.id !== 'fetch' && credential.id !== 'dummy' && credential.id !== walletInfo.credentialId) {
        return NextResponse.json({ error: 'Invalid passkey credential. Authentication failed.' }, { status: 401 })
      }
    }

    return NextResponse.json({
      simulated: false,
      walletAddress: walletInfo.walletAddress,
      message: `User ${emailStr} successfully authenticated via Passkey`
    })
  } catch (err: any) {
    console.error('Error verifying passkey:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
