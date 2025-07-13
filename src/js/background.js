const displayWelcomePage = () => {
  // Use chrome API (works with polyfill in both browsers)
  const url = chrome.runtime.getURL('src/html/welcome.html');
  chrome.tabs.create({ url: url, active: true }, (tab) => {
    console.log('Welcome page opened:', tab ? tab.id : 'failed');
  });
};

const closeTab = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.remove(tabs[0].id, () => {
        console.log('Tab closed');
      });
    }
  });
};

const handleMessage = (request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (!request) {
    console.log('Received undefined message');
    return;
  }

  if (request.action === 'customCommitMessageUpdated') {
    chrome.storage.local.set({ custom_commit_message: request.message }, () => {
      console.log('Custom commit message updated');
    });
  }

  if (request.closeWebPage) {
    if (request.isSuccess) {
      console.log('Authentication successful, setting up user data');
      chrome.storage.local.set({ leethub_username: request.username }, () => {
        chrome.storage.local.set({ leethub_token: request.token }, () => {
          chrome.storage.local.set({ pipe_leethub: false }, () => {
            console.log('User data stored, closing tab and opening welcome page');
            closeTab();
            displayWelcomePage();
          });
        });
      });
    } else {
      console.log('Authentication failed');
      alert('Error while trying to authenticate your profile!');
      closeTab();
    }
  }
  
  // Send response to indicate message was processed
  if (sendResponse) {
    sendResponse({ received: true });
  }
};

// Add message listener
chrome.runtime.onMessage.addListener(handleMessage);

console.log('Background script loaded and message listener added');
