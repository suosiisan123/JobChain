import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, decodeFunctionData, parseAbi, hexToBigInt, getAddress, Hex } from 'viem'
import { arcTestnet } from '@/lib/arc-config'

export const dynamic = 'force-dynamic'

const SUBMIT_BATCH_ABI = parseAbi([
  'function submitBatch(bytes calldataBytes, bytes signature)'
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const txHash = searchParams.get('hash')

    if (!txHash || !txHash.startsWith('0x')) {
      return NextResponse.json({ error: 'Missing or invalid transaction hash. Must start with 0x.' }, { status: 400 })
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    })

    const tx = await client.getTransaction({ hash: txHash as `0x${string}` })
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found on Arc Testnet.' }, { status: 404 })
    }

    // Decode submitBatch function arguments
    let decoded: any
    try {
      decoded = decodeFunctionData({
        abi: SUBMIT_BATCH_ABI,
        data: tx.input
      })
    } catch (decodeErr: any) {
      return NextResponse.json({
        error: `Failed to decode transaction input. This may not be a submitBatch transaction. Error: ${decodeErr.message}`
      }, { status: 400 })
    }

    const [calldataBytesHex] = decoded.args
    const calldata = (calldataBytesHex as Hex).slice(2)

    // Helper functions to extract words
    const word = (i: number) => calldata.slice(i * 64, (i + 1) * 64)
    const addrFromWord = (i: number) => getAddress(('0x' + word(i).slice(24)) as `0x${string}`)
    const intFromWord = (i: number, signed = false) => hexToBigInt(('0x' + word(i)) as Hex, { signed })

    // Extract batch metadata
    const batchId = ('0x' + word(1)) as Hex
    const count = Number(intFromWord(5))

    // Extract balance deltas (address, int256 delta)
    const entries: { address: string; delta: string }[] = []
    for (let i = 0; i < count; i++) {
      try {
        const address = addrFromWord(6 + i * 2)
        const delta = intFromWord(7 + i * 2, true)
        entries.push({
          address,
          delta: (Number(delta) / 1e6).toFixed(6) // Convert to USDC format
        })
      } catch (entryErr) {
        console.warn('Failed to parse entry at index', i, entryErr)
      }
    }

    // Try fetching block timestamp for Circle Facilitator query
    let blockTimestamp = 0
    try {
      const block = await client.getBlock({ blockNumber: tx.blockNumber! })
      blockTimestamp = Number(block.timestamp)
    } catch (blockErr) {
      console.warn('Failed to fetch block details:', blockErr)
    }

    // Call Circle Facilitator to fetch matching settlements in that time window
    let settlements: any[] = []
    if (blockTimestamp > 0) {
      try {
        const windowStart = blockTimestamp - 300
        const windowEnd = blockTimestamp + 300
        const facilitatorRes = await fetch(
          `https://gateway-api-testnet.circle.com/v1/x402/settlements?fromTime=${windowStart}&toTime=${windowEnd}`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (facilitatorRes.ok) {
          const resJson = await facilitatorRes.json()
          settlements = resJson.settlements || []
        }
      } catch (facErr) {
        console.warn('Circle facilitator settlements API call skipped or timed out:', facErr)
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: tx.blockNumber?.toString(),
      blockTimestamp,
      batchId,
      relayer: tx.from,
      entriesCount: count,
      entries,
      settlements
    })
  } catch (err: any) {
    console.error('Error decoding batch:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
