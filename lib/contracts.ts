// ═══════════════════════════════════════════════════════════════
// JobChain V2 — Contract Configuration
// ═══════════════════════════════════════════════════════════════

// TODO: Update after deploying with `npx hardhat run scripts/deploy.ts --network arcTestnet`
export const JOBCHAIN_CONTRACT_ADDRESS = "0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE" as `0x${string}`;
export const ZK_VERIFIER_CONTRACT_ADDRESS = "0x98A1234567890abcdef1234567890abcdef12345" as `0x${string}`;
export const JOB_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`;
export const REVENUE_DISTRIBUTOR_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`;

export const USDC_ADDRESS_ARC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const EURC_ADDRESS_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;

// ═══════════════════════════════════════════════════════════════
// Official ERC-8004 Contracts on Arc Testnet
// ═══════════════════════════════════════════════════════════════
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`;
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`;

export const identityRegistryAbi = [
  {
    inputs: [{ name: "metadataURI", type: "string" }],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ERC-721 Transfer event for tracking agent registrations
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

export const reputationRegistryAbi = [
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "int128" },
      { name: "category", type: "uint8" },
      { name: "tag", type: "string" },
      { name: "comment", type: "string" },
      { name: "metadata", type: "string" },
      { name: "attestation", type: "string" },
      { name: "referenceHash", type: "bytes32" },
    ],
    name: "giveFeedback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

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
  // ── Agent Registry (Staking & Info) ──
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
  {
    inputs: [],
    name: "PROTOCOL_FEE_BPS",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_bps", type: "uint256" }],
    name: "setProtocolFeeBps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // ── Job Queue ──
  {
    inputs: [
      { name: "_description", type: "string" },
      { name: "_requiredCapabilities", type: "string" },
      { name: "_reward", type: "uint256" },
      { name: "_deadline", type: "uint256" },
      { name: "_paymentToken", type: "address" },
    ],
    name: "postJob",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_description", type: "string" },
      { name: "_requiredCapabilities", type: "string" },
      { name: "_deadline", type: "uint256" },
      { name: "_paymentToken", type: "address" },
      { name: "_auctionType", type: "uint8" },
      { name: "_startPrice", type: "uint256" },
      { name: "_floorPrice", type: "uint256" },
      { name: "_decayPeriod", type: "uint256" }
    ],
    name: "postJobAuction",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "getCurrentReward",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_agentId", type: "uint256" },
      { name: "_price", type: "uint256" }
    ],
    name: "submitBid",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_bidIndex", type: "uint256" }
    ],
    name: "acceptBid",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "lowestBidIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" }
    ],
    name: "jobBids",
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "bidder", type: "address" },
      { name: "refunded", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_agentId", type: "uint256" }, { name: "_token", type: "address" }],
    name: "setAgentPayoutToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_agentId", type: "uint256" },
      { name: "_capabilityProof", type: "bytes" },
    ],
    name: "pickupJob",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_resultHash", type: "string" },
      { name: "_proof", type: "bytes" },
    ],
    name: "submitResult",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_resultHash", type: "string" },
      { name: "_proof", type: "bytes" },
    ],
    name: "submitResultWithProof",
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
    name: "claimFailedRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "openDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_jobId", type: "uint256" },
      { name: "_agentId", type: "uint256" },
      { name: "_supportAgent", type: "bool" }
    ],
    name: "castVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "resolveDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_agentId", type: "uint256" }],
    name: "isEligibleValidator",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "getDispute",
    outputs: [
      { name: "disputedAt", type: "uint256" },
      { name: "approveWeight", type: "uint256" },
      { name: "rejectWeight", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "failedTime", type: "uint256" },
      { name: "voterCount", type: "uint256" }
    ],
    stateMutability: "view",
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
      { name: "paymentToken", type: "address" },
      { name: "failedAt", type: "uint256" },
      { name: "auctionType", type: "uint8" },
      { name: "startPrice", type: "uint256" },
      { name: "floorPrice", type: "uint256" },
      { name: "decayPeriod", type: "uint256" },
      { name: "parentJobId", type: "uint256" },
      { name: "hasParent", type: "bool" },
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "getJobYield",
    outputs: [
      { name: "exchangeRateAtDeposit", type: "uint256" },
      { name: "agentExchangeRateAtPickup", type: "uint256" },
      { name: "depositedInPool", type: "bool" },
      { name: "stakeDepositedInPool", type: "bool" },
      { name: "rewardYield", type: "uint256" },
      { name: "stakeYield", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextJobId",
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
  {
    inputs: [],
    name: "cumulativeYield",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "yieldTVL",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "yieldPool",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "verifier",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  // ── Events ──
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
  {
    inputs: [
      { name: "parentJobId", type: "uint256" },
      { name: "desc", type: "string" },
      { name: "reward", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ],
    name: "postSubJob",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_jobId", type: "uint256" }],
    name: "getSubJobIds",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_desc", type: "string" },
      { name: "_requiredCapabilities", type: "string" },
      { name: "_interval", type: "uint256" },
      { name: "_reward", type: "uint256" },
      { name: "_maxExecutions", type: "uint256" },
      { name: "_paymentToken", type: "address" }
    ],
    name: "registerSchedule",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_scheduleId", type: "uint256" }],
    name: "executeScheduledJob",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_scheduleId", type: "uint256" }],
    name: "cancelSchedule",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_scheduleId", type: "uint256" },
      { name: "_amount", type: "uint256" }
    ],
    name: "replenishSchedule",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_scheduleId", type: "uint256" },
      { name: "_amount", type: "uint256" }
    ],
    name: "withdrawSchedule",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_scheduleId", type: "uint256" }],
    name: "getSchedule",
    outputs: [
      { name: "poster", type: "address" },
      { name: "description", type: "string" },
      { name: "requiredCapabilities", type: "string" },
      { name: "reward", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "nextExecution", type: "uint256" },
      { name: "fundedBalance", type: "uint256" },
      { name: "maxExecutions", type: "uint256" },
      { name: "executionsCount", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "active", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextScheduleId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// ═══════════════════════════════════════════════════════════════
// Circle CCTP V2 Configuration
// ═══════════════════════════════════════════════════════════════
export const CCTP_TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;
export const CCTP_MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`;

export const tokenMessengerAbi = [
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "recipient", type: "bytes32" },
      { name: "burnToken", type: "address" }
    ],
    name: "depositForBurn",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

export const messageTransmitterAbi = [
  {
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" }
    ],
    name: "receiveMessage",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "message", type: "bytes" }
    ],
    name: "MessageSent",
    type: "event"
  }
] as const;

// ═══════════════════════════════════════════════════════════════
// Circle Gateway Nanopayments Config
// ═══════════════════════════════════════════════════════════════
export const GATEWAY_VAULT_ADDRESS = "0x88aa490CC64Ba7DB81e88a5527c0C32Ca71Ec971" as `0x${string}`;

export const gatewayVaultAbi = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

export const jobTokenAbi = [
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
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
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "delegatee", type: "address" }],
    name: "delegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "getVotes",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const revenueDistributorAbi = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "stakeJOB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "unstakeJOB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "claimRevenue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_user", type: "address" },
      { name: "_token", type: "address" }
    ],
    name: "getPendingRevenue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_user", type: "address" }],
    name: "getUserStaked",
    outputs: [
      { name: "stakedAmount", type: "uint256" },
      { name: "lastStakeTimestamp", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalStakedJOB",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_description", type: "string" },
      { name: "_newProtocolFeeBps", type: "uint256" }
    ],
    name: "createProposal",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_support", type: "bool" }
    ],
    name: "castVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_proposalId", type: "uint256" }],
    name: "executeProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_id", type: "uint256" }],
    name: "getProposal",
    outputs: [
      { name: "id", type: "uint256" },
      { name: "description", type: "string" },
      { name: "newProtocolFeeBps", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "againstVotes", type: "uint256" },
      { name: "endBlock", type: "uint256" },
      { name: "executed", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextProposalId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_user", type: "address" }
    ],
    name: "getHasVoted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;


