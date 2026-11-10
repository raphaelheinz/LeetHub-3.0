/*
 * Bulk sync of previously solved problems.
 *
 * Runs as a content script on leetcode.com / leetcode.cn (same isolated world as leetcode.js, so
 * the upload helpers defined there are available). Opened from the extension popup, it shows a
 * checklist of all problems the user has solved and pushes the latest accepted submission of each
 * selected problem to GitHub, one problem at a time.
 */

/* global fetchSubmissionDetails, fetchQuestionDetails, getLeetCodeBaseUrl, languages, uploadGit,
   upload, getUpdatedData, appendProblemToReadme, sortTopicsInReadme, addLeadingZeros,
   getCustomCommitMessage, incrementStats, readmeFilename, defaultRepoReadme,
   difficulty:writable, last_language:writable */

const BULK_SYNC_DELAY_MS = 3000; // pause between problems to stay below GitHub/LeetCode rate limits
const BULK_SYNC_README_FLUSH_EVERY = 10; // update the topics README once per N pushed problems
const BULK_SYNC_MAX_SUBMISSION_PAGES = 5; // look at most 5 * 20 submissions for an accepted one
const BULK_SYNC_PANEL_ID = 'leethub-bulk-sync-panel';
const DIFFICULTY_COLORS = { Easy: '#00b8a3', Medium: '#ffc01e', Hard: '#ff375f' };

const bulkSyncState = {
  running: false,
  stopRequested: false,
  problems: [], // { id, title, titleSlug, difficulty, problemName, synced, selected, status }
  panel: null,
};

const isLeetCodeCN = () => getLeetCodeBaseUrl() === 'https://leetcode.cn';
const bulkSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const toBase64 = text => btoa(unescape(encodeURIComponent(text)));

class BulkSyncStop extends Error {}

/* ------------------------------------------------------------------------------------------ */
/* LeetCode API                                                                                */
/* ------------------------------------------------------------------------------------------ */

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

