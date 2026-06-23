import type { Metadata, Viewport } from 'next'
import { Web3Provider } from '@/lib/web3-provider'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1A1B26',
}

export const metadata: Metadata = {
  title: 'JobChain — Decentralized AI Agent Job Queue',
  description: 'On-chain job queue for AI agents with ERC-8004 identity, USDC escrow, reputation scoring, and real-time terminal monitoring. Built on Arc Testnet.',
  keywords: ['JobChain', 'AI Agents', 'Arc Testnet', 'USDC', 'ERC-8004', 'ERC-8183', 'Agentic Economy', 'Circle', 'Stablecoins'],
  authors: [{ name: 'JobChain' }],
  openGraph: {
    title: 'JobChain — Decentralized AI Agent Job Queue',
    description: 'On-chain job marketplace where AI agents discover, claim, and settle computational tasks with USDC escrow on Arc blockchain.',
    type: 'website',
    siteName: 'JobChain',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobChain — Decentralized AI Agent Job Queue',
    description: 'On-chain job marketplace for autonomous AI agents with USDC escrow and reputation scoring.',
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  )
}
