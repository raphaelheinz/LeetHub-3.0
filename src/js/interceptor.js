console.log('LeetHub: Interceptor script loaded in MAIN world on', window.location.href);

// Store reference to solution posts for communication with content script
window.leetHubSolutionPosts = [];

// 1. Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function (...args) {
  const [url, options] = args;
  
  console.log('LeetHub: Fetch intercepted', url, options?.method);

  // Check if this is a GraphQL request to publish solution
  if (url && url.includes('/graphql/') && options?.method === 'POST') {
    console.log('LeetHub: GraphQL POST detected via fetch');
    try {
      const body = JSON.parse(options.body);
      console.log('LeetHub: GraphQL operation:', body.operationName);
      if (body.operationName === 'ugcArticlePublishSolution') {
        console.log('LeetHub: Solution post operation detected!');
        const solutionData = body.variables?.data;
        console.log('LeetHub: Solution data:', solutionData);
        if (solutionData?.questionSlug && solutionData?.content) {
          console.log('LeetHub: Valid solution data found, storing for processing...');
          // Store the solution data for the content script to process
          window.leetHubSolutionPosts.push({
            questionSlug: solutionData.questionSlug,
            content: solutionData.content,
            title: solutionData.title,
            timestamp: Date.now(),
          });
          // Dispatch custom event to notify content script
          window.dispatchEvent(
            new CustomEvent('leetHubSolutionPost', {
              detail: {
                questionSlug: solutionData.questionSlug,
                content: solutionData.content,
                title: solutionData.title,
              },
            }),
          );
        } else {
          console.log('LeetHub: Missing questionSlug or content in solution data');
        }
      }
    } catch (error) {
      console.log('LeetHub: Error parsing GraphQL body:', error);
    }
  }

  return originalFetch.apply(this, args);
};

// 2. Intercept XMLHttpRequest (fallback)
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  this._leethub_url = url;
  this._leethub_method = method;
  console.log('LeetHub: XHR open intercepted', method, url);
  return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function (data) {
  console.log('LeetHub: XHR send intercepted', this._leethub_method, this._leethub_url);

  if (this._leethub_url && this._leethub_url.includes('/graphql/') && this._leethub_method === 'POST') {
    console.log('LeetHub: GraphQL POST detected via XHR');
    try {
      const body = JSON.parse(data);
      console.log('LeetHub: XHR GraphQL operation:', body.operationName);
      if (body.operationName === 'ugcArticlePublishSolution') {
        console.log('LeetHub: Solution post operation detected via XHR!');
        const solutionData = body.variables?.data;
        console.log('LeetHub: XHR Solution data:', solutionData);
        if (solutionData?.questionSlug && solutionData?.content) {
          console.log('LeetHub: Valid solution data found via XHR, storing for processing...');
          // Store the solution data for the content script to process
          window.leetHubSolutionPosts.push({
            questionSlug: solutionData.questionSlug,
            content: solutionData.content,
            title: solutionData.title,
            timestamp: Date.now(),
          });
          // Dispatch custom event to notify content script
          window.dispatchEvent(
            new CustomEvent('leetHubSolutionPost', {
              detail: {
                questionSlug: solutionData.questionSlug,
                content: solutionData.content,
                title: solutionData.title,
              },
            }),
          );
        } else {
          console.log('LeetHub: Missing questionSlug or content in XHR solution data');
        }
      }
    } catch (error) {
      console.log('LeetHub: Error parsing XHR GraphQL body:', error);
    }
  }

  return originalXHRSend.apply(this, [data]);
};

console.log('LeetHub: Request interceptors installed in page context');