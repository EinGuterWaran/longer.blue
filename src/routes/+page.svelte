<script>
  let { data } = $props()
  let content = ''
  let isSubmitting = false

  async function createPost() {
    if (!content.trim()) return
    
    isSubmitting = true
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) throw new Error('Failed to create post')

      const result = await response.json()
      content = '' // Clear the textarea
      // Optionally refresh the page to show the new post
      window.location.reload()
    } catch (error) {
      console.error('Error:', error)
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

  <div class="w-full max-w-2xl mb-8 px-4">
    <div class="relative group">
      <textarea
        bind:value={content}
        class="w-full h-48 p-4 text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm hover:shadow-md"
        placeholder="Write your longer post here..."
      />
      <div class="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none transition-opacity opacity-0 group-hover:opacity-100" />
    </div>
    
    <button
      on:click={createPost}
      disabled={isSubmitting}
      class="px-8 py-3 mt-4 text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:bg-blue-300 transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] font-medium"
    >
      {isSubmitting ? 'Creating...' : 'Create Post'}
    </button>
  </div>

  <div class="w-full max-w-lg mt-6 font-light text-center text-gray-600 dark:text-gray-300">
    Post longer content on
    <a
      href="https://bsky.app"
      class="font-medium text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
    >
      Bluesky
    </a>
  </div>
</main>
