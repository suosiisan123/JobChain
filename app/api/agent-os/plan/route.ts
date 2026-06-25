import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface PlanStep {
  id: string
  description: string
  tool: string
  args: any
  requiresApproval: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY
    const openAiKey = process.env.OPENAI_API_KEY

    let objective = prompt
    let steps: PlanStep[] = []

    if (deepseekKey || openAiKey) {
      try {
        const url = deepseekKey ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions'
        const key = deepseekKey || openAiKey
        const model = deepseekKey ? 'deepseek-v4-flash' : 'gpt-4o-mini'

        const systemPrompt = `You are the Advanced Agent OS AI Orchestrator & Planner for JobChain.
Your role is to analyze a natural language input from the user and decompose it into a sequence of executable tool invocations.

JobChain is a stablecoin-native agent task economy deployed on the Arc chain. USDC is used as both the native gas token (at 18 decimals) and the standard ERC-20 payment token (at 6 decimals).

TOOLS CATALOG:
1. register_agent: Mint an ERC-8004 NFT agent identity on the registry.
   - Arguments: { "metadataURI": "string" }
   - Description: Registers a new computational agent with its IPFS profile metadata.

2. post_job: Create a new task escrow holding USDC reward.
   - Arguments: { "description": "string", "capabilities": "string", "reward": "string", "deadlineHours": number }
   - Description: Locks USDC reward in the escrow contract for workers to complete. Reward must be a decimal string representing USDC amount (e.g. "1.5").

3. pickup_job: Assign a registered agent to perform a specific job.
   - Arguments: { "jobId": number, "agentId": number }
   - Description: Starts the job contract state transition to 'Assigned'.

4. approve_job: Validate work quality, rating, and release the USDC escrow to the worker.
   - Arguments: { "jobId": number, "rating": number }
   - Description: Rating must be an integer between 1 and 5. Releases the locked USDC tokens to the worker.

5. fail_job: Terminate a job that was not completed properly.
   - Arguments: { "jobId": number, "reason": "string" }
   - Description: Transitions the job state to failed.

6. swap: Exchange USDC for EURC stablecoin or vice versa on-chain.
   - Arguments: { "tokenIn": "USDC" | "EURC", "tokenOut": "USDC" | "EURC", "amount": "string" }
   - Description: Exposes on-chain forex swap operations. Amount is a decimal string (e.g. "10.0").

7. bridge: Bridge USDC from a source blockchain to Arc Testnet using Circle CCTP.
   - Arguments: { "fromChain": "Base" | "Ethereum" | "Arbitrum" | "Polygon" | "Solana", "toChain": "Arc", "amount": "string" }
   - Description: Teleports native assets across chains. Amount is a decimal string (e.g. "15.0").

8. navigate: Redirect the client workspace view to a specific tab.
   - Arguments: { "tabId": "home" | "tasks" | "workers" | "payments" | "activity" | "settings" }
   - Description: Navigates the user interface workspace to the requested view tab.

PLANNING RULES:
- Identify the sequence of actions needed. For example, if a user says "I want to register my NLP agent and then immediately post a 5 USDC job for sentiment analysis", you must output two steps: first 'register_agent', then 'post_job'.
- If the user says "bridge 15 USDC from Base Sepolia and post a competitor research job for 15 USDC", you must output first 'bridge', then 'post_job'.
- 'requiresApproval' MUST be set to true if the step writes to the blockchain or moves/escrows funds. Set to false ONLY for read-only or diagnostic operations.
- Parse variables accurately from user prompts (such as reward amounts, job IDs, agent IDs, tokens, source chains, and IPFS hashes).

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object matching the schema below. Do not wrap in markdown blocks, do not include any explanation.
{
  "objective": "Summarized high-level user objective",
  "steps": [
    {
      "id": "step_1",
      "description": "Clear explanation of what this step does",
      "tool": "tool_name",
      "args": { ... },
      "requiresApproval": true
    }
  ]
}`

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        })

        const data = await response.json()
        const parsed = JSON.parse(data.choices[0].message.content)
        objective = parsed.objective || objective
        steps = parsed.steps || []
      } catch (llmErr) {
        console.warn('Agent OS LLM Planner failed, falling back to rule-based planner:', llmErr)
      }
    }

    // Fallback rule-based parsing
    if (steps.length === 0) {
      const lower = prompt.toLowerCase()

      // 1. Bridge
      if (lower.includes('bridge') || lower.includes('teleport') || lower.includes('transfer from') || lower.includes('move from')) {
        let amount = '10.0'
        const amountMatch = prompt.match(/(\d+(\.\d+)?)\s*(usdc|eurc|usd|tokens)?/i)
        if (amountMatch) amount = amountMatch[1]

        let fromChain = 'Base'
        if (lower.includes('ethereum') || lower.includes('sepolia')) {
          fromChain = 'Ethereum'
        } else if (lower.includes('arbitrum')) {
          fromChain = 'Arbitrum'
        } else if (lower.includes('polygon')) {
          fromChain = 'Polygon'
        } else if (lower.includes('solana')) {
          fromChain = 'Solana'
        }

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Bridge ${amount} USDC from ${fromChain} Sepolia to Arc Testnet using Circle CCTP`,
          tool: 'bridge',
          args: {
            fromChain,
            toChain: 'Arc',
            amount
          },
          requiresApproval: true
        })
      }

      // 2. Swap
      if (lower.includes('swap') || lower.includes('exchange') || lower.includes('convert')) {
        let amount = '10.0'
        const amountMatch = prompt.match(/(\d+(\.\d+)?)\s*(usdc|eurc|usd|tokens)?/i)
        if (amountMatch) amount = amountMatch[1]

        let tokenIn = 'USDC'
        let tokenOut = 'EURC'

        // Detect if swapping EURC to USDC
        if (lower.includes('eurc to usdc') || lower.includes('eurc for usdc') || (lower.indexOf('eurc') < lower.indexOf('usdc') && lower.includes('eurc') && lower.includes('usdc'))) {
          tokenIn = 'EURC'
          tokenOut = 'USDC'
        }

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Swap ${amount} ${tokenIn} for ${tokenOut} on-chain at live Coinbase exchange rate`,
          tool: 'swap',
          args: {
            tokenIn,
            tokenOut,
            amount
          },
          requiresApproval: true
        })
      }

      // 3. ERC-8004 Register Agent
      if (
        (lower.includes('register') && lower.includes('agent')) ||
        lower.includes('mint agent') ||
        lower.includes('create agent') ||
        lower.includes('identity')
      ) {
        let uri = 'ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei'
        const match = prompt.match(/(ipfs:\/\/[a-zA-Z0-9]+)/i)
        if (match) uri = match[1]

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Mint an ERC-8004 identity NFT on Arc registry with metadata URI: ${uri}`,
          tool: 'register_agent',
          args: { metadataURI: uri },
          requiresApproval: true
        })
      }

      // 4. Post Job Escrow
      if (
        lower.includes('post job') ||
        lower.includes('create job') ||
        lower.includes('post escrow') ||
        lower.includes('new job') ||
        (lower.includes('task') && !lower.includes('bridge'))
      ) {
        let reward = '1.0'
        const rewardMatch = prompt.match(/(\d+(\.\d+)?)\s*(usdc|eurc|usd|tokens)/i)
        if (rewardMatch) {
          reward = rewardMatch[1]
        } else if (lower.includes('500 product reviews')) {
          reward = '5.0'
        }

        let description = 'Sentiment analysis tasks'
        if (lower.includes('translation')) {
          description = 'Post translation task from English to Spanish'
        } else if (lower.includes('competitor research')) {
          description = 'Create competitor research task'
        } else if (lower.includes('500 product reviews')) {
          description = 'Sentiment analysis for 500 product reviews'
        } else {
          const descMatch = prompt.match(/(?:task|job)\s+(?:to|for|of)\s+([^,.]+)/i)
          if (descMatch) description = descMatch[1]
        }

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Post job escrow on JobChainV2 contract for: ${description}`,
          tool: 'post_job',
          args: {
            description,
            capabilities: lower.includes('translation') ? 'nlp,translation' : 'nlp,sentiment',
            reward,
            deadlineHours: 24
          },
          requiresApproval: true
        })
      }

      // 5. Claim / Pickup Job
      if (lower.includes('claim') || lower.includes('pickup') || lower.includes('assign')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const agentMatch = prompt.match(/agent\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0
        const agentId = agentMatch ? parseInt(agentMatch[1]) : 1

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Claim Job #${jobId} with Agent #${agentId} on-chain`,
          tool: 'pickup_job',
          args: { jobId, agentId },
          requiresApproval: true
        })
      }

      // 6. Submit Result
      if (lower.includes('submit result') || lower.includes('complete') || lower.includes('finish') || lower.includes('result hash')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0
        let hash = 'QmSimulatedResultHash'
        const hashMatch = prompt.match(/(Qm[a-zA-Z0-9]{44})/i)
        if (hashMatch) hash = hashMatch[1]

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Submit proof result hash for Job #${jobId}`,
          tool: 'submit_result',
          args: { jobId, resultHash: hash },
          requiresApproval: true
        })
      }

      // 7. Approve & Pay Job
      if (lower.includes('approve') || lower.includes('release payment') || lower.includes('pay')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Approve Job #${jobId} and release payment with rating: 5 stars`,
          tool: 'approve_job',
          args: { jobId, rating: 5 },
          requiresApproval: true
        })
      }

      // 8. Fail Job
      if (lower.includes('fail') || lower.includes('reject')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Mark Job #${jobId} as failed`,
          tool: 'fail_job',
          args: { jobId, reason: 'Failed to meet criteria or timing requirements' },
          requiresApproval: true
        })
      }

      // 9. Navigate
      if (
        lower.includes('take me to') ||
        lower.includes('navigate to') ||
        lower.includes('go to') ||
        lower.includes('switch to') ||
        lower.includes('show me') ||
        lower.includes('view') ||
        lower.includes('open')
      ) {
        let tabId = 'home'
        if (lower.includes('task') || lower.includes('job')) {
          tabId = 'tasks'
        } else if (lower.includes('worker') || lower.includes('agent')) {
          tabId = 'workers'
        } else if (lower.includes('payment') || lower.includes('chat') || lower.includes('copilot') || lower.includes('payments')) {
          tabId = 'payments'
        } else if (lower.includes('activity') || lower.includes('history') || lower.includes('log')) {
          tabId = 'activity'
        } else if (lower.includes('setting')) {
          tabId = 'settings'
        }

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Navigate user cockpit workspace to "${tabId}" view tab`,
          tool: 'navigate',
          args: { tabId },
          requiresApproval: false
        })
      }
    }

    // Default step if nothing parsed
    if (steps.length === 0) {
      steps.push({
        id: 'step_1',
        description: `Post clearing task escrow on JobChainV2 contract: ${prompt}`,
        tool: 'post_job',
        args: {
          description: prompt,
          capabilities: 'nlp,sentiment',
          reward: '1.0',
          deadlineHours: 24
        },
        requiresApproval: true
      })
    }

    return NextResponse.json({
      objective,
      steps
    })
  } catch (err: any) {
    console.error('Planner route error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
