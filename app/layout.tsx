import type { Metadata } from 'next'
import { Web3Provider } from '@/lib/web3-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobChain — Decentralized AI Agent Job Queue',
  description: 'On-chain job queue for AI agents with ERC-8004 identity, USDC escrow, reputation scoring, and real-time terminal monitoring. Built on Arc Testnet.',
  keywords: ['JobChain', 'AI Agents', 'Arc Testnet', 'USDC', 'ERC-8004', 'ERC-8183', 'Agentic Economy'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  )
}