async function leetCodeGraphQL(query, variables, operationName) {
  const res = await fetch(`${getLeetCodeBaseUrl()}/graphql/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-csrftoken': getCsrfToken() },
    body: JSON.stringify({ query, variables, operationName }),
  });
  if (res.status === 429) {
    throw new Error('LEETCODE_RATE_LIMIT');
  }
  if (!res.ok) {
    throw new Error(`LeetCode API error (${res.status})`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`LeetCode API error: ${json.errors[0].message}`);
  }
  return json.data;
}

/* Problem name exactly as the regular submit flow builds it, so already-pushed problems match. */
function buildProblemName(questionNumber, titleSlug) {
  return addLeadingZeros(`${questionNumber}-${titleSlug}`);
}

/* Returns every problem the logged-in user has solved, sorted by problem number. */
async function fetchSolvedProblems() {
  const res = await fetch(`${getLeetCodeBaseUrl()}/api/problems/all/`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Could not load your problem list from LeetCode (${res.status})`);
  }
  const data = await res.json();
  if (!data.user_name) {
    throw new Error('You are not logged in to LeetCode. Please log in and try again.');
  }

  const cn = isLeetCodeCN();
  return data.stat_status_pairs
    .filter(pair => pair.status === 'ac')
    .map(pair => {
      // leetcode.cn submission details only expose the internal question id, which the regular
      // submit flow uses for the folder name there; leetcode.com uses the frontend id.
      const questionNumber = cn ? pair.stat.question_id : pair.stat.frontend_question_id;
      return {
        id: String(pair.stat.frontend_question_id),
        title: pair.stat.question__title,
        titleSlug: pair.stat.question__title_slug,
        difficulty: ['Easy', 'Medium', 'Hard'][pair.difficulty.level - 1] ?? 'Unknown',
        problemName: buildProblemName(questionNumber, pair.stat.question__title_slug),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const isAccepted = submission =>
  submission.statusDisplay === 'Accepted' || submission.status === 10 || submission.status === 'AC';

/* Returns the most recent accepted submission ({ id, ... }) of a problem, or null. */
async function findLatestAcceptedSubmission(titleSlug) {
  const query = isLeetCodeCN()
    ? `query submissionList($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!) {
        submissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug) {
          lastKey
          hasNext
          submissions { id status statusDisplay lang timestamp }
        }
      }`
    : `query submissionList($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!) {
        questionSubmissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug) {
          lastKey
          hasNext
          submissions { id status statusDisplay lang timestamp }
        }
      }`;

  let lastKey = null;
  for (let page = 0; page < BULK_SYNC_MAX_SUBMISSION_PAGES; page++) {
    const data = await leetCodeGraphQL(
      query,
      { offset: page * 20, limit: 20, lastKey, questionSlug: titleSlug },
      'submissionList',
    );
    const list = data.submissionList ?? data.questionSubmissionList;
    const accepted = list?.submissions?.find(isAccepted);
    if (accepted) {
      return accepted;
    }
    if (!list?.hasNext) {
      return null;
    }
    lastKey = list.lastKey;
    await bulkSleep(500);
  }
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* GitHub upload                                                                               */
/* ------------------------------------------------------------------------------------------ */

/* MM-DD-YYYY-hh-mm-ss, same format as the regular flow, but for the submission's own time. */
function formatSubmissionTimestamp(unixSeconds) {
  const d = new Date(Number(unixSeconds) * 1000);
  const pad = n => String(n).padStart(2, '0');
  return (
    `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}-` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

const isSolutionFile = fileName => !/^(README|NOTES|Solution)\.md$/.test(fileName);

/* A problem counts as synced if any solution file of it has been pushed before. */
function hasSyncedSolution(stats, problemName) {
  return Object.keys(stats?.shas?.[problemName] ?? {}).some(isSolutionFile);
}

async function rememberExistingFile(problemName, fileName, settings) {
  const data = await getUpdatedData(
    settings.token,
    settings.hook,
    problemName,
    fileName,
    settings.useDifficultyFolder,
    settings.useLanguageFolder,
  );
  if (data?.sha) {
    const stats = (await chrome.storage.local.get('stats')).stats ?? {
      solved: 0,
      easy: 0,
      medium: 0,
      hard: 0,
    };
    stats.shas = stats.shas ?? {};
    stats.shas[problemName] = stats.shas[problemName] ?? {};
    stats.shas[problemName][fileName] = data.sha;
    await chrome.storage.local.set({ stats });
  }
}

/* Uploads a file. A file that already exists in the repo is recorded instead of overwritten. */
async function uploadIfMissing(content, problemName, fileName, commitMsg, settings) {
  try {
    await uploadGit(
      content,
      problemName,
      fileName,
      commitMsg,
      'upload',
      false,
      undefined,
      difficulty,
    );
    return 'pushed';
  } catch (err) {
    if (err.message === '422') {
      await rememberExistingFile(problemName, fileName, settings);
      return 'exists';
    }
    if (err.message === '403' || err.message === '429') {
      throw new BulkSyncStop(
        'GitHub rate limit reached. Wait a few minutes, then click "Sync selected" again - ' +
          'problems that were already pushed are skipped.',
      );
    }
    throw err;
  }
}

/* Adds several problems to the topics table of the repo README in a single commit. */
async function flushRepoReadme(entries, settings) {
  const withTopics = entries.filter(entry => entry.topicTags?.length);
  if (!withTopics.length) {
    return;
  }

  const savedDifficulty = difficulty;
  const savedLanguage = last_language;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getUpdatedData(
        settings.token,
        settings.hook,
        '',
        readmeFilename,
        false,
      );
      let readme = current?.content
        ? decodeURIComponent(escape(atob(current.content)))
        : defaultRepoReadme;

      for (const entry of withTopics) {
        // appendProblemToReadme builds the problem link from these globals
        difficulty = entry.difficulty;
        last_language = entry.language;
        for (const topic of entry.topicTags) {
          readme = await appendProblemToReadme(
            topic.name,
            readme,
            settings.hook,
            entry.problemName,
          );
        }
      }
      readme = sortTopicsInReadme(readme);

      try {
        await upload(
          settings.token,
          settings.hook,
          toBase64(readme),
          '',
          readmeFilename,
          current?.sha,
          `Add ${withTopics.length} problem(s) to topics - LeetHub bulk sync`,
          undefined,
          false,
        );
        return;
      } catch (err) {
        if (err.message !== '409' || attempt === 1) {
          throw err;
        }
      }
    }
  } finally {
    difficulty = savedDifficulty;
    last_language = savedLanguage;
  }
}

/*
 * Pushes the latest accepted submission of one problem.
 * Returns { status: 'pushed' | 'skipped' | 'dry-run', message, readmeEntry? }.
 */
async function syncProblem(problem, settings, dryRun) {
  const submission = await findLatestAcceptedSubmission(problem.titleSlug);
  if (!submission) {
    return { status: 'skipped', message: 'no accepted submission found' };
  }

  const details = await fetchSubmissionDetails(submission.id);
  if (!details?.code) {
    return { status: 'skipped', message: 'could not load submission code' };
  }
  const question = await fetchQuestionDetails(problem.titleSlug);

  const languageName = details.lang?.verboseName ?? details.langVerboseName;
  const extension = languages[languageName];
  if (!extension) {
    return { status: 'skipped', message: `unsupported language: ${languageName}` };
  }

  const questionNumber = details.question.questionFrontendId ?? details.question.questionId;
  const problemName = buildProblemName(questionNumber, problem.titleSlug);
  const questionDifficulty = question?.difficulty ?? problem.difficulty;
  const fileName = settings.useTimestampFilename
    ? `${problemName}-${formatSubmissionTimestamp(details.timestamp)}${extension}`
    : `${problemName}${extension}`;

  const { stats } = await chrome.storage.local.get('stats');
  if (stats?.shas?.[problemName]?.[fileName]) {
    return { status: 'skipped', message: 'already synced' };
  }
  if (dryRun) {
    return { status: 'dry-run', message: `would push ${fileName} (${languageName})` };
  }

  const wasSyncedBefore = hasSyncedSolution(stats, problemName);

  // Globals read by constructGitHubPath() / incrementStats() in leetcode.js
  difficulty = questionDifficulty;
  last_language = languageName;

  if (!stats?.shas?.[problemName]?.[readmeFilename]) {
    const cn = isLeetCodeCN();
    const title = (cn && question?.translatedTitle) || question?.title || problem.title;
    const content = (cn && question?.translatedContent) || question?.content || '';
    const url = `${getLeetCodeBaseUrl()}/problems/${problem.titleSlug}/`;
    const markdown = `<h2><a href="${url}">${questionNumber}. ${title}</a></h2><h3>${questionDifficulty}</h3><hr>${content}`;
    await uploadIfMissing(
      toBase64(markdown),
      problemName,
      readmeFilename,
      `Create readme : ${problemName}`,
      settings,
    );
  }

  const runtimePercentile = Math.round((details.runtimePercentile ?? 0) * 100) / 100;
  const memoryPercentile = Math.round((details.memoryPercentile ?? 0) * 100) / 100;
  const problemContext = {
    time: `${details.runtimeDisplay} (${runtimePercentile}%)`,
    space: `${details.memoryDisplay} (${memoryPercentile}%)`,
    language: extension,
    problemName,
    difficulty: questionDifficulty,
    date: formatSubmissionTimestamp(details.timestamp).slice(0, 10),
    problemTopic: question?.topicTags?.[0]?.name ?? 'UNKNOWN',
  };
  const defaultCommitMsg = `Time: ${problemContext.time}, Space: ${problemContext.space} - LeetHub`;
  const commitMsg = (await getCustomCommitMessage(problemContext)) || defaultCommitMsg;

  const result = await uploadIfMissing(
    toBase64(details.code),
    problemName,
    fileName,
    commitMsg,
    settings,
  );

  if (!wasSyncedBefore) {
    await incrementStats();
  }

  return {
    status: 'pushed',
    message: result === 'exists' ? `${fileName} already in repo` : `pushed ${fileName}`,
    readmeEntry: {
      problemName,
      difficulty: questionDifficulty,
      language: languageName,
      topicTags: question?.topicTags,
    },
  };
}

async function loadSyncSettings() {
  const settings = await chrome.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'mode_type',
    'useDifficultyFolder',
    'useLanguageFolder',
    'useTimestampFilename',
  ]);
  if (!settings.leethub_token) {
    throw new Error('LeetHub is not authorized with GitHub. Open the extension popup first.');
  }
  if (!settings.leethub_hook || settings.mode_type !== 'commit') {
    throw new Error('No GitHub repository linked. Open the extension popup to link one.');
  }
  return {
    token: settings.leethub_token,
    hook: settings.leethub_hook,
    useDifficultyFolder: settings.useDifficultyFolder || false,
    useLanguageFolder: settings.useLanguageFolder || false,
    useTimestampFilename: settings.useTimestampFilename || false,
  };
}

/* Retries a LeetCode call once after a pause if LeetCode rate limits us. */
async function withLeetCodeRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.message !== 'LEETCODE_RATE_LIMIT') {
      throw err;
    }
    setBulkStatus('LeetCode is rate limiting requests, waiting 30 seconds...');
    await bulkSleep(30000);
    try {
      return await fn();
    } catch (retryErr) {
      if (retryErr.message === 'LEETCODE_RATE_LIMIT') {
        throw new BulkSyncStop('LeetCode rate limit reached. Please try again later.');
      }
      throw retryErr;
    }
  }
}

