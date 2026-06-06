import time
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

# Default contract addresses on Arc Testnet
DEFAULT_JOBCHAIN = '0x06bdC5FC3A02Cb00df43cdf581fe038dFeFF58DE'
DEFAULT_IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
DEFAULT_USDC = '0x3600000000000000000000000000000000000000'

# Minimal ABIs for web3.py contract instantiation
IDENTITY_REGISTRY_ABI = [
    {
        "inputs": [{"name": "metadataURI", "type": "string"}],
        "name": "register",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": True, "name": "tokenId", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    }
]

ERC20_ABI = [
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

JOBCHAIN_ABI = [
    {
        "inputs": [
            {"name": "_agentId", "type": "uint256"},
            {"name": "_amount", "type": "uint256"}
        ],
        "name": "stakeCollateral",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "_jobId", "type": "uint256"},
            {"name": "_agentId", "type": "uint256"},
            {"name": "_capabilityProof", "type": "bytes"}
        ],
        "name": "pickupJob",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "_jobId", "type": "uint256"},
            {"name": "_resultHash", "type": "string"},
            {"name": "_proof", "type": "bytes"}
        ],
        "name": "submitResult",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "_jobId", "type": "uint256"}],
        "name": "getJob",
        "outputs": [
            {"name": "poster", "type": "address"},
            {"name": "description", "type": "string"},
            {"name": "requiredCapabilities", "type": "string"},
            {"name": "reward", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
            {"name": "assignedAgent", "type": "uint256"},
            {"name": "status", "type": "uint8"},
            {"name": "resultHash", "type": "string"},
            {"name": "rating", "type": "uint8"},
            {"name": "createdAt", "type": "uint256"},
            {"name": "paymentToken", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextJobId",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

class JobChainSDK:
    def __init__(self, private_key: str, rpc_url: str, authority_private_key: str = None,
                 jobchain_address: str = DEFAULT_JOBCHAIN, identity_registry_address: str = DEFAULT_IDENTITY_REGISTRY,
                 usdc_address: str = DEFAULT_USDC):
        
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.private_key = private_key if private_key.startswith('0x') else '0x' + private_key
        self.account = Account.from_key(self.private_key)
        
        auth_pk = authority_private_key or '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
        self.authority_private_key = auth_pk if auth_pk.startswith('0x') else '0x' + auth_pk
        self.authority_account = Account.from_key(self.authority_private_key)
        
        self.jobchain_address = Web3.to_checksum_address(jobchain_address)
        self.identity_registry_address = Web3.to_checksum_address(identity_registry_address)
        self.usdc_address = Web3.to_checksum_address(usdc_address)
        
        self.jobchain = self.w3.eth.contract(address=self.jobchain_address, abi=JOBCHAIN_ABI)
        self.identity_registry = self.w3.eth.contract(address=self.identity_registry_address, abi=IDENTITY_REGISTRY_ABI)
        self.usdc = self.w3.eth.contract(address=self.usdc_address, abi=ERC20_ABI)

    def generate_capability_proof(self, agent_id: int, capabilities: str) -> bytes:
        msg_hash = Web3.solidity_keccak(['uint256', 'string'], [agent_id, capabilities])
        message = encode_defunct(primitive=msg_hash)
        signed_message = Account.sign_message(message, private_key=self.authority_private_key)
        return signed_message.signature

    def generate_execution_proof(self, job_id: int, result_hash: str) -> bytes:
        msg_hash = Web3.solidity_keccak(['uint256', 'string'], [job_id, result_hash])
        message = encode_defunct(primitive=msg_hash)
        signed_message = Account.sign_message(message, private_key=self.authority_private_key)
        return signed_message.signature

    def register_agent(self, name: str, capabilities: str) -> int:
        metadata_uri = f"ipfs://bafkreib-{name.lower()}-{capabilities.lower()}"
        
        tx = self.identity_registry.functions.register(metadata_uri).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.w3.eth.gas_price
        })
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Parse Transfer log to extract tokenId
        logs = self.identity_registry.events.Transfer().process_receipt(receipt)
        if logs:
            return logs[0]['args']['tokenId']
        raise Exception("Failed to retrieve minted Agent ID from transaction receipt logs")

    def stake_collateral(self, agent_id: int, amount: float) -> str:
        parsed_amount = int(amount * 1e6)
        
        # Approve
        approve_tx = self.usdc.functions.approve(self.jobchain_address, parsed_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.w3.eth.gas_price
        })
        signed_approve = self.w3.eth.account.sign_transaction(approve_tx, private_key=self.private_key)
        self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_raw_transaction(signed_approve.rawTransaction))
        
        # Stake
        stake_tx = self.jobchain.functions.stakeCollateral(agent_id, parsed_amount).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.w3.eth.gas_price
        })
        signed_stake = self.w3.eth.account.sign_transaction(stake_tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_stake.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.hex()

    def pickup_job(self, job_id: int, agent_id: int, capability_proof: bytes) -> str:
        tx = self.jobchain.functions.pickupJob(job_id, agent_id, capability_proof).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.w3.eth.gas_price
        })
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.hex()

    def submit_result(self, job_id: int, result_hash: str, proof: bytes) -> str:
        tx = self.jobchain.functions.submitResult(job_id, result_hash, proof).build_transaction({
            'from': self.account.address,
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'gasPrice': self.w3.eth.gas_price
        })
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.hex()

    def get_job(self, job_id: int) -> dict:
        d = self.jobchain.functions.getJob(job_id).call()
        return {
            "id": job_id,
            "poster": d[0],
            "description": d[1],
            "requiredCapabilities": d[2],
            "reward": d[3],
            "deadline": d[4],
            "assignedAgent": d[5],
            "status": d[6],
            "resultHash": d[7],
            "rating": d[8],
            "createdAt": d[9],
            "paymentToken": d[10]
        }

    def get_next_job_id(self) -> int:
        return self.jobchain.functions.nextJobId().call()

    def listen_for_jobs(self, callback, agent_id: int, capabilities: list, poll_interval_sec: float = 5.0):
        last_processed_job_id = self.get_next_job_id()
        print(f"[JobChainSDK Python] Listening for matching jobs for Agent #{agent_id}...")
        print(f"[JobChainSDK Python] Capabilities: {capabilities}. Starting from Job ID #{last_processed_job_id}")
        
        while True:
            try:
                next_id = self.get_next_job_id()
                if next_id > last_processed_job_id:
                    for i in range(last_processed_job_id, next_id):
                        job = self.get_job(i)
                        
                        # Open jobs only
                        if job["status"] == 0:
                            req_caps = [c.strip().lower() for c in job["requiredCapabilities"].split(',') if c.strip()]
                            has_match = len(req_caps) == 0 or any(c in capabilities for c in req_caps)
                            
                            if has_match:
                                print(f"\n[JobChainSDK Python] Match found! Job #{i}: {job['description']}")
                                try:
                                    # 1. Generate Capability Proof
                                    cap_proof = self.generate_capability_proof(agent_id, job["requiredCapabilities"])
                                    
                                    # 2. Claim job
                                    print(f"[JobChainSDK Python] Claiming job #{i} on-chain...")
                                    claim_tx = self.pickup_job(i, agent_id, cap_proof)
                                    print(f"[JobChainSDK Python] Claim successful! Tx: {claim_tx}")
                                    
                                    # 3. Execute logic (callback)
                                    result = callback(job)
                                    
                                    if result:
                                        # 4. Generate Execution Proof & Submit
                                        ipfs_hash = f"ipfs://bafkreih-{result.lower().replace(' ', '')}"
                                        exec_proof = self.generate_execution_proof(i, ipfs_hash)
                                        
                                        print(f"[JobChainSDK Python] Submitting result hash \"{ipfs_hash}\"...")
                                        submit_tx = self.submit_result(i, ipfs_hash, exec_proof)
                                        print(f"[JobChainSDK Python] Result submitted successfully! Tx: {submit_tx}")
                                except Exception as err:
                                    print(f"[JobChainSDK Python] Error processing job #{i}: {err}")
                    last_processed_job_id = next_id
            except Exception as err:
                print(f"[JobChainSDK Python] Connection error. Reconnecting in {poll_interval_sec}s... {err}")
            
            time.sleep(poll_interval_sec)
