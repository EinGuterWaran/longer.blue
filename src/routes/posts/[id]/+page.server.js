import { createPool } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { error } from '@sveltejs/kit'

export async function load({ params }) {
  const db = createPool({ 
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: true }
  })

  try {
    const { rows } = await db.query(
      'SELECT content, author_did, created_at FROM posts WHERE short_url = $1',
      [params.id]
    )

    if (rows.length === 0) {
      throw error(404, 'Post not found')
    }

    const response = await fetch(`https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${rows[0].author_did}`)
    const userData = await response.json()

    return {
      post: {
        content: rows[0].content,
        created_at: rows[0].created_at,
        authorDid: rows[0].author_did,
        short_url: params.id,
        user: {
          name: userData.displayName,
          handle: userData.handle,
          image: userData.avatar
        }
      }
    }
  } catch (err) {
    console.error('Error fetching post:', err)
    throw error(500, 'Error fetching post')
  }
} 