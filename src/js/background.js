const displayWelcomePage = () => {
  const url = chrome.runtime.getURL('src/html/welcome.html');
  chrome.tabs.create({ url: url, active: true });
};

const closeTab = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    chrome.tabs.remove(tabs[0].id);
  });
};

const handleMessage = request => {
  if (!request) {
    console.log('Received undefined message');
    return;
  }

  if (request.action === 'customCommitMessageUpdated') {
    chrome.storage.local.set({ custom_commit_message: request.message });
  }

  if (request.closeWebPage) {
    if (request.isSuccess) {
      chrome.storage.local.set({ leethub_username: request.username });
      chrome.storage.local.set({ leethub_token: request.token });
      chrome.storage.local.set({ pipe_leethub: false }, () => {});
      closeTab();
      displayWelcomePage();
    } else {
      alert('Error while trying to authenticate your profile!');
      closeTab();
    }
  }
};

chrome.runtime.onMessage.addListener(handleMessage);
