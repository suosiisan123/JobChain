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
  const artifactPath = path.join(__dirname, "../artifacts/contracts/GatewayVault.sol/GatewayVault.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("Deploying GatewayVault...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`GatewayVault successfully deployed to: ${address}`);
}

main().catch((error) => {
  console.error("Deploy failed:", error.message);
  process.exitCode = 1;
});
