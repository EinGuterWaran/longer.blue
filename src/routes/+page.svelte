<script>
  import { onMount } from 'svelte'
  import { BskyAgent } from '@atproto/api'
  import Footer from '../components/Footer.svelte'
  import { LogOut } from 'lucide-svelte'
  
  let content = $state('')
  let isSubmitting = $state(false)
  let hasInteracted = $state(false)
  let isLoggedIn = $state(false)
  let userHandle = $state('')
  let jwt = $state('')
  let userDid = $state('')
  let userAvatar = $state('')
  let showValidation = $state(false)
  let characterCount = $state(0)
  
  // Login form states
  let identifier = $state('')
  let password = $state('')
  let loginError = $state('')

  let showLoginModal = $state(false)
  let pendingPost = $state(null)

  // Add new state variables
  let showConfirmDialog = $state(false)
  let postResult = $state(null)
  let threadMode = $state(false)

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
    window.location.reload()
  }

  // Computed value for validation
  let isValidLength = $derived(characterCount >= 300 && characterCount <= 10000)

  function handleInput(event) {
    content = event.target.value
    characterCount = content.trim().length
    if (!hasInteracted && content.length > 0) {
      hasInteracted = true
      showValidation = true
    }
  }

  async function login() {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      })

      const data = await response.json()
      
      if (data.success) {
        isLoggedIn = true
        userHandle = data.handle
        jwt = data.accessJwt
        userDid = data.did
        // Store credentials
        localStorage.setItem('jwt', data.accessJwt)
        localStorage.setItem('userHandle', data.handle)
        localStorage.setItem('userDid', data.did)
        loginError = ''
        // Fetch profile data
        fetchUserProfile(data.handle)
      } else {
        loginError = data.error
      }
    } catch (error) {
      console.error('Login error:', error)
      loginError = 'Failed to login'
    }
  }

  async function createPost() {
    if (!content.trim() || !isLoggedIn) return
    
    isSubmitting = true
    try {
      // Create post in database
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ 
          content,
          authorDid: userDid
        }),
      })

      // If we get a 401 error, try to refresh the session
      if (response.status === 401) {
        // Force re-login
        isLoggedIn = false
        jwt = ''
        userDid = ''
        localStorage.removeItem('jwt')
        localStorage.removeItem('userDid')
        showLoginModal = true
        pendingPost = content
        throw new Error('Session expired. Please login again.')
      }

      if (!response.ok) {
        const responseText = await response.text()
        throw new Error(`Failed to create post: ${responseText}`)
      }

      const result = await response.json()
      postResult = result // Store the result
      showConfirmDialog = true // Show confirmation dialog
      
    } catch (error) {
      console.error('Detailed error:', error)
      if (!error.message.includes('Session expired')) {
        alert('Failed to create post. Please try again.')
      }
    } finally {
      isSubmitting = false
    }
  }

  async function publishToBluesky() {
    try {
      const agent = new BskyAgent({
        service: 'https://bsky.social'
      })
      
      await agent.resumeSession({
        did: userDid,
        accessJwt: jwt
      })

      const postUrl = `https://longer.blue/posts/${postResult.post.shortUrl}`

      if (threadMode) {
        // Split content into chunks of ~300 characters at sentence boundaries
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]
        let currentChunk = ''
        const chunks = []
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > 300) {
            chunks.push(currentChunk.trim())
            currentChunk = sentence
          } else {
            currentChunk += sentence
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim())

        // Post the thread
        let lastPost = null
        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1
          const postText = isLast 
            ? `${chunks[i]}\n\nRead the full post: ${postUrl}`
            : chunks[i]

          // Add URL facet for the last post
          const post = await agent.post({
            text: postText,
            reply: lastPost ? {
              root: lastPost.root || lastPost,
              parent: lastPost
            } : undefined,
            facets: isLast ? [{
              index: {
                byteStart: postText.indexOf(postUrl),
                byteEnd: postText.indexOf(postUrl) + postUrl.length
              },
              features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: postUrl
              }]
            }] : undefined
          })
          lastPost = post
        }
      } else {
        // Original single post logic
        const previewText = content.slice(0, 100) + '...'
        const postText = `${previewText}\n\nRead more: ${postUrl}`

        const urlStart = postText.indexOf(postUrl)
        const urlEnd = urlStart + postUrl.length

        await agent.post({
          text: postText,
          langs: ['en'],
          facets: [{
            index: {
              byteStart: urlStart,
              byteEnd: urlEnd
            },
            features: [{
              $type: 'app.bsky.richtext.facet#link',
              uri: postUrl
            }]
          }]
        })
      }

      content = ''
      showConfirmDialog = false
      window.location.href = `/posts/${postResult.post.shortUrl}?posted=true`
    } catch (error) {
      console.error('Failed to post to Bluesky:', error)
      alert('Failed to post to Bluesky. Your post is still saved on longer.blue.')
      window.location.href = `/posts/${postResult.post.shortUrl}`
    }
  }

  function skipBlueskyPost() {
    content = ''
    showConfirmDialog = false
    window.location.href = `/posts/${postResult.post.shortUrl}`
  }

  function handlePostClick() {
    if (!isLoggedIn) {
      pendingPost = content
      showLoginModal = true
      return
    }
    createPost()
  }

  async function handleLogin() {
    const loginButton = document.activeElement;
    if (loginButton) {
      loginButton.textContent = 'Logging in...';
      loginButton.disabled = true;
    }

    try {
      await login();
      if (isLoggedIn) {
        showLoginModal = false;
        if (pendingPost) {
          content = pendingPost;
          pendingPost = null;
          createPost();
        }
      }
    } finally {
      if (loginButton) {
        loginButton.textContent = 'Login';
        loginButton.disabled = false;
      }
    }
  }
