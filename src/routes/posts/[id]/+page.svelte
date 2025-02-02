<script>
  import { onMount } from 'svelte'
  import Footer from '../../../components/Footer.svelte'
  import { BskyAgent } from '@atproto/api'
  import { 
    LogOut, 
    LogIn, 
    PlusCircle, 
    Edit2, 
    Share2, 
    Trash2 
  } from 'lucide-svelte'

  let { data } = $props()
  let { post } = data
  
  let justPosted = $state(false)
  let isLoggedIn = $state(false)
  let showLoginModal = $state(false)
  let userHandle = $state('')
  let userAvatar = $state('')
  
  let decodedContent = $state('')
  
  let isAuthor = $state(false)
  
  let isEditing = $state(false)
  let editedContent = $state('')
  let content = $state(data.post.content)
  
  function decodeHtmlEntities(text) {
    if (typeof document === 'undefined') return text
    const parser = new DOMParser()
    const dom = parser.parseFromString(
      `<!doctype html><body>${text}`, 'text/html'
    )
    return dom.body.textContent
  }
  
  async function fetchUserProfile(handle) {
    try {
      const response = await fetch(`https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`)
      const data = await response.json()
      if (data.avatar) {
        userAvatar = data.avatar
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }
  
  onMount(() => {
    content = post?.content ? decodeHtmlEntities(post.content) : 'No content available'
    decodedContent = content
    
    const searchParams = new URLSearchParams(window.location.search)
    justPosted = searchParams.get('posted') === 'true'
    
    // Auto-hide toast after 4 seconds if it's shown
    if (justPosted) {
      setTimeout(() => {
        justPosted = false
      }, 4000)
    }
    
    // Check login status
    const storedJwt = localStorage.getItem('jwt')
    isLoggedIn = !!storedJwt
    
    // Add user info if logged in
    if (isLoggedIn) {
      userHandle = localStorage.getItem('userHandle') || ''
      if (userHandle) {
        fetchUserProfile(userHandle)
      }
    }
    
    // Check if the logged-in user is the author
    if (isLoggedIn) {
      const userDid = localStorage.getItem('userDid')
      console.log('Current user DID:', userDid)
      console.log('Post author DID:', post.authorDid)
      isAuthor = userDid === post.authorDid
    }
  })
  
  function logout() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('userData')
    isLoggedIn = false
    userHandle = ''
    userAvatar = ''
  }
  
  // Format date only if it exists
  let formattedDate = post.created_at ? new Date(post.created_at).toLocaleString() : 'Date unknown'
  
  async function deletePost() {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    try {
      const response = await fetch(`/api/posts/${post.short_url}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      })
      
      if (response.ok) {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  function startEdit() {
    editedContent = content
    isEditing = true
  }

  async function saveEdit() {
    try {
      const response = await fetch(`/api/posts/${data.post.short_url}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({ content: editedContent })
      })

      if (response.ok) {
        content = editedContent
        isEditing = false
        window.location.reload()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update post')
      }
    } catch (error) {
      console.error('Error updating post:', error)
      alert('Failed to update post')
    }
  }

  async function shareOnBluesky() {
    try {
      const agent = new BskyAgent({
        service: 'https://bsky.social'
      })
      
      // Get the tokens from localStorage
      const userDid = localStorage.getItem('userDid')
      const accessJwt = localStorage.getItem('jwt')
      
      console.log('Attempting to share with DID:', userDid)
      
      if (!userDid || !accessJwt) {
        throw new Error('Missing authentication credentials')
      }

      try {
        await agent.resumeSession({
          did: userDid,
          accessJwt: accessJwt
        })
      } catch (sessionError) {
        console.error('Session resume error:', sessionError)
        throw new Error('Failed to authenticate with Bluesky')
      }

      const postUrl = `https://longer.blue/posts/${post.short_url}`
      const previewText = content.slice(0, 100) + '...'
      const postText = `${previewText}\n\nRead more: ${postUrl}`

      console.log('Attempting to post:', postText)

      await agent.post({
        text: postText,
        langs: ['en'],
        facets: [{
          index: {
            byteStart: postText.indexOf(postUrl),
            byteEnd: postText.indexOf(postUrl) + postUrl.length
          },
          features: [{
            $type: 'app.bsky.richtext.facet#link',
            uri: postUrl
          }]
        }]
      })

      alert('Successfully shared on Bluesky!')
    } catch (error) {
      console.error('Detailed sharing error:', error)
      
      if (error.message?.includes('ExpiredToken') || error.message?.includes('authentication')) {
        alert('Your session has expired. Please log in again.')
        logout()
      } else {
        alert(`Failed to share on Bluesky: ${error.message}`)
      }
    }
  }
