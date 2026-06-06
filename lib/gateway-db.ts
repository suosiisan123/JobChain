import fs from 'fs'
import path from 'path'

const DB_DIR = path.join(process.cwd(), '.gemini')
const DB_FILE = path.join(DB_DIR, 'gateway_db.json')

export interface GatewayDeposit {
  address: string
  balance: number // in USD/USDC
}

export interface AgentBalance {
  address: string
  balance: number // in USD/USDC
}

export interface Receipt {
  signature: string
  nonce: string
  amount: number
  timestamp: number
}

interface DatabaseSchema {
  deposits: Record<string, number> // address -> balance
  agentBalances: Record<string, number> // address -> balance
  validatedReceipts: Record<string, Receipt> // signature -> receipt
}

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ deposits: {}, agentBalances: {}, validatedReceipts: {} }, null, 2)
    )
  }
}

function readDb(): DatabaseSchema {
  initDb()
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { deposits: {}, agentBalances: {}, validatedReceipts: {} }
  }
}

function writeDb(db: DatabaseSchema) {
  initDb()
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

export const gatewayDb = {
  // Get buyer's vault deposit
  getDeposit(address: string): number {
    const db = readDb()
    return db.deposits[address.toLowerCase()] || 0
  },

  // Update buyer's vault deposit
  adjustDeposit(address: string, amount: number): number {
    const db = readDb()
    const addr = address.toLowerCase()
    const current = db.deposits[addr] || 0
    const next = Math.max(0, current + amount)
    db.deposits[addr] = next
    writeDb(db)
    return next
  },

  // Get agent's claimable earnings
  getAgentBalance(address: string): number {
    const db = readDb()
    return db.agentBalances[address.toLowerCase()] || 0
  },

  // Update agent's claimable earnings
  adjustAgentBalance(address: string, amount: number): number {
    const db = readDb()
    const addr = address.toLowerCase()
    const current = db.agentBalances[addr] || 0
    const next = current + amount
    db.agentBalances[addr] = next
    writeDb(db)
    return next
  },

  // Register a receipt to prevent double spending
  registerReceipt(receipt: Receipt): boolean {
    const db = readDb()
    if (db.validatedReceipts[receipt.signature]) {
      return false // already processed!
    }
    db.validatedReceipts[receipt.signature] = receipt
    writeDb(db)
    return true
  },

  // Clear signature cache (for testing if needed)
  clearReceipts() {
    const db = readDb()
    db.validatedReceipts = {}
    writeDb(db)
  }
}
