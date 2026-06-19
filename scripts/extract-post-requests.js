const fs = require('fs')

const postmanPath = 'C:\\Users\\eric\\.agents\\CIRCLE API.postman_collection.json'
const fileContent = fs.readFileSync(postmanPath, 'utf8')
const data = JSON.parse(fileContent)

const posts = []

function findPosts(items) {
  for (const item of items) {
    if (item.request && item.request.method === 'POST') {
      const url = typeof item.request.url === 'string' ? item.request.url : (item.request.url?.raw || '')
      const body = item.request.body?.raw || ''
      posts.push({
        name: item.name,
        url,
        body
      })
    }
    if (item.item) {
      findPosts(item.item)
    }
  }
}

findPosts(data.item)
console.log(JSON.stringify(posts, null, 2))
