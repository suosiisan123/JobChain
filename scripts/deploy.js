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

  // Deploy MockYieldPool first
  console.log("Deploying MockYieldPool...");
  const poolArtifactPath = path.join(__dirname, "../artifacts/contracts/MockYieldPool.sol/MockYieldPool.json");
  const poolArtifact = JSON.parse(fs.readFileSync(poolArtifactPath, "utf8"));
  const poolFactory = new ethers.ContractFactory(poolArtifact.abi, poolArtifact.bytecode, wallet);
  const mockPool = await poolFactory.deploy();
  await mockPool.waitForDeployment();
  const poolAddress = await mockPool.getAddress();
  console.log(`MockYieldPool deployed to: ${poolAddress}`);

  // Deploy ZKVerifier
  console.log("Deploying ZKVerifier...");
  const verifierArtifactPath = path.join(__dirname, "../artifacts/contracts/ZKVerifier.sol/ZKVerifier.json");
  const verifierArtifact = JSON.parse(fs.readFileSync(verifierArtifactPath, "utf8"));
  const verifierFactory = new ethers.ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, wallet);
  const zkVerifier = await verifierFactory.deploy(wallet.address);
  await zkVerifier.waitForDeployment();
  const verifierAddress = await zkVerifier.getAddress();
  console.log(`ZKVerifier deployed to: ${verifierAddress}`);

  // Predict RevenueDistributor address using createAddress to solve circular dependencies
  const currentNonce = await wallet.getNonce();
  const predictedDistributorAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: currentNonce + 4 // pool (0), verifier (1), jobChain (2), jobToken (3), distributor (4)
  });
  console.log("Predicted RevenueDistributor Address:", predictedDistributorAddress);

  // Deploy JobChainV2
  console.log("Deploying JobChainV2...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(
    USDC_ARC,
    "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
    IDENTITY_REGISTRY,
    REPUTATION_REGISTRY,
    ethers.ZeroAddress, // StableFX (Zero address to fallback)
    poolAddress,
    verifierAddress,
    predictedDistributorAddress
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  // Deploy JOBToken
  console.log("Deploying JOBToken...");
  const tokenArtifactPath = path.join(__dirname, "../artifacts/contracts/JOBToken.sol/JOBToken.json");
  const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, "utf8"));
  const tokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, wallet);
  const jobToken = await tokenFactory.deploy();
  await jobToken.waitForDeployment();
  const tokenAddress = await jobToken.getAddress();
  console.log(`JOBToken deployed to: ${tokenAddress}`);

  // Deploy RevenueDistributor
  console.log("Deploying RevenueDistributor...");
  const distArtifactPath = path.join(__dirname, "../artifacts/contracts/RevenueDistributor.sol/RevenueDistributor.json");
  const distArtifact = JSON.parse(fs.readFileSync(distArtifactPath, "utf8"));
  const distFactory = new ethers.ContractFactory(distArtifact.abi, distArtifact.bytecode, wallet);
  const revenueDistributor = await distFactory.deploy(
    tokenAddress,
    USDC_ARC,
    "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC
    address
  );
  await revenueDistributor.waitForDeployment();
  const distributorAddress = await revenueDistributor.getAddress();
  console.log(`RevenueDistributor deployed to: ${distributorAddress}`);

  // Linkage validation / update
  if (predictedDistributorAddress.toLowerCase() !== distributorAddress.toLowerCase()) {
    console.log("Predicted address differed. Updating on-chain linkages...");
    const tx = await contract.setRevenueDistributor(distributorAddress);
    await tx.wait();
    console.log("Linkage updated successfully.");
  }

  console.log("");
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  JobChainV2 & DAO deployed successfully!       ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  Address: ${address}  `);
  console.log(`║  JOBToken: ${tokenAddress}  `);
  console.log(`║  RevenueDistributor: ${distributorAddress}  `);
  console.log(`║  ZKVerifier: ${verifierAddress}  `);
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
