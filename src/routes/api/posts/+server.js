import { createPool, sql } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { json } from '@sveltejs/kit'
import { nanoid } from 'nanoid'
import { escape } from 'html-escaper'

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 5
const requestLog = new Map()

// Content validation
const MAX_CONTENT_LENGTH = 10000 // Maximum characters allowed
const MIN_CONTENT_LENGTH = 300   // Minimum characters required

function sanitizeInput(content) {
  // Remove any null bytes
  content = content.replace(/\0/g, '')
  // Escape HTML special characters
  return escape(content)
}

function checkRateLimit(ip) {
  const now = Date.now()
  const userRequests = requestLog.get(ip) || []
  
  // Clean up old requests
  const recentRequests = userRequests.filter(time => time > now - RATE_LIMIT_WINDOW)
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return false
  }
  
  recentRequests.push(now)
  requestLog.set(ip, recentRequests)
  return true
}

export async function POST({ request, getClientAddress }) {
  const clientIp = getClientAddress()

  // Rate limiting check
  if (!checkRateLimit(clientIp)) {
    return json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { content } = await request.json()

    // Input validation
    if (!content || typeof content !== 'string') {
      return json({ error: 'Invalid content' }, { status: 400 })
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return json({ error: 'Content too long' }, { status: 400 })
    }

    if (content.length < MIN_CONTENT_LENGTH) {
      return json({ error: 'Content too short' }, { status: 400 })
    }

    // Sanitize input
    const sanitizedContent = sanitizeInput(content.trim())
    
    const db = createPool({ 
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: true }
    })
    
    const shortUrl = nanoid(8)
    const authorDid = 'placeholder_did'

    // Use parameterized query to prevent SQL injection
    const { rows } = await db.query(
      'INSERT INTO posts (content, short_url, author_did) VALUES ($1, $2, $3) RETURNING id, short_url, created_at',
      [sanitizedContent, shortUrl, authorDid]
    )
    
    // Don't return the full content in the response
    return json({ 
      post: {
        id: rows[0].id,
        shortUrl: rows[0].short_url,
        createdAt: rows[0].created_at
      }
    })

  } catch (error) {
    console.error('Error creating post:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
} 