export interface DomainError {
  code: string
  title: string
  message: string
  retryable: boolean
}

export function mapRawError(error: any): DomainError {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Action Failed',
      message: 'The requested operation failed due to an unknown error. Please try again.',
      retryable: true
    }
  }

  // Parse message strings from error variants (objects, strings, nested details)
  let rawMsg = ''
  if (typeof error === 'string') {
    rawMsg = error
  } else {
    rawMsg = String(error.message || error.details || error.shortMessage || error.reason || '')
  }
  const cleanMsg = rawMsg.toLowerCase()

  // 1. Rate Limit Checks
  if (cleanMsg.includes('429') || cleanMsg.includes('rate limit') || cleanMsg.includes('too many requests')) {
    return {
      code: 'RATE_LIMIT_ERROR',
      title: 'Rate Limit Exceeded',
      message: 'The node endpoint is experiencing heavy volume. Please wait a few seconds and tap retry.',
      retryable: true
    }
  }

  // 2. User Cancellations / Rejections
  if (
    cleanMsg.includes('user rejected') || 
    cleanMsg.includes('user denied') || 
    cleanMsg.includes('cancelled') || 
    cleanMsg.includes('canceled') || 
    cleanMsg.includes('declined') ||
    cleanMsg.includes('user_rejected')
  ) {
    return {
      code: 'WALLET_REJECTED',
      title: 'Signature Cancelled',
      message: 'The cryptographic signature request was cancelled or declined in your wallet.',
      retryable: true
    }
  }

  // 3. WebAuthn / Passkey Biometrics
  if (
    cleanMsg.includes('webauthn') || 
    cleanMsg.includes('credential') || 
    cleanMsg.includes('authenticator') || 
    cleanMsg.includes('fingerprint') ||
    cleanMsg.includes('biometric') ||
    cleanMsg.includes('passkey')
  ) {
    return {
      code: 'BIOMETRIC_AUTH_FAILED',
      title: 'Passkey Authentication Failed',
      message: 'Touch ID, Face ID, or your physical security key was not verified. Please verify your device capabilities and try again.',
      retryable: true
    }
  }

  // 4. Bundler mempool issues (max operations/unstaked account lockups)
  if (
    cleanMsg.includes('mempool') || 
    (cleanMsg.includes('max operations') && cleanMsg.includes('unstaked')) ||
    cleanMsg.includes('operation queue')
  ) {
    return {
      code: 'BUNDLER_QUEUE_STUCK',
      title: 'Transaction Queue Busy',
      message: 'Your smart wallet has multiple pending operations waiting in the bundler mempool. Please disconnect and wait 5 minutes to clear.',
      retryable: false
    }
  }

  // 5. Insufficient funds / Gas
  if (
    cleanMsg.includes('insufficient funds') || 
    cleanMsg.includes('low balance') || 
    cleanMsg.includes('exceeds balance') || 
    cleanMsg.includes('gas token') ||
    cleanMsg.includes('needs gas')
  ) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      title: 'Insufficient Balance',
      message: 'You have insufficient USDC or native gas token (on EOA) to complete the transaction or pay the network fees.',
      retryable: false
    }
  }

  // 6. Offline / Network disconnects
  if (
    cleanMsg.includes('network') || 
    cleanMsg.includes('offline') || 
    cleanMsg.includes('failed to fetch') || 
    cleanMsg.includes('dns') ||
    cleanMsg.includes('connection refused')
  ) {
    return {
      code: 'NETWORK_DISCONNECT',
      title: 'Network Lost',
      message: 'Unable to communicate with the blockchain. Please check your internet connectivity.',
      retryable: true
    }
  }

  // 7. Contract execution reverts
  if (cleanMsg.includes('revert') || cleanMsg.includes('execution reverted')) {
    // Extract readable custom errors if possible
    let detail = 'The smart contract reverted the transaction. Check your inputs or permissions.'
    if (cleanMsg.includes('not verified')) {
      detail = 'Your wallet address is not registered on the ERC-8004 Identity registry.'
    } else if (cleanMsg.includes('insufficient allowance')) {
      detail = 'Your approved USDC allowance is too low. Approve spending limit first.'
    }
    return {
      code: 'CONTRACT_REVERT',
      title: 'Contract Execution Reverted',
      message: detail,
      retryable: false
    }
  }

  // Default Fallback
  return {
    code: 'GENERIC_FAILURE',
    title: 'Operation Failed',
    message: error.message || 'An unexpected runtime error occurred. Please report this issue to support.',
    retryable: true
  }
}
