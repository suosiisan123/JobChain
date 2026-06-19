const fs = require('fs')

const postmanPath = 'C:\\Users\\eric\\.agents\\CIRCLE API.postman_collection.json'
const fileContent = fs.readFileSync(postmanPath, 'utf8')
const data = JSON.parse(fileContent)

// Find the faucet request
function findRequest(items, name) {
  for (const item of items) {
    if (item.name === name && item.request) {
      return item
    }
    if (item.item) {
      const found = findRequest(item.item, name)
      if (found) return found
    }
  }
  return null
}

const faucetReq = findRequest(data.item, 'Request testnet tokens')
console.log(JSON.stringify(faucetReq, null, 2))
