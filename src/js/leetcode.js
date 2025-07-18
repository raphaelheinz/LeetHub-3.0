
/* Enum for languages supported by LeetCode. */
const languages = {
  C: '.c',
  'C++': '.cpp',
  'C#': '.cs',
  Bash: '.sh',
  Dart: '.dart',
  Elixir: '.ex',
  Erlang: '.erl',
  Go: '.go',
  Java: '.java',
  JavaScript: '.js',
  Javascript: '.js',
  Kotlin: '.kt',
  MySQL: '.sql',
  'MS SQL Server': '.sql',
  Oracle: '.sql',
  PHP: '.php',
  Pandas: '.py',
  PostgreSQL: '.sql',
  Python: '.py',
  Python3: '.py',
  Racket: '.rkt',
  Ruby: '.rb',
  Rust: '.rs',
  Scala: '.scala',
  Swift: '.swift',
  TypeScript: '.ts',
};

/* Commit messages */
const readmeMsg = 'Create README - LeetHub';
const discussionMsg = 'Prepend discussion post - LeetHub';
const createNotesMsg = 'Attach NOTES - LeetHub';

// SubFolder
const basePath = 'LeetCode';

/* Difficulty of most recenty submitted question */
let difficulty = '';

/* state of upload for progress */
let uploadState = { uploading: false };

/* returns today's date in MM-DD-YYYY format */
function getTodaysDate() {
  const today = new Date();
  const month = today.getMonth() + 1; // fix months are zero-indexed
  const day = today.getDate();
  const year = today.getFullYear();

  const formattedMonth = month < 10 ? '0' + month : month;
  const formattedDay = day < 10 ? '0' + day : day;

  return `${formattedMonth}-${formattedDay}-${year}`;
}

/* returns time in hh-mm-ss format */
function getTime() {
  const today = new Date();
  const hours = today.getHours();
  const minutes = today.getMinutes();
  const seconds = today.getSeconds();

  const formattedHours = hours < 10 ? '0' + hours : hours;
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

  return `${formattedHours}-${formattedMinutes}-${formattedSeconds}`;
}
/* returns the corresponding language from language extension */
function getLanguageFromExtension(extension) {
  if (extension === null || extension === undefined) {
    return null;
  }
  const language = Object.keys(languages).find(key => languages[key] === extension);
  console.log(language);
  return language || null;
}

/**
 * Constructs the full GitHub API URL to upload a file to a specific path in the repository.
 *
 * @param {string} hook - GitHub repository path in the format "username/repo".
 * @param {string} basePath - Base folder path where the file will be uploaded (e.g., "algorithm/LeetCode").
 * @param {string} difficulty - Problem difficulty (e.g., "Easy", "Medium", "Hard").
 * @param {string} problem - Problem slug or directory name (e.g., "0001-two-sum").
 * @param {string} filename - Name of the file to upload (e.g., "0001-two-sum.js").
 * @param {boolean} [useDifficultyFolder=true] - Whether to include the difficulty as a subfolder.
 * @returns {string} Full GitHub API URL for the file upload.
 */

function constructGitHubPath(hook, basePath, difficulty, problem, filename, useDifficultyFolder, useLanguageFolder = false) {
  if (useLanguageFolder) {
    //split the filename to get the extension
    const fileExtension = filename.split('.').pop();
    //get the language from the extension
    const language = getLanguageFromExtension(`.${fileExtension}`);
    console.log('Language:', language);
    if (language) {
        const path = useDifficultyFolder
          ? `${basePath}/${language}/${difficulty}/${problem}/${filename}`
          : `/${language}/${problem}/${filename}`;
        return `https://api.github.com/repos/${hook}/contents/${path}`;
    }
  }
  const path = useDifficultyFolder
    ? `${basePath}/${difficulty}/${problem}/${filename}`
    : `${problem}/${filename}`;
  return `https://api.github.com/repos/${hook}/contents/${path}`;
}

const parseCustomCommitMessage = (text, problemContext) => {
  return text.replace(/{(\w+)}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(problemContext, key) ? problemContext[key] : match;
  });
};

/* returns custom commit message or null if doesn't exist */
const getCustomCommitMessage = problemContext => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('custom_commit_message', result => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (!result.custom_commit_message || !result.custom_commit_message.trim()) {
        resolve(null); // no custom message is set
      } else {
        const finalCommitMessage = parseCustomCommitMessage(
          result.custom_commit_message,
          problemContext,
        );
        resolve(finalCommitMessage);
      }
    });
  });
};

/* Main function for uploading code to GitHub repo, and callback cb is called if success */
const upload = (
  token,
  hook,
  code,
  problem,
  filename,
  sha,
  commitMsg,
  cb = undefined,
  useDifficultyFolder,
  useLanguageFolder
) => {
  // const URL = `https://api.github.com/repos/${hook}/contents/${problem}/${filename}`;
  const URL = constructGitHubPath(
    hook,
    basePath,
    difficulty,
    problem,
    filename,
    useDifficultyFolder,
    useLanguageFolder
  );

  /* Define Payload */
  let data = {
    message: commitMsg,
    content: code,
    sha,
  };

  data = JSON.stringify(data);

  let options = {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: data,
  };
  let updatedSha;

  return fetch(URL, options)
    .then(res => {
      if (res.status === 200 || res.status === 201) {
        return res.json();
      } else if (res.status === 409) {
        throw new Error('409');
      }
    })
    .then(async body => {
      updatedSha = body.content.sha; // get updated SHA.
      const stats = await getAndInitializeStats(problem);
      stats.shas[problem][filename] = updatedSha;
      return chrome.storage.local.set({ stats });
    })
    .then(() => {
      console.log(`Successfully committed ${filename.split('.').pop()} to github`);
      if (cb != undefined) {
        cb();
      }
    });
};

