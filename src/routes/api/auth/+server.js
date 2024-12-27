import { BskyAgent } from '@atproto/api'
import { json } from '@sveltejs/kit'

export async function POST({ request }) {
  const { identifier, password } = await request.json()
  
  const agent = new BskyAgent({
    service: 'https://bsky.social'
  })

  try {
    const { success, data } = await agent.login({
      identifier,
      password
    })

    if (!success) {
      throw new Error('Login failed')
    }

    return json({
      success: true,
      did: data.did,
      handle: data.handle,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt
    })
  } catch (error) {
    console.error('Login error:', error)
    return json({ 
      success: false, 
      error: 'Invalid credentials'
    }, { status: 401 })
  }
} 