#!/usr/bin/env ts-node

import { JobChainSDK } from './index'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from the workspace folder
dotenv.config({ path: path.join(__dirname, '../../.env') })

const privateKey = process.env.PRIVATE_KEY
const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545'

if (!privateKey) {
  console.error('❌ Error: PRIVATE_KEY environment variable is not defined.')
  console.error('Please configure your private key safely in .env or your terminal environment.')
  process.exit(1)
}

const args = process.argv.slice(2)
const command = args[0]

const sdk = new JobChainSDK({
  privateKey,
  rpcUrl
})

async function run() {
  if (command === 'register') {
    let name = ''
    let skills = ''

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) {
        name = args[i + 1]
      }
      if (args[i] === '--skills' && args[i + 1]) {
        skills = args[i + 1]
      }
    }

    if (!name || !skills) {
      console.error('Usage: jobchain register --name <name> --skills <skills>')
      process.exit(1)
    }

    console.log(`⏳ Registering Agent "${name}" with skills [${skills}] on Arc...`)
    try {
      const agentId = await sdk.registerAgent(name, skills)
      console.log(`✅ Success! Minted Agent ID: #${agentId}`)
    } catch (err: any) {
      console.error('❌ Registration failed:', err.message || err)
    }
  } else if (command === 'listen') {
    let agentIdStr = ''
    let skillsStr = ''

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--agent' && args[i + 1]) {
        agentIdStr = args[i + 1]
      }
      if (args[i] === '--skills' && args[i + 1]) {
        skillsStr = args[i + 1]
      }
    }

    if (!agentIdStr || !skillsStr) {
      console.error('Usage: jobchain listen --agent <agentId> --skills <skills>')
      process.exit(1)
    }

    const agentId = parseInt(agentIdStr, 10)
    const skills = skillsStr.split(',').map((s) => s.trim().toLowerCase())

    console.log(`🚀 Starting listener for Agent #${agentId}...`)

    // Start listening loop
    await sdk.listenForJobs(
      async (job) => {
        console.log(`[Local AI Runtime] Processing job: "${job.description}"`)
        // Simulated local task execution / LLM generation
        const mockResult = `Executed job "${job.description}" successfully using JobChain TS-SDK runtime.`
        console.log(`[Local AI Runtime] Output: ${mockResult}`)
        return mockResult
      },
      {
        agentId,
        capabilities: skills
      }
    )
  } else {
    console.log('JobChain Node CLI')
    console.log('Commands:')
    console.log('  register --name <name> --skills <skills>       Register a new agent identity on Arc')
    console.log('  listen --agent <agentId> --skills <skills>     Launch the low-latency job listener loop')
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err.message || err)
  process.exit(1)
})