const getAndInitializeStats = problem => {
  return chrome.storage.local.get('stats').then(({ stats }) => {
    if (stats == null || stats == {}) {
      // create stats object
      stats = {};
      stats.solved = 0;
      stats.easy = 0;
      stats.medium = 0;
      stats.hard = 0;
      stats.shas = {};
    }

    if (stats.shas[problem] == null) {
      stats.shas[problem] = {};
    }

    return stats;
  });
};

const incrementStats = () => {
  return chrome.storage.local.get('stats').then(({ stats }) => {
    stats.solved += 1;
    stats.easy += difficulty === 'Easy' ? 1 : 0;
    stats.medium += difficulty === 'Medium' ? 1 : 0;
    stats.hard += difficulty === 'Hard' ? 1 : 0;
    return chrome.storage.local.set({ stats });
  });
};

const checkAlreadyCompleted = async problemName => {
  const { stats } = await chrome.storage.local.get('stats');
  return stats?.shas?.[problemName] ?? false;
};

/* Main function for updating code on GitHub Repo */
/* Read from existing file on GitHub */
/* Discussion posts prepended at top of README */
/* Future implementations may require appending to bottom of file */
const update = (
  token,
  hook,
  addition,
  problem,
  filename,
  commitMsg,
  shouldPreprendDiscussionPosts,
  cb = undefined,
  useDifficultyFolder,
  useLanguageFolder
) => {
  let responseSHA;
  return getUpdatedData(token, hook, problem, filename, useDifficultyFolder, useLanguageFolder)
    .then(data => {
      responseSHA = data.sha;
      return decodeURIComponent(escape(atob(data.content)));
    })
    .then(existingContent =>
      shouldPreprendDiscussionPosts
        ? // https://web.archive.org/web/20190623091645/https://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
          // In order to preserve mutation of the data, we have to encode it, which is usually done in base64.
          // But btoa only accepts ASCII 7 bit chars (0-127) while Javascript uses 16-bit minimum chars (0-65535).
          // EncodeURIComponent converts the Unicode Points UTF-8 bits to hex UTF-8.
          // Unescape converts percent-encoded hex values into regular ASCII (optional; it shrinks string size).
          // btoa converts ASCII to base64.
          btoa(unescape(encodeURIComponent(addition + existingContent)))
        : btoa(unescape(encodeURIComponent(existingContent))),
    )
    .then(newContent =>
      upload(
        token,
        hook,
        newContent,
        problem,
        filename,
        responseSHA,
        commitMsg,
        cb,
        useDifficultyFolder,
        useLanguageFolder,
      ),
    );
};

function uploadGit(
  code,
  problemName,
  fileName,
  commitMsg,
  action,
  shouldPrependDiscussionPosts = false,
  cb = undefined,
  _diff = undefined,
) {
  // Assign difficulty
  if (_diff && _diff !== undefined) {
    difficulty = _diff.trim();
  }

  let token;
  let hook;
  let useDifficultyFolder = false;
  let useLanguageFolder = false;

  return chrome.storage.local
    .get('leethub_token')
    .then(({ leethub_token }) => {
      token = leethub_token;
      if (leethub_token == undefined) {
        throw new Error('leethub token is undefined');
      }
      return chrome.storage.local.get('mode_type');
    })
    .then(({ mode_type }) => {
      if (mode_type !== 'commit') {
        throw new Error('leethub mode is not commit');
      }
      return chrome.storage.local.get('leethub_hook');
    })
    .then(({ leethub_hook }) => {
      hook = leethub_hook;
      if (!hook) {
        throw new Error('leethub hook not defined');
      }
      return chrome.storage.local.get('useDifficultyFolder');
    })
    .then(result => {
      useDifficultyFolder = result.useDifficultyFolder || false;
      return chrome.storage.local.get('useLanguageFolder');
    })
    .then(result => {
      useLanguageFolder = result.useLanguageFolder || false;
      return chrome.storage.local.get('stats');
    })
    .then(({ stats }) => {
      if (action === 'upload') {
        /* Get SHA, if it exists */
        const sha = stats?.shas?.[problemName]?.[fileName] ?? '';
    
        return upload(
          token,
          hook,
          code,
          problemName,
          fileName,
          sha,
          commitMsg,
          cb,
          useDifficultyFolder,
          useLanguageFolder
        );
      } else if (action === 'update') {
        return update(
          token,
          hook,
          code,
          problemName,
          fileName,
          commitMsg,
          shouldPrependDiscussionPosts,
          cb,
          useDifficultyFolder,
          useLanguageFolder,
        );
      }
    })
    .catch(err => {
      if (err.message === '409') {
        return getUpdatedData(token, hook, problemName, fileName, useDifficultyFolder, useLanguageFolder);
      } else {
        throw err;
      }
    })
    .then(data =>
      data != null
        ? upload(
            token,
            hook,
            code,
            problemName,
            fileName,
            data.sha,
            commitMsg,
            cb,
            useDifficultyFolder,
            useLanguageFolder,
          )
        : undefined,
    );
}

/* Gets updated GitHub data for the specific file in repo in question */
async function getUpdatedData(token, hook, problem, filename, useDifficultyFolder,useLanguageFolder) {
  const URL = constructGitHubPath(
    hook,
    basePath,
    difficulty,
    problem,
    filename,
    useDifficultyFolder,
    useLanguageFolder
  );

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  return fetch(URL, options).then(res => {
    if (res.status === 200 || res.status === 201) {
      return res.json();
    } else {
      throw new Error('' + res.status);
    }
  });
}

/* Checks if an elem/array exists and has length */
function checkElem(elem) {
  return elem && elem.length > 0;
}

