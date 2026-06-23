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

4. submit_result: Submit work output proof.
   - Arguments: { "jobId": number, "resultHash": "string" }
   - Description: Submits the IPFS CID or proof hash containing the finished task outputs.

5. approve_job: Validate work quality, rating, and release the USDC escrow to the worker.
   - Arguments: { "jobId": number, "rating": number }
   - Description: Rating must be an integer between 1 and 5. Releases the locked USDC tokens to the worker.

6. fail_job: Terminate a job that was not completed properly.
   - Arguments: { "jobId": number, "reason": "string" }
   - Description: Transitions the job state to failed.

7. open_dispute: Initiate dispute resolution on a job.
   - Arguments: { "jobId": number }
   - Description: Signals DAO arbiters to review the job state.

8. schedule_cron: Setup cron triggers for recurring job execution.
   - Arguments: { "jobId": number, "intervalMinutes": number }
   - Description: Creates an on-chain automated job trigger.

9. cast_dao_vote: Participate in JobChain DAO governance voting.
   - Arguments: { "proposalId": number, "support": boolean }
   - Description: Submits a vote (FOR/AGAINST) on active proposals.

10. decode_calldata: Inspect and parse transaction byte payloads.
    - Arguments: { "calldata": "string" }
    - Description: Decodes contract execution data. Does NOT modify blockchain state.

11. run_sentiment_stream: Process natural language inputs through microtask streams.
    - Arguments: { "text": "string" }
    - Description: Sends data to live pipelines. Does NOT modify blockchain state.

PLANNING RULES:
- Identify the sequence of actions needed. For example, if a user says "I want to register my NLP agent and then immediately post a 5 USDC job for sentiment analysis", you must output two steps: first 'register_agent', then 'post_job'.
- 'requiresApproval' MUST be set to true if the step writes to the blockchain or moves/escrows funds. Set to false ONLY for read-only or diagnostic operations.
- Parse variables accurately from user prompts (such as reward amounts, job IDs, agent IDs, and IPFS hashes).

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
