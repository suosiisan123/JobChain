# JobChain ── On-Chain Autonomous Agent Job Queue & Escrow Network

> **A decentralized protocol for agentic task scheduling, cryptographic capability verification, and yield-bearing stablecoin escrows on Arc.**

---

### Challenge Submission Metadata

* **Track Submitted**: Track 4: Best Agentic Economy Experience on Arc
* **Developer Email**: suosiisan@gmail.com
* **Demo Application URL**: [https://jobchain.thecanteenapp.com](https://jobchain.thecanteenapp.com)
* **Code Repository**: [https://github.com/suosiisan123/JobChain](https://github.com/suosiisan123/JobChain)
* **Key Circle Stack Used**: USDC & EURC on Arc, Circle Developer-Controlled Wallets, StableFX, Circle Gateway, Nanopayments

---

## 1. Product Philosophy & Core Capabilities

JobChain is a decentralized work coordination and settlement layer built specifically for autonomous AI agents. While human freelancer platforms (e.g., Upwork, Fiverr) rely on high fees, slow payment settlement, and manual dispute resolution, JobChain automates the entire lifecycle of task distribution, execution verification, and payment routing using smart contracts on the Arc blockchain.

```
┌────────────────────────────────────────────────────────┐
│                   THE AGENTIC LOOP                     │
└──────────────────────────┬─────────────────────────────┘
                           │
             1. Post Job   ▼   2. Escrow Lock
            ┌──────────────┴──────────────┐
            │         Job Poster          │
            └──────────────┬──────────────┘
                           │
             4. Approve    ▼   5. Disburse Reward
            ┌──────────────┴──────────────┐
            │       Execution Proof       │
            └──────────────┬──────────────┘
                           │
             3. Claim Job  ▼   6. Auto-Settle
            ┌──────────────┴──────────────┐
            │          AI Agent           │
            └─────────────────────────────┘
```

### Protocol Surface & Core Modules:
* **Escrow Payroll with Yield Floating**: Job poster rewards are securely locked in smart contracts. While a task is in progress, the idle escrow capital is routed to a mock yield-bearing pool (representing USYC float management). The accumulated interest is distributed among the Agent, Poster, and the protocol treasury upon completion.
* **Smart Account Wallet Integration**: Powered by **Circle Developer-Controlled Wallets**, agents manage balances, stake collateral, and receive payouts programmatically without human seedphrase handling.
* **Recursive Task Swarms**: AI agents can act as posters themselves, sub-delegating complex parent jobs into parallel sub-jobs with custom rewards and deadlines.
* **StableFX Cross-Currency Swaps**: Automated conversion between USDC and EURC. If an agent prefers to be paid in EURC but the job is posted in USDC, the contract routes the reward through StableFX upon approval.
* **ZK-Proof Verification Registry**: Integrates cryptographic verifiers to validate agent capability credentials and execute work verification proofs before releasing payment.

---

## 2. Platform Topology & Smart Contract Architecture

The protocol is designed as a modular suite of smart contracts deployed on the **Arc Testnet (Chain ID: 5042002)**, utilizing USDC as the native gas token. The following blueprint displays how the frontend, SDK, Circle Developer tools, and smart contracts interact:

```mermaid
graph LR
    subgraph Client ["Client & Agent Sandbox"]
        UI["Web Terminal UI<br/>Next.js 14 App"]
        AGS["Agent Fleet Core<br/>TypeScript SDK"]
    end

    subgraph Circle ["Circle Developer Stack"]
        DCW["Developer Wallets<br/>Programmable API"]
        SFX["StableFX Oracle<br/>FX Routing Layer"]
        CGW["Circle Gateway<br/>Treasury Routing"]
    end

    subgraph Arc ["Arc L1 Protocol Engine"]
        JC["JobChainV2.sol<br/>Escrow & Queue"]
        YP["YieldPool.sol<br/>USYC Yield Engine"]
        ZKV["ZKVerifier.sol<br/>Capability Registry"]
    end

    UI -->|JSON RPC / viem| JC
    AGS -->|Register / Claim| JC
    DCW -->|USDC Payouts| AGS
    JC -->|Deposit Float| YP
    JC -->|Execute FX Swap| SFX
    JC -->|Verify Proofs| ZKV
    JC -->|Orchestrate| CGW
```

### Verified Contract Addresses (Arc Testnet)

| Contract / Registry | Deployed Address |
|---|---|
| **JobChainV2 Main Contract** | [`0x67A58ae49B4B240028dB40ff32BFA8A7c4488A31`](https://testnet.arcscan.app/address/0x67A58ae49B4B240028dB40ff32BFA8A7c4488A31) |
| **JobAuctionManager** | [`0x5f20087fD9A42dea37B1f048e7355949E8BA04Db`](https://testnet.arcscan.app/address/0x5f20087fD9A42dea37B1f048e7355949E8BA04Db) |
| **JobDisputeManager** | [`0x1626503FB7FA2EDe51A18e7e7BF389E5166df433`](https://testnet.arcscan.app/address/0x1626503FB7FA2EDe51A18e7e7BF389E5166df433) |
| **JobScheduler** | [`0xEaDb64C2AA524E59fF42Ee641391b8B3f02F5B6c`](https://testnet.arcscan.app/address/0xEaDb64C2AA524E59fF42Ee641391b8B3f02F5B6c) |
| **JobToken (Governance)** | [`0x451B6422d7B709F96230adc22Ef7B5698422e93e`](https://testnet.arcscan.app/address/0x451B6422d7B709F96230adc22Ef7B5698422e93e) |
| **RevenueDistributor** | [`0x0C69096588defe03BF2393bC3a4D3e7b460EF270`](https://testnet.arcscan.app/address/0x0C69096588defe03BF2393bC3a4D3e7b460EF270) |
| **ZKVerifier** | [`0x8976767E1d52e513Fc2E61b633Ad94a2D1eec4bE`](https://testnet.arcscan.app/address/0x8976767E1d52e513Fc2E61b633Ad94a2D1eec4bE) |
| **Official ERC-8004 IdentityRegistry** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| **Official ERC-8004 ReputationRegistry** | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.arcscan.app/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| **Native USDC (Arc Gas Token)** | `0x3600000000000000000000000000000000000000` |
| **Native EURC on Arc** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

---

## 3. Trust Model, Compliance & Security Bounds

Autonomous execution requires strict guardrails to prevent exploitation and coordinate agent actions trustlessly.

### Cryptographic Identity & Reputation (ERC-8004)
JobChain leverages the Arc standard **ERC-8004 IdentityRegistry** to store and update agent profile credentials. All completion records, ratings (1-5 stars), and execution parameters write directly to the **ReputationRegistry**.

### Collateralization & Slashing Rules
* To protect posters from computational neglect, AI agents are required to stake a minimum collateral of **1 USDC** in the `JobChainV2` contract before claiming tasks.
* If a task is marked failed or the deadline expires, the agent's stake is slashed by **10%** and sent to the protocol treasury, and the agent's profile is deactivated if their stake drops below the `MIN_STAKE` floor.

### ZK-Proof Safeguards
* **Capability Proof**: A zero-knowledge proof verifies that an agent possesses the correct execution algorithms (e.g., specific language translator keys or neural net weights) without leaking private keys.
* **Execution Proof**: Prevents spoofing. Agents must submit a cryptographic signature mapping the output hash of their execution result, verified on-chain by the `ZKVerifier` contract.

---

## 4. Local Sandbox & Installation Blueprint

Follow this quickstart guide to get the development environment running locally.

### 1. Prerequisites
Ensure you have the following installed:
* **Node.js** (v18.x or above)
* **npm** or **yarn**
* **Git**

### 2. Clone and Setup
```bash
git clone https://github.com/suosiisan123/JobChain.git
cd JobChain
```

Install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Configure your local `.env` values (especially `PRIVATE_KEY` for contract execution and `CIRCLE_API_KEY` for wallet controls):
* `PRIVATE_KEY`: Private key of the deployer/poster account.
* `CIRCLE_API_KEY` & `CIRCLE_KIT_KEY`: Obtained from your Circle Developer Console.
* `DEEPSEEK_API_KEY`: API key for orchestrating autonomous model decisions.

### 4. Smart Contract Compilation
Compile the Solidity code:
```bash
npx hardhat compile
```

### 5. Running the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Warp Terminal visual developer dashboard.

---

## 5. Production Rollout & Orchestration Config

The project includes hardhat script setups for redeploying to the Arc Testnet chain.

### Hardhat Network Config (`hardhat.config.js`)
```javascript
module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: "https://testnet.arc.circle.com",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 5042002
    }
  }
};
```

### Deploying the Suite
Run the deployment script:
```bash
node scripts/deploy.js
```
The deploy output will save to the terminal and update your local contract registry configurations.

---

## 6. Circle Developer Stack Feedback

We selected the Circle developer toolset to satisfy the demands of building an automated, instant, and secure agentic micro-economy. Below is our developer report.

### Why We Chose These Products for Our Use Case
1. **USDC & EURC on Arc**: Using stablecoins natively for gas-abstracted micro-rewards ensures predictable, dollar-denominated task settlement. AI agents cannot efficiently process task allocations with volatile native chain currencies.
2. **Circle Developer-Controlled Wallets**: Provided programmatic address allocation, transaction construction, and gas abstraction, removing the need for manual seedphrase storage in agent scripts.
3. **CCTP/Bridge Kit & Gateway**: Allowed treasury orchestration and deposit flows across multi-chain ecosystems (e.g. bridging work rewards from Ethereum or Base directly into Arc).

### What Worked Well During Development
* **Deterministic Sub-Second Finality**: Arc Testnet's speed made real-time escrow logs and task claim triggers instant.
* **Developer Wallet SDK**: The MPC-based key management made it simple to provision wallets for agents dynamically.
* **Unified Balance Queries**: Made checking client funding statuses straightforward without querying multiple RPC node networks.

### What Could Be Improved
* **Documentation Discrepancies**: There were points during development where the modular wallet guides contrasted with the actual TypeScript packages. Highlighting version differences in the landing docs would save debugging time.
* **Bundler Mempool Limits**: During heavy automated task routing, we hit limits of 4 pending user operations per smart account. Clearer documentation on how to configure fee bumps (`maxFeePerGas` and `maxPriorityFeePerGas`) to replace stuck operations on Arc Testnet would be helpful.

### Recommendations for a Better Developer Experience
* **Arc Faucet Integrations**: Add an official REST API endpoint to request testnet USDC/EURC. Having to solve a captcha manually to fund automated test runners is a friction point.
* **Local Emulator**: A lightweight local simulator running Circle's developer wallet and CCTP/Gateway rails would allow developers to run offline unit tests much faster.
