import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying JobChainV2 with account:", deployer.address);

  // USDC and Official ERC-8004 addresses on Arc Testnet
  const USDC_ARC = "0x3600000000000000000000000000000000000000";
  const EURC_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
  const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

  console.log("Deploying MockYieldPool...");
  const MockYieldPool = await ethers.getContractFactory("MockYieldPool");
  const mockYieldPool = await MockYieldPool.deploy();
  await mockYieldPool.waitForDeployment();
  const poolAddress = await mockYieldPool.getAddress();
  console.log("MockYieldPool deployed to:", poolAddress);

  console.log("Deploying ZKVerifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(deployer.address);
  await zkVerifier.waitForDeployment();
  const verifierAddress = await zkVerifier.getAddress();
  console.log("ZKVerifier deployed to:", verifierAddress);

  // Predict RevenueDistributor address using createAddress to solve circular dependencies
  const currentNonce = await deployer.getNonce();
  const predictedDistributorAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: currentNonce + 4 // pool (0), verifier (1), jobChain (2), jobToken (3), distributor (4)
  });
  console.log("Predicted RevenueDistributor Address:", predictedDistributorAddress);

  const JobChainV2 = await ethers.getContractFactory("JobChainV2");
  const jobChain = await JobChainV2.deploy(
    USDC_ARC,
    EURC_ARC,
    IDENTITY_REGISTRY,
    REPUTATION_REGISTRY,
    ethers.ZeroAddress, // stableFX
    poolAddress,
    verifierAddress,
    predictedDistributorAddress
  );
  await jobChain.waitForDeployment();
  const address = await jobChain.getAddress();
  console.log("JobChainV2 deployed to:", address);

  // Deploy JOBToken
  console.log("Deploying JOBToken...");
  const JOBToken = await ethers.getContractFactory("JOBToken");
  const jobToken = await JOBToken.deploy();
  await jobToken.waitForDeployment();
  const tokenAddress = await jobToken.getAddress();
  console.log("JOBToken deployed to:", tokenAddress);

  // Deploy RevenueDistributor
  console.log("Deploying RevenueDistributor...");
  const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
  const revenueDistributor = await RevenueDistributor.deploy(
    tokenAddress,
    USDC_ARC,
    EURC_ARC,
    address
  );
  await revenueDistributor.waitForDeployment();
  const distributorAddress = await revenueDistributor.getAddress();
  console.log("RevenueDistributor deployed to:", distributorAddress);

  // Double check if predicted address matches actual address, if not, update it
  if (predictedDistributorAddress.toLowerCase() !== distributorAddress.toLowerCase()) {
    console.log("Predicted address differed. Updating on-chain linkages...");
    const tx = await jobChain.setRevenueDistributor(distributorAddress);
    await tx.wait();
    console.log("Linkage updated successfully.");
  }

  console.log("ZKVerifier deployed to:", verifierAddress);
  console.log("USDC address:", USDC_ARC);
  console.log("IdentityRegistry:", IDENTITY_REGISTRY);
  console.log("ReputationRegistry:", REPUTATION_REGISTRY);
  console.log("");
  console.log("Update lib/contracts.ts with:");
  console.log(`export const JOBCHAIN_CONTRACT_ADDRESS = "${address}";`);
  console.log(`export const ZK_VERIFIER_CONTRACT_ADDRESS = "${verifierAddress}";`);
  console.log(`export const JOB_TOKEN_ADDRESS = "${tokenAddress}";`);
  console.log(`export const REVENUE_DISTRIBUTOR_ADDRESS = "${distributorAddress}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
