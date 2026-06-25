/* ── Helpers ──────────────────────────────────────────────── */
const $ = sel => document.querySelector(sel);

function showEl(id) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.style.display = el.dataset.display || 'block';
}

function hideEl(id) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.style.display = 'none';
}

function showError(msg) {
  const el = $('#error');
  el.innerHTML = msg;
  el.style.display = 'block';
  hideEl('#success');
}

function showSuccess(msg) {
  const el = $('#success');
  el.innerHTML = msg;
  el.style.display = 'block';
  hideEl('#error');
}

/* ── Getters ─────────────────────────────────────────────── */
const option = () => $('#type').value;

const repositoryName = () => {
  if (option() === 'new') return $('#name').value.trim();
  return $('#existing_repo').value.trim();
};

/* ── Status codes for creating repo ──────────────────────── */
const statusCode = (res, status, name) => {
  switch (status) {
    case 304:
      showError(`Error creating ${name} - Unable to modify repository. Try again later!`);
      break;
    case 400:
      showError(
        `Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`,
      );
      break;
    case 401:
      showError(`Error creating ${name} - Unauthorized access to repo. Try again later!`);
      break;
    case 403:
      showError(`Error creating ${name} - Forbidden access to repository. Try again later!`);
      break;
    case 422:
      showError(
        `Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`,
      );
      break;
    default:
      /* Change mode type to commit */
      chrome.storage.local.set({ mode_type: 'commit' }, () => {
        showSuccess(
          `Successfully created <a target="_blank" href="${res.html_url}">${name}</a>. Start <a href="https://leetcode.com">LeetCoding</a> or <a href="https://leetcode.cn">力扣</a>!`,
        );
        showEl('#unlink');
        /* Show new layout */
        hideEl('#hook_mode');
        showEl('#commit_mode');
      });
      /* Set Repo Hook */
      chrome.storage.local.set({ leethub_hook: res.full_name }, () => {
        console.log('Successfully set new repo hook');
      });
      break;
  }
};

/* ── Create Repo ─────────────────────────────────────────── */
const createRepo = (token, name) => {
  const data = JSON.stringify({
    name,
    private: true,
    auto_init: true,
    description:
      'Collection of LeetCode questions to ace the coding interview! - Created using LeetHub-3.0',
  });

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      statusCode(JSON.parse(xhr.responseText), xhr.status, name);
    }
  });
  xhr.open('POST', 'https://api.github.com/user/repos', true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send(data);
};

/* ── Link Status Codes ───────────────────────────────────── */
const linkStatusCode = (status, name) => {
  let bool = false;
  switch (status) {
    case 301:
      showError(
        `Error linking <a target="_blank" href="https://github.com/${name}">${name}</a> to LeetHub. <br> This repository has been moved permanently. Try creating a new one.`,
      );
      break;
    case 403:
      showError(
        `Error linking <a target="_blank" href="https://github.com/${name}">${name}</a> to LeetHub. <br> Forbidden action. Please make sure you have the right access to this repository.`,
      );
      break;
    case 404:
      showError(
        `Error linking <a target="_blank" href="https://github.com/${name}">${name}</a> to LeetHub. <br> Resource not found. Make sure you enter the right repository name.`,
      );
      break;
    default:
      bool = true;
      break;
  }
  showEl('#unlink');
  return bool;
};

/* ── Handle type selector change ─────────────────────────── */
$('#type').addEventListener('change', function () {
  const selectedType = this.value;
  if (selectedType === 'link') {
    hideEl('#name');
    showEl('#existing_repo');
    loadRepositories();
  } else if (selectedType === 'new') {
    showEl('#name');
    hideEl('#existing_repo');
  } else {
    hideEl('#name');
    hideEl('#existing_repo');
  }

  // Enable/disable Get Started button
  $('#hook_button').disabled = !this.value;
});

/* ── Load Repositories ───────────────────────────────────── */
function loadRepositories() {
  chrome.storage.local.get('leethub_token', data => {
    const token = data.leethub_token;
    let repos = [];
    let page = 1;

    function fetchPage() {
      const url = `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner`;
      const xhr = new XMLHttpRequest();
      xhr.addEventListener('readystatechange', function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            repos = repos.concat(response);

            const linkHeader = xhr.getResponseHeader('Link');
            const hasNext = linkHeader && linkHeader.includes('rel="next"');

            if (hasNext) {
              page++;
              fetchPage();
            } else {
              // Populate dropdown
              const select = $('#existing_repo');
              select.innerHTML = '<option value="">Select a Repository</option>';
              repos.forEach(repo => {
                const opt = document.createElement('option');
                opt.value = repo.name;
                opt.textContent = repo.name;
                select.appendChild(opt);
              });
            }
          } else {
            showError('Failed to load repositories. Please try again.');
          }
        }
      });
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Authorization', `token ${token}`);
      xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
      xhr.send();
    }

    fetchPage();
  });
}

