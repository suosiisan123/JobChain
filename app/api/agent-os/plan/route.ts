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
                content: `You are the AI Planner for JobChain Agent OS. Analyze the user's request and decompose it into a sequence of executable tool steps.
Available Tools:
1. register_agent (args: metadataURI) - Mint ERC-8004 NFT agent identity
2. post_job (args: description, capabilities, reward, deadlineHours) - Post job escrow
3. pickup_job (args: jobId, agentId) - Assign an agent to a job
4. submit_result (args: jobId, resultHash) - Submit work result hash
5. approve_job (args: jobId, rating) - Approve work and release USDC reward (rating: 1-5)
6. fail_job (args: jobId, reason) - Mark job as failed
7. open_dispute (args: jobId) - Raise a dispute
8. schedule_cron (args: jobId, intervalMinutes) - Schedule recurring jobs
9. cast_dao_vote (args: proposalId, support) - Vote on DAO proposals (support: boolean)
10. decode_calldata (args: calldata) - Decode batch tx bytes
11. run_sentiment_stream (args: text) - Trigger real-time sentiment tasks

IMPORTANT: If a step changes state, performs a payment/escrow, or writes to blockchain, set 'requiresApproval' to true.
Return ONLY a valid JSON object matching this schema:
{
  "objective": "summarized user objective",
  "steps": [
    {
      "id": "step_1",
      "description": "Clear step description",
      "tool": "tool_name",
      "args": { ... },
      "requiresApproval": true/false
    }
  ]
}`
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

      // 1. ERC-8004 Register Agent
      if (lower.includes('register agent') || lower.includes('mint agent') || lower.includes('create agent') || lower.includes('identity')) {
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

      // 2. Post Job Escrow
      if (lower.includes('post job') || lower.includes('create job') || lower.includes('post escrow') || lower.includes('new job')) {
        let reward = '1.0'
        const rewardMatch = prompt.match(/(\d+(\.\d+)?)\s*(usdc|eurc|usd|tokens)/i)
        if (rewardMatch) reward = rewardMatch[1]

        let description = 'Sentiment analysis tasks'
        const descMatch = prompt.match(/job\s+(?:to|for)\s+([^,.]+)/i)
        if (descMatch) description = descMatch[1]

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Post job escrow on JobChainV2 contract for: ${description}`,
          tool: 'post_job',
          args: {
            description,
            capabilities: 'nlp,sentiment',
            reward,
            deadlineHours: 24
          },
          requiresApproval: true
        })
      }

      // 3. Claim / Pickup Job
      if (lower.includes('claim job') || lower.includes('pickup job') || lower.includes('assign job')) {
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

      // 4. Submit Result
      if (lower.includes('submit result') || lower.includes('complete job') || lower.includes('finish job')) {
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

      // 5. Approve & Pay Job
      if (lower.includes('approve job') || lower.includes('release payment') || lower.includes('pay job')) {
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

      // 6. Fail Job
      if (lower.includes('fail job') || lower.includes('reject job')) {
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

      // 7. Disputes
      if (lower.includes('dispute')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Initiate dispute resolution for Job #${jobId}`,
          tool: 'open_dispute',
          args: { jobId },
          requiresApproval: true
        })
      }

      // 8. Cron Scheduler
      if (lower.includes('schedule') || lower.includes('cron') || lower.includes('recurring')) {
        const jobMatch = prompt.match(/job\s*(?:#|id)?\s*(\d+)/i)
        const jobId = jobMatch ? parseInt(jobMatch[1]) : 0

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Schedule Job #${jobId} as a recurring cron automation`,
          tool: 'schedule_cron',
          args: { jobId, intervalMinutes: 15 },
          requiresApproval: true
        })
      }

      // 9. DAO Voting
      if (lower.includes('vote') || lower.includes('proposal') || lower.includes('governance')) {
        const propMatch = prompt.match(/proposal\s*(?:#|id)?\s*(\d+)/i)
        const proposalId = propMatch ? parseInt(propMatch[1]) : 1
        const support = !lower.includes('against') && !lower.includes('reject')

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Vote ${support ? 'FOR' : 'AGAINST'} Governance Proposal #${proposalId}`,
          tool: 'cast_dao_vote',
          args: { proposalId, support },
          requiresApproval: true
        })
      }

      // 10. Calldata batch decoding
      if (lower.includes('decode') || lower.includes('calldata') || lower.includes('bytes')) {
        let calldata = '0x'
        const cdMatch = prompt.match(/(0x[a-fA-F0-9]+)/i)
        if (cdMatch) calldata = cdMatch[1]

        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Decode raw transaction batch calldata`,
          tool: 'decode_calldata',
          args: { calldata },
          requiresApproval: false
        })
      }

      // 11. Run sentiment streams
      if (lower.includes('stream') || lower.includes('sentiment task') || lower.includes('process text')) {
        steps.push({
          id: `step_${steps.length + 1}`,
          description: `Trigger live sentiment processing microtask stream`,
          tool: 'run_sentiment_stream',
          args: { text: prompt },
          requiresApproval: false
        })
      }
    }

    // Default step if nothing parsed
    if (steps.length === 0) {
      steps.push({
        id: 'step_1',
        description: `Run general sentiment automation tasks for: "${prompt}"`,
        tool: 'run_sentiment_stream',
        args: { text: prompt },
        requiresApproval: false
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
