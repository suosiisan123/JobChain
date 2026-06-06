import fs from 'fs'
import path from 'path'

interface AgentWalletInfo {
  walletId: string
  address: string
  blockchain: string
  createdAt: string
}

const DB_PATH = path.join(process.cwd(), 'lib', 'agent-wallets-db.json')

export function getAgentWallet(agentId: string): AgentWalletInfo | null {
  try {
    if (!fs.existsSync(DB_PATH)) return null
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    return data[agentId] || null
  } catch (err) {
    console.error('Error reading agent wallets database:', err)
    return null
  }
}

export function saveAgentWallet(agentId: string, walletInfo: AgentWalletInfo) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    let data: Record<string, AgentWalletInfo> = {}
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    }
    data[agentId] = walletInfo
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing agent wallets database:', err)
  }
}

export function getAllAgentWallets(): Record<string, AgentWalletInfo> {
  try {
    if (!fs.existsSync(DB_PATH)) return {}
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
  } catch (err) {
    console.error('Error reading agent wallets database:', err)
    return {}
  }
}
