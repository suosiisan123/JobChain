import fs from 'fs'
import path from 'path'

export interface UserWalletInfo {
  email: string
  walletAddress: string
  walletId?: string
  credentialId?: string
  publicKey?: string
  createdAt: string
  txHistory?: {
    txHash: string
    functionName: string
    timestamp: string
  }[]
}

const DB_PATH = path.join(process.cwd(), 'lib', 'user-wallets-db.json')

export function getUserWallet(email: string): UserWalletInfo | null {
  try {
    if (!fs.existsSync(DB_PATH)) return null
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    return data[email.toLowerCase()] || null
  } catch (err) {
    console.error('Error reading user wallets database:', err)
    return null
  }
}

export function saveUserWallet(email: string, walletInfo: UserWalletInfo) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    let data: Record<string, UserWalletInfo> = {}
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    }
    data[email.toLowerCase()] = walletInfo
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing user wallets database:', err)
  }
}

export function addTxToHistory(email: string, txHash: string, functionName: string) {
  try {
    const wallet = getUserWallet(email)
    if (!wallet) return
    if (!wallet.txHistory) wallet.txHistory = []
    wallet.txHistory.unshift({
      txHash,
      functionName,
      timestamp: new Date().toISOString()
    })
    saveUserWallet(email, wallet)
  } catch (err) {
    console.error('Error adding transaction to history:', err)
  }
}