</script>

{#if justPosted}
  <div class="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-out z-[100]">
    <span>Successfully shared on Bluesky!</span>
  </div>
{/if}

<header class="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md z-50">
  <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
    <div class="flex items-center">
      <a href="/" class="hover:opacity-80 transition-opacity">
        <h1 class="bg-gradient-to-r from-blue-600 via-blue-400 to-blue-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          longer.blue
        </h1>
      </a>
    </div>
    
    <div class="flex items-center gap-4">
      {#if isLoggedIn}
        <a
          href="/"
          class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors flex items-center gap-2"
        >
          <PlusCircle size={18} />
          New Post
        </a>
        <div class="flex items-center gap-2">
          <span class="text-gray-700 dark:text-gray-300">{userHandle}</span>
          <img
            src={userAvatar || `https://ui-avatars.com/api/?name=${userHandle}`}
            alt="Profile"
            class="w-8 h-8 rounded-full"
          />
        </div>
        <button
          on:click={logout}
          class="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors ml-4 flex items-center gap-2"
        >
          <LogOut size={18} />
          Logout
        </button>
      {:else}
        <button
          on:click={() => showLoginModal = true}
          class="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <LogIn size={18} />
          Login
        </button>
      {/if}
    </div>
  </div>
</header>

<main class="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 py-10 pt-24">
  <div class="w-full max-w-2xl px-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">      
      <!-- Author information with more defensive checks -->
      <div class="flex items-center gap-3 mb-6">
        <img
          src={post?.user?.image || `https://ui-avatars.com/api/?name=Anonymous`}
          alt={post?.user?.name || 'Anonymous'}
          class="w-10 h-10 rounded-full"
        />
        <div>
          <a 
            href={`https://bsky.app/profile/${post?.user?.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            {post?.user?.name || 'Anonymous'}
          </a>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {formattedDate}
          </div>
        </div>
      </div>
      
      {#if isEditing}
        <div class="mt-6">
          <textarea
            bind:value={editedContent}
            class="w-full h-48 p-4 text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm hover:shadow-md"
          />
          <div class="flex gap-3 mt-4">
            <button
              on:click={saveEdit}
              class="px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
            >
              Save
            </button>
            <button
              on:click={() => isEditing = false}
              class="px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="prose dark:prose-invert max-w-none overflow-hidden">
          <p class="whitespace-pre-wrap break-words overflow-wrap-anywhere">{content}</p>
        </div>
        {#if isAuthor}
          <div class="mt-6 flex flex-wrap gap-3">
            <button
              on:click={startEdit}
              class="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Edit2 size={18} />
              Edit
            </button>
            <button
              on:click={shareOnBluesky}
              class="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Share2 size={18} />
              Share on Bluesky
            </button>
            <button
              on:click={deletePost}
              class="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors ml-auto flex items-center gap-2"
            >
              <Trash2 size={18} />
              Delete Post
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
  <Footer />
</main> 

<style>
  @keyframes fadeOut {
    0% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(10px); }
  }

  .animate-fade-out {
    animation: fadeOut 4s ease-in-out forwards;
  }

  :global(.overflow-wrap-anywhere) {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
</style> 