function convertToSlug(string) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
  const p = new RegExp(a.split('').join('|'), 'g');

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w-]+/g, '') // Remove all non-word characters
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

function addLeadingZeros(title) {
  const maxTitlePrefixLength = 4;
  var len = title.split('-')[0].length;
  if (len < maxTitlePrefixLength) {
    return '0'.repeat(4 - len) + title;
  }
  return title;
}

function formatStats(time, timePercentile, space, spacePercentile) {
  return `Time: ${time} (${timePercentile}%), Space: ${space} (${spacePercentile}%) - LeetHub`;
}

function getGitIcon() {
  // Create an SVG element
  var gitSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gitSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  gitSvg.setAttribute('width', '24');
  gitSvg.setAttribute('height', '24');
  gitSvg.setAttribute('viewBox', '0 0 114.8625 114.8625');

  // Create a path element inside the SVG
  var gitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  gitPath.setAttribute('fill', '#100f0d');
  gitPath.setAttribute(
    'd',
    'm112.693375 52.3185-50.149-50.146875c-2.886625-2.88875-7.57075-2.88875-10.461375 0l-10.412625 10.4145 13.2095 13.2095C57.94975 24.759 61.47025 25.45475 63.9165 27.9015c2.461 2.462 3.150875 6.01275 2.087375 9.09375l12.732 12.7305c3.081-1.062 6.63325-.3755 9.09425 2.088875 3.4375 3.4365 3.4375 9.007375 0 12.44675-3.44 3.4395-9.00975 3.4395-12.45125 0-2.585375-2.587875-3.225125-6.387125-1.914-9.57275l-11.875-11.874V74.06075c.837375.415 1.628375.96775 2.326625 1.664 3.4375 3.437125 3.4375 9.007375 0 12.44975-3.4375 3.436-9.01125 3.436-12.44625 0-3.4375-3.442375-3.4375-9.012625 0-12.44975.849625-.848625 1.8335-1.490625 2.88325-1.920375V42.26925c-1.04975-.42975-2.03125-1.066375-2.88325-1.920875-2.6035-2.602625-3.23-6.424375-1.894625-9.622125L36.55325 17.701875 2.1660125 52.086125c-2.88818 2.891125-2.88818 7.57525 0 10.463875l50.1513625 50.146975c2.88725 2.88818125 7.569875 2.88818125 10.461375 0l49.914625-49.9146c2.889625-2.889125 2.889625-7.575625 0-10.463875',
  );

  gitSvg.appendChild(gitPath);
  return gitSvg;
}

function getToolTip() {
  var toolTip = document.createElement('div');
  toolTip.id = 'toolTip';
  toolTip.className = 'hidden';

  chrome.storage.local.get('dontShowToolTip').then(({ dontShowToolTip }) => {
    if (dontShowToolTip) {
      return toolTip;
    } else {
      toolTip.textContent =
        'You may select from earlier submissions to push. \r\n\r\n You may maintain multiple versions by adding a suffix with a right-click.';
      toolTip.className =
        'fixed bg-sd-popover text-sd-popover-foreground rounded-sd-md z-modal text-xs text-left font-normal whitespace-pre-line shadow w-48 p-2 border-sd-border border cursor-default translate-y-20 transition-opacity opacity-0 duration-300 group-hover:opacity-100';
      toolTip.appendChild(getDontShowContainer());
      toolTip.addEventListener('click', event => event.stopPropagation());
    }
  });
  return toolTip;
}

function getDontShowContainer() {
  var dontShowContainer = document.createElement('div');
  dontShowContainer.className = 'flex item-center justify-center gap-1 mt-2';

  var lable = document.createElement('label');
  lable.htmlFor = 'dontShowCheckBox';
  lable.textContent = 'dont show it again';

  var checkBox = document.createElement('input');
  checkBox.type = 'checkbox';
  checkBox.id = 'dontShowCheckBox';
  checkBox.addEventListener('click', function (event) {
    event.stopPropagation();
    if (this.checked) {
      chrome.storage.local.set({ dontShowToolTip: true });
      document.getElementById('toolTip').className = document
        .getElementById('toolTip')
        .className.replace('group-hover:opacity-100', '');
    }
  });

  dontShowContainer.appendChild(checkBox);
  dontShowContainer.appendChild(lable);
  return dontShowContainer;
}

/* Discussion Link - When a user makes a new post, the link is prepended to the README for that problem.*/
document.addEventListener('click', event => {
  const element = event.target;
  const oldPath = window.location.pathname;

  /* Act on Post button click */
  /* Complex since "New" button shares many of the same properties as "Post button */
  if (
    element.classList.contains('icon__3Su4') ||
    (element.parentElement != null &&
      (element.parentElement.classList.contains('icon__3Su4') ||
        element.parentElement.classList.contains('btn-content-container__214G') ||
        element.parentElement.classList.contains('header-right__2UzF')))
  ) {
    setTimeout(function () {
      /* Only post if post button was clicked and url changed */
      if (
        oldPath !== window.location.pathname &&
        oldPath === window.location.pathname.substring(0, oldPath.length) &&
        !Number.isNaN(window.location.pathname.charAt(oldPath.length))
      ) {
        const date = new Date();
        const currentDate = `${date.getDate()}/${date.getMonth()}/${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}`;
        const addition = `[Discussion Post (created on ${currentDate})](${window.location})  \n`;
        const problemName = window.location.pathname.split('/')[2]; // must be true.

        uploadGit(addition, problemName, 'README.md', discussionMsg, 'update', true);
      }
    }, 1000);
  }
});

