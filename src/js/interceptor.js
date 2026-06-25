// Store reference to solution posts for communication with content script
window.leetHubSolutionPosts = [];

// 1. Intercept fetch requests
const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const [resource, options] = args;

  let url = '';
  if (typeof resource === 'string') {
    url = resource;
  } else if (resource instanceof URL) {
    url = resource.href;
  } else if (resource && typeof resource === 'object' && 'url' in resource) {
    url = resource.url;
  } else if (resource && typeof resource.toString === 'function') {
    url = resource.toString();
  }

  const method = options?.method || 'GET';

  console.log('[LeetHub Fetch Intercept]', url, method);

  const response = await originalFetch.apply(this, args);
  if (url?.includes('/problems/') && url?.includes('/submit/')) {
    try {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();

      if (data?.submission_id) {
        console.log('LeetHub: Submission ID detected', data.submission_id);
        window.postMessage(
          {
            type: 'leetHubSubmissionId',
            submissionId: data.submission_id,
          },
          '*',
        );
      }
    } catch (e) {
      console.log('LeetHub: Error parsing submission response', e);
    }
  }

  if (url?.includes('/graphql/') && method === 'POST') {
    console.log('LeetHub: GraphQL POST detected via fetch');
    try {
      const body = JSON.parse(options?.body || '{}');
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

          window.postMessage(
            {
              type: 'leetHubSolutionPost',
              questionSlug: solutionData.questionSlug,
              content: solutionData.content,
              title: solutionData.title,
            },
            '*',
          );
        } else {
          console.log('LeetHub: Missing questionSlug or content in solution data');
        }
      }
    } catch (error) {
      console.log('LeetHub: Error parsing GraphQL body:', error);
    }
  }

  return response;
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
  const url = this._leethub_url;
  const method = this._leethub_method;

  // Intercept submit responses via XHR
  if (url?.includes('/problems/') && url?.includes('/submit/')) {
    this.addEventListener('load', () => {
      try {
        const responseData = JSON.parse(this.responseText);
        if (responseData?.submission_id) {
          console.log('LeetHub: Submission ID detected via XHR', responseData.submission_id);
          window.postMessage(
            {
              type: 'leetHubSubmissionId',
              submissionId: responseData.submission_id,
            },
            '*',
          );
        }
      } catch (e) {
        console.log('LeetHub: Error parsing XHR submission response', e);
      }
    });
  }

  if (url?.includes('/graphql/') && method === 'POST') {
    console.log('LeetHub: GraphQL POST detected via XHR');

    try {
      const body = JSON.parse(data || '{}');
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
          // Dispatch window message to notify content script
          window.postMessage(
            {
              type: 'leetHubSolutionPost',
              questionSlug: solutionData.questionSlug,
              content: solutionData.content,
              title: solutionData.title,
            },
            '*',
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
