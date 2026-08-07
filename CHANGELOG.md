# Changelog

## 0.0.13
- Fixed the Codex status bar icon rendering as a solid block, caused by clip paths leaking into the icon font
- Status bar icons now share a uniform width so they line up with built-in icons
- Added `npm run build:icon-font` to regenerate the icon font from the source SVGs

## 0.0.12
- Show each built-in preset's configured tool icon in the status bar instead of the generic terminal icon

## 0.0.11
- Added GitHub Copilot CLI preset and icons (hidden from status bar by default)

## 0.0.9
- Added Command Sets feature to launch multiple presets with one click
- Command Sets appear in the status bar with a list icon
- Added "Focus first preset" setting to control which terminal gets focus
- Default command set: Claude | Codex (enabled)

## 0.0.8
- Added Cursor, Amp, and OpenCode as built-in presets (disabled in status bar by default)
- Added Claude Chrome preset (uses `claude --chrome`)
- Added CLI download links footer in preset editor
- Added theme-aware icons for Cursor, Amp, and OpenCode

## 0.0.7
- Renamed "Status color" to "Button text color" for clarity
- Fixed "Choose file" button wrapping in icon field

## 0.0.6
- Added tooltips and placeholders to all preset editor fields
- Simplified header text in preset editor for better clarity

## 0.0.5
- Preset editor now adapts to light/dark themes using VS Code's CSS variables

## 0.0.4
- Fixed Shift+Tab being intercepted by IDE accessibility navigation when terminals are opened in the editor area
- Added automatic terminal configuration for better keybinding support (tabFocusMode, accessibilitySupport, sendKeybindingsToShell)
- Added detection and warning notification when Screen Reader mode may interfere with terminal keybindings

## 0.0.3
- Added onStartupFinished to activate the extension on startup so refreshStatusBar() runs immediately.

## 0.0.1
- Initial release: editor-area terminal presets with activity bar view, status bar buttons, and preset editor.