function LeetCodeV1() {
  this.progressSpinnerElementId = 'leethub_progress_elem';
  this.progressSpinnerElementClass = 'leethub_progress';
  this.injectSpinnerStyle();
}
LeetCodeV1.prototype.init = async function () {};
/* Function for finding and parsing the full code. */
/* - At first find the submission details url. */
/* - Then send a request for the details page. */
/* - Parse the code from the html reponse. */
/* - Parse the stats from the html response (explore section) */
LeetCodeV1.prototype.findAndUploadCode = function (
  problemName,
  fileName,
  commitMsg,
  action,
  cb = undefined,
) {
  /* Get the submission details url from the submission page. */
  let submissionURL;
  const e = document.getElementsByClassName('status-column__3SUg');
  if (checkElem(e)) {
    // for normal problem submisson
    const submissionRef = e[1].innerHTML.split(' ')[1];
    submissionURL = 'https://leetcode.com' + submissionRef.split('=')[1].slice(1, -1);
  } else {
    // for a submission in explore section
    const submissionRef = document.getElementById('result-state');
    submissionURL = submissionRef.href;
  }

  if (submissionURL == undefined) {
    return;
  }
  /* Request for the submission details page */
  return fetch(submissionURL)
    .then(res => {
      if (res.status == 200) {
        return res.text();
      } else {
        throw new Error('' + res.status);
      }
    })
    .then(responseText => {
      const doc = new DOMParser().parseFromString(responseText, 'text/html');
      /* the response has a js object called pageData. */
      /* Pagedata has the details data with code about that submission */
      const scripts = doc.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const text = scripts[i].innerText;
        if (text.includes('pageData')) {
          /* Extract the full code */
          const firstIndex = text.indexOf('submissionCode');
          const lastIndex = text.indexOf('editCodeUrl');
          let slicedText = text.slice(firstIndex, lastIndex);
          /* slicedText has form "submissionCode: 'Details code'" */
          /* Find the index of first and last single inverted coma. */
          const firstInverted = slicedText.indexOf("'");
          const lastInverted = slicedText.lastIndexOf("'");
          /* Extract only the code */
          const codeUnicoded = slicedText.slice(firstInverted + 1, lastInverted);
          /* The code has some unicode. Replacing all unicode with actual characters */
          const code = codeUnicoded.replace(/\\u[\dA-F]{4}/gi, function (match) {
            return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
          });

          /* For a submission in explore section we do not get probStat beforehand.
            So, parse statistics from submisson page */
          if (!commitMsg) {
            slicedText = text.slice(text.indexOf('runtime'), text.indexOf('memory'));
            const resultRuntime = slicedText.slice(
              slicedText.indexOf("'") + 1,
              slicedText.lastIndexOf("'"),
            );
            slicedText = text.slice(text.indexOf('memory'), text.indexOf('total_correct'));
            const resultMemory = slicedText.slice(
              slicedText.indexOf("'") + 1,
              slicedText.lastIndexOf("'"),
            );
            commitMsg = `Time: ${resultRuntime}, Memory: ${resultMemory} - LeetHub`;
          }
          if (code != null) {
            return uploadGit(
              btoa(unescape(encodeURIComponent(code))),
              problemName,
              fileName,
              commitMsg,
              action,
              false,
              cb,
            );
          }
        }
      }
    });
};
// Returns the language extension
LeetCodeV1.prototype.getLanguageExtension = function () {
  const tag = [
    ...document.getElementsByClassName('ant-select-selection-selected-value'),
    ...document.getElementsByClassName('Select-value-label'),
  ];
  if (tag && tag.length > 0) {
    for (let i = 0; i < tag.length; i += 1) {
      const elem = tag[i].textContent;
      if (elem !== undefined && languages[elem] !== undefined) {
        return languages[elem];
      }
    }
  }
  return null;
};
/* function to get the notes if there is any
 the note should be opened atleast once for this to work
 this is because the dom is populated after data is fetched by opening the note */
