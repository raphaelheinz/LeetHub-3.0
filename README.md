<div align="center">
    <img src="assets/logo.png" alt="LeetHub-3.0">
</div>

<p align="center">
  <a href="https://github.com/raphaelheinz/LeetHub-3.0/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/>
  </a>
  <a href="https://chromewebstore.google.com/u/1/detail/leethub-v3/kdkgpjpenaeoodajljkflmlnkoihkmda">
    <img src="https://img.shields.io/chrome-web-store/v/kdkgpjpenaeoodajljkflmlnkoihkmda.svg" alt="chrome-webstore"/>
  </a>
  <a href="https://chromewebstore.google.com/u/1/detail/leethub-v3/kdkgpjpenaeoodajljkflmlnkoihkmda">
    <img src="https://img.shields.io/chrome-web-store/d/kdkgpjpenaeoodajljkflmlnkoihkmda.svg" alt="users">
  </a>
  <a href="https://github.com/raphaelheinz/LeetHub-3.0/graphs/contributors" alt="Contributors">
    <img src="https://img.shields.io/github/contributors/raphaelheinz/LeetHub-3.0" />
  </a>
</p>

## What is LeetHub-3.0?

A cross-browser extension that automatically pushes your code to GitHub when you pass all tests on a <a href="http://leetcode.com/">Leetcode</a> problem. It's forked from <a href="https://github.com/arunbhardwaj/LeetHub-2.0">LeetHub-2.0</a> which is not compatible with Leetcode anymore since the latest updates.

### Browser Support
- ✅ **Chrome** (Manifest V3)
- ✅ **Firefox** (Manifest V2) 
- ✅ **Edge** (Chromium-based)
- ✅ **Opera** (Chromium-based)

> 📖 **See [Cross-Browser Compatibility Guide](CROSS_BROWSER_GUIDE.md) for detailed installation and building instructions for each browser.**


## Why LeetHub?

There's no easy way of accessing your leetcode problems in one place! Moreover, pushing code manually to GitHub from Leetcode is very time consuming. So, why not just automate it entirely without spending a SINGLE additional second on it?

## Screenshot

<h1 align="center">
    <img src="assets/extension/4.png" alt="leetcode view" width="800">
</h1>

## Supported UI

LeetHub-3.0 works with two different Leetcode UIs. There are known issues when using the plugin with the "non-dynamic layout". Please use one of the following:

1. **old layout** or
2. new **"dynamic layout"**


## Manual synchronization

Your submission may not be successfully uploaded to GitHub if you update the text in the editor too fast. It is necessary to wait for 4 seconds (until the spinner stops) after submitting the solution before entering new characters, switching languages, or switching editors. During this period, your solution is being pushed to GitHub, and the website should maintain its layout without alteration. While this process is less than ideal, we have not found a better solution so far. Sorry for this inconvenience! If you find a fix, your PRs are welcome!

In the meantime, we have added a manual synchronization button next to notes icon. Please use the manual sync button only after you have successfully submitted your solution to Leetcode. Additionally, you can push previous submissions to GitHub by selecting the submission first and then click on the manual synchronization button.


## Installation

### Chrome/Edge/Opera

<div align="center">
    <a href="https://chromewebstore.google.com/u/1/detail/leethub-v3/kdkgpjpenaeoodajljkflmlnkoihkmda" rel="Download leetcode plugin">
        <img src="https://embedsignage.com/wp-content/uploads/2016/04/embed-signage-chromeos-web-store-button.png" alt="Download leetcode plugin" width="300" />
    </a>
</div>

Install from Chrome Web Store (recommended for automatic updates).

### Firefox

Firefox support is available! See the [Cross-Browser Compatibility Guide](CROSS_BROWSER_GUIDE.md) for detailed Firefox installation instructions.

### Manual Installation (All Browsers)

For manual installation or development:

1. **Download and Setup**
   ```bash
   git clone https://github.com/raphaelheinz/LeetHub-3.0.git
   cd LeetHub-3.0
   npm run setup
   ```

2. **Build for your browser**
   ```bash
   # For Chrome/Edge/Opera
   npm run build:chrome
   
   # For Firefox  
   npm run build:firefox
   
   # For all browsers
   npm run build:all
   ```

3. **Load Extension**
   - **Chrome/Edge**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `build/chrome/` folder
   - **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", select `manifest.json` from `build/firefox/` folder

> 📖 **For detailed instructions, OAuth setup, and troubleshooting, see [Cross-Browser Compatibility Guide](CROSS_BROWSER_GUIDE.md)**


## Setup

1. After installing the LeetHub, launch the plugin
2. Click on **"Authorize with GitHub"** to set up your account with LeetHub
3. Setup an existing/new repository with LeetHub (private by default) by clicking **"Get Started"**
4. Begin Leetcoding! To view your progress, simply click on the extension!


## Supported npm commands

```bash
npm run               # Show available commands
npm run setup         # Install dependencies
npm run format        # Auto-format JavaScript, HTML/CSS
npm run format-test   # Test if code is formatted properly
npm run lint          # Lint JavaScript
npm run lint-test     # Test if code is linted properly
npm run build:chrome  # Build Chrome/Edge/Opera extension
npm run build:firefox # Build Firefox extension
npm run build:all     # Build for all browsers
```

## Contribution

Please help to further improve this awesome plugin! We would appreciate your support. Your pull requests are welcome!

Don't forget to star this repository for further development of new features. If you want a particular feature, simply [request](https://github.com/raphaelheinz/LeetHub-3.0/labels/feature) for it!

