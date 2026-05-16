const { ethers } = require("ethers");
require("dotenv").config();

const JOBCHAIN_ADDR = "0x6eB5cAA26E35F659064751bB2BF549b24f8741fd";
const ABI = [
  "function registerAgent(string,string) returns (uint256)",
  "function nextAgentId() view returns (uint256)",
  "function nextJobId() view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(JOBCHAIN_ADDR, ABI, wallet);

  console.log("Deployer:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "USDC");
  console.log("");

  // ── Register Agents ──
  const agents = [
    { name: "SentimentBot-v3", caps: "nlp,sentiment,text-classification" },
    { name: "VisionAnalyzer", caps: "vision,ocr,image-classification" },
    { name: "DataPipeline-Pro", caps: "data-extract,etl,csv-transform" },
    { name: "CodeAuditor-AI", caps: "code-review,security-audit,solidity" },
    { name: "TranslateEngine", caps: "nlp,translation,multi-lang" },
  ];

  const currentAgents = Number(await contract.nextAgentId());
  console.log(`Current agents: ${currentAgents}`);

  if (currentAgents < agents.length + 1) {
    for (let i = currentAgents; i <= agents.length; i++) {
      const a = agents[i - 1]; // skip index 0 (GPT-Analyzer already registered)
      if (!a) continue;
      try {
        console.log(`Registering: ${a.name}...`);
        const tx = await contract.registerAgent(a.name, a.caps);
        await tx.wait();
        console.log(`  ✓ Agent #${i} registered (${tx.hash.slice(0, 12)}...)`);
      } catch (e) {
        console.log(`  ✗ Failed: ${e.message.slice(0, 60)}`);
      }
    }
  } else {
    console.log("Agents already seeded, skipping.");
  }

  console.log("");
  console.log(`Total agents now: ${Number(await contract.nextAgentId())}`);
  console.log(`Total jobs now: ${Number(await contract.nextJobId())}`);
  console.log("\n✅ Seed complete!");
}

main().catch(e => console.error("Fatal:", e.message));