LeetCodeV1.prototype.getNotesIfAny = function () {
  // there are no notes on expore
  if (document.URL.startsWith('https://leetcode.com/explore/')) return '';

  let notes = '';
  if (
    checkElem(document.getElementsByClassName('notewrap__eHkN')) &&
    checkElem(
      document
        .getElementsByClassName('notewrap__eHkN')[0]
        .getElementsByClassName('CodeMirror-code'),
    )
  ) {
    const notesdiv = document
      .getElementsByClassName('notewrap__eHkN')[0]
      .getElementsByClassName('CodeMirror-code')[0];
    if (notesdiv) {
      for (let i = 0; i < notesdiv.childNodes.length; i++) {
        if (notesdiv.childNodes[i].childNodes.length == 0) continue;
        const text = notesdiv.childNodes[i].childNodes[0].innerText;
        if (text) {
          notes = `${notes}\n${text.trim()}`.trim();
        }
      }
    }
  }
  return notes.trim();
};
// Returns a slugged num+title variation e.g. 0001-two-sum
LeetCodeV1.prototype.getProblemNameSlug = function () {
  const questionElem = document.getElementsByClassName('content__u3I1 question-content__JfgR');
  const questionDescriptionElem = document.getElementsByClassName('question-description__3U1T');
  let questionTitle = 'unknown-problem';
  if (checkElem(questionElem)) {
    let qtitle = document.getElementsByClassName('css-v3d350');
    if (checkElem(qtitle)) {
      questionTitle = qtitle[0].innerHTML;
    }
  } else if (checkElem(questionDescriptionElem)) {
    let qtitle = document.getElementsByClassName('question-title');
    if (checkElem(qtitle)) {
      questionTitle = qtitle[0].innerText;
    }
  }
  return addLeadingZeros(convertToSlug(questionTitle));
};
/* Gets the success state of the solution and updates html elements with new classes */
LeetCodeV1.prototype.getSuccessStateAndUpdate = function () {
  const successTag = document.getElementsByClassName('success__3Ai7');
  const resultState = document.getElementById('result-state');

  // check success state for a normal problem
  if (
    checkElem(successTag) &&
    successTag[0].className === 'success__3Ai7' &&
    successTag[0].innerText.trim() === 'Success'
  ) {
    console.log(successTag[0]);
    successTag[0].classList.add('marked_as_success');
    return true;
  }
  // check success state for a explore section problem
  else if (
    resultState &&
    resultState.className === 'text-success' &&
    resultState.innerText === 'Accepted'
  ) {
    resultState.classList.add('marked_as_success');
    return true;
  }

  return false;
};
/* Parser function for time/space stats */
LeetCodeV1.prototype.parseStats = function () {
  const probStats = document.getElementsByClassName('data__HC-i');
  if (!checkElem(probStats)) {
    return null;
  }
  const time = probStats[0].textContent;
  const timePercentile = probStats[1].textContent;
  const space = probStats[2].textContent;
  const spacePercentile = probStats[3].textContent;

  return `Time: ${time} (${timePercentile}), Space: ${space} (${spacePercentile}) - LeetHub`;
};
/* Parser function for the question, question title, question difficulty, and tags */
LeetCodeV1.prototype.parseQuestion = function () {
  let questionUrl = window.location.href;
  if (questionUrl.endsWith('/submissions/')) {
    questionUrl = questionUrl.substring(0, questionUrl.lastIndexOf('/submissions/') + 1);
  }
  const questionElem = document.getElementsByClassName('content__u3I1 question-content__JfgR');
  const questionDescriptionElem = document.getElementsByClassName('question-description__3U1T');
  if (checkElem(questionElem)) {
    const qbody = questionElem[0].innerHTML;

    // Problem title.
    let qtitle = document.getElementsByClassName('css-v3d350');
    if (checkElem(qtitle)) {
      qtitle = qtitle[0].innerHTML;
    } else {
      qtitle = 'unknown-problem';
    }

    // Problem difficulty, each problem difficulty has its own class.
    const isHard = document.getElementsByClassName('css-t42afm');
    const isMedium = document.getElementsByClassName('css-dcmtd5');
    const isEasy = document.getElementsByClassName('css-14oi08n');

    if (checkElem(isEasy)) {
      difficulty = 'Easy';
    } else if (checkElem(isMedium)) {
      difficulty = 'Medium';
    } else if (checkElem(isHard)) {
      difficulty = 'Hard';
    }
    // Final formatting of the contents of the README for each problem
    const markdown = `<h2><a href="${questionUrl}">${qtitle}</a></h2><h3>${difficulty}</h3><hr>${qbody}`;
    return markdown;
  } else if (checkElem(questionDescriptionElem)) {
    let questionTitle = document.getElementsByClassName('question-title');
    if (checkElem(questionTitle)) {
      questionTitle = questionTitle[0].innerText;
    } else {
      questionTitle = 'unknown-problem';
    }

    const questionBody = questionDescriptionElem[0].innerHTML;
    const markdown = `<h2>${questionTitle}</h2><hr>${questionBody}`;

    return markdown;
  }
};
/* Injects a spinner on left side to the "Run Code" button */
LeetCodeV1.prototype.startSpinner = function () {
  try {
    let elem = document.getElementById('leethub_progress_anchor_element');
    if (!elem) {
      elem = document.createElement('span');
      elem.id = 'leethub_progress_anchor_element';
      elem.style = 'margin-right: 20px;padding-top: 2px;';
    }
    elem.innerHTML = `<div id="${this.progressSpinnerElementId}" class="${this.progressSpinnerElementClass}"></div>`;
    this.insertToAnchorElement(elem);
    uploadState.uploading = true;
  } catch (error) {
    console.log(error);
  }
};
/* Injects css style required for the upload progress indicator */
LeetCodeV1.prototype.injectSpinnerStyle = function () {
  const style = document.createElement('style');
  style.textContent = `.${this.progressSpinnerElementClass} {pointer-events: none;width: 2.0em;height: 2.0em;border: 0.4em solid transparent;border-color: #eee;border-top-color: #3E67EC;border-radius: 50%;animation: loadingspin 1s linear infinite;} @keyframes loadingspin { 100% { transform: rotate(360deg) }}`;
  document.head.append(style);
};
/* Inserts an anchor element that is specific to the page you are on (e.g. Explore) */
LeetCodeV1.prototype.insertToAnchorElement = function (elem) {
  if (document.URL.startsWith('https://leetcode.com/explore/')) {
    const action = document.getElementsByClassName('action');
    if (
      checkElem(action) &&
      checkElem(action[0].getElementsByClassName('row')) &&
      checkElem(action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')) &&
      action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6').length > 1
    ) {
      const target = action[0]
        .getElementsByClassName('row')[0]
        .getElementsByClassName('col-sm-6')[1];
      elem.className = 'pull-left';
      if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
    }
  } else {
    if (checkElem(document.getElementsByClassName('action__38Xc'))) {
      const target = document.getElementsByClassName('action__38Xc')[0];
      elem.className = 'runcode-wrapper__8rXm';
      if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
    }
  }
};
/* Creates a ✔️ tick mark before "Run Code" button signaling LeetHub has done its job */
LeetCodeV1.prototype.markUploaded = function () {
  const elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    elem.style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid #78b13f;border-right:7px solid #78b13f;';
  }
};
/* Creates a ❌ failed tick mark before "Run Code" button signaling that upload failed */
LeetCodeV1.prototype.markUploadFailed = function () {
  const elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    elem.style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid red;border-right:7px solid red;';
  }
};

