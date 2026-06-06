import fs from 'fs'
import path from 'path'

export interface SponsorRecord {
  address: string
  ip: string
  functionName: string
  timestamp: string
}

const DB_PATH = path.join(process.cwd(), 'lib', 'gas-sponsor-db.json')

export function getSponsorCount(address: string, ip: string): number {
  try {
    if (!fs.existsSync(DB_PATH)) return 0
    const records = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as SponsorRecord[]
    // Count occurrences of address or IP
    const addrCount = records.filter(r => r.address.toLowerCase() === address.toLowerCase()).length
    const ipCount = records.filter(r => r.ip === ip).length
    return Math.max(addrCount, ipCount)
  } catch (err) {
    console.error('Error reading gas sponsor database:', err)
    return 0
  }
}

export function addSponsorRecord(address: string, ip: string, functionName: string) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    let records: SponsorRecord[] = []
    if (fs.existsSync(DB_PATH)) {
      records = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    }
    records.push({
      address: address.toLowerCase(),
      ip,
      functionName,
      timestamp: new Date().toISOString()
    })
    fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing gas sponsor database:', err)
  }
}
