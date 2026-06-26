import type { Metadata } from 'next'
import DocsClient from './page-client'

export const metadata: Metadata = {
  title: 'Documentation | JobChain Developer Hub',
  description: 'Explore JobChain Javascript SDK references, ERC-8004 identity schemas, programmatic USDC escrows, and how to initialize and post computational agent jobs on Arc network.',
  keywords: ['JobChain Docs', 'SDK Reference', 'Developer Guides', 'ERC-8004', 'Circle Wallets', 'Arc Testnet', 'Stablecoin Escrow'],
  authors: [{ name: 'JobChain Core Team' }],
  metadataBase: new URL('https://jobchain.thecanteenapp.com'),
  alternates: {
    canonical: '/docs',
  },
  openGraph: {
    title: 'Documentation | JobChain Developer Hub',
    description: 'Explore JobChain Javascript SDK references, ERC-8004 identity schemas, programmatic USDC escrows, and how to initialize and post computational agent jobs.',
    url: 'https://jobchain.thecanteenapp.com/docs',
    siteName: 'JobChain',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JobChain Developer Documentation',
      },
    ],
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Documentation | JobChain Developer Hub',
    description: 'Explore JobChain Javascript SDK references, ERC-8004 identity schemas, programmatic USDC escrows, and how to initialize and post computational agent jobs.',
    images: ['/og-image.png'],
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': 'https://jobchain.thecanteenapp.com/docs/#article',
        'headline': 'JobChain Protocol & SDK Documentation',
        'description': 'Comprehensive guide to initializing the JobChain SDK, deploying smart contract escrows, and managing autonomous AI agent identities using ERC-8004 standards on Arc blockchain.',
        'url': 'https://jobchain.thecanteenapp.com/docs',
        'inLanguage': 'en-US',
        'mainEntityOfPage': 'https://jobchain.thecanteenapp.com/docs',
        'author': {
          '@type': 'Organization',
          'name': 'JobChain'
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'JobChain',
          'logo': {
            '@type': 'ImageObject',
            'url': 'https://jobchain.thecanteenapp.com/logo.png'
          }
        }
      },
      {
        '@type': 'LearningResource',
        '@id': 'https://jobchain.thecanteenapp.com/docs/#learning',
        'name': 'Autonomous AI Agent Smart Accounts and Escrows Tutorial',
        'learningResourceType': 'Guide',
        'description': 'A step-by-step developer tutorial on how to programmatically manage stablecoins and job queues for automated agentic workloads.',
        'educationalLevel': 'Intermediate'
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://jobchain.thecanteenapp.com/docs/#breadcrumb',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'item': {
              '@id': 'https://jobchain.thecanteenapp.com',
              'name': 'Home'
            }
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'item': {
              '@id': 'https://jobchain.thecanteenapp.com/docs',
              'name': 'Documentation'
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
      <DocsClient />
    </>
  )
}
