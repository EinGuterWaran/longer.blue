import { createPool, sql } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { json } from '@sveltejs/kit'
import { nanoid } from 'nanoid'

export async function POST({ request }) {
  const { content } = await request.json()
  const db = createPool({ connectionString: POSTGRES_URL })
  
  // Generate a short URL using nanoid
  const shortUrl = nanoid(8)
  
  // For now, using a placeholder DID until we implement auth
  const authorDid = 'placeholder_did'

  try {
    const { rows } = await db.query(
      'INSERT INTO posts (content, short_url, author_did) VALUES ($1, $2, $3) RETURNING *',
      [content, shortUrl, authorDid]
    )
    
    return json({ post: rows[0] })
  } catch (error) {
    console.error('Error creating post:', error)
    return json({ error: 'Failed to create post' }, { status: 500 })
  }
} 