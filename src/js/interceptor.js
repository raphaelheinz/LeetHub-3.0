// LeetCode Fetch Interceptor - Runs in Main World
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0].url;
  
  // CCTV: Now monitoring LeetCode's actual fetch, so all requests will be visible.
  console.log('[LeetHub Injected Intercept]', url);

  const response = await originalFetch(...args);

  if (url.includes('/problems/') && url.includes('/submit/')) {
    try {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data && data.submission_id) {
        // If an ID is found, send a message to the content script.
        window.postMessage({
          type: 'LEETHUB_SUBMISSION_ID',
          submissionId: data.submission_id
        }, '*');
      }
    } catch (e) {}
  }
  return response;
};
