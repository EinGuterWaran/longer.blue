<script>
  import { onMount } from 'svelte'
  import Footer from '../../../components/Footer.svelte'

  let { data } = $props()
  let { post } = data
  
  let justPosted = $state(false)
  let isLoggedIn = $state(false)
  let showLoginModal = $state(false)
  let userHandle = $state('')
  let userAvatar = $state('')
  
  let decodedContent = $state('')
  
  function decodeHtmlEntities(text) {
    if (typeof document === 'undefined') return text
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
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
    decodedContent = post?.content ? decodeHtmlEntities(post.content) : 'No content available'
    
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
</script>

{#if justPosted}
  <div class="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-out z-[100]">
    <span>Successfully shared on Bluesky!</span>
  </div>
{/if}

<header class="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md z-50">
  <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
    <a href="/" class="hover:opacity-80 transition-opacity">
      <h1 class="bg-gradient-to-r from-blue-600 via-blue-400 to-blue-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
        longer.blue
      </h1>
    </a>
    
    <div class="flex items-center gap-4">
      {#if isLoggedIn}
        <div class="flex items-center gap-2">
          <img
            src={userAvatar || `https://ui-avatars.com/api/?name=${userHandle}`}
            alt="Profile"
            class="w-8 h-8 rounded-full"
          />
          <span class="text-gray-700 dark:text-gray-300">{userHandle}</span>
        </div>
        <button
          on:click={logout}
          class="px-3 py-1 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      {:else}
        <button
          on:click={() => showLoginModal = true}
          class="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
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
      
      <p class="text-gray-700 dark:text-gray-100 whitespace-pre-wrap mb-4 break-words">
        {decodedContent}
      </p>
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
</style> 