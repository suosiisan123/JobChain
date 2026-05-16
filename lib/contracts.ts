// ═══════════════════════════════════════════════════════════════
// JobChain V2 — Contract Configuration
// ═══════════════════════════════════════════════════════════════

// TODO: Update after deploying with `npx hardhat run scripts/deploy.ts --network arcTestnet`
export const JOBCHAIN_CONTRACT_ADDRESS = "0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE" as `0x${string}`;

export const USDC_ADDRESS_ARC = "0x3600000000000000000000000000000000000000" as `0x${string}`;

// ═══════════════════════════════════════════════════════════════
// USDC ERC-20 ABI (subset for approve + transferFrom)
// ═══════════════════════════════════════════════════════════════
export const usdcAbi = [
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// JobChainV2 Full ABI
// ═══════════════════════════════════════════════════════════════
export const jobChainAbi = [
  // ── Agent Registry ──
  {
    inputs: [{ name: "_name", type: "string" }, { name: "_capabilities", type: "string" }],
    name: "registerAgent",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_agentId", type: "uint256" }, { name: "_amount", type: "uint256" }],
    name: "stakeCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_agentId", type: "uint256" }],
    name: "getAgentReputation",
    outputs: [
      { name: "score", type: "uint256" },
      { name: "completed", type: "uint256" },
      { name: "failed", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_agentId", type: "uint256" }],
    name: "getAgent",
    outputs: [
      { name: "agentOwner", type: "address" },
      { name: "name", type: "string" },
      { name: "capabilities", type: "string" },
      { name: "stakedAmount", type: "uint256" },
      { name: "completedJobs", type: "uint256" },
      { name: "totalScore", type: "uint256" },
      { name: "failedJobs", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "registeredAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function"
  },
  // ── Job Queue ──
  {
    inputs: [
      { name: "_description", type: "string" },
      { name: "_requiredCapabilities", type: "string" },
      { name: "_reward", type: "uint256" },
      { name: "_deadline", type: "uint256" },
    ],
    name: "postJob",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }, { name: "_agentId", type: "uint256" }],
    name: "pickupJob",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }, { name: "_resultHash", type: "string" }],
    name: "submitResult",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }, { name: "_rating", type: "uint8" }],
    name: "approveAndRelease",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }, { name: "_reason", type: "string" }],
    name: "failJob",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "cancelJob",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "getJob",
    outputs: [
      { name: "poster", type: "address" },
      { name: "description", type: "string" },
      { name: "requiredCapabilities", type: "string" },
      { name: "reward", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "assignedAgent", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "resultHash", type: "string" },
      { name: "rating", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function"
  },
  // ── State Variables ──
  {
    inputs: [],
    name: "nextJobId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextAgentId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "protocolFees",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "capabilities", type: "string" },
    ],
    name: "AgentRegistered",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "totalStake", type: "uint256" },
    ],
    name: "AgentStaked",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "slashAmount", type: "uint256" },
      { indexed: false, name: "reason", type: "string" },
    ],
    name: "AgentSlashed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "poster", type: "address" },
      { indexed: false, name: "reward", type: "uint256" },
      { indexed: false, name: "requiredCapabilities", type: "string" },
      { indexed: false, name: "deadline", type: "uint256" },
    ],
    name: "JobPosted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "agentId", type: "uint256" },
    ],
    name: "JobPickedUp",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "resultHash", type: "string" },
    ],
    name: "ResultSubmitted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: false, name: "rating", type: "uint8" },
    ],
    name: "JobApproved",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "PaymentReleased",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "reason", type: "string" },
    ],
    name: "JobFailed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "jobId", type: "uint256" }],
    name: "JobCancelled",
    type: "event"
  },
] as const;
