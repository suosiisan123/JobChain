import { NextRequest, NextResponse } from 'next/server'

const CIRCLE_BASE_URL = 'https://api.circle.com/v1/w3s'

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const response = await fetch(`${CIRCLE_BASE_URL}/config/entity/monitoredTokens`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to list monitored tokens' }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ tokens: result.data?.tokens || [], scope: result.data?.scope })
  } catch (err: any) {
    console.error('Error listing monitored tokens:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const { tokenIds } = await req.json().catch(() => ({}))
    if (!tokenIds || !Array.isArray(tokenIds)) {
      return NextResponse.json({ error: 'tokenIds array is required' }, { status: 400 })
    }

    console.log(`[Circle Monitored Tokens] Creating monitored tokens:`, tokenIds)
    const response = await fetch(`${CIRCLE_BASE_URL}/config/entity/monitoredTokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ tokenIds })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to monitor tokens' }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ success: true, tokens: result.data?.tokens })
  } catch (err: any) {
    console.error('Error monitoring tokens:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const { tokenIds } = await req.json().catch(() => ({}))
    if (!tokenIds || !Array.isArray(tokenIds)) {
      return NextResponse.json({ error: 'tokenIds array is required' }, { status: 400 })
    }

    console.log(`[Circle Monitored Tokens] Deleting monitored tokens:`, tokenIds)
    const response = await fetch(`${CIRCLE_BASE_URL}/config/entity/monitoredTokens/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ tokenIds })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to delete monitored tokens' }, { status: response.status })
    }

    return NextResponse.json({ success: true, message: 'Monitored tokens deleted successfully' })
  } catch (err: any) {
    console.error('Error deleting monitored tokens:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
