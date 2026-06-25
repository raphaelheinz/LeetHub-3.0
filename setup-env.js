import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, '.env');
const ENV_EXAMPLE_PATH = path.join(__dirname, '.env.example');
const AUTHORIZE_JS_PATH = path.join(__dirname, 'src', 'js', 'authorize.js');
const OAUTH2_JS_PATH = path.join(__dirname, 'src', 'js', 'oauth2.js');

// Parse a .env file content
function parseEnv(content) {
  const env = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.substring(0, index).trim();
    let value = trimmed.substring(index + 1).trim();
    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
  return env;
}

// Extract current secrets from authorize.js
function extractSecrets() {
  if (!fs.existsSync(AUTHORIZE_JS_PATH)) {
    return { clientId: '', clientSecret: '' };
  }
  const content = fs.readFileSync(AUTHORIZE_JS_PATH, 'utf8');
  const clientIdMatch = content.match(/this\.CLIENT_ID\s*=\s*['"]([^'"]*)['"]/);
  const clientSecretMatch = content.match(/this\.CLIENT_SECRET\s*=\s*['"]([^'"]*)['"]/);
  return {
    clientId: clientIdMatch ? clientIdMatch[1] : '',
    clientSecret: clientSecretMatch ? clientSecretMatch[1] : '',
  };
}

// Update authorize.js and oauth2.js with secrets from env
function updateSecrets(clientId, clientSecret) {
  if (fs.existsSync(AUTHORIZE_JS_PATH)) {
    let content = fs.readFileSync(AUTHORIZE_JS_PATH, 'utf8');
    content = content.replace(/(this\.CLIENT_ID\s*=\s*['"])[^'"]*(['"])/, `$1${clientId}$2`);
    content = content.replace(
      /(this\.CLIENT_SECRET\s*=\s*['"])[^'"]*(['"])/,
      `$1${clientSecret}$2`,
    );
    fs.writeFileSync(AUTHORIZE_JS_PATH, content, 'utf8');
    console.log('Updated src/js/authorize.js');
  }

  if (fs.existsSync(OAUTH2_JS_PATH)) {
    let content = fs.readFileSync(OAUTH2_JS_PATH, 'utf8');
    content = content.replace(/(const\s+CLIENT_ID\s*=\s*['"])[^'"]*(['"])/, `$1${clientId}$2`);
    fs.writeFileSync(OAUTH2_JS_PATH, content, 'utf8');
    console.log('Updated src/js/oauth2.js');
  }
}

function main() {
  const current = extractSecrets();

  // Create .env.example if it doesn't exist
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    const exampleContent = `# GitHub OAuth Secrets for LeetHub-3.0
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
`;
    fs.writeFileSync(ENV_EXAMPLE_PATH, exampleContent, 'utf8');
    console.log('Created .env.example');
  }

  // Create .env with current values if it doesn't exist
  if (!fs.existsSync(ENV_PATH)) {
    const envContent = `# GitHub OAuth Secrets for LeetHub-3.0
GITHUB_CLIENT_ID=${current.clientId || 'your_client_id_here'}
GITHUB_CLIENT_SECRET=${current.clientSecret || 'your_client_secret_here'}
`;
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    console.log('Created .env with existing credentials');
  } else {
    // If it exists, read it and update files
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const env = parseEnv(envContent);
    const clientId = env.GITHUB_CLIENT_ID || current.clientId;
    const clientSecret = env.GITHUB_CLIENT_SECRET || current.clientSecret;
    updateSecrets(clientId, clientSecret);
  }
}

main();
