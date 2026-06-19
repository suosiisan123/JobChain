import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from '@/lib/arc-config'
import { JOBCHAIN_CONTRACT_ADDRESS, USDC_ADDRESS_ARC, jobChainAbi, usdcAbi } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { prompt, defaultReward = '1.0' } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      return NextResponse.json({ error: 'Server private key missing in environment config' }, { status: 500 })
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`)
    
    // Set up viem clients
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    })

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    })

    // 1. Decompose task (rule-based NLP parser with fallback to OpenAI if API key is provided)
    let subtasks: { description: string; requiredCapabilities: string; reward: string }[] = []

    const openAiKey = process.env.OPENAI_API_KEY
    if (openAiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an AI Manager Agent for JobChain. Decompose the user's objective into 1 to 3 distinct sub-jobs. 
Return ONLY a valid JSON array of objects, each containing:
- description (string, concise job description)
- requiredCapabilities (string, comma-separated capabilities like scraping, python, writing, etc.)
- reward (string, amount of USDC to pay, e.g. "0.5")`
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        })
        const data = await response.json()
        const parsed = JSON.parse(data.choices[0].message.content)
        subtasks = parsed.subtasks || parsed.tasks || Object.values(parsed)[0] as any[]
      } catch (llmErr) {
        console.warn('LLM Decomposition failed, falling back to rule-based parsing:', llmErr)
      }
    }

    // Rule-based fallback parsing if LLM is not used or failed
    if (subtasks.length === 0) {
      // Look for keywords in the prompt to spawn sub-tasks
      const steps = prompt.split(/[;.]\s+/).filter((s: string) => s.trim().length > 5)
      if (steps.length > 0) {
        subtasks = steps.map((step: string, index: number) => {
          let caps = 'general'
          if (step.toLowerCase().includes('scrape') || step.toLowerCase().includes('fetch')) caps = 'scraping,web'
          else if (step.toLowerCase().includes('audit') || step.toLowerCase().includes('check')) caps = 'security,audit'
          else if (step.toLowerCase().includes('zk') || step.toLowerCase().includes('proof')) caps = 'zk,cryptography'
          
          return {
            description: step.trim(),
            requiredCapabilities: caps,
            reward: defaultReward
          }
        })
      } else {
        subtasks = [
          {
            description: prompt,
            requiredCapabilities: 'general',
            reward: defaultReward
          }
        ]
      }
    }

    // 2. Post jobs to Arc Testnet smart contract
    const postedJobs: { jobId: string; txHash: string; description: string }[] = []

    for (const task of subtasks) {
      const parsedReward = parseUnits(task.reward, 6) // USDC 6 decimals
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600 * 24) // 24 hours from now

      try {
        // A. Approve USDC for the escrow contract
        const approveHash = await walletClient.writeContract({
          address: USDC_ADDRESS_ARC,
          abi: usdcAbi,
          functionName: 'approve',
          args: [JOBCHAIN_CONTRACT_ADDRESS, parsedReward]
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        // B. Post the job on-chain
        const postHash = await walletClient.writeContract({
          address: JOBCHAIN_CONTRACT_ADDRESS,
          abi: jobChainAbi,
          functionName: 'postJob',
          args: [
            task.description,
            task.requiredCapabilities,
            parsedReward,
            deadline,
            USDC_ADDRESS_ARC
          ]
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: postHash })
        
        // Find JobId from logs (Topic of JobPosted event)
        // event JobPosted(uint256 indexed jobId, address indexed poster, uint256 reward, string requiredCapabilities, uint256 deadline);
        const jobId = receipt.logs?.[1]?.topics?.[1]
          ? BigInt(receipt.logs[1].topics[1]).toString()
          : (postedJobs.length + 1).toString()

        postedJobs.push({
          jobId,
          txHash: postHash,
          description: task.description
        })
      } catch (err: any) {
        console.error(`Failed to post task "${task.description}":`, err)
        return NextResponse.json({
          error: `Blockchain execution failed: ${err.message || err}`,
          postedSoFar: postedJobs
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      orchestrator: account.address,
      prompt,
      decomposedTasks: subtasks,
      postedJobs
    })

  } catch (err: any) {
    console.error('Orchestration error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
