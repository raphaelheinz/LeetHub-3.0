const displayWelcomePage = () => {
  const url = chrome.runtime.getURL('src/html/welcome.html');
  chrome.tabs.create({ url: url, active: true });
};

const closeTab = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.remove(tabs[0].id);
    }
  });
};

const handleMessage = (request, sender, sendResponse) => {
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
      closeTab();
    }
  }

  if (request.action === 'crossFetch') {
    const { url, options } = request;
    fetch(url, options)
      .then(async response => {
        const text = await response.text();
        sendResponse({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          text: text,
        });
      })
      .catch(error => {
        sendResponse({
          ok: false,
          error: error.message,
        });
      });
    return true; // Keep the message channel open for async response
  }
};

chrome.runtime.onMessage.addListener(handleMessage);
