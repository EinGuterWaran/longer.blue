<script>
  import { onMount } from 'svelte'
  
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
      console.log('Sending post request with JWT:', jwt)
      console.log('Current userDid:', userDid)
      
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

      console.log('Response status:', response.status)
      const responseText = await response.text()
      console.log('Response body:', responseText)

      if (!response.ok) {
        throw new Error(`Failed to create post: ${responseText}`)
      }

      const result = JSON.parse(responseText)
      content = ''
      window.location.reload()
    } catch (error) {
      console.error('Detailed error:', error)
      alert('Failed to create post. Please try again.')
    } finally {
      isSubmitting = false
    }
  }
</script>

<main class="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 py-10">
  <h1 class="pt-4 pb-8 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-500 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent md:text-7xl">
    longer.blue
  </h1>

  {#if !isLoggedIn}
    <div class="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Login with Bluesky</h2>
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
        on:click={login}
        class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Login
      </button>
    </div>
  {:else}
    <div class="w-full max-w-2xl mb-8 px-4">
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
        on:click={createPost}
        disabled={isSubmitting || !isValidLength}
        class="px-8 py-3 mt-4 text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:bg-blue-300 transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] font-medium"
      >
        {#if isSubmitting}
          Creating...
        {:else if showValidation && !isValidLength}
          Post Too Short
        {:else}
          Create Post
        {/if}
      </button>
    </div>
  {/if}

  <div class="w-full max-w-lg mt-6 font-light text-center text-gray-600 dark:text-gray-300">
    Post longer content on
    <a
      href="https://bsky.app"
      class="font-medium text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
    >
      Bluesky
    </a>
  </div>

  {#if isLoggedIn}
    <div class="fixed top-4 right-4 flex items-center gap-4">
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
    </div>
  {/if}
</main>
