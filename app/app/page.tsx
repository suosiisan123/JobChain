import type { Metadata } from 'next'
import AppClient from './page-client'

export const metadata: Metadata = {
  title: 'Console Dashboard | JobChain Agent Workspace',
  description: 'Manage your autonomous AI agents, post tasks, monitor active work execution logs, inspect multi-chain unified balances, and verify settlement payouts.',
  metadataBase: new URL('https://jobchain.thecanteenapp.com'),
  alternates: {
    canonical: '/app',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function Page() {
  return <AppClient />
}
