/* global oAuth2 */

/* ── Helpers ──────────────────────────────────────────────── */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove('hidden');
}

let action = false;

/* ── Auth: GitHub OAuth ──────────────────────────────────── */
$('#authenticate').addEventListener('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

/* ── Auth: PAT Connect ───────────────────────────────────── */
$('#pat_connect').addEventListener('click', () => {
  const pat = $('#pat_token').value.trim();
  const errorEl = $('#pat_error');

  if (!pat) {
    errorEl.textContent = 'Please enter a Personal Access Token.';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  $('#pat_connect').disabled = true;

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      $('#pat_connect').disabled = false;
      if (xhr.status === 200) {
        let username;
        try {
          username = JSON.parse(xhr.responseText).login;
        } catch {
          errorEl.textContent = 'Failed to parse user profile.';
          errorEl.style.display = 'block';
          return;
        }
        chrome.storage.local.set(
          {
            leethub_token: pat,
            leethub_username: username,
            mode_type: 'hook',
          },
          () => {
            chrome.tabs.create({
              url: chrome.runtime.getURL('src/html/welcome.html'),
              active: true,
            });
          },
        );
      } else {
        let errorMsg = 'Invalid token. Make sure it has the "repo" scope.';
        if (xhr.status === 0) {
          errorMsg = 'Network error. Check your connection.';
        }
        errorEl.textContent = errorMsg;
        errorEl.style.display = 'block';
      }
    }
  });
  xhr.open('GET', 'https://api.github.com/user', true);
  xhr.setRequestHeader('Authorization', `token ${pat}`);
  xhr.send();
});

/* ── Hook URL ────────────────────────────────────────────── */
$('#hook_URL').href = chrome.runtime.getURL('src/html/welcome.html');

/* ── Commit Message Accordion ────────────────────────────── */
$('#commit-accordion-trigger').addEventListener('click', () => {
  const trigger = $('#commit-accordion-trigger');
  const content = $('#commit-accordion-content');
  trigger.classList.toggle('open');
  content.classList.toggle('open');

  if (content.classList.contains('open')) {
    chrome.storage.local.get(['custom_commit_message'], data => {
      const msg = data.custom_commit_message;
      const textarea = $('#custom-commit-msg');
      if (!msg) {
        textarea.placeholder = 'Time: {time}, Space: {space} - LeetHub';
      } else {
        textarea.placeholder = msg;
        textarea.value = msg;
      }
    });
  }
});

/* ── Settings Toggles ────────────────────────────────────── */
function initToggle(checkboxId, storageKey, defaultVal = false) {
  const checkbox = $(`#${checkboxId}`);
  // Load initial state
  chrome.storage.local.get({ [storageKey]: defaultVal }, data => {
    checkbox.checked = data[storageKey];
  });
  // Save on change
  checkbox.addEventListener('change', () => {
    chrome.storage.local.set({ [storageKey]: checkbox.checked });
  });
}

initToggle('use-difficulty-folder', 'useDifficultyFolder');
initToggle('use-language-folder', 'useLanguageFolder');
initToggle('use-timestamp-filename', 'useTimestampFilename');
initToggle('auto-commit-solution-post', 'autoCommitSolutionPost', true);

/* ── Commit Message Save/Reset ───────────────────────────── */
$('#msg-save-btn').addEventListener('click', () => {
  const commitMessage = $('#custom-commit-msg').value;
  chrome.runtime.sendMessage({
    action: 'customCommitMessageUpdated',
    message: commitMessage.trim(),
  });

  const feedback = $('#success-message');
  feedback.style.display = 'inline';
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 3000);
});

/* ── Msg Reset ───────────────────────────────────────────── */
$('#msg-reset-btn').addEventListener('click', () => {
  const textarea = $('#custom-commit-msg');
  textarea.value = '';
  textarea.placeholder = 'Time: {time}, Space: {space} - LeetHub';
  chrome.runtime.sendMessage({ action: 'customCommitMessageUpdated', message: null });
});

/* ── Variable Pills ──────────────────────────────────────── */
$$('.var-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const varName = pill.dataset.var;
    const textarea = $('#custom-commit-msg');
    textarea.value += `{${varName}} `;
    textarea.focus();
  });
});

/* ── Init: Determine which mode to show ──────────────────── */
chrome.storage.local.get('leethub_token', data => {
  const token = data.leethub_token;

  if (!token) {
    action = true;
    show('#auth_mode');
    return;
  }

  // Validate token
  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        const user = JSON.parse(xhr.responseText);

        chrome.storage.local.get('mode_type', data2 => {
          if (data2 && data2.mode_type === 'commit') {
            show('#commit_mode');

            // Set user info
            if (user.avatar_url) {
              const avatar = $('#user_avatar');
              avatar.src = user.avatar_url;
              avatar.style.display = 'block';
            }
            if (user.login) {
              $('#user_name').textContent = user.login;
            }

            // Get stats and repo link
            chrome.storage.local.get(['stats', 'leethub_hook'], data3 => {
              const { stats } = data3;
              if (stats && stats.solved) {
                $('#p_solved').textContent = stats.solved;
                $('#p_solved_easy').textContent = stats.easy;
                $('#p_solved_medium').textContent = stats.medium;
                $('#p_solved_hard').textContent = stats.hard;
              }

              const hook = data3.leethub_hook;
              if (hook) {
                const repoLink = $('#repo_url');
                repoLink.href = `https://github.com/${hook}`;
                repoLink.textContent = hook;
              }
            });
          } else {
            show('#hook_mode');
          }
        });
      } else if (xhr.status === 401) {
        chrome.storage.local.set({ leethub_token: null }, () => {
          action = true;
          show('#auth_mode');
        });
      }
    }
  });
  xhr.open('GET', 'https://api.github.com/user', true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.send();
});

/* ── Logout ──────────────────────────────────────────────── */
const handleLogout = () => {
  chrome.storage.local.remove(
    ['leethub_token', 'leethub_username', 'leethub_hook', 'mode_type', 'stats'],
    () => {
      window.location.reload();
    },
  );
};

$('#logout_btn').addEventListener('click', handleLogout);
$('#logout_btn_hook').addEventListener('click', handleLogout);
