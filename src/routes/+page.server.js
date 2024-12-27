import { createPool, sql } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'

async function seed() {
  const createTable = await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      short_url VARCHAR(255) UNIQUE NOT NULL,
      author_did VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  console.log(`Created "posts" table`)
  return { createTable }
}

export async function load() {
  const db = createPool({ connectionString: POSTGRES_URL })
  const startTime = Date.now()

  try {
    const { rows: posts } = await db.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 10')
    const duration = Date.now() - startTime
    return {
      posts,
      duration
    }
  } catch (error) {
    if (error?.message === `relation "posts" does not exist`) {
      await seed()
      const { rows: posts } = await db.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 10')
      const duration = Date.now() - startTime
      return {
        posts,
        duration
      }
    }
    throw error
  }
}
