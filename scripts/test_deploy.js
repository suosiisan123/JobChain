const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy MockYieldPool
  console.log("Deploying MockYieldPool...");
  const MockYieldPool = await hre.ethers.getContractFactory("MockYieldPool");
  const mockPool = await MockYieldPool.deploy();
  await mockPool.waitForDeployment();
  const poolAddress = await mockPool.getAddress();
  console.log("MockYieldPool deployed to:", poolAddress);

  // Deploy ZKVerifier
  console.log("Deploying ZKVerifier...");
  const ZKVerifier = await hre.ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(deployer.address);
  await zkVerifier.waitForDeployment();
  const verifierAddress = await zkVerifier.getAddress();
  console.log("ZKVerifier deployed to:", verifierAddress);

  // Predict RevenueDistributor address
  const currentNonce = await deployer.getNonce();
  const predictedDistributorAddress = hre.ethers.getCreateAddress({
    from: deployer.address,
    nonce: currentNonce + 1 // jobChain (0), distributor (1)
  });
  console.log("Predicted RevenueDistributor Address:", predictedDistributorAddress);

  // Deploy JobChainV2
  console.log("Deploying JobChainV2...");
  const JobChainV2 = await hre.ethers.getContractFactory("JobChainV2");
  const contract = await JobChainV2.deploy(
    hre.ethers.ZeroAddress, // USDC
    hre.ethers.ZeroAddress, // EURC
    hre.ethers.ZeroAddress, // IDENTITY_REGISTRY
    hre.ethers.ZeroAddress, // REPUTATION_REGISTRY
    hre.ethers.ZeroAddress, // stableFX
    poolAddress,
    verifierAddress,
    predictedDistributorAddress
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("JobChainV2 deployed to:", address);
}

main().catch((error) => {
  console.error("Deploy failed:", error);
  process.exitCode = 1;
});
