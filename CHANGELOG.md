# Changelog

## [0.0.15] - Cross-Browser Compatibility Update

### Added
- ✨ **Firefox Support**: Full compatibility with Firefox browsers using Manifest V2
- 🔧 **Browser Polyfill**: Unified API layer for Chrome and Firefox compatibility  
- 📦 **Build System**: Automated build scripts for Chrome and Firefox distributions
- 📖 **Cross-Browser Guide**: Comprehensive documentation for multi-browser support
- 🧪 **Testing**: Browser polyfill test page for verification

### Enhanced
- 🌐 **Chrome Support**: Maintained full Chrome/Edge/Opera compatibility with Manifest V3
- 📋 **Manifest Files**: Separate optimized manifests for each browser
- 🚀 **Build Commands**: New npm scripts for browser-specific builds
- 📚 **Documentation**: Updated README with cross-browser installation instructions

### Technical Details
- Browser polyfill provides unified `chrome.*` and `browser.*` APIs
- Chrome build uses Manifest V3 with service workers
- Firefox build uses Manifest V2 with background scripts  
- Automatic browser detection and API mapping
- Robust error handling for API compatibility

### Build Commands
```bash
npm run build:chrome   # Build for Chrome/Edge/Opera
npm run build:firefox  # Build for Firefox
npm run build:all      # Build for all browsers
```

### Browser Support Matrix
| Browser | Version | Manifest | Status |
|---------|---------|----------|--------|
| Chrome  | Latest  | V3       | ✅ Full Support |
| Firefox | 109+    | V2       | ✅ Full Support |
| Edge    | Latest  | V3       | ✅ Full Support |
| Opera   | Latest  | V3       | ✅ Full Support |

### Migration Guide
Existing Chrome users: No changes needed, extension continues to work normally.
New Firefox users: See [Cross-Browser Compatibility Guide](CROSS_BROWSER_GUIDE.md) for installation.

### Files Added
- `src/js/browser-polyfill.js` - Cross-browser API compatibility layer
- `manifest-firefox.json` - Firefox-specific manifest file
- `scripts/build-chrome.js` - Chrome build automation
- `scripts/build-firefox.js` - Firefox build automation  
- `CROSS_BROWSER_GUIDE.md` - Comprehensive cross-browser documentation
- `test/polyfill-test.html` - Browser compatibility testing page

### Files Modified
- `manifest.json` - Enhanced for Chrome with additional permissions
- `src/html/popup.html` - Added browser polyfill script
- `src/html/welcome.html` - Added browser polyfill script
- `package.json` - Added build scripts and commands
- `README.md` - Updated with cross-browser information
