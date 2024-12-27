import { createPool, sql } from '@vercel/postgres'
import { POSTGRES_URL } from '$env/static/private'
import { json } from '@sveltejs/kit'
import { nanoid } from 'nanoid'
import { escape } from 'html-escaper'
import { BskyAgent } from '@atproto/api'

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 5
const requestLog = new Map()

// Content validation
const MAX_CONTENT_LENGTH = 10000 // Maximum characters allowed
const MIN_CONTENT_LENGTH = 300   // Minimum characters required

function sanitizeInput(content) {
  content = content.replace(/\0/g, '')
  return escape(content)
}

function checkRateLimit(ip) {
  const now = Date.now()
  const userRequests = requestLog.get(ip) || []
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
  
  if (!checkRateLimit(clientIp)) {
    return json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized - No token' }, { status: 401 })
  }
  
  const jwt = authHeader.split(' ')[1]
  
  const body = await request.json()
  const { content, authorDid } = body

  // Validate content
  if (!content || typeof content !== 'string') {
    return json({ error: 'Invalid content' }, { status: 400 })
  }

  const contentLength = content.trim().length
  if (contentLength < MIN_CONTENT_LENGTH || contentLength > MAX_CONTENT_LENGTH) {
    return json({ 
      error: `Content length must be between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH} characters` 
    }, { status: 400 })
  }
  
  try {
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    })
    
    try {
      await agent.resumeSession({
        did: authorDid,
        accessJwt: jwt
      })
    } catch (error) {
      if (error.error === 'ExpiredToken') {
        return json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        }, { status: 401 })
      }
      throw error
    }

    // Generate short URL
    const shortUrl = nanoid(10)
    
    // Sanitize content
    const sanitizedContent = sanitizeInput(content)
    
    // Save to database
    const db = createPool({ 
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: true }
    })

    const { rows } = await db.query(
      'INSERT INTO posts (content, short_url, author_did) VALUES ($1, $2, $3) RETURNING *',
      [sanitizedContent, shortUrl, authorDid]
    )

    return json({
      success: true,
      post: {
        id: rows[0].id,
        shortUrl: rows[0].short_url,
        content: rows[0].content,
        authorDid: rows[0].author_did,
        createdAt: rows[0].created_at
      }
    })

  } catch (error) {
    console.error('Error creating post:', error)
    return json({ 
      error: 'Failed to create post',
      details: error.message 
    }, { status: 500 })
  }
} 