</script>

<main class="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 py-10">
  <h1 class="pt-4 pb-8 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-500 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent md:text-7xl">
    longer.blue
  </h1>

  <div class="text-center mb-8 px-4">
    <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
      Create longer posts for Bluesky
    </h2>
    <p class="text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
      Nothing gets posted to Bluesky without your explicit permission. Your content is safely saved here first, and you decide if and when to share it.
    </p>
  </div>

  <div class="w-full max-w-2xl mb-8 px-4">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-sm font-medium text-gray-900 dark:text-gray-300 me-3">
        Single post
      </span>
      <label class="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          bind:checked={threadMode} 
          class="sr-only peer"
        >
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
          Thread mode
        </span>
      </label>
      <div class="group relative">
        <button class="text-gray-400 hover:text-gray-600">ⓘ</button>
        <div class="absolute bottom-full mb-2 p-2 bg-white dark:bg-gray-800 rounded shadow-lg hidden group-hover:block w-64">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Thread mode will split your post into multiple connected tweets (~300 chars each).
            Single post mode will create one post with a preview and link.
          </p>
        </div>
      </div>
    </div>
    <div class="relative group">
      <textarea
        value={content}
        on:input={handleInput}
        class="w-full h-48 p-4 text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 {showValidation ? (isValidLength ? 'border-blue-200 dark:border-blue-800' : 'border-red-200 dark:border-red-800') : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm hover:shadow-md"
        placeholder="Write your longer post here... (minimum 300 characters)"
      />
      <div class="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none transition-opacity opacity-0 group-hover:opacity-100" />
    </div>
    
    <div class="mt-2 text-sm {showValidation ? (isValidLength ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-500 dark:text-gray-400'}">
      {characterCount} characters {showValidation ? (isValidLength ? '✓' : `(at least ${300 - characterCount} more needed)`) : '(minimum 300)'}
    </div>
    
    <button
      on:click={handlePostClick}
      disabled={!isValidLength}
      class="px-8 py-3 mt-4 text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:bg-blue-300 transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] font-medium"
    >
      {#if isSubmitting}
        Saving...
      {:else if showValidation && !isValidLength}
        Post Too Short
      {:else}
        Save Post
      {/if}
    </button>
  </div>

  <Footer />
</main>

<!-- Login Modal -->
{#if showLoginModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Login with Bluesky</h2>
        <button 
          on:click={() => showLoginModal = false}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      {#if loginError}
        <div class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{loginError}</div>
      {/if}
      <input
        type="text"
        bind:value={identifier}
        placeholder="Username or email"
        class="w-full mb-3 p-2 border rounded"
      />
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        class="w-full mb-4 p-2 border rounded"
      />
      <button
        on:click={handleLogin}
        class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
      >
        Login
      </button>
    </div>
  </div>
{/if}

<!-- Login Button -->
<div class="fixed top-4 right-4">
  {#if isLoggedIn}
    <div class="flex items-center gap-4">
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
        class="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors ml-4 flex items-center gap-2"
      >
        <LogOut size={18} />
        Logout
      </button>
    </div>
  {:else}
    <button
      on:click={() => showLoginModal = true}
      class="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
    >
      Login
    </button>
  {/if}
</div>

<!-- Add confirmation dialog -->
{#if showConfirmDialog}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Post Created!</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-6">Would you like to share a preview of this post on Bluesky?</p>
      <div class="flex gap-4">
        <button
          on:click={publishToBluesky}
          class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Share on Bluesky
        </button>
        <button
          on:click={skipBlueskyPost}
          class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  </div>
{/if}
