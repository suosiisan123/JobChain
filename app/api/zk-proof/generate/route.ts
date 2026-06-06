import { NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Standard development authority key (matches default Hardhat account #0)
// Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const TEST_AUTHORITY_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

export async function POST(req: Request) {
  try {
    const { type, agentId, capabilities, jobId, resultHash } = await req.json()

    const wallet = new ethers.Wallet(TEST_AUTHORITY_KEY)
    let messageHash = ''

    if (type === 'capability') {
      if (!agentId || !capabilities) {
        return NextResponse.json({ error: 'Missing agentId or capabilities' }, { status: 400 })
      }
      messageHash = ethers.solidityPackedKeccak256(
        ['uint256', 'string'],
        [Number(agentId), capabilities]
      )
    } else if (type === 'execution') {
      if (!jobId || !resultHash) {
        return NextResponse.json({ error: 'Missing jobId or resultHash' }, { status: 400 })
      }
      messageHash = ethers.solidityPackedKeccak256(
        ['uint256', 'string'],
        [Number(jobId), resultHash]
      )
    } else {
      return NextResponse.json({ error: 'Invalid attestation type' }, { status: 400 })
    }

    // Sign the raw hash. ethers signMessage adds the standard \x19Ethereum Signed Message prefix
    const signature = await wallet.signMessage(ethers.getBytes(messageHash))

    return NextResponse.json({
      type,
      messageHash,
      signature,
      signer: wallet.address,
      authorityAddress: wallet.address
    })
  } catch (err: any) {
    console.error('Error generating ZK/ECDSA attestation signature:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
