'use client'

import React from 'react'
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider, useAccount, useWriteContract } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { arcTestnet } from './arc-config'

import '@rainbow-me/rainbowkit/styles.css'

// WebAuthn global interceptor to resolve RP ID mismatches and platform authenticator limitations dynamically
if (typeof window !== 'undefined' && window.navigator?.credentials) {
  const originalCreate = window.navigator.credentials.create.bind(window.navigator.credentials)
  window.navigator.credentials.create = async function (options: any) {
    if (options?.publicKey) {
      console.log('[WebAuthn Interceptor] Intercepted credentials.create:', options.publicKey)
      
      // 1. Resolve RP ID domain mismatch
      const currentHost = window.location.hostname
      if (options.publicKey.rp?.id && options.publicKey.rp.id !== currentHost) {
        console.warn(`[WebAuthn Interceptor] RP ID mismatch! Expected: ${options.publicKey.rp.id}, Current Host: ${currentHost}. Overriding to bypass browser block.`)
        try {
          options.publicKey.rp.id = currentHost
        } catch (e) {
          console.error('[WebAuthn Interceptor] Failed to override rp.id:', e)
        }
      }

      // 2. Relax platform authenticator attachment constraints if Windows Hello/TouchID is disabled
      if (options.publicKey.authenticatorSelection) {
        if (options.publicKey.authenticatorSelection.authenticatorAttachment === 'platform') {
          console.warn('[WebAuthn Interceptor] authenticatorAttachment is set to "platform". Relaxing constraint to allow USB keys/mobile devices.')
          try {
            delete options.publicKey.authenticatorSelection.authenticatorAttachment
          } catch (e) {
            console.error('[WebAuthn Interceptor] Failed to delete authenticatorAttachment:', e)
          }
        }
      }
    }
    return originalCreate(options)
  }

  const originalGet = window.navigator.credentials.get.bind(window.navigator.credentials)
  window.navigator.credentials.get = async function (options: any) {
    if (options?.publicKey) {
      console.log('[WebAuthn Interceptor] Intercepted credentials.get:', options.publicKey)
      
      // 1. Resolve RP ID domain mismatch
      const currentHost = window.location.hostname
      if (options.publicKey.rpId && options.publicKey.rpId !== currentHost) {
        console.warn(`[WebAuthn Interceptor] RP ID mismatch! Expected: ${options.publicKey.rpId}, Current Host: ${currentHost}. Overriding to bypass browser block.`)
        try {
          options.publicKey.rpId = currentHost
        } catch (e) {
          console.error('[WebAuthn Interceptor] Failed to override rpId:', e)
        }
      }
    }
    return originalGet(options)
  }
}

export const config = getDefaultConfig({
  appName: 'JobChain',
  projectId: 'jobchain-arc-testnet', // WalletConnect cloud project ID (public demo)
  chains: [arcTestnet],
  ssr: true,
})

const queryClient = new QueryClient()

import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createPublicClient, encodeFunctionData } from 'viem'
import {
  type WebAuthnAccount,
  createBundlerClient,
  toWebAuthnAccount,
} from 'viem/account-abstraction'
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core'

export interface SmartWalletContextType {
  address: string | undefined
  isConnected: boolean
  isPasskey: boolean
  email: string | null
  login: (email: string) => Promise<string>
  logout: () => void
  writeContractAsync: (args: {
    address: `0x${string}`
    abi: any
    functionName: string
    args?: any[]
  }) => Promise<`0x${string}`>
  isSponsored: boolean
  paymasterUrl: string | null
  checkSponsorshipEligibility: (functionName: string, contractAddress: string) => Promise<{ eligible: boolean, reason?: string, paymasterUrl?: string }>
}

export const SmartWalletContext = createContext<SmartWalletContextType | null>(null)

const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY || 'TEST_CLIENT_KEY:7313d7ebea6caf047933111f3b96e392:020a95a91b12365acedee37a8102d4b0'
const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL || 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl'

const passkeyTransport = toPasskeyTransport(clientUrl, clientKey)
const modularTransport = toModularTransport(`${clientUrl}/arcTestnet`, clientKey)

const client = createPublicClient({
  chain: arcTestnet,
  transport: modularTransport,
})

const bundlerClient = createBundlerClient({
  chain: arcTestnet,
  transport: modularTransport,
})

