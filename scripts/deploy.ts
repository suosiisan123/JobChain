import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying JobChainV2 with account:", deployer.address);

  // USDC and Official ERC-8004 addresses on Arc Testnet
  const USDC_ARC = "0x3600000000000000000000000000000000000000";
  const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
  const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

  const JobChainV2 = await ethers.getContractFactory("JobChainV2");
  const jobChain = await JobChainV2.deploy(USDC_ARC, IDENTITY_REGISTRY, REPUTATION_REGISTRY);
  await jobChain.waitForDeployment();

  const address = await jobChain.getAddress();
  console.log("JobChainV2 deployed to:", address);
  console.log("USDC address:", USDC_ARC);
  console.log("IdentityRegistry:", IDENTITY_REGISTRY);
  console.log("ReputationRegistry:", REPUTATION_REGISTRY);
  console.log("");
  console.log("Update lib/contracts.ts with:");
  console.log(`export const JOBCHAIN_CONTRACT_ADDRESS = "${address}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
