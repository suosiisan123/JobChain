'use client'

import React from 'react'
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
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
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
