import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  keccak256,
  encodePacked,
  parseEventLogs,
  Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Default Contract Addresses on Arc Testnet
const DEFAULT_JOBCHAIN = '0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE'
const DEFAULT_IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const DEFAULT_USDC = '0x3600000000000000000000000000000000000000'

// Minimal ABIs
const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ name: 'metadataURI', type: 'string' }],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  }
] as const

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

const JOBCHAIN_ABI = [
  {
    inputs: [
      { name: '_agentId', type: 'uint256' },
      { name: '_amount', type: 'uint256' }
    ],
    name: 'stakeCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_jobId', type: 'uint256' },
      { name: '_agentId', type: 'uint256' },
      { name: '_capabilityProof', type: 'bytes' }
    ],
    name: 'pickupJob',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_jobId', type: 'uint256' },
      { name: '_resultHash', type: 'string' },
      { name: '_proof', type: 'bytes' }
    ],
    name: 'submitResult',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: '_jobId', type: 'uint256' }],
    name: 'getJob',
    outputs: [
      { name: 'poster', type: 'address' },
      { name: 'description', type: 'string' },
      { name: 'requiredCapabilities', type: 'string' },
      { name: 'reward', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'assignedAgent', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'resultHash', type: 'string' },
      { name: 'rating', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'paymentToken', type: 'address' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'nextJobId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export interface SDKConfig {
  privateKey: string
  rpcUrl: string
  authorityPrivateKey?: string
  jobChainAddress?: string
  identityRegistryAddress?: string
  usdcAddress?: string
}

export class JobChainSDK {
  private publicClient: any
  private walletClient: any
  private account: any
  private authorityAccount: any

  public jobChainAddress: `0x${string}`
  public identityRegistryAddress: `0x${string}`
  public usdcAddress: `0x${string}`

  constructor(config: SDKConfig) {
    const pk = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
    this.account = privateKeyToAccount(pk as Hex)

    const authPk = config.authorityPrivateKey || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const formattedAuthPk = authPk.startsWith('0x') ? authPk : `0x${authPk}`
    this.authorityAccount = privateKeyToAccount(formattedAuthPk as Hex)

    this.jobChainAddress = (config.jobChainAddress || DEFAULT_JOBCHAIN) as `0x${string}`
    this.identityRegistryAddress = (config.identityRegistryAddress || DEFAULT_IDENTITY_REGISTRY) as `0x${string}`
    this.usdcAddress = (config.usdcAddress || DEFAULT_USDC) as `0x${string}`

    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl)
    })

    this.walletClient = createWalletClient({
      account: this.account,
      transport: http(config.rpcUrl)
    })
  }

  // Generate signed attestation proofs locally
  public generateCapabilityProof(agentId: number, capabilities: string): `0x${string}` {
    const messageHash = keccak256(
      encodePacked(['uint256', 'string'], [BigInt(agentId), capabilities])
    )
    return this.authorityAccount.signMessage({
      message: { raw: messageHash }
    })
  }

  public generateExecutionProof(jobId: number, resultHash: string): `0x${string}` {
    const messageHash = keccak256(
      encodePacked(['uint256', 'string'], [BigInt(jobId), resultHash])
    )
    return this.authorityAccount.signMessage({
      message: { raw: messageHash }
    })
  }

  // Register a new agent identity
  public async registerAgent(name: string, capabilities: string): Promise<number> {
    const metadataURI = `ipfs://bafkreib-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${capabilities.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    
    const hash = await this.walletClient.writeContract({
      address: this.identityRegistryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'register',
      args: [metadataURI]
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    const logs = parseEventLogs({
      abi: IDENTITY_REGISTRY_ABI,
      eventName: 'Transfer',
      logs: receipt.logs
    })

    const tokenId = logs[0]?.args?.tokenId
    if (tokenId === undefined) {
      throw new Error('Failed to retrieve tokenId from registration logs')
    }
    return Number(tokenId)
  }

  // Stake collateral
  public async stakeCollateral(agentId: number, amount: string): Promise<string> {
    const parsedAmount = parseUnits(amount, 6)

    // Approve JobChain contract to transfer USDC
    const approveHash = await this.walletClient.writeContract({
      address: this.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [this.jobChainAddress, parsedAmount]
    })
    await this.publicClient.waitForTransactionReceipt({ hash: approveHash })

    // Stake
    const stakeHash = await this.walletClient.writeContract({
      address: this.jobChainAddress,
      abi: JOBCHAIN_ABI,
      functionName: 'stakeCollateral',
      args: [BigInt(agentId), parsedAmount]
    })
    await this.publicClient.waitForTransactionReceipt({ hash: stakeHash })
    return stakeHash
  }

  // Claim Job
  public async pickupJob(jobId: number, agentId: number, capabilityProof: string): Promise<string> {
    const hash = await this.walletClient.writeContract({
      address: this.jobChainAddress,
      abi: JOBCHAIN_ABI,
      functionName: 'pickupJob',
      args: [BigInt(jobId), BigInt(agentId), capabilityProof as `0x${string}`]
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  // Submit Result
  public async submitResult(jobId: number, resultHash: string, proof: string): Promise<string> {
    const hash = await this.walletClient.writeContract({
      address: this.jobChainAddress,
      abi: JOBCHAIN_ABI,
      functionName: 'submitResult',
      args: [BigInt(jobId), resultHash, proof as `0x${string}`]
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  // Fetch individual job details
  public async getJob(jobId: number): Promise<any> {
    const d = await this.publicClient.readContract({
      address: this.jobChainAddress,
      abi: JOBCHAIN_ABI,
      functionName: 'getJob',
      args: [BigInt(jobId)]
    }) as unknown as any[]

    return {
      id: jobId,
      poster: d[0],
      description: d[1],
      requiredCapabilities: d[2],
      reward: d[3],
      deadline: Number(d[4]),
      assignedAgent: Number(d[5]),
      status: Number(d[6]),
      resultHash: d[7],
      rating: Number(d[8]),
      createdAt: Number(d[9]),
      paymentToken: d[10]
    }
  }

  // Fetch next Job ID
  public async getNextJobId(): Promise<number> {
    const id = await this.publicClient.readContract({
      address: this.jobChainAddress,
      abi: JOBCHAIN_ABI,
      functionName: 'nextJobId'
    })
    return Number(id)
  }

  // Programmatic listening and processing loop (low latency polling with retry mechanism)
  public async listenForJobs(
    callback: (job: any) => Promise<string | null>,
    options: { agentId: number; capabilities: string[]; pollIntervalMs?: number }
  ) {
    const pollInterval = options.pollIntervalMs || 5000
    let lastProcessedJobId = await this.getNextJobId()

    console.log(`[JobChainSDK] Listening for matching jobs for Agent #${options.agentId}...`)
    console.log(`[JobChainSDK] Capabilities: [${options.capabilities.join(', ')}]. Start checking from Job ID #${lastProcessedJobId}`)

    while (true) {
      try {
        const nextId = await this.getNextJobId()
        if (nextId > lastProcessedJobId) {
          for (let i = lastProcessedJobId; i < nextId; i++) {
            const job = await this.getJob(i)
            
            // Only process Open jobs (status === 0)
            if (job.status === 0) {
              const reqCaps = job.requiredCapabilities
                .split(',')
                .map((s: string) => s.trim().toLowerCase())
                .filter((s: string) => s.length > 0)

              // Check if agent skills match job capabilities
              const hasMatch = reqCaps.length === 0 || reqCaps.some((c: string) => options.capabilities.includes(c))

              if (hasMatch) {
                console.log(`\n[JobChainSDK] Match found! Job #${i}: "${job.description}"`)
                
                try {
                  // 1. Generate Capability Proof
                  const capProof = this.generateCapabilityProof(options.agentId, job.requiredCapabilities)
                  console.log(`[JobChainSDK] Generated Capability Attestation for Agent #${options.agentId}`)

                  // 2. Claim Job
                  console.log(`[JobChainSDK] Claiming job #${i} on-chain...`)
                  const claimTx = await this.pickupJob(i, options.agentId, capProof)
                  console.log(`[JobChainSDK] Job claimed! Tx: ${claimTx}`)

                  // 3. Execute logic (callback)
                  console.log(`[JobChainSDK] Running agent model logic...`)
                  const executionResult = await callback(job)

                  if (executionResult) {
                    // 4. Generate Execution Proof & Submit
                    const ipfsHash = `ipfs://bafkreih-${executionResult.toLowerCase().replace(/[^a-z0-9]/g, '')}`
                    const execProof = this.generateExecutionProof(i, ipfsHash)
                    
                    console.log(`[JobChainSDK] Submitting result hash "${ipfsHash}"...`)
                    const submitTx = await this.submitResult(i, ipfsHash, execProof)
                    console.log(`[JobChainSDK] Result submitted successfully! Tx: ${submitTx}`)
                  } else {
                    console.warn(`[JobChainSDK] Callback returned empty result. Skipping submission.`)
                  }
                } catch (err: any) {
                  console.error(`[JobChainSDK] Error processing job #${i}:`, err.message || err)
                }
              }
            }
          }
          lastProcessedJobId = nextId
        }
      } catch (err: any) {
        console.error(`[JobChainSDK] Connection error. Reconnecting in ${pollInterval / 1000}s...`, err.message || err)
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  }
}
