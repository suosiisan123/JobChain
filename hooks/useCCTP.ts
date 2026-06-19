'use client'

import { useState, useEffect } from 'react'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { usePublicClient, useWalletClient } from 'wagmi'
import { keccak256, toHex, encodeAbiParameters, parseAbiParameters, parseUnits } from 'viem'
import {
  CCTP_TOKEN_MESSENGER,
  CCTP_MESSAGE_TRANSMITTER,
  tokenMessengerAbi,
  messageTransmitterAbi,
  usdcAbi,
  JOBCHAIN_CONTRACT_ADDRESS,
  jobChainAbi,
  USDC_ADDRESS_ARC
} from '@/lib/contracts'
import toast from 'react-hot-toast'

export type BridgeStep =
  | 'IDLE'
  | 'APPROVING'
  | 'APPROVED'
  | 'BURNING'
  | 'BURNED'
  | 'WAITING_FOR_ATTESTATION'
  | 'ATTESTATION_RECEIVED'
  | 'MINTING'
  | 'MINTED'
  | 'CREATING_JOB'
  | 'SUCCESS'
  | 'ERROR'

export interface BridgeState {
  step: BridgeStep
  sourceChainId: number
  amount: string
  burnTxHash?: string
  messageBytes?: string
  messageHash?: string
  attestationBytes?: string
  mintTxHash?: string
  jobTxHash?: string
  jobId?: string
  error?: string
  description?: string
  requiredCapabilities?: string
  deadlineHours?: string
  timestamp: number
}

export const CCTP_CHAINS = [
  {
    id: 11155111,
    name: 'Ethereum Sepolia',
    domain: 0,
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    estimatedTime: '15-20 min',
    fee: '0.00 USDC'
  },
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    domain: 3,
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    estimatedTime: '1-2 min',
    fee: '0.00 USDC'
  },
  {
    id: 84532,
    name: 'Base Sepolia',
    domain: 6,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    estimatedTime: '1-2 min',
    fee: '0.00 USDC'
  }
] as const

const STORAGE_KEY = 'jobchain_pending_bridge'

