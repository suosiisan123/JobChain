import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits } from 'viem'

const baseSepoliaRpc = 'https://sepolia.base.org'
const arbitrumSepoliaRpc = 'https://sepolia-rollup.arbitrum.io/rpc'
const arcRpc = 'https://rpc.testnet.arc.network'

const baseClient = createPublicClient({
  transport: http(baseSepoliaRpc)
})

const arbitrumClient = createPublicClient({
  transport: http(arbitrumSepoliaRpc)
})

const arcClient = createPublicClient({
  transport: http(arcRpc)
})

// USDC addresses
const BASE_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const ARBITRUM_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
const ARC_USDC = '0x3600000000000000000000000000000000000000'

const minErc20Abi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')

  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 })
  }

  try {
    const arcUSDC = arcClient.readContract({
      address: ARC_USDC,
      abi: minErc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    }).then(b => parseFloat(formatUnits(b, 6))).catch(() => 0.0)

    const baseUSDC = baseClient.readContract({
      address: BASE_USDC,
      abi: minErc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    }).then(b => parseFloat(formatUnits(b, 6))).catch(() => 0.0)

    const arbitrumUSDC = arbitrumClient.readContract({
      address: ARBITRUM_USDC,
      abi: minErc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    }).then(b => parseFloat(formatUnits(b, 6))).catch(() => 0.0)

    const [arc, base, arbitrum] = await Promise.all([arcUSDC, baseUSDC, arbitrumUSDC])
    const total = arc + base + arbitrum

    return NextResponse.json({
      address,
      balances: {
        arc,
        base,
        arbitrum,
      },
      total
    })
  } catch (err: any) {
    console.error('Error fetching unified balances:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch unified balances' }, { status: 500 })
  }
}
