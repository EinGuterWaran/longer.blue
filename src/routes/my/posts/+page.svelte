<script lang="ts">
  import { onMount } from 'svelte'
  import Footer from '../../../components/Footer.svelte'
  import { LogOut, LogIn, PlusCircle, Edit2, Share2, Trash2 } from 'lucide-svelte'
  
  interface Post {
    id: number
    content: string
    short_url: string
    author_did: string
    created_at: string
  }

  let posts = $state<Post[]>([])
  let isLoading = $state(true)
  let error = $state<string | null>(null)
  let isLoggedIn = $state(false)
  let userHandle = $state('')
  let userAvatar = $state('')
  let jwt = $state('')
  let userDid = $state('')

  function decodeHtmlEntities(text: string): string {
    if (typeof document === 'undefined') return text
    const parser = new DOMParser()
    const dom = parser.parseFromString(
      `<!doctype html><body>${text}`, 'text/html'
    )
    return dom.body.textContent || text
  }

  async function fetchUserProfile(handle: string) {
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

  async function fetchUserPosts() {
    try {
      const response = await fetch('/api/posts/my', {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'X-User-Did': userDid
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to fetch posts')
      }
      
      const data = await response.json()
      // Decode HTML entities in each post's content
      posts = data.posts.map(post => ({
        ...post,
        content: decodeHtmlEntities(post.content)
      }))
    } catch (err: any) {
      console.error('Error fetching posts:', err)
      error = err.message
      if (err.message.includes('Invalid or expired token')) {
        // Force re-login
        isLoggedIn = false
        jwt = ''
        userDid = ''
        localStorage.removeItem('jwt')
        localStorage.removeItem('userDid')
        window.location.href = '/'
      }
    } finally {
      isLoading = false
    }
  }

  onMount(() => {
    // Check for stored credentials
    const storedJwt = localStorage.getItem('jwt')
    const storedHandle = localStorage.getItem('userHandle')
    const storedDid = localStorage.getItem('userDid')
    
    if (storedJwt && storedHandle && storedDid) {
      isLoggedIn = true
      jwt = storedJwt
      userHandle = storedHandle
      userDid = storedDid
      fetchUserProfile(storedHandle)
      fetchUserPosts()
    } else {
      window.location.href = '/'
    }
  })

  function logout() {
    isLoggedIn = false
    jwt = ''
    userHandle = ''
    userDid = ''
    localStorage.removeItem('jwt')
    localStorage.removeItem('userHandle')
    localStorage.removeItem('userDid')
    window.location.href = '/'
  }

  async function deletePost(shortUrl: string) {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    try {
      const response = await fetch(`/api/posts/${shortUrl}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      })
      
      if (response.ok) {
        posts = posts.filter(post => post.short_url !== shortUrl)
      } else {
        throw new Error('Failed to delete post')
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('Failed to delete post')
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString()
  }
</script>

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
      {/if}
    </div>
  </div>
</header>

<main class="relative flex flex-col items-center min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 py-10 pt-24">
  <div class="w-full max-w-7xl px-4 mx-auto">
    <h2 class="text-3xl font-bold text-gray-800 dark:text-white mb-8">My Posts</h2>
    
    {#if isLoading}
      <div class="flex justify-center items-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    {:else if error}
      <div class="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">
        {error}
      </div>
    {:else if posts.length === 0}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center">
        <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">No Posts Yet</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">Start creating longer posts for Bluesky today!</p>
        <a
          href="/"
          class="inline-flex items-center gap-2 px-6 py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          <PlusCircle size={20} />
          Create Your First Post
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each posts as post}
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg flex flex-col">
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center gap-3">
                <img
                  src={userAvatar || `https://ui-avatars.com/api/?name=${userHandle}`}
                  alt={userHandle}
                  class="w-10 h-10 rounded-full"
                />
                <div>
                  <div class="font-medium text-gray-800 dark:text-white">
                    {userHandle}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(post.created_at)}
                  </div>
                </div>
              </div>
            </div>
            <div class="prose dark:prose-invert max-w-none flex-grow">
              <p class="line-clamp-3 whitespace-pre-wrap break-words">
                {post.content}
              </p>
            </div>
            <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <a
                href={`/posts/${post.short_url}`}
                class="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View
              </a>
              <button
                on:click={() => deletePost(post.short_url)}
                class="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <Footer />
</main>

<style>
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 