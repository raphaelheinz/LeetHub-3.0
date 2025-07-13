# Cross-Browser Compatibility Guide

LeetHub-3.0 is now compatible with both Chrome and Firefox! This guide explains how to build and install the extension for each browser.

## Browser Support

- ✅ **Chrome** (Manifest V3)
- ✅ **Firefox** (Manifest V2)
- ✅ **Edge** (Uses Chrome build)
- ✅ **Opera** (Uses Chrome build)

## Architecture

The extension uses a browser compatibility layer (`src/js/browser-polyfill.js`) that provides a unified API interface for both browsers. This allows the same codebase to work across different browsers without modification.

### Key Features:
- **Unified API**: The polyfill ensures that `chrome.*` APIs work in Firefox and `browser.*` APIs work in Chrome
- **Automatic Detection**: The extension automatically detects which browser it's running in
- **No Code Changes**: Existing code continues to work without modifications

## Building for Different Browsers

### Prerequisites
```bash
npm install
```

### Build Commands

#### For Chrome/Edge/Opera (Manifest V3)
```bash
npm run build:chrome
```
This creates a `build/chrome/` folder with Chrome-compatible files.

#### For Firefox (Manifest V2)
```bash
npm run build:firefox
```
This creates a `build/firefox/` folder with Firefox-compatible files.

#### Build for All Browsers
```bash
npm run build:all
```
This creates both Chrome and Firefox builds.

## Installation

### Chrome/Edge/Opera
1. Run `npm run build:chrome`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `build/chrome/` folder

### Firefox
1. Run `npm run build:firefox`
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from `build/firefox/` folder

## Distribution

### Chrome Web Store
1. Build with `npm run build:chrome`
2. Zip the `build/chrome/` folder
3. Upload to Chrome Web Store

### Firefox Add-ons (AMO)
1. Build with `npm run build:firefox`
2. Zip the `build/firefox/` folder
3. Upload to Firefox Add-ons

## Technical Details

### Manifest Differences

**Chrome (Manifest V3)**:
- Uses `action` instead of `browser_action`
- Uses `service_worker` for background scripts
- Requires `host_permissions` for external sites
- Uses `tabs` permission explicitly

**Firefox (Manifest V2)**:
- Uses `browser_action`
- Uses `scripts` array for background scripts
- Includes permissions in main `permissions` array
- Different CSP format

### API Compatibility

The browser polyfill handles these API differences:
- `chrome.runtime.*` ↔ `browser.runtime.*`
- `chrome.tabs.*` ↔ `browser.tabs.*`
- `chrome.storage.*` ↔ `browser.storage.*`

### OAuth2 Flow

Both browsers use the same OAuth2 flow with GitHub:
- Client ID: `0114dd35b156d4729fac`
- Redirect URL: `https://github.com/`
- Scopes: `['repo']`

## Troubleshooting

### Common Issues

1. **Extension not loading in Firefox**
   - Make sure you used `npm run build:firefox`
   - Check that you're loading from the `build/firefox/` folder
   - Verify Firefox version is 109.0 or higher

2. **APIs not working**
   - Ensure `browser-polyfill.js` is loaded first in all HTML files
   - Check browser console for polyfill errors

3. **Permission errors**
   - Chrome: Check `host_permissions` in manifest
   - Firefox: Check `permissions` array includes URLs

### Debug Mode

To enable debug logging, open browser console and check for:
- Polyfill initialization messages
- API call traces
- Permission warnings

## Development

When developing new features:

1. **Use chrome.* APIs**: The polyfill will handle Firefox compatibility
2. **Test in both browsers**: Use the build commands to test in each browser
3. **Update permissions**: Add new permissions to both manifest files
4. **Check CSP**: Ensure Content Security Policy works in both browsers

## Contributing

When contributing cross-browser fixes:

1. Test changes in both Chrome and Firefox
2. Update both manifest files if needed
3. Ensure polyfill covers new APIs
4. Update this documentation

## Browser-Specific Notes

### Chrome
- Full Manifest V3 support
- Service worker background scripts
- Robust extension APIs

### Firefox
- Uses Manifest V2 (more stable than V3 in Firefox)
- Background scripts (not service workers)
- Promise-based APIs by default

### Edge
- Uses Chrome build (Chromium-based)
- Full compatibility with Chrome version

### Opera
- Uses Chrome build (Chromium-based)
- Full compatibility with Chrome version
