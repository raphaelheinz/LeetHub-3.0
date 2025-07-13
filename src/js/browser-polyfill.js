/**
 * Browser compatibility layer for Chrome/Firefox extension APIs
 * This polyfill provides a unified API interface for both browsers
 */

(function() {
  'use strict';

  // Debug flag - set to true to enable console logging
  const DEBUG = false;
  
  const log = (...args) => {
    if (DEBUG) console.log('[Browser Polyfill]', ...args);
  };

  // Check if we're running in Firefox (which has browser API) or Chrome (which has chrome API)
  const isFirefox = typeof browser !== 'undefined' && browser.runtime;
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

  if (!isFirefox && !isChrome) {
    console.error('[Browser Polyfill] No browser extension API found');
    return;
  }

  log('Detected browser:', isFirefox ? 'Firefox' : 'Chrome');

  // Use browser API if available (Firefox), otherwise use chrome API (Chrome)
  const browserAPI = isFirefox ? browser : chrome;

  // Helper function to safely bind methods
  const safeBind = (obj, method) => {
    try {
      return obj && obj[method] ? obj[method].bind(obj) : undefined;
    } catch (error) {
      console.warn('[Browser Polyfill] Failed to bind method:', method, error);
      return undefined;
    }
  };

  // For Chrome, we need to promisify some APIs to match Firefox's promise-based approach
  // However, since this extension currently uses callbacks, we'll maintain callback compatibility
  // and just ensure the API exists on both browsers

  if (isChrome && !window.browser) {
    log('Creating browser API for Chrome');
    // Create browser object for Chrome to match Firefox API
    window.browser = {
      runtime: {
        getURL: safeBind(chrome.runtime, 'getURL'),
        onMessage: chrome.runtime.onMessage,
        sendMessage: safeBind(chrome.runtime, 'sendMessage')
      },
      tabs: {
        create: safeBind(chrome.tabs, 'create'),
        remove: safeBind(chrome.tabs, 'remove'),
        query: safeBind(chrome.tabs, 'query')
      },
      storage: {
        local: {
          get: safeBind(chrome.storage.local, 'get'),
          set: safeBind(chrome.storage.local, 'set')
        }
      }
    };
    log('Browser API created for Chrome');
  }

  if (isFirefox && !window.chrome) {
    log('Creating chrome API for Firefox');
    // Create chrome object for Firefox to match Chrome API
    window.chrome = {
      runtime: {
        getURL: safeBind(browser.runtime, 'getURL'),
        onMessage: browser.runtime.onMessage,
        sendMessage: safeBind(browser.runtime, 'sendMessage')
      },
      tabs: {
        create: safeBind(browser.tabs, 'create'),
        remove: safeBind(browser.tabs, 'remove'),
        query: safeBind(browser.tabs, 'query')
      },
      storage: {
        local: {
          get: safeBind(browser.storage.local, 'get'),
          set: safeBind(browser.storage.local, 'set')
        }
      }
    };
    log('Chrome API created for Firefox');
  }

  // Verify that both APIs are available
  if (window.chrome && window.chrome.runtime) {
    log('Chrome API is available');
  } else {
    console.warn('[Browser Polyfill] Chrome API is not properly initialized');
  }

  if (window.browser && window.browser.runtime) {
    log('Browser API is available');
  } else {
    console.warn('[Browser Polyfill] Browser API is not properly initialized');
  }

  log('Browser polyfill initialization complete');
})();
