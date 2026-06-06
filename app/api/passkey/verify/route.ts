import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserWallet, saveUserWallet, UserWalletInfo } from '@/lib/user-wallets-db'
import { hasCircleConfig } from '@/lib/circle-client'

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

      // Generate a deterministic address for user's SCA on Arc Testnet in simulated/faucet mode
      const emailHash = crypto.createHash('sha256').update(emailStr).digest('hex')
      // Ensure the generated address is a valid hex format
      const generatedAddress = `0x${emailHash.substring(0, 40)}`

      walletInfo = {
        email: emailStr,
        walletAddress: generatedAddress,
        walletId: `sca_wallet_${emailHash.substring(0, 8)}`,
        credentialId: credential.id,
        publicKey: credential.response.attestationObject || 'simulated_public_key',
        createdAt: new Date().toISOString(),
        txHistory: []
      }

      saveUserWallet(emailStr, walletInfo)
    } else {
      // Login Flow
      if (!walletInfo) {
        return NextResponse.json({ error: 'User not registered. Register first.' }, { status: 404 })
      }
      // In a real implementation, WebAuthn signature would be validated here.
      // We simulate successful verification for demonstration.
    }

    return NextResponse.json({
      simulated: !hasCircleConfig,
      walletAddress: walletInfo.walletAddress,
      message: `User ${emailStr} successfully authenticated via Passkey`
    })
  } catch (err: any) {
    console.error('Error verifying passkey:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
