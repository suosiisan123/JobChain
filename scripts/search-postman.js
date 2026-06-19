const fs = require('fs')

const postmanPath = 'C:\\Users\\eric\\.agents\\CIRCLE API.postman_collection.json'
const fileContent = fs.readFileSync(postmanPath, 'utf8')
const data = JSON.parse(fileContent)

function inspectItems(items, depth = 0) {
  for (const item of items) {
    const indent = '  '.repeat(depth)
    if (item.request) {
      const method = item.request.method
      const url = typeof item.request.url === 'string' ? item.request.url : (item.request.url?.raw || '')
      console.log(`${indent}- [${method}] ${item.name} (${url})`)
    }
    if (item.item) {
      console.log(`${indent}+ Folder: ${item.name}`)
      inspectItems(item.item, depth + 1)
    }
  }
}

console.log('Collection Name:', data.info.name)
inspectItems(data.item)