function LeetCodeV2() {
  this.submissionData;
  this.progressSpinnerElementId = 'leethub_progress_elem';
  this.progressSpinnerElementClass = 'leethub_progress';
  this.injectSpinnerStyle();
}
LeetCodeV2.prototype.init = async function () {
  const problem = document.URL.match(/leetcode.com\/problems\/([^/]*)\//);
  const val = await chrome.storage.local.get(problem[1]);
  if (!val) {
    alert('Have you submitted this problem yet?');
    return false;
  }
  const submissionId = val[problem[1]];

  // Query for getting the solution runtime and memory stats, the code, the coding language, the question id, question title and question difficulty
  const submissionDetailsQuery = {
    query:
      '\n    query submissionDetails($submissionId: Int!) {\n  submissionDetails(submissionId: $submissionId) {\n    runtime\n    runtimeDisplay\n    runtimePercentile\n    runtimeDistribution\n    memory\n    memoryDisplay\n    memoryPercentile\n    memoryDistribution\n    code\n    timestamp\n    statusCode\n    lang {\n      name\n      verboseName\n    }\n    question {\n      questionId\n    questionFrontendId\n    title\n    titleSlug\n    content\n    difficulty\n    }\n    notes\n    topicTags {\n      tagId\n      slug\n      name\n    }\n    runtimeError\n  }\n}\n    ',
    variables: { submissionId: submissionId },
    operationName: 'submissionDetails',
  };
  const submissionDetailsOptions = {
    method: 'POST',
    headers: {
      cookie: document.cookie, // required to authorize the API request
      'content-type': 'application/json',
    },
    body: JSON.stringify(submissionDetailsQuery),
  };
  const submissionDetailsData = await fetch('https://leetcode.com/graphql/', submissionDetailsOptions)
    .then(res => res.json())
    .then(res => res.data.submissionDetails);

  this.submissionData = submissionDetailsData;

  const questionDetailsQuery = {
    query:
      '\n    query questionDetail($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    title\n    titleSlug\n    questionId\n    questionFrontendId\n    questionTitle\n    translatedTitle\n    content\n    translatedContent\n    categoryTitle\n    difficulty\n    stats\n    topicTags {\n      name\n      slug\n      translatedName\n    }\n  }\n}\n',
    variables: { titleSlug: this.submissionData.question.titleSlug },
    operationName: 'questionDetail',
  };
  const questionDetailsOptions = {
    method: 'POST',
    headers: {
      cookie: document.cookie,
      'content-type': 'application/json',
    },
    body: JSON.stringify(questionDetailsQuery),
  };
  const questionDetailsData = await fetch('https://leetcode.com/graphql/', questionDetailsOptions)
    .then(res => res.json())
    .then(res => res.data.question);
  this.questionDetails = questionDetailsData;
};
LeetCodeV2.prototype.findAndUploadCode = function (
  problemName,
  fileName,
  commitMsg,
  action,
  cb = undefined,
) {
  const code = this.getCode();
  if (!code) {
    throw new Error('No solution code found');
  }

  return uploadGit(
    btoa(unescape(encodeURIComponent(code))),
    problemName,
    fileName,
    commitMsg,
    action,
    false,
    cb,
  );
};
LeetCodeV2.prototype.getCode = function () {
  if (this.submissionData != null) {
    return this.submissionData.code;
  }

  const code = document.getElementsByTagName('code');
  if (!checkElem(code)) {
    return null;
  }

  return code[0].innerText;
};
LeetCodeV2.prototype.getLanguageExtension = function () {
  if (this.submissionData != null) {
    return languages[this.submissionData.lang.verboseName];
  }

  const tag = document.querySelector('button[id^="headlessui-listbox-button"]');
  if (!tag) {
    throw new Error('No language button found');
  }

  const lang = tag.innerText;
  if (languages[lang] === undefined) {
    throw new Error('Unknown Language: ' + { lang });
  }

  return languages[lang];
};

LeetCodeV2.prototype.getNotesIfAny = function () {};

LeetCodeV2.prototype.extractQuestionNumber = function () {
  return this.submissionData.question.questionFrontendId;
};

/**
 * Gets a formatted problem name slug from the LeetCodeV2 instance.
 * @returns {string} A string combining the problem number and the slug title.
 */
LeetCodeV2.prototype.getProblemNameSlug = function () {
  const slugTitle = this.submissionData.question.titleSlug;
  const qNum = this.extractQuestionNumber();
  return addLeadingZeros(qNum + '-' + slugTitle);
};

LeetCodeV2.prototype.getSuccessStateAndUpdate = function () {
  const successTag = document.querySelectorAll('[data-e2e-locator="submission-result"]');
  if (checkElem(successTag)) {
    console.log(successTag[0]);
    successTag[0].classList.add('marked_as_success');
    return true;
  }
  return false;
};
LeetCodeV2.prototype.parseStats = function () {
  if (this.submissionData != null) {
    const runtimePercentile =
      Math.round((this.submissionData.runtimePercentile + Number.EPSILON) * 100) / 100;
    const spacePercentile =
      Math.round((this.submissionData.memoryPercentile + Number.EPSILON) * 100) / 100;
    return {
      time: this.submissionData.runtimeDisplay,
      timePercentile: runtimePercentile,
      space: this.submissionData.memoryDisplay,
      spacePercentile: spacePercentile,
      problemTopic: this.questionDetails?.topicTags?.[0]?.name ?? 'UNKNOWN'
    };
  }

  // Doesn't work unless we wait for page to finish loading.
  setTimeout(() => {}, 1000);
  const probStats = document.getElementsByClassName('flex w-full pb-4')[0].innerText.split('\n');
  if (!checkElem(probStats)) {
    return null;
  }

  const time = probStats[1];
  const timePercentile = probStats[3];
  const space = probStats[5];
  const spacePercentile = probStats[7];

  return formatStats(time, timePercentile, space, spacePercentile);
};
LeetCodeV2.prototype.parseQuestion = function () {
  let markdown;
  if (this.submissionData != null) {
    const questionUrl = window.location.href.split('/submissions')[0];
    const qTitle = `${this.extractQuestionNumber()}. ${this.submissionData.question.title}`;
    const qBody = this.parseQuestionDescription();

    difficulty = this.submissionData.question.difficulty;

    // Final formatting of the contents of the README for each problem
    markdown = `<h2><a href="${questionUrl}">${qTitle}</a></h2><h3>${difficulty}</h3><hr>${qBody}`;
  } else {
    // TODO: get the README markdown via scraping. Right now this isn't possible.
    markdown = null;
  }

  return markdown;
};
LeetCodeV2.prototype.parseQuestionTitle = function () {
  if (this.submissionData != null) {
    return this.submissionData.question.title;
  }

  let questionTitle = document
    .getElementsByTagName('title')[0]
    .innerText.split(' ')
    .slice(0, -2)
    .join(' ');

  if (questionTitle === '') {
    questionTitle = 'unknown-problem';
  }

  return questionTitle;
};
LeetCodeV2.prototype.parseQuestionDescription = function () {
  if (this.submissionData != null) {
    return this.submissionData.question.content;
  }

  const description = document.getElementsByName('description');
  if (!checkElem(description)) {
    return null;
  }
  return description[0].content;
};
LeetCodeV2.prototype.parseDifficulty = function () {
  if (this.submissionData != null) {
    return this.submissionData.question.difficulty;
  }

  const diffElement = document.getElementsByClassName('mt-3 flex space-x-4');
  if (checkElem(diffElement)) {
    return diffElement[0].children[0].innerText;
  }
  // Else, we're not on the description page. Nothing we can do.
  return 'unknown';
};
LeetCodeV2.prototype.startSpinner = function () {
  let elem = document.getElementById('leethub_progress_anchor_element');
  if (!elem) {
    elem = document.createElement('span');
    elem.id = 'leethub_progress_anchor_element';
    elem.style = 'margin-right: 20px;padding-top: 2px;';
  }
  elem.innerHTML = `<div id="${this.progressSpinnerElementId}" class="${this.progressSpinnerElementClass}"></div>`;
  this.insertToAnchorElement(elem);
  uploadState.uploading = true;
};
LeetCodeV2.prototype.injectSpinnerStyle = function () {
  const style = document.createElement('style');
  style.textContent = `.${this.progressSpinnerElementClass} {pointer-events: none;width: 2.0em;height: 2.0em;border: 0.4em solid transparent;border-color: #eee;border-top-color: #3E67EC;border-radius: 50%;animation: loadingspin 1s linear infinite;} @keyframes loadingspin { 100% { transform: rotate(360deg) }}`;
  document.head.append(style);
};
LeetCodeV2.prototype.insertToAnchorElement = function (elem) {
  if (document.URL.startsWith('https://leetcode.com/explore/')) {
    // TODO: support spinner when answering problems on Explore pages
    //   action = document.getElementsByClassName('action');
    //   if (
    //     checkElem(action) &&
    //     checkElem(action[0].getElementsByClassName('row')) &&
    //     checkElem(action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')) &&
    //     action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6').length > 1
    //   ) {
    //     target = action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')[1];
    //     elem.className = 'pull-left';
    //     if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
    //   }
    return;
  }

  if (checkElem(document.getElementsByClassName('ml-auto'))) {
    const target = document.getElementsByClassName('ml-auto')[0];
    elem.className = 'runcode-wrapper__8rXm';
    if (target.childNodes.length > 0) target.prepend(elem);
  }
};
LeetCodeV2.prototype.markUploaded = function () {
  let elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    elem.style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid #78b13f;border-right:7px solid #78b13f;';
  }
};
LeetCodeV2.prototype.markUploadFailed = function () {
  let elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    elem.style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid red;border-right:7px solid red;';
  }
};

