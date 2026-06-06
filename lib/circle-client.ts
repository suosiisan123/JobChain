import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY
const entitySecret = process.env.CIRCLE_ENTITY_SECRET
const walletSetId = process.env.CIRCLE_WALLET_SET_ID

export const hasCircleConfig = !!(apiKey && entitySecret && walletSetId)

export const circleClient = hasCircleConfig
  ? initiateDeveloperControlledWalletsClient({
      apiKey: apiKey!,
      entitySecret: entitySecret!,
    })
  : null

export const WALLET_SET_ID = walletSetId || ''
