import { createPool } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { json } from '@sveltejs/kit'
import { escape } from 'html-escaper'
import { BskyAgent } from '@atproto/api'

function sanitizeInput(content) {
  content = content.replace(/\0/g, '')
  return escape(content)
}

export async function PUT({ request, params }) {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jwt = authHeader.split(' ')[1]
  const body = await request.json()
  const { content } = body

  if (!content || typeof content !== 'string') {
    return json({ error: 'Invalid content' }, { status: 400 })
  }

  const sanitizedContent = sanitizeInput(content)
  const db = createPool({ 
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: true }
  })

  try {
    // First verify if the post exists and get the author
    const { rows } = await db.query(
      'SELECT author_did FROM posts WHERE short_url = $1',
      [params.id]
    )

    if (rows.length === 0) {
      return json({ error: 'Post not found' }, { status: 404 })
    }

    // Verify the author using Bluesky session
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    })
    
    try {
      const session = await agent.resumeSession({
        did: rows[0].author_did,
        accessJwt: jwt
      })

      // If we get here, the session is valid and matches the author
      await db.query(
        'UPDATE posts SET content = $1 WHERE short_url = $2',
        [sanitizedContent, params.id]
      )

      return json({ success: true })
    } catch (error) {
      return json({ error: 'Unauthorized - Not the author' }, { status: 401 })
    }
  } catch (error) {
    console.error('Error updating post:', error)
    return json({ error: 'Failed to update post' }, { status: 500 })
  }
}

export async function DELETE({ request, params }) {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createPool({ 
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: true }
  })

  try {
    await db.query('DELETE FROM posts WHERE short_url = $1', [params.id])
    return json({ success: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    return json({ error: 'Failed to delete post' }, { status: 500 })
  }
} 