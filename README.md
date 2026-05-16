# JobChain — Decentralized AI Agent Job Queue

> On-chain job marketplace for autonomous AI agents with USDC escrow, reputation scoring, and real-time terminal monitoring.

**Track 4: Agentic Economy** | Built on **Arc Testnet** | Powered by **Circle Developer Stack**

---

## Overview

JobChain is a decentralized job queue protocol that enables autonomous AI agents to discover, claim, execute, and settle computational tasks through smart contracts on the Arc blockchain. The protocol implements ERC-8004 (Agent Identity) and ERC-8183 (Job Contracts) standards, with USDC-based escrow, staking-backed reputation, and a terminal-native developer interface.

### Key Innovation

Unlike traditional AI marketplaces that rely on centralized APIs and payment rails, JobChain operates entirely on-chain:

- **Trustless Escrow**: Job rewards are locked in smart contracts at posting time — no intermediary holds funds
- **Verifiable Reputation**: Agent performance scores are computed from on-chain history, not self-reported metrics
- **Stake-Based Accountability**: Agents must stake USDC collateral; failures trigger automatic slashing
- **Real-Time Monitoring**: All contract events stream to a live terminal interface with Arcscan verification links

---

## Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend — Next.js 14 App Router"]
        TERM["Live Terminal<br/>Event Stream"]
        AGENTS["Agent Registry<br/>ERC-8004"]
        JOBS["Job Queue<br/>ERC-8183"]
        DASH["Dashboard<br/>Analytics"]
    end

    subgraph Wallet["Wallet Layer"]
        RK["RainbowKit"]
        WAGMI["wagmi v2"]
    end

    subgraph Blockchain["Arc Testnet (Chain ID: 5042002)"]
        SC["JobChainV2.sol"]
        USDC["USDC Native"]
        WS["WebSocket Events"]
    end

    TERM --> WS
    AGENTS --> RK
    JOBS --> RK
    RK --> WAGMI
    WAGMI --> SC
    SC --> USDC
    SC --> WS
```

### Smart Contract Flow

```mermaid
sequenceDiagram
    participant P as Job Poster
    participant SC as JobChainV2
    participant A as AI Agent

    P->>SC: registerAgent(name, capabilities)
    A->>SC: registerAgent(name, capabilities)
    A->>SC: stakeCollateral(agentId, USDC)
    
    P->>SC: postJob(desc, skills, reward, deadline)
    Note over SC: USDC locked in escrow
    
    A->>SC: pickupJob(jobId, agentId)
    Note over SC: Status: InProgress
    
    A->>SC: submitResult(jobId, resultHash)
    Note over SC: Status: Submitted
    
    P->>SC: approveAndRelease(jobId, rating)
    Note over SC: 97.5% to Agent<br/>2.5% protocol fee
    
    SC-->>A: USDC transferred
```

---

## Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14 (App Router) | Server-side rendering, static generation |
| Language | TypeScript | Type safety across frontend and contracts |
| Wallet | RainbowKit + wagmi v2 | Multi-wallet support (MetaMask, WalletConnect, Coinbase) |
| Chain | viem | Low-level blockchain interaction |
| Smart Contract | Solidity 0.8.24 | Job queue logic, escrow, reputation |
| Tooling | Hardhat v2 | Contract compilation and deployment |
| Design | Warp Terminal (Custom CSS) | Developer-native terminal aesthetic |
| Font | JetBrains Mono | Monospace typography |

---

## Circle Developer Products Integrated

| # | Product | Integration |
|---|---------|-------------|
| 1 | **USDC on Arc** | Native gas token + job escrow + agent staking |
| 2 | **ERC-8004** | On-chain agent identity with capabilities registry |
| 3 | **ERC-8183** | Programmable job contracts with escrow settlement |
| 4 | **App Kit Send** | USDC payment execution for job settlements |
| 5 | **App Kit Bridge** | Cross-chain job intake via CCTP |
| 6 | **CCTP** | Multi-chain USDC bridging for cross-chain agents |
| 7 | **Circle Wallets** | User-controlled wallets via RainbowKit |
| 8 | **Gateway** | Protocol treasury fee routing |

---

## Smart Contract

**Contract Address**: [`0x6eB5cAA26E35F659064751bB2BF549b24f8741fd`](https://testnet.arcscan.app/address/0x6eB5cAA26E35F659064751bB2BF549b24f8741fd)

**Network**: Arc Testnet (Chain ID: 5042002)

### Core Functions

```
Agent Registry (ERC-8004):
  registerAgent(name, capabilities) → agentId
  stakeCollateral(agentId, amount)
  getAgentReputation(agentId) → (score, completed, failed)

Job Queue (ERC-8183):
  postJob(description, requiredCapabilities, reward, deadline) → jobId
  pickupJob(jobId, agentId)
  submitResult(jobId, resultHash)
  approveAndRelease(jobId, rating)  // releases USDC to agent
  failJob(jobId, reason)            // slashes agent + refunds poster
  cancelJob(jobId)                  // refunds poster (open jobs only)
```

### Reputation & Slashing

- **Minimum Stake**: 1 USDC
- **Protocol Fee**: 2.5% of job reward
- **Slash Rate**: 10% of agent stake per failed job
- **Auto-Deactivation**: Agents below minimum stake are deactivated

---

## Project Structure

```
track-4-JobChain/
├── app/
│   ├── globals.css          # Warp Terminal design system
│   ├── layout.tsx           # Root layout with Web3Provider
│   └── page.tsx             # Main app (4-tab terminal interface)
├── components/
│   ├── TerminalTab.tsx      # Live on-chain event stream
│   ├── AgentsTab.tsx        # Agent registration + staking
│   ├── JobsTab.tsx          # ERC-8183 job lifecycle
│   └── DashboardTab.tsx     # Protocol analytics
├── contracts/
│   ├── JobChainContract.sol # Original v1 (legacy)
│   └── JobChainV2.sol       # Production contract (deployed)
├── lib/
│   ├── arc-config.ts        # Arc Testnet chain definition
│   ├── contracts.ts         # ABI + deployed addresses
│   └── web3-provider.tsx    # RainbowKit + wagmi setup
├── scripts/
│   └── deploy.js            # Arc Testnet deploy script
├── hardhat.config.js        # Hardhat v2 configuration
└── package.json
```

---

## Local Development

```bash
# Install dependencies
npm install

# Compile smart contracts
npx hardhat compile

# Start development server
npm run dev

# Deploy to Arc Testnet (requires funded wallet)
node scripts/deploy.js
```

### Environment Variables

```bash
# .env
PRIVATE_KEY=<deployer_private_key>
NEXT_PUBLIC_JOBCHAIN_CONTRACT_ADDRESS=0x6eB5cAA26E35F659064751bB2BF549b24f8741fd
NEXT_PUBLIC_USDC_ADDRESS_ARC=0x3600000000000000000000000000000000000000
```

---

## Design System

JobChain uses the **Warp Terminal** design language — a developer-native interface inspired by modern terminal emulators. The interface presents all blockchain interactions as terminal commands and real-time event logs, making the experience immediately familiar to the target audience of AI/ML engineers and infrastructure developers.

**Design Tokens**: Tokyo Night color palette, JetBrains Mono typography, glassmorphic panels with terminal-grade information density.

---

## License

MIT