export function useCCTP() {
  const { address, writeContractAsync } = useSmartWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [bridgeState, setBridgeState] = useState<BridgeState>({
    step: 'IDLE',
    sourceChainId: CCTP_CHAINS[1].id,
    amount: '',
    timestamp: 0
  })

  // Load pending bridge on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as BridgeState
          // If the bridge is older than 2 hours, discard it
          if (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000) {
            setBridgeState(parsed)
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        } catch {}
      }
    }
  }, [])

  // Persist bridge state changes
  const updateBridgeState = (updates: Partial<BridgeState>) => {
    setBridgeState((prev) => {
      const newState = { ...prev, ...updates, timestamp: Date.now() }
      if (newState.step === 'IDLE' || newState.step === 'SUCCESS') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      }
      return newState
    })
  }

  const resetBridge = () => {
    localStorage.removeItem(STORAGE_KEY)
    setBridgeState({
      step: 'IDLE',
      sourceChainId: CCTP_CHAINS[1].id,
      amount: '',
      timestamp: 0
    })
  }

  // Orchestrate the bridging workflow
  const startBridgeAndEscrow = async (params: {
    sourceChainId: number
    amount: string
    description: string
    requiredCapabilities: string
    deadlineHours: string
  }) => {
    const { sourceChainId, amount, description, requiredCapabilities, deadlineHours } = params
    const chainConfig = CCTP_CHAINS.find(c => c.id === sourceChainId)
    if (!chainConfig) {
      toast.error('Unsupported source chain selected')
      return
    }

    if (!address) {
      toast.error('Wallet not connected')
      return
    }

    updateBridgeState({
      step: 'APPROVING',
      sourceChainId,
      amount,
      description,
      requiredCapabilities,
      deadlineHours,
      error: undefined
    })

    // ═══════════════════════════════════════════════════════════════
    // REAL CCTP BRIDGING WORKFLOW
    // ═══════════════════════════════════════════════════════════════
    try {
      if (!walletClient || !publicClient) {
        throw new Error('Web3 clients not initialized. Check connection.')
      }

      // 1. Check current wallet chain matches source chain
      const currentChainId = await walletClient.getChainId()
      if (currentChainId !== sourceChainId) {
        throw new Error(`Please switch your wallet network to ${chainConfig.name} in RainbowKit.`)
      }

      const decimals = 6
      const amountUnits = parseUnits(amount, decimals)

      // 2. Approve USDC on source chain
      const approveTx = await walletClient.writeContract({
        address: chainConfig.usdcAddress as `0x${string}`,
        abi: usdcAbi,
        functionName: 'approve',
        args: [CCTP_TOKEN_MESSENGER, amountUnits]
      })
      
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx })
      if (approveReceipt.status !== 'success') {
        throw new Error('USDC Approval transaction failed on source chain')
      }
      
      updateBridgeState({ step: 'APPROVED' })

      // 3. Initiate CCTP burn
      const recipientBytes32 = toHex(address as `0x${string}`, { size: 32 })
      const burnTx = await walletClient.writeContract({
        address: CCTP_TOKEN_MESSENGER,
        abi: tokenMessengerAbi,
        functionName: 'depositForBurn',
        args: [amountUnits, 26, recipientBytes32, chainConfig.usdcAddress as `0x${string}`]
      })

      updateBridgeState({ step: 'BURNING' })
      const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: burnTx })
      if (burnReceipt.status !== 'success') {
        throw new Error('CCTP Burn transaction failed on source chain')
      }

      // Extract CCTP message bytes from events
      // CCTP MessageTransmitter event topic: MessageSent(bytes message)
      const messageSentTopic = '0x8c5261668696ce2189d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2' // simulated hash topic
      // Parse logs to find message
      const log = burnReceipt.logs.find(
        (l) => l.address.toLowerCase() === CCTP_MESSAGE_TRANSMITTER.toLowerCase()
      )
      if (!log) {
        throw new Error('CCTP MessageSent log not found in transaction receipt')
      }

      const messageBytes = log.data
      const messageHash = keccak256(messageBytes)

      updateBridgeState({
        step: 'BURNED',
        burnTxHash: burnTx,
        messageBytes,
        messageHash
      })

      // 4. Poll Circle Attestation API
      updateBridgeState({ step: 'WAITING_FOR_ATTESTATION' })
      let attestationBytes = ''
      const startTime = Date.now()
      
      // Timeout after 20 minutes
      while (Date.now() - startTime < 20 * 60 * 1000) {
        try {
          const response = await fetch(
            `https://iris-api-sandbox.circle.com/attestations/${messageHash}`
          )
          const data = await response.json()
          if (data.status === 'complete' && data.attestation) {
            attestationBytes = data.attestation
            break
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 10000)) // Poll every 10 seconds
      }

      if (!attestationBytes) {
        throw new Error('Circle CCTP Attestation retrieval timed out.')
      }

      updateBridgeState({
        step: 'ATTESTATION_RECEIVED',
        attestationBytes
      })

      // 5. Mint USDC on Arc Testnet
      // Since Arc is the destination chain, we must switch or execute the receiver
      // Note: For User Smart Accounts/Passkeys, the backend can execute this or we can ask EOA
      updateBridgeState({ step: 'MINTING' })
      
      // Ask useSmartWallet to execute standard receiveMessage call on Arc Transmitter
      const mintTx = await writeContractAsync({
        address: CCTP_MESSAGE_TRANSMITTER,
        abi: messageTransmitterAbi,
        functionName: 'receiveMessage',
        args: [messageBytes, attestationBytes]
      })

      updateBridgeState({
        step: 'MINTED',
        mintTxHash: mintTx
      })

      // 6. Deposit to Escrow and Post Job on Arc
      updateBridgeState({ step: 'CREATING_JOB' })
      const rewardUnits = parseUnits(amount, 6)
      const deadlineSec = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineHours) * 3600)

      const jobTx = await writeContractAsync({
        address: JOBCHAIN_CONTRACT_ADDRESS,
        abi: jobChainAbi,
        functionName: 'postJob',
        args: [description, requiredCapabilities, rewardUnits, deadlineSec]
      })

      updateBridgeState({
        step: 'SUCCESS',
        jobTxHash: jobTx,
        jobId: 'Arc_CCTP_Job'
      })
      toast.success('Cross-chain job funded and created successfully!')
    } catch (err: any) {
      updateBridgeState({ step: 'ERROR', error: err.message || 'Bridging failed' })
      toast.error(err.message || 'Bridging failed')
    }
  }

  return {
    bridgeState,
    startBridgeAndEscrow,
    resetBridge
  }
}
