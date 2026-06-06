'use client'

import React from 'react'
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider, useAccount, useWriteContract } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { arcTestnet } from './arc-config'

import '@rainbow-me/rainbowkit/styles.css'

const config = getDefaultConfig({
  appName: 'JobChain',
  projectId: 'jobchain-arc-testnet', // WalletConnect cloud project ID (public demo)
  chains: [arcTestnet],
  ssr: true,
})

const queryClient = new QueryClient()

import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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
}

export const SmartWalletContext = createContext<SmartWalletContextType | null>(null)

// Dynamic loader for Circle SDK
let sdkInstance: any = null
if (typeof window !== 'undefined') {
  try {
    const { W3SSdk } = require('@circle-fin/w3s-pw-web-sdk')
    sdkInstance = new W3SSdk({
      appSettings: {
        appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID || 'sim_app_id'
      }
    })
  } catch (err) {
    console.warn('[Circle SDK] SDK import bypassed or simulated:', err)
  }
}

function SmartWalletProviderInner({ children }: { children: React.ReactNode }) {
  const { address: eoaAddress, isConnected: isEoaConnected } = useAccount()
  const { writeContractAsync: eoaWriteContractAsync } = useWriteContract()

  const [passkeyAddress, setPasskeyAddress] = useState<string | undefined>(undefined)
  const [passkeyEmail, setPasskeyEmail] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAddress = localStorage.getItem('jobchain_passkey_address')
      const storedEmail = localStorage.getItem('jobchain_passkey_email')
      if (storedAddress && storedEmail) {
        setPasskeyAddress(storedAddress)
        setPasskeyEmail(storedEmail)
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

      const { challenge, userId, userExists } = challengeData

      let credential: any
      if (!userExists) {
        credential = await navigator.credentials.create({
          publicKey: {
            challenge: Uint8Array.from(atob(challenge), c => c.charCodeAt(0)),
            rp: { name: 'JobChain Smart Wallet', id: window.location.hostname },
            user: {
              id: Uint8Array.from(userId, (c: string) => c.charCodeAt(0)),
              name: email,
              displayName: email,
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        })
      } else {
        credential = await navigator.credentials.get({
          publicKey: {
            challenge: Uint8Array.from(atob(challenge), c => c.charCodeAt(0)),
            rpId: window.location.hostname,
            userVerification: 'required',
            timeout: 60000,
          },
        })
      }

      if (!credential) throw new Error('Biometric authentication cancelled')

      const credentialSerialized = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        type: credential.type,
        response: {
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
          attestationObject: credential.response.attestationObject
            ? btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)))
            : undefined,
          authenticatorData: credential.response.authenticatorData
            ? btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData)))
            : undefined,
          signature: credential.response.signature
            ? btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
            : undefined,
        }
      }

      const verifyRes = await fetch('/api/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credential: credentialSerialized, action: userExists ? 'login' : 'register' })
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed')

      const address = verifyData.walletAddress
      setPasskeyAddress(address)
      setPasskeyEmail(email)
      localStorage.setItem('jobchain_passkey_address', address)
      localStorage.setItem('jobchain_passkey_email', email)

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
    localStorage.removeItem('jobchain_passkey_address')
    localStorage.removeItem('jobchain_passkey_email')
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
      const txChallengeRes = await fetch('/api/passkey/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: passkeyEmail, txRequest: { functionName: args.functionName } })
      })
      const txChallengeData = await txChallengeRes.json()
      if (!txChallengeRes.ok) throw new Error(txChallengeData.error || 'Failed to initiate execution verification')

      const txCredential = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(atob(txChallengeData.challenge), c => c.charCodeAt(0)),
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
        },
      })
      if (!txCredential) throw new Error('Biometric verification rejected')

      const getFunctionSignature = (abi: any[], name: string): string => {
        const fn = abi.find(item => item.name === name && item.type === 'function')
        if (!fn) return `${name}()`
        const params = (fn.inputs || []).map((i: any) => i.type).join(',')
        return `${name}(${params})`
      }

      const abiFunctionSignature = getFunctionSignature(args.abi, args.functionName)
      const executeRes = await fetch('/api/passkey/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: passkeyEmail,
          walletAddress: passkeyAddress,
          contractAddress: args.address,
          abiFunctionSignature,
          abiParameters: args.args || [],
          functionName: args.functionName,
        })
      })

      const executeData = await executeRes.json()
      if (!executeRes.ok) throw new Error(executeData.error || 'SCA execution failed')

      // Save to localStorage history so it displays instantly on frontend
      const localHistoryKey = `tx_history_${passkeyEmail}`
      const existingHistory = JSON.parse(localStorage.getItem(localHistoryKey) || '[]')
      existingHistory.unshift({
        txHash: executeData.txHash,
        functionName: args.functionName,
        timestamp: new Date().toISOString()
      })
      localStorage.setItem(localHistoryKey, JSON.stringify(existingHistory))

      // Trigger standard storage event so other tabs hear it
      window.dispatchEvent(new Event('storage'))

      if (executeData.challengeId && sdkInstance) {
        await new Promise<void>((resolve, reject) => {
          sdkInstance.execute(executeData.challengeId, (err: any, result: any) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }

      return executeData.txHash
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
      writeContractAsync
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