LeetCodeV2.prototype.addManualSubmitButton = function () {
  let elem = document.getElementById('manualGitSubmit');
  const domain = document.URL.match(/:\/\/(www\.)?(.[^/:]+)/)[2].split('.')[0];
  if (elem || domain != 'leetcode') {
    return;
  }

  var submitButton = document.createElement('button');
  submitButton.id = 'manualGitSubmit';
  submitButton.className =
    'relative inline-flex gap-2 items-center justify-center font-medium cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors bg-transparent enabled:hover:bg-fill-secondary enabled:active:bg-fill-primary text-caption rounded text-text-primary group ml-auto p-1';
  submitButton.textContent = 'Push ';
  submitButton.appendChild(getGitIcon());
  submitButton.appendChild(getToolTip());
  submitButton.addEventListener('click', () => loader(this));
  submitButton.addEventListener('contextmenu', event => {
    event.preventDefault();
    const suffix = prompt(
      'Add a suffix for this solution file, i.e., -bfs, -dfs. \r\nWe don\'recommend includes special character except for "-".',
    );
    if (isValidSuffix(suffix)) {
      loader(this, suffix);
    }
  });

  let notesIcon = document.querySelectorAll('.ml-auto svg.fa-bookmark');
  if (checkElem(notesIcon)) {
    const target = notesIcon[0].closest('button.ml-auto').parentElement;
    target.prepend(submitButton);
  }
};

/* Validate if string can be added as suffix. Can add more constrains if necessary. */
function isValidSuffix(string) {
  if (!string || string.length > 255) {
    return false;
  }
  return true;
}

