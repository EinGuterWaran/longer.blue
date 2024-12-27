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

<main
  class="relative flex flex-col items-center justify-center min-h-screen py-10"
>
  <h1
    class="pt-4 pb-8 bg-gradient-to-br dark:from-white from-black via-[#707070] to-[#ffffff] bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl"
  >
    longer.blue
  </h1>

  <div class="w-full max-w-2xl mb-8">
    <textarea
      bind:value={content}
      class="w-full h-48 p-4 text-gray-700 border rounded-lg focus:outline-none focus:border-blue-500"
      placeholder="Write your longer post here..."
    />
    <button
      on:click={createPost}
      disabled={isSubmitting}
      class="px-6 py-2 mt-4 text-white bg-blue-500 rounded-full hover:bg-blue-600 disabled:bg-gray-400"
    >
      {isSubmitting ? 'Creating...' : 'Create Post'}
    </button>
  </div>

  <div
    class="w-full max-w-lg mt-6 font-light text-center text-gray-600 dark:text-gray-300"
  >
    Post longer content on
    <a
      href="https://bsky.app"
      class="font-medium underline transition-colors underline-offset-4 dark:hover:text-white hover:text-black"
    >
      Bluesky
    </a>
  </div>
</main>
