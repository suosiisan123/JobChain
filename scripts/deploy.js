const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(bal), "USDC");

  // Read compiled artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/JobChainV2.sol/JobChainV2.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // USDC and Official ERC-8004 addresses on Arc Testnet
  const USDC_ARC = "0x3600000000000000000000000000000000000000";
  const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
  const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

  // Deploy
  console.log("Deploying JobChainV2...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(USDC_ARC, IDENTITY_REGISTRY, REPUTATION_REGISTRY);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("");
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  JobChainV2 deployed successfully!             ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  Address: ${address}  `);
  console.log(`║  USDC:    ${USDC_ARC}  `);
  console.log(`║  IdentityRegistry: ${IDENTITY_REGISTRY}  `);
  console.log(`║  ReputationRegistry: ${REPUTATION_REGISTRY}  `);
  console.log(`║  Chain:   Arc Testnet (5042002)                ║`);
  console.log("╚════════════════════════════════════════════════╝");
}

main().catch((error) => {
  console.error("Deploy failed:", error.message);
  process.exitCode = 1;
});
