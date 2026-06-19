import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const response = await fetch('https://api.circle.com/v2/notifications/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to list webhook subscriptions' }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ subscriptions: result.data || [] })
  } catch (err: any) {
    console.error('Error listing webhook subscriptions:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const { endpoint } = await req.json().catch(() => ({}))
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint URL is required' }, { status: 400 })
    }

    console.log(`[Circle Webhook] Creating subscription for endpoint: ${endpoint}`)
    const response = await fetch('https://api.circle.com/v2/notifications/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ endpoint })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to create webhook subscription' }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ success: true, subscription: result.data })
  } catch (err: any) {
    console.error('Error creating webhook subscription:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const apiKey = process.env.CIRCLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Circle API key is missing' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required as query parameter "id"' }, { status: 400 })
    }

    console.log(`[Circle Webhook] Deleting subscription: ${subscriptionId}`)
    const response = await fetch(`https://api.circle.com/v2/notifications/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: errorText || 'Failed to remove webhook subscription' }, { status: response.status })
    }

    return NextResponse.json({ success: true, message: `Subscription ${subscriptionId} removed.` })
  } catch (err: any) {
    console.error('Error deleting webhook subscription:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