async function runBulkSync() {
  if (bulkSyncState.running) {
    return;
  }
  const selected = selectedProblems();
  if (!selected.length) {
    setBulkStatus('Nothing selected.');
    return;
  }

  const dryRun = bulkSyncState.panel.querySelector('#leethub-bulk-dry-run').checked;
  let settings;
  try {
    settings = await loadSyncSettings();
  } catch (err) {
    setBulkStatus(err.message, true);
    return;
  }

  bulkSyncState.running = true;
  bulkSyncState.stopRequested = false;
  renderBulkControls();

  const counts = { pushed: 0, skipped: 0, failed: 0 };
  let pendingReadme = [];
  let stopMessage = null;

  try {
    for (let i = 0; i < selected.length; i++) {
      if (bulkSyncState.stopRequested) {
        stopMessage = 'Stopped.';
        break;
      }
      const problem = selected[i];
      setBulkProgress(i, selected.length);
      setBulkStatus(`(${i + 1}/${selected.length}) ${problem.id}. ${problem.title}...`);
      setProblemStatus(problem, 'syncing...');

      try {
        const result = await withLeetCodeRetry(() => syncProblem(problem, settings, dryRun));
        console.log(`LeetHub bulk sync: ${problem.problemName}: ${result.message}`);
        setProblemStatus(problem, result.message, result.status);
        if (result.status === 'dry-run') {
          counts.pushed++;
        } else if (result.status === 'pushed') {
          counts.pushed++;
          problem.synced = true;
          problem.selected = false;
          if (result.readmeEntry) {
            pendingReadme.push(result.readmeEntry);
          }
        } else {
          counts.skipped++;
          if (result.message === 'already synced') {
            problem.synced = true;
            problem.selected = false;
          }
        }
      } catch (err) {
        if (err instanceof BulkSyncStop) {
          setProblemStatus(problem, 'not synced', 'error');
          stopMessage = err.message;
          break;
        }
        console.error(`LeetHub bulk sync: ${problem.problemName} failed`, err);
        setProblemStatus(problem, `failed: ${err.message}`, 'error');
        counts.failed++;
      }

      if (pendingReadme.length >= BULK_SYNC_README_FLUSH_EVERY) {
        try {
          await flushRepoReadme(pendingReadme, settings);
          pendingReadme = [];
        } catch (err) {
          // keep the entries and try again with the next flush
          console.error('LeetHub bulk sync: could not update topics README', err);
        }
      }
      if (i < selected.length - 1) {
        await bulkSleep(BULK_SYNC_DELAY_MS);
      }
    }
  } finally {
    try {
      await flushRepoReadme(pendingReadme, settings);
    } catch (err) {
      console.error('LeetHub bulk sync: could not update topics README', err);
    }
    bulkSyncState.running = false;
    setBulkProgress(1, 1);
    renderBulkControls();
  }

  const verb = dryRun ? 'would push' : 'pushed';
  const summary = `${verb} ${counts.pushed}, skipped ${counts.skipped}, failed ${counts.failed}.`;
  setBulkStatus(
    stopMessage ? `${stopMessage} So far: ${summary}` : `Done: ${summary}`,
    !!stopMessage,
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Panel UI                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function el(tag, style = {}, props = {}) {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  Object.assign(node, props);
  return node;
}

const buttonStyle = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #555',
  background: '#3a3a3a',
  color: '#eee',
  cursor: 'pointer',
  fontSize: '13px',
};

function setBulkStatus(text, isError = false) {
  const status = bulkSyncState.panel?.querySelector('#leethub-bulk-status');
  if (status) {
    status.textContent = text;
    status.style.color = isError ? '#ff6b6b' : '#ccc';
  }
}

function setBulkProgress(done, total) {
  const bar = bulkSyncState.panel?.querySelector('#leethub-bulk-progress');
  if (bar) {
    bar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
  }
}

function setProblemStatus(problem, text, kind) {
  problem.status = text;
  const cell = problem.row?.querySelector('.leethub-bulk-row-status');
  if (cell) {
    cell.textContent = text;
    cell.style.color =
      kind === 'error' ? '#ff6b6b' : kind === 'pushed' || kind === 'dry-run' ? '#5cb85c' : '#999';
  }
  if (problem.row) {
    problem.row.querySelector('input').checked = problem.selected;
  }
}

function visibleProblems() {
  const panel = bulkSyncState.panel;
  const difficultyFilter = panel.querySelector('#leethub-bulk-difficulty').value;
  const hideSynced = panel.querySelector('#leethub-bulk-hide-synced').checked;
  return bulkSyncState.problems.filter(
    p => (!difficultyFilter || p.difficulty === difficultyFilter) && !(hideSynced && p.synced),
  );
}

/* Only problems that are selected AND visible with the current filters are synced. */
function selectedProblems() {
  return visibleProblems().filter(p => p.selected && !p.synced);
}

function renderBulkControls() {
  const panel = bulkSyncState.panel;
  if (!panel) {
    return;
  }
  const count = selectedProblems().length;
  const syncButton = panel.querySelector('#leethub-bulk-sync');
  syncButton.textContent = `Sync selected (${count})`;
  syncButton.disabled = bulkSyncState.running || count === 0;
  syncButton.style.opacity = syncButton.disabled ? '0.5' : '1';
  panel.querySelector('#leethub-bulk-stop').style.display = bulkSyncState.running ? '' : 'none';
  panel.querySelectorAll('input, select').forEach(input => {
    input.disabled = bulkSyncState.running;
  });

  const visible = visibleProblems().filter(p => !p.synced);
  const selectAll = panel.querySelector('#leethub-bulk-select-all');
  selectAll.checked = visible.length > 0 && visible.every(p => p.selected);
}

function renderBulkList() {
  const list = bulkSyncState.panel.querySelector('#leethub-bulk-list');
  list.replaceChildren();
  const visible = visibleProblems();
  if (!visible.length) {
    list.appendChild(
      el('div', { padding: '16px', color: '#999' }, { textContent: 'No problems.' }),
    );
  }
  for (const problem of visible) {
    const row = el('label', {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '5px 8px',
      borderBottom: '1px solid #333',
      cursor: problem.synced ? 'default' : 'pointer',
      opacity: problem.synced ? '0.6' : '1',
    });
    const checkbox = el('input', {}, { type: 'checkbox', checked: problem.selected });
    checkbox.disabled = problem.synced || bulkSyncState.running;
    checkbox.addEventListener('change', () => {
      problem.selected = checkbox.checked;
      renderBulkControls();
    });
    const title = el('span', { flex: '1' }, { textContent: `${problem.id}. ${problem.title}` });
    const diff = el(
      'span',
      { width: '60px', color: DIFFICULTY_COLORS[problem.difficulty] ?? '#ccc' },
      { textContent: problem.difficulty },
    );
    const status = el(
      'span',
      { width: '220px', textAlign: 'right', color: '#999', fontSize: '12px' },
      {
        className: 'leethub-bulk-row-status',
        textContent: problem.status || (problem.synced ? 'already synced' : ''),
      },
    );
    row.append(checkbox, title, diff, status);
    problem.row = row;
    list.appendChild(row);
  }
  renderBulkControls();
}

async function loadProblemList() {
  setBulkStatus('Loading your solved problems from LeetCode...');
  try {
    const [solved, { stats }] = await Promise.all([
      fetchSolvedProblems(),
      chrome.storage.local.get('stats'),
    ]);
    bulkSyncState.problems = solved.map(p => {
      const synced = hasSyncedSolution(stats, p.problemName);
      return { ...p, synced, selected: !synced, status: '' };
    });
    const syncedCount = bulkSyncState.problems.filter(p => p.synced).length;
    setBulkStatus(
      `${solved.length} solved problems found, ${syncedCount} already synced. ` +
        'Keep this tab open while syncing.',
    );
    renderBulkList();
  } catch (err) {
    setBulkStatus(err.message, true);
  }
}

function buildBulkSyncPanel() {
  const overlay = el('div', {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  overlay.id = BULK_SYNC_PANEL_ID;

  const box = el('div', {
    width: 'min(760px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '18px',
    borderRadius: '10px',
    background: '#262626',
    color: '#eee',
    fontSize: '14px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
  });

  const header = el('div', { display: 'flex', alignItems: 'center' });
  header.append(
    el(
      'div',
      { flex: '1', fontSize: '18px', fontWeight: '600' },
      {
        textContent: 'LeetHub - Sync past solutions',
      },
    ),
  );
  const close = el('button', { ...buttonStyle, padding: '2px 10px' }, { textContent: '×' });
  close.title = 'Close (a running sync continues in the background)';
  close.addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  header.append(close);

  const status = el('div', { color: '#ccc', minHeight: '20px' }, { id: 'leethub-bulk-status' });

  const controls = el('div', {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    fontSize: '13px',
  });
  const labelled = (input, text) => {
    const label = el('label', { display: 'flex', alignItems: 'center', gap: '6px' });
    label.append(input, document.createTextNode(text));
    return label;
  };
  const selectAll = el('input', {}, { type: 'checkbox', id: 'leethub-bulk-select-all' });
  selectAll.addEventListener('change', () => {
    visibleProblems()
      .filter(p => !p.synced)
      .forEach(p => {
        p.selected = selectAll.checked;
      });
    renderBulkList();
  });
  const difficultySelect = el(
    'select',
    { background: '#3a3a3a', color: '#eee', border: '1px solid #555', borderRadius: '4px' },
    { id: 'leethub-bulk-difficulty' },
  );
  for (const [value, text] of [
    ['', 'All difficulties'],
    ['Easy', 'Easy'],
    ['Medium', 'Medium'],
    ['Hard', 'Hard'],
  ]) {
    difficultySelect.append(el('option', {}, { value, textContent: text }));
  }
  difficultySelect.addEventListener('change', renderBulkList);
  const hideSynced = el('input', {}, { type: 'checkbox', id: 'leethub-bulk-hide-synced' });
  hideSynced.addEventListener('change', renderBulkList);
  const dryRun = el('input', {}, { type: 'checkbox', id: 'leethub-bulk-dry-run' });
  controls.append(
    labelled(selectAll, 'Select all'),
    difficultySelect,
    labelled(hideSynced, 'Hide already synced'),
    labelled(dryRun, "Dry run (don't push)"),
  );

  const list = el('div', {
    flex: '1',
    minHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #333',
    borderRadius: '6px',
  });
  list.id = 'leethub-bulk-list';

  const progressTrack = el('div', { height: '4px', background: '#333', borderRadius: '2px' });
  const progressBar = el('div', {
    height: '100%',
    width: '0%',
    background: '#ff6c0a',
    borderRadius: '2px',
    transition: 'width 0.3s',
  });
  progressBar.id = 'leethub-bulk-progress';
  progressTrack.append(progressBar);

  const footer = el('div', { display: 'flex', justifyContent: 'flex-end', gap: '10px' });
  const stop = el('button', { ...buttonStyle, display: 'none' }, { textContent: 'Stop' });
  stop.id = 'leethub-bulk-stop';
  stop.addEventListener('click', () => {
    bulkSyncState.stopRequested = true;
    setBulkStatus('Stopping after the current problem...');
  });
  const sync = el('button', {
    ...buttonStyle,
    background: '#ff6c0a',
    borderColor: '#ff6c0a',
    color: '#fff',
  });
  sync.id = 'leethub-bulk-sync';
  sync.addEventListener('click', runBulkSync);
  footer.append(stop, sync);

  box.append(header, status, controls, list, progressTrack, footer);
  overlay.append(box);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      overlay.style.display = 'none';
    }
  });
  return overlay;
}

function openBulkSyncPanel() {
  if (bulkSyncState.panel && document.body.contains(bulkSyncState.panel)) {
    bulkSyncState.panel.style.display = 'flex';
    if (!bulkSyncState.running) {
      loadProblemList();
    }
    return;
  }
  bulkSyncState.panel = buildBulkSyncPanel();
  document.body.appendChild(bulkSyncState.panel);
  renderBulkControls();
  loadProblemList();
}

/* Opened from the extension popup */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'leethubOpenBulkSync') {
    return;
  }
  if (!/(^|\.)leetcode\.(com|cn)$/.test(window.location.hostname)) {
    sendResponse({ ok: false, error: 'not-leetcode' });
    return;
  }
  openBulkSyncPanel();
  sendResponse({ ok: true });
});
