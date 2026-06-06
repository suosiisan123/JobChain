import { useContext } from 'react'
import { SmartWalletContext, SmartWalletContextType } from '@/lib/web3-provider'

export function useSmartWallet(): SmartWalletContextType {
  const context = useContext(SmartWalletContext)
  if (!context) {
    throw new Error('useSmartWallet must be used within a Web3Provider')
  }
  return context
}
