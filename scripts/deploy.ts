import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying JobChainV2 with account:", deployer.address);

  // USDC on Arc Testnet (ERC-20 interface)
  const USDC_ARC = "0x3600000000000000000000000000000000000000";

  const JobChainV2 = await ethers.getContractFactory("JobChainV2");
  const jobChain = await JobChainV2.deploy(USDC_ARC);
  await jobChain.waitForDeployment();

  const address = await jobChain.getAddress();
  console.log("JobChainV2 deployed to:", address);
  console.log("USDC address:", USDC_ARC);
  console.log("");
  console.log("Update lib/contracts.ts with:");
  console.log(`export const JOBCHAIN_CONTRACT_ADDRESS = "${address}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
