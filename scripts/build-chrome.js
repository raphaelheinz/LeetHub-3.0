import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Build script for Chrome extension
 * Creates a build folder with Chrome-compatible files
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build', 'chrome');

// Create build directory
if (!fs.existsSync(path.join(projectRoot, 'build'))) {
  fs.mkdirSync(path.join(projectRoot, 'build'));
}
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy all files except specific ones
const copyRecursive = (src, dest, exclude = []) => {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    fs.readdirSync(src).forEach(item => {
      if (!exclude.includes(item)) {
        copyRecursive(path.join(src, item), path.join(dest, item), exclude);
      }
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

// Copy project files (exclude build, node_modules, etc.)
const excludeList = ['build', 'node_modules', '.git', 'manifest-firefox.json', 'scripts'];
copyRecursive(projectRoot, buildDir, excludeList);

console.log('✅ Chrome extension built successfully in build/chrome/');
console.log('📦 You can now zip the build/chrome/ folder and upload to Chrome Web Store');