function SmartWalletProviderInner({ children }: { children: React.ReactNode }) {
  const { address: eoaAddress, isConnected: isEoaConnected } = useAccount()
  const { writeContractAsync: eoaWriteContractAsync } = useWriteContract()

  const [passkeyAddress, setPasskeyAddress] = useState<string | undefined>(undefined)
  const [passkeyEmail, setPasskeyEmail] = useState<string | null>(null)
  const [passkeyAccount, setPasskeyAccount] = useState<any>(null)
  
  const [isSponsoredState, setIsSponsoredState] = useState(false)
  const [paymasterUrlState, setPaymasterUrlState] = useState<string | null>(null)

  const checkSponsorshipEligibility = async (functionName: string, contractAddress: string) => {
    return { eligible: true, paymasterUrl: clientUrl }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAddress = localStorage.getItem('jobchain_passkey_address')
      const storedEmail = localStorage.getItem('jobchain_passkey_email')
      const storedCred = localStorage.getItem('jobchain_passkey_credential')
      if (storedAddress && storedEmail) {
        setPasskeyAddress(storedAddress)
        setPasskeyEmail(storedEmail)
        if (storedCred) {
          try {
            const parsedCred = JSON.parse(storedCred)
            toCircleSmartAccount({
              client,
              owner: toWebAuthnAccount({ credential: parsedCred }) as WebAuthnAccount,
            }).then(acc => {
              setPasskeyAccount(acc)
            }).catch(err => {
              console.error('Failed to restore passkey account:', err)
            })
          } catch (e) {
            console.error('Error parsing stored credential:', e)
          }
        }
      }
    }
  }, [])

  const login = async (email: string): Promise<string> => {
    try {
      const challengeRes = await fetch('/api/passkey/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const challengeData = await challengeRes.json()
      if (!challengeRes.ok) throw new Error(challengeData.error || 'Failed to initialize session')

      const { userExists } = challengeData

      let credential: any
      if (!userExists) {
        credential = await toWebAuthnCredential({
          transport: passkeyTransport,
          mode: WebAuthnMode.Register,
          username: email,
        })
      } else {
        credential = await toWebAuthnCredential({
          transport: passkeyTransport,
          mode: WebAuthnMode.Login,
        })
      }

      if (!credential) throw new Error('Biometric authentication cancelled')

      // Instantiate the modular smart account
      const account = await toCircleSmartAccount({
        client,
        owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      })

      const address = account.address

      const verifyRes = await fetch('/api/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          credential,
          action: userExists ? 'login' : 'register',
          walletAddress: address
        })
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed')

      setPasskeyAddress(address)
      setPasskeyEmail(email)
      setPasskeyAccount(account)
      localStorage.setItem('jobchain_passkey_address', address)
      localStorage.setItem('jobchain_passkey_email', email)
      localStorage.setItem('jobchain_passkey_credential', JSON.stringify(credential))

      toast.success(`Logged in with Passkey: ${address.slice(0, 6)}...${address.slice(-4)}`)
      return address
    } catch (err: any) {
      console.error('Passkey Auth Error:', err)
      toast.error(err.message || 'Passkey auth failed')
      throw err
    }
  }

  const logout = () => {
    setPasskeyAddress(undefined)
    setPasskeyEmail(null)
    setPasskeyAccount(null)
    localStorage.removeItem('jobchain_passkey_address')
    localStorage.removeItem('jobchain_passkey_email')
    localStorage.removeItem('jobchain_passkey_credential')
    toast.success('Logged out of Smart Account')
  }

  const writeContractAsync = async (args: {
    address: `0x${string}`
    abi: any
    functionName: string
    args?: any[]
  }): Promise<`0x${string}`> => {
    if (isEoaConnected && eoaAddress) {
      return await eoaWriteContractAsync(args)
    }

    if (passkeyAddress && passkeyEmail) {
      let activeAccount = passkeyAccount
      if (!activeAccount) {
        const storedCred = localStorage.getItem('jobchain_passkey_credential')
        if (storedCred) {
          const parsedCred = JSON.parse(storedCred)
          activeAccount = await toCircleSmartAccount({
            client,
            owner: toWebAuthnAccount({ credential: parsedCred }) as WebAuthnAccount,
          })
          setPasskeyAccount(activeAccount)
        } else {
          throw new Error('Passkey credential not found. Please log in again.')
        }
      }

      console.log('[SCA Debug] 🚀 Starting writeContractAsync for Passkey Wallet:', {
        passkeyAddress,
        passkeyEmail,
        targetContract: args.address,
        functionName: args.functionName,
        arguments: args.args
      })
      toast.loading('Preparing secure biometric signature...', { id: 'passkey-tx' })
      try {
        console.log('[SCA Debug] Encoding contract function call data...')
        const callData = encodeFunctionData({
          abi: args.abi,
          functionName: args.functionName,
          args: args.args,
        })
        console.log('[SCA Debug] Generated CallData (hex):', callData)

        console.log('[SCA Debug] Sending User Operation request to Circle Bundler at:', clientUrl)
        toast.loading('Submitting transaction to bundler...', { id: 'passkey-tx' })

        const userOpHash = await bundlerClient.sendUserOperation({
          account: activeAccount,
          calls: [{
            to: args.address,
            data: callData,
          }],
          paymaster: true,
          maxPriorityFeePerGas: 1500000000n, // At least 1.5 Gwei to satisfy Arc Testnet precheck of 1 Gwei
          maxFeePerGas: 15000000000n, // 15 Gwei max fee
        })
        
        console.log('[SCA Debug] User Operation successfully sent! hash:', userOpHash)
        console.log(`[SCA Debug] You can track the user operation status at: ${clientUrl}/user-ops/${userOpHash}`)
        toast.loading(`User Op sent! Hash: ${userOpHash.slice(0, 10)}...`, { id: 'passkey-tx' })

        // Custom detailed polling loop for tracking state progression
        console.log('[SCA Debug] Starting polling loop for User Operation Receipt...')
        let receiptData: any = null
        let attempts = 0
        const maxAttempts = 60 // 3 minutes total
        const delayMs = 3000

        while (!receiptData && attempts < maxAttempts) {
          attempts++
          console.log(`[SCA Debug] Polling attempt ${attempts}/${maxAttempts} for userOp: ${userOpHash}`)
          try {
            // Check status via getUserOperationByHash first
            const opDetails = await bundlerClient.request({
              method: 'eth_getUserOperationByHash' as any,
              params: [userOpHash] as any
            })
            console.log(`[SCA Debug] getUserOperationByHash response (Attempt ${attempts}):`, opDetails)

            // Try getting the receipt
            receiptData = await bundlerClient.request({
              method: 'eth_getUserOperationReceipt' as any,
              params: [userOpHash] as any
            })
            
            if (receiptData) {
              console.log('[SCA Debug] User Operation Receipt retrieved! Details:', receiptData)
              break
            } else {
              console.log('[SCA Debug] Receipt is still null. User operation is pending inclusion.')
              toast.loading(`Waiting for block inclusion... (Attempt ${attempts}/${maxAttempts})`, { id: 'passkey-tx' })
            }
          } catch (e: any) {
            console.warn(`[SCA Debug] Query error on attempt ${attempts}:`, e.message || e)
          }
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

        if (!receiptData) {
          console.error('[SCA Debug] Polling timed out. User operation is still pending.')
          throw new Error(`Timed out waiting for User Operation ${userOpHash} to be confirmed. It remains pending in the bundler mempool.`)
        }

        const txHash = receiptData.receipt?.transactionHash || receiptData.transactionHash || receiptData.hash
        console.log('[SCA Debug] System settlement completed successfully! Transaction Hash:', txHash)
        toast.success(`Success! Tx Hash: ${txHash.slice(0, 10)}...`, { id: 'passkey-tx' })

        // Save to localStorage history so it displays instantly on frontend
        const localHistoryKey = `tx_history_${passkeyEmail}`
        const existingHistory = JSON.parse(localStorage.getItem(localHistoryKey) || '[]')
        existingHistory.unshift({
          txHash: txHash,
          functionName: args.functionName,
          timestamp: new Date().toISOString()
        })
        localStorage.setItem(localHistoryKey, JSON.stringify(existingHistory))

        // Trigger standard storage event so other tabs hear it
        window.dispatchEvent(new Event('storage'))

        return txHash
      } catch (err: any) {
        console.error('[SCA Debug] Execution failed with error:', err)
        toast.error(`Execution failed: ${err.message || err}`, { id: 'passkey-tx' })
        throw err
      }
    }

    throw new Error('No active wallet. Connect or login with Passkey.')
  }

  const activeAddress = eoaAddress || passkeyAddress
  const isConnected = isEoaConnected || !!passkeyAddress

  return (
    <SmartWalletContext.Provider value={{
      address: activeAddress,
      isConnected,
      isPasskey: !isEoaConnected && !!passkeyAddress,
      email: passkeyEmail,
      login,
      logout,
      writeContractAsync,
      isSponsored: !isEoaConnected && !!passkeyAddress,
      paymasterUrl: paymasterUrlState,
      checkSponsorshipEligibility
    }}>
      {children}
    </SmartWalletContext.Provider>
  )
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7AA2F7',
            accentColorForeground: '#1A1B26',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <SmartWalletProviderInner>
            {children}
          </SmartWalletProviderInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
