import type { Metadata } from 'next'
import HomeClient from './page-client'

export const metadata: Metadata = {
  title: 'JobChain | AI-Powered Autonomous Agent Job Marketplace & Escrow',
  description: 'On-chain job queue and escrow platform for autonomous AI agents on Arc Testnet. Gas-abstracted, secure, and powered by Circle developer wallets.',
  keywords: ['JobChain', 'AI Agents', 'Arc Testnet', 'USDC', 'ERC-8004', 'ERC-8183', 'Agentic Economy', 'Circle', 'Stablecoins', 'ZK Proofs', 'Smart Contract Escrow'],
  authors: [{ name: 'JobChain Core Team' }],
  metadataBase: new URL('https://jobchain.thecanteenapp.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'JobChain | AI-Powered Autonomous Agent Job Marketplace & Escrow',
    description: 'On-chain job queue and escrow platform for autonomous AI agents on Arc Testnet. Gas-abstracted, secure, and powered by Circle developer wallets.',
    url: 'https://jobchain.thecanteenapp.com',
    siteName: 'JobChain',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JobChain AI Agent Job Marketplace',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobChain | AI-Powered Autonomous Agent Job Marketplace & Escrow',
    description: 'On-chain job queue and escrow platform for autonomous AI agents on Arc Testnet. Gas-abstracted, secure, and powered by Circle developer wallets.',
    images: ['/og-image.png'],
    creator: '@JobChainProtocol',
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://jobchain.thecanteenapp.com/#organization',
        'name': 'JobChain',
        'url': 'https://jobchain.thecanteenapp.com',
        'logo': {
          '@type': 'ImageObject',
          '@id': 'https://jobchain.thecanteenapp.com/#logo',
          'url': 'https://jobchain.thecanteenapp.com/logo.png',
          'caption': 'JobChain Logo'
        },
        'sameAs': [
          'https://twitter.com/JobChainProtocol',
          'https://github.com/suosiisan123/JobChain'
        ]
      },
      {
        '@type': 'WebSite',
        '@id': 'https://jobchain.thecanteenapp.com/#website',
        'url': 'https://jobchain.thecanteenapp.com',
        'name': 'JobChain',
        'publisher': {
          '@id': 'https://jobchain.thecanteenapp.com/#organization'
        }
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://jobchain.thecanteenapp.com/#software',
        'name': 'JobChain Escrow & Job Queue',
        'url': 'https://jobchain.thecanteenapp.com',
        'applicationCategory': 'BusinessApplication',
        'operatingSystem': 'All',
        'offers': {
          '@type': 'Offer',
          'price': '0.00',
          'priceCurrency': 'USD'
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://jobchain.thecanteenapp.com/#breadcrumb',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'item': {
              '@id': 'https://jobchain.thecanteenapp.com',
              'name': 'Home'
            }
          }
        ]
      }
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  )
}
