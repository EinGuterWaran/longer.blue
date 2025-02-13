import { createPool } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { json } from '@sveltejs/kit'
import { BskyAgent } from '@atproto/api'

export async function GET({ request }) {
  const authHeader = request.headers.get('Authorization')
  const userDid = request.headers.get('X-User-Did')
  
  console.log('Auth header:', authHeader ? 'Present' : 'Missing')
  console.log('User DID:', userDid)
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized - Missing or invalid auth header' }, { status: 401 })
  }

  if (!userDid) {
    return json({ error: 'Unauthorized - Missing user DID' }, { status: 401 })
  }

  const jwt = authHeader.split(' ')[1]
  
  try {
    // First verify the user's identity using Bluesky
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    })
    
    try {
      // Verify the session
      await agent.resumeSession({
        did: userDid,
        accessJwt: jwt,
        refreshJwt: jwt, // Add this to match the expected format
        handle: '', // Add this to match the expected format
      })
    } catch (error) {
      console.error('Auth error details:', error)
      return json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Now fetch the user's posts
    const db = createPool({ 
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: true }
    })

    console.log('Fetching posts for DID:', userDid)

    const { rows: posts } = await db.query(
      'SELECT * FROM posts WHERE author_did = $1 ORDER BY created_at DESC',
      [userDid]
    )

    console.log('Found posts:', posts.length)

    return json({ posts })
  } catch (error) {
    console.error('Detailed error:', error)
    return json({ 
      error: 'Failed to fetch posts',
      details: error.message
    }, { status: 500 })
  }
} 