/* ── Link Repo ───────────────────────────────────────────── */
const linkRepo = (token, name) => {
  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      const res = JSON.parse(xhr.responseText);
      const bool = linkStatusCode(xhr.status, name);
      if (xhr.status === 200) {
        if (!bool) {
          chrome.storage.local.set({ mode_type: 'hook' }, () => {
            console.log(`Error linking ${name} to LeetHub`);
          });
          chrome.storage.local.set({ leethub_hook: null }, () => {
            console.log('Defaulted repo hook to NONE');
          });
          showEl('#hook_mode');
          hideEl('#commit_mode');
        } else {
          chrome.storage.local.set({ mode_type: 'commit', repo: res.html_url }, () => {
            showSuccess(
              `Successfully linked <a target="_blank" href="${res.html_url}">${name}</a> to LeetHub. Start <a href="http://leetcode.com">LeetCoding</a> now!`,
            );
            showEl('#unlink');
          });
          chrome.storage.local
            .set({ leethub_hook: res.full_name })
            .then(() => {
              console.log('Successfully set new repo hook');
              return chrome.storage.local.get('stats');
            })
            .then(psolved => {
              const { stats } = psolved;
              if (stats && stats.solved) {
                $('#p_solved').textContent = stats.solved;
                $('#p_solved_easy').textContent = stats.easy;
                $('#p_solved_medium').textContent = stats.medium;
                $('#p_solved_hard').textContent = stats.hard;
              }
            });
          hideEl('#hook_mode');
          showEl('#commit_mode');
        }
      }
    }
  });
  xhr.open('GET', `https://api.github.com/repos/${name}`, true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send();
};

/* ── Unlink Repo ─────────────────────────────────────────── */
const unlinkRepo = () => {
  chrome.storage.local.set({ mode_type: 'hook' }, () => {
    console.log('Unlinking repo');
  });
  chrome.storage.local.set({ leethub_hook: null }, () => {
    console.log('Setting repo hook to NONE');
  });
  showEl('#hook_mode');
  hideEl('#commit_mode');
};

/* ── Hook Button ─────────────────────────────────────────── */
$('#hook_button').addEventListener('click', () => {
  if (!option()) {
    showError('No option selected - Pick an option from dropdown menu below that best suits you!');
  } else if (!repositoryName()) {
    showError('No repository name added - Enter the name of your repository!');
    $('#name').focus();
  } else {
    hideEl('#error');
    showSuccess('Attempting to create Hook... Please wait.');

    chrome.storage.local.get('leethub_token', data => {
      const token = data.leethub_token;
      if (!token) {
        showError(
          'Authorization error - Grant LeetHub access to your GitHub account to continue (launch extension to proceed)',
        );
      } else if (option() === 'new') {
        createRepo(token, repositoryName());
      } else {
        chrome.storage.local.get('leethub_username', data2 => {
          const username = data2.leethub_username;
          if (!username) {
            showError(
              'Improper Authorization error - Grant LeetHub access to your GitHub account to continue (launch extension to proceed)',
            );
          } else {
            linkRepo(token, `${username}/${repositoryName()}`);
          }
        });
      }
    });
  }
});

/* ── Unlink Click ────────────────────────────────────────── */
$('#unlink a').addEventListener('click', () => {
  unlinkRepo();
  hideEl('#unlink');
  showSuccess('Successfully unlinked your current git repo. Please create/link a new hook.');
});

/* ── Sync Counts ─────────────────────────────────────────── */
$('#sync_counts').addEventListener('click', async () => {
  const { leethub_hook: repo } = await chrome.storage.local.get('leethub_hook');
  if (!repo) {
    showError('No repository linked - Please link a repository to sync counts!');
    return;
  }

  const { leethub_token: token } = await chrome.storage.local.get('leethub_token');
  if (!token) {
    showError('No token found - Please authorize LeetHub to access your GitHub account!');
    return;
  }

  hideEl('#error');
  const stats = { solved: 0, easy: 0, medium: 0, hard: 0, shas: {} };

  const fetchFileContent = async (path, itemType) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return {
      content: itemType !== 'dir' ? atob(data.content) : data,
      sha: data.sha,
    };
  };

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch repository data: ${response.statusText}`);
    const repoContents = await response.json();

    const extractReadmeContent = async contents => {
      const promises = contents.map(async item => {
        try {
          if (item.name.toLowerCase() === 'readme.md') {
            const { content } = await fetchFileContent(item.path, item.type);
            const difficulty = content.split('<h3>')[1]?.split('</h3>')[0]?.trim();
            if (difficulty) {
              const d = difficulty.toLowerCase();
              if (d === 'easy') stats.easy += 1;
              else if (d === 'medium') stats.medium += 1;
              else if (d === 'hard') stats.hard += 1;
              stats.solved += 1;
            }
            return { path: item.path, difficulty };
          } else if (item.type === 'dir') {
            const { content: subContents } = await fetchFileContent(item.path, item.type);
            return extractReadmeContent(subContents);
          }
        } catch (error) {
          console.error(`Error processing ${item.path}: ${error.message}`);
          return null;
        }
      });
      return Promise.all(promises);
    };

    await extractReadmeContent(repoContents);

    chrome.storage.local.set({ stats }, () => {
      $('#p_solved').textContent = stats.solved;
      $('#p_solved_easy').textContent = stats.easy;
      $('#p_solved_medium').textContent = stats.medium;
      $('#p_solved_hard').textContent = stats.hard;
    });
  } catch (error) {
    console.error(error.message);
    showError('Failed to fetch repository data. Please try again.');
  }
});

/* ── Detect Mode Type on Load ────────────────────────────── */
chrome.storage.local.get('mode_type', data => {
  const mode = data.mode_type;

  if (mode && mode === 'commit') {
    chrome.storage.local.get('leethub_token', data2 => {
      const token = data2.leethub_token;
      if (!token) {
        showError(
          'Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)',
        );
        showEl('#hook_mode');
        hideEl('#commit_mode');
      } else {
        chrome.storage.local.get('leethub_hook', repoName => {
          const hook = repoName.leethub_hook;
          if (!hook) {
            showError(
              'Improper Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)',
            );
            showEl('#hook_mode');
            hideEl('#commit_mode');
          } else {
            linkRepo(token, hook);
          }
        });
      }
    });

    hideEl('#hook_mode');
    showEl('#commit_mode');
  } else {
    showEl('#hook_mode');
    hideEl('#commit_mode');
  }
});
