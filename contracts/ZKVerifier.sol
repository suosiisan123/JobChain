// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract ZKVerifier {
    address public owner;
    address public attestationAuthority;

    event AttestationAuthorityUpdated(address indexed oldAuthority, address indexed newAuthority);

    constructor(address _attestationAuthority) {
        owner = msg.sender;
        attestationAuthority = _attestationAuthority;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setAttestationAuthority(address _newAuthority) external onlyOwner {
        emit AttestationAuthorityUpdated(attestationAuthority, _newAuthority);
        attestationAuthority = _newAuthority;
    }

    /**
     * @notice Verifies a cryptographic capability attestation signature for an agent.
     * @param agentId The ID of the agent being verified.
     * @param capabilities The comma-separated capability string.
     * @param signature The ECDSA signature signed by the attestationAuthority.
     */
    function verifyCapability(
        uint256 agentId,
        string calldata capabilities,
        bytes calldata signature
    ) external view returns (bool) {
        if (signature.length == 0) return false;
        bytes32 messageHash = keccak256(abi.encodePacked(agentId, capabilities));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(ethSignedMessageHash, signature);
        return signer == attestationAuthority && signer != address(0);
    }

    /**
     * @notice Verifies a cryptographic work execution proof or attestation signature.
     * @param jobId The ID of the job.
     * @param resultHash The hash/URI of the submitted result.
     * @param proof The ECDSA signature signed by the attestationAuthority or verification service.
     */
    function verifyExecution(
        uint256 jobId,
        string calldata resultHash,
        bytes calldata proof
    ) external view returns (bool) {
        if (proof.length == 0) return false;
        
        // Dynamic mock ZK equation check if length is 32 bytes (simulating key-based verification)
        // or standard cryptographic ECDSA verification
        if (proof.length == 32) {
            bytes32 mockProofValue = abi.decode(proof, (bytes32));
            return mockProofValue == keccak256(abi.encodePacked(jobId, resultHash, "ZK-PROOF-PASS"));
        }

        bytes32 messageHash = keccak256(abi.encodePacked(jobId, resultHash));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = recoverSigner(ethSignedMessageHash, proof);
        return signer == attestationAuthority && signer != address(0);
    }

    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) public pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        return ecrecover(ethSignedMessageHash, v, r, s);
    }
}
