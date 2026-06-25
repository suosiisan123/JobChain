import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const PROVIDER_URL = 'https://rpc.testnet.arc.network'
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)'
]

export async function POST(req: NextRequest) {
  try {
    const { txHash, recipient, tokenIn, tokenOut, amount } = await req.json()

    if (!recipient || !tokenIn || !tokenOut || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      return NextResponse.json({ error: 'Private key is missing in server environment' }, { status: 500 })
    }

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL)
    const wallet = new ethers.Wallet(privateKey, provider)

    // 1. Fetch live rate from Coinbase
    let finalRate = 1.0825
    try {
      const coinBaseRes = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=EUR')
      if (coinBaseRes.ok) {
        const coinBaseData = await coinBaseRes.json()
        const usdcRate = coinBaseData?.data?.rates?.USDC || coinBaseData?.data?.rates?.USD
        if (usdcRate) {
          finalRate = parseFloat(usdcRate)
        }
      }
    } catch (e) {
      console.warn('[Swap API] Live rate fetch failed, using fallback:', e)
    }

    const isEurcToUsdc = tokenIn.toUpperCase() === 'EURC'
    const rate = isEurcToUsdc ? finalRate : 1 / finalRate

    const outAmount = parseFloat(amount) * rate
    // Both USDC and EURC have 6 decimals
    const outAmountUnits = ethers.parseUnits(outAmount.toFixed(6), 6)

    const tokenOutAddress = tokenOut.toUpperCase() === 'USDC' ? USDC_ADDRESS : EURC_ADDRESS
    const tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_ABI, wallet)

    // 2. Validate user's input transfer on-chain if txHash is provided
    if (txHash) {
      try {
        console.log(`[Swap API] Validating transaction ${txHash}...`)
        const receipt = await provider.getTransactionReceipt(txHash)
        if (!receipt || receipt.status !== 1) {
          return NextResponse.json({ error: 'Transaction not found or reverted' }, { status: 400 })
        }
      } catch (err) {
        console.warn('[Swap API] Error validating receipt on-chain:', err)
      }
    }

    // Check balance of tokenOut in deployer wallet
    const deployerBal = await tokenOutContract.balanceOf(wallet.address)
    if (deployerBal < outAmountUnits) {
      return NextResponse.json({
        error: `Deployer wallet has insufficient ${tokenOut} balance (needed ${ethers.formatUnits(outAmountUnits, 6)}, has ${ethers.formatUnits(deployerBal, 6)}). Please deposit to deployer.`
      }, { status: 400 })
    }

    // 3. Execute transfer of tokenOut to recipient
    console.log(`[Swap API] Transferring ${ethers.formatUnits(outAmountUnits, 6)} ${tokenOut} to ${recipient}...`)
    const tx = await tokenOutContract.transfer(recipient, outAmountUnits)
    await tx.wait()

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      rate,
      amountOut: outAmount.toFixed(6),
      message: `Successfully swapped ${amount} ${tokenIn} for ${outAmount.toFixed(6)} ${tokenOut}`
    })

  } catch (err: any) {
    console.error('[Swap API] Error in swap route:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
