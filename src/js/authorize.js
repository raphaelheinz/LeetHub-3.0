/*
    (needs patch)
    IMPLEMENTATION OF AUTHENTICATION ROUTE AFTER REDIRECT FROM GITHUB.
*/

const localAuth = {
  /**
   * Initialize
   */
  init() {
    this.KEY = 'leethub_token';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
    this.CLIENT_ID = '0114dd35b156d4729fac';
    this.CLIENT_SECRET = 'cfc3301d9745530bf1b31e92528ad9c31fd3f995';
    this.REDIRECT_URL = 'https://github.com/';
    this.SCOPES = ['repo'];
  },

  /**
   * Parses Access Code
   *
   * @param url The url containing the access code.
   */
  parseAccessCode(url) {
    console.log('Parsing access code from URL:', url);
    
    if (url.match(/\?error=(.+)/)) {
      console.error('OAuth error detected in URL');
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        chrome.tabs.remove(tab.id, function () {
          console.log('Tab removed due to OAuth error');
        });
      });
    } else {
      const codeMatch = url.match(/\?code=([\w\/\-]+)/);
      if (codeMatch && codeMatch[1]) {
        console.log('Access code found, requesting token');
        // eslint-disable-next-line
        this.requestToken(codeMatch[1]);
      } else {
        console.error('No access code found in URL');
      }
    }
  },

  /**
   * Request Token
   *
   * @param code The access code returned by provider.
   */
  requestToken(code) {
    console.log('Requesting token with code:', code);
    const that = this;
    
    // Create the request body
    const params = new URLSearchParams();
    params.append('client_id', this.CLIENT_ID);
    params.append('client_secret', this.CLIENT_SECRET);
    params.append('code', code);
    params.append('redirect_uri', this.REDIRECT_URL);

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        console.log('Token request response status:', xhr.status);
        console.log('Token request response text:', xhr.responseText);
        
        if (xhr.status === 200) {
          // GitHub can return the response in different formats
          let accessToken = null;
          
          // Try to parse as URL-encoded format first
          const tokenMatch = xhr.responseText.match(/access_token=([^&]*)/);
          if (tokenMatch && tokenMatch[1]) {
            accessToken = tokenMatch[1];
          } else {
            // Try to parse as JSON format
            try {
              const jsonResponse = JSON.parse(xhr.responseText);
              if (jsonResponse.access_token) {
                accessToken = jsonResponse.access_token;
              }
            } catch (e) {
              console.log('Response is not JSON format');
            }
          }
          
          if (accessToken) {
            console.log('Token received successfully');
            that.finish(accessToken);
          } else {
            console.error('No access token found in response:', xhr.responseText);
            chrome.runtime.sendMessage({
              closeWebPage: true,
              isSuccess: false,
            });
          }
        } else {
          console.error('Token request failed with status:', xhr.status, 'Response:', xhr.responseText);
          chrome.runtime.sendMessage({
            closeWebPage: true,
            isSuccess: false,
          });
        }
      }
    });
    
    xhr.addEventListener('error', function() {
      console.error('Network error during token request');
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    });
    
    xhr.open('POST', this.ACCESS_TOKEN_URL, true);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send(params.toString());
  },

  /**
   * Finish
   *
   * @param token The OAuth2 token given to the application from the provider.
   */
  finish(token) {
    console.log('Getting user info with token');
    /* Get username */
    // To validate user, load user object from GitHub.
    const AUTHENTICATION_URL = 'https://api.github.com/user';

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        console.log('User info request status:', xhr.status);
        console.log('User info response:', xhr.responseText);
        
        if (xhr.status === 200) {
          try {
            const userInfo = JSON.parse(xhr.responseText);
            const username = userInfo.login;
            
            if (username) {
              console.log('Authentication successful for user:', username);
              
              // Send message to background script with better error handling
              chrome.runtime.sendMessage({
                closeWebPage: true,
                isSuccess: true,
                token,
                username,
                KEY: 'leethub_token', // Use the actual key instead of this.KEY
              }, (response) => {
                console.log('Message sent to background script, response:', response);
                if (chrome.runtime.lastError) {
                  console.error('Error sending message to background:', chrome.runtime.lastError);
                }
              });
            } else {
              console.error('No username found in user info');
              chrome.runtime.sendMessage({
                closeWebPage: true,
                isSuccess: false,
              });
            }
          } catch (error) {
            console.error('Error parsing user info JSON:', error);
            chrome.runtime.sendMessage({
              closeWebPage: true,
              isSuccess: false,
            });
          }
        } else {
          console.error('Failed to get user information. Status:', xhr.status, 'Response:', xhr.responseText);
          chrome.runtime.sendMessage({
            closeWebPage: true,
            isSuccess: false,
          });
        }
      }
    });
    
    xhr.addEventListener('error', function() {
      console.error('Network error during user info request');
      chrome.runtime.sendMessage({
        closeWebPage: true,
        isSuccess: false,
      });
    });
    
    xhr.open('GET', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.send();
  },
};

localAuth.init(); // load params.
const link = window.location.href;

/* Check for open pipe */
if (window.location.host === 'github.com') {
  console.log('On GitHub, checking for pipe_leethub flag');
  chrome.storage.local.get('pipe_leethub', data => {
    console.log('Pipe leethub data:', data);
    if (data && data.pipe_leethub) {
      console.log('Pipe is open, parsing access code from:', link);
      localAuth.parseAccessCode(link);
    } else {
      console.log('Pipe is not open, ignoring GitHub page');
    }
  });
} else {
  console.log('Not on GitHub, current host:', window.location.host);
}
