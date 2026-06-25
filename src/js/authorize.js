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
    if (url.match(/\?error=(.+)/)) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        chrome.tabs.remove(tab.id, function () {});
      });
    } else {
      // eslint-disable-next-line
      this.requestToken(url.match(/\?code=([\w\/\-]+)/)[1]);
    }
  },

  /**
   * Request Token
   *
   * @param code The access code returned by provider.
   */
  requestToken(code) {
    const that = this;
    const body = JSON.stringify({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      code: code,
    });

    chrome.runtime.sendMessage(
      {
        action: 'crossFetch',
        url: this.ACCESS_TOKEN_URL,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: body,
        },
      },
      response => {
        if (response && response.ok) {
          let tokenData;
          try {
            tokenData = JSON.parse(response.text);
          } catch {
            // fallback to URL encoded match if not JSON
            const match = response.text.match(/access_token=([^&]*)/);
            if (match) {
              that.finish(match[1]);
              return;
            }
          }
          if (tokenData && tokenData.access_token) {
            that.finish(tokenData.access_token);
          } else {
            alert('Error while trying to authenticate your profile!');
            chrome.runtime.sendMessage({
              closeWebPage: true,
              isSuccess: false,
            });
          }
        } else {
          alert('Error while trying to authenticate your profile!');
          chrome.runtime.sendMessage({
            closeWebPage: true,
            isSuccess: false,
          });
        }
      },
    );
  },

  /**
   * Finish
   *
   * @param token The OAuth2 token given to the application from the provider.
   */
  finish(token) {
    const AUTHENTICATION_URL = 'https://api.github.com/user';

    chrome.runtime.sendMessage(
      {
        action: 'crossFetch',
        url: AUTHENTICATION_URL,
        options: {
          method: 'GET',
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      },
      response => {
        if (response && response.ok) {
          try {
            const username = JSON.parse(response.text).login;
            chrome.runtime.sendMessage({
              closeWebPage: true,
              isSuccess: true,
              token,
              username,
              KEY: this.KEY,
            });
          } catch {
            alert('Error while trying to authenticate your profile!');
            chrome.runtime.sendMessage({
              closeWebPage: true,
              isSuccess: false,
            });
          }
        } else {
          alert('Error while trying to authenticate your profile!');
          chrome.runtime.sendMessage({
            closeWebPage: true,
            isSuccess: false,
          });
        }
      },
    );
  },
};

localAuth.init(); // load params.
const link = window.location.href;

/* Check for open pipe */
if (window.location.host === 'github.com') {
  chrome.storage.local.get('pipe_leethub', data => {
    if (data && data.pipe_leethub) {
      localAuth.parseAccessCode(link);
    }
  });
}
