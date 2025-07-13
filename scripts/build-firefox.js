import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Build script for Firefox extension
 * Creates a build folder with Firefox-compatible files
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build', 'firefox');

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
const excludeList = ['build', 'node_modules', '.git', 'manifest.json', 'scripts'];
copyRecursive(projectRoot, buildDir, excludeList);

// Copy Firefox manifest
fs.copyFileSync(
  path.join(projectRoot, 'manifest-firefox.json'),
  path.join(buildDir, 'manifest.json')
);

console.log('✅ Firefox extension built successfully in build/firefox/');
console.log('📦 You can now zip the build/firefox/ folder and upload to Firefox Add-ons');