LeetCodeV2.prototype.addUrlChangeListener = function () {
  window.navigation.addEventListener('navigate', _ => {
    const problem = window.location.href.match(/leetcode.com\/problems\/(.*)\/submissions/);
    const submissionId = window.location.href.match(/\/(\d+)(\/|\?|$)/);
    if (problem && problem.length > 1 && submissionId && submissionId.length > 1) {
      chrome.storage.local.set({ [problem[1]]: submissionId[1] });
    }
  });
};

/* Sync to local storage */
chrome.storage.local.get('isSync', data => {
  const keys = [
    'leethub_token',
    'leethub_username',
    'pipe_leethub',
    'stats',
    'leethub_hook',
    'mode_type',
    'custom_commit_message',
  ];
  if (!data || !data.isSync) {
    keys.forEach(key => {
      chrome.storage.sync.get(key, data => {
        chrome.storage.local.set({ [key]: data[key] });
      });
    });
    chrome.storage.local.set({ isSync: true }, _ => {
      console.log('LeetHub Synced to local values');
    });
  } else {
    console.log('LeetHub Local storage already synced!');
  }
});

const loader = (leetCode, suffix) => {
  let iterations = 0;
  // start upload indicator here
  leetCode.startSpinner();
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          clearInterval(intervalId); // poll for max 10 attempts (10 seconds)
          leetCode.markUploadFailed();
        }
        return;
      }

      // If successful, stop polling
      clearInterval(intervalId);

      // For v2, query LeetCode API for submission results
      await leetCode.init();

      const probStats = leetCode.parseStats();
      if (!probStats) {
        throw new Error('Could not get submission stats');
      }

      const probStatement = leetCode.parseQuestion();
      if (!probStatement) {
        throw new Error('Could not find problem statement');
      }

      const problemName = leetCode.getProblemNameSlug();
      const alreadyCompleted = await checkAlreadyCompleted(problemName);
      const language = leetCode.getLanguageExtension();
      if (!language) {
        throw new Error('Could not find language');
      }

      /* Upload README */
      const updateReadMe = await chrome.storage.local.get('stats').then(({ stats }) => {
        const shaExists = stats?.shas?.[problemName]?.['README.md'] !== undefined;

        if (!shaExists) {
          return uploadGit(
            btoa(unescape(encodeURIComponent(probStatement))),
            problemName,
            'README.md',
            readmeMsg,
            'upload',
            false,
          );
        }
      });

      /* Upload Notes if any*/
      let notes = leetCode.getNotesIfAny();
      let updateNotes;
      if (notes != undefined && notes.length > 0) {
        updateNotes = uploadGit(
          btoa(unescape(encodeURIComponent(notes))),
          problemName,
          'NOTES.md',
          createNotesMsg,
          'upload',
          false,
        );
      }

      const problemContext = {
        time: `${probStats.time} (${probStats.timePercentile}%)`,
        space: `${probStats.space} (${probStats.spacePercentile}%)`,
        language: language,
        problemName: problemName,
        difficulty: difficulty,
        date: getTodaysDate(),
        problemTopic: probStats.problemTopic,
      };
      const probStatsCommitMsg = `Time: ${probStats.time} (${probStats.timePercentile}%), Space: ${probStats.space} (${probStats.spacePercentile}%) - LeetHub`; // default commit
      const commitMsg = (await getCustomCommitMessage(problemContext)) || probStatsCommitMsg;

      const { useTimestampFilename = false } =
        await chrome.storage.local.get('useTimestampFilename');

      let fileName;
      if (useTimestampFilename) {
        const timestamp = `${getTodaysDate()}-${getTime()}`.replace(/[:\s]/g, '--');
        fileName = suffix
          ? `${problemName}${suffix}-${timestamp}${language}`
          : `${problemName}-${timestamp}${language}`;
      } else {
        fileName = suffix ? `${problemName}${suffix}${language}` : `${problemName}${language}`;
      }

      /* Upload code to Git */
      const updateCode = leetCode.findAndUploadCode(problemName, fileName, commitMsg, 'upload');

      await Promise.all([updateReadMe, updateNotes, updateCode]);

      uploadState.uploading = false;
      leetCode.markUploaded();

      if (!alreadyCompleted) {
        incrementStats();
      }
    } catch (err) {
      uploadState.uploading = false;
      leetCode.markUploadFailed();
      clearInterval(intervalId);
      console.error(err);
    }
  }, 1000);
};

const isMacOS = window.navigator.userAgent.includes('Mac');

// Submit by Keyboard Shortcuts only support on LeetCode v2
function submitByShortcuts(event, leetCodeV2) {
  const isEnterKey = event.key === 'Enter';

  // Adapt to MacOS operating system
  if (isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey))) {
    loader(leetCodeV2);
  }
}

// Use MutationObserver to determine when the submit button elements are loaded
const observer = new MutationObserver(function (_mutations, observer) {
  const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]');
  const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
  const textareaList = document.getElementsByTagName('textarea');
  const textarea =
    textareaList.length === 4
      ? textareaList[2]
      : textareaList.length === 2
        ? textareaList[0]
        : textareaList[1];

  if (v1SubmitBtn) {
    observer.disconnect();

    const leetCode = new LeetCodeV1();
    v1SubmitBtn.addEventListener('click', () => loader(leetCode));
    return;
  }

  if (v2SubmitBtn && textarea) {
    observer.disconnect();

    const leetCode = new LeetCodeV2();
    v2SubmitBtn.addEventListener('click', () => loader(leetCode));
    textarea.addEventListener('keydown', e => submitByShortcuts(e, leetCode));
    leetCode.addManualSubmitButton();
  }
});

setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}, 2000);

// add url change listener & manual submit button if it does not exist already
setTimeout(() => {
  const leetCode = new LeetCodeV2();
  leetCode.addManualSubmitButton();
  leetCode.addUrlChangeListener();
}, 6000);
