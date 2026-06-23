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

  const overrides = {
    gasLimit: 8000000
  };

  // Helper function to deploy a contract from artifact
  async function deployContract(name, args = []) {
    console.log(`Deploying ${name}...`);
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact for ${name} not found at ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(...args, overrides);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`${name} deployed to: ${address}`);
    return { contract, address, abi: artifact.abi };
  }

  // USDC and Official ERC-8004 addresses on Arc Testnet
  const USDC_ARC = "0x3600000000000000000000000000000000000000";
  const EURC_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
  const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

  // 1. Deploy MockYieldPool
  const { address: poolAddress } = await deployContract("MockYieldPool");

  // 2. Deploy ZKVerifier
  const { address: verifierAddress } = await deployContract("ZKVerifier", [wallet.address]);

  // 3. Deploy JobChainV2
  const { contract: jobChainContract, address: jobChainAddress } = await deployContract("JobChainV2", [
    USDC_ARC,
    EURC_ARC,
    IDENTITY_REGISTRY,
    REPUTATION_REGISTRY,
    ethers.ZeroAddress, // stableFX
    poolAddress,
    verifierAddress,
    ethers.ZeroAddress // revenueDistributor (linked later)
  ]);

  // 4. Deploy JobAuctionManager
  const { address: auctionManagerAddress } = await deployContract("JobAuctionManager", [jobChainAddress]);

  // 5. Deploy JobDisputeManager
  const { address: disputeManagerAddress } = await deployContract("JobDisputeManager", [jobChainAddress]);

  // 6. Deploy JobScheduler
  const { address: schedulerAddress } = await deployContract("JobScheduler", [
    jobChainAddress,
    USDC_ARC,
    EURC_ARC
  ]);

  // 7. Deploy JOBToken
  const { address: tokenAddress } = await deployContract("JOBToken");

  // 8. Deploy RevenueDistributor
  const { address: distributorAddress } = await deployContract("RevenueDistributor", [
    tokenAddress,
    USDC_ARC,
    EURC_ARC,
    jobChainAddress
  ]);

  // 9. Configure linkages on-chain
  console.log("Configuring manager contracts and linkages...");

  // Set manager contracts in JobChainV2
  console.log("Setting JobAuctionManager in JobChainV2...");
  let tx = await jobChainContract.setManager(auctionManagerAddress, true, overrides);
  await tx.wait();

  console.log("Setting JobDisputeManager in JobChainV2...");
  tx = await jobChainContract.setManager(disputeManagerAddress, true, overrides);
  await tx.wait();

  console.log("Setting JobScheduler in JobChainV2...");
  tx = await jobChainContract.setManager(schedulerAddress, true, overrides);
  await tx.wait();

  // Set system addresses (including verifier and revenueDistributor) in JobChainV2
  console.log("Setting system addresses in JobChainV2...");
  tx = await jobChainContract.setSystemAddresses(
    verifierAddress,
    ethers.ZeroAddress,
    poolAddress,
    distributorAddress,
    overrides
  );
  await tx.wait();

  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  JobChainV2 Stack deployed successfully!      ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  JobChainAddress:      ${jobChainAddress}`);
  console.log(`║  JobAuctionManager:    ${auctionManagerAddress}`);
  console.log(`║  JobDisputeManager:    ${disputeManagerAddress}`);
  console.log(`║  JobScheduler:        ${schedulerAddress}`);
  console.log(`║  JOBToken:             ${tokenAddress}`);
  console.log(`║  RevenueDistributor:   ${distributorAddress}`);
  console.log(`║  MockYieldPool:        ${poolAddress}`);
  console.log(`║  ZKVerifier:           ${verifierAddress}`);
  console.log("╚════════════════════════════════════════════════╝");
}

main().catch((error) => {
  console.error("Deploy failed:", error);
  process.exitCode = 1;
});
