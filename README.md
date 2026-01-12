# Commands

Commands is a VS Code extension that opens a terminal in the editor area with a command of your choice. This makes your terminal a first-class citizen next to your files, not tucked away in the panel or sidebar.

## What it does

- Launches a terminal in the editor area and runs a preset command immediately.
- Lets you customize presets (nickname, command, icon) and hide/show status bar buttons.
- Ships with quick presets for Claude, Codex, and Gemini.
- Includes a Quick Pick command for fast launching.

## Where to find it

Open the activity bar (the vertical strip of icons on the far left edge of the window). It usually contains:
- Explorer (files)
- Search
- Source Control
- Run & Debug
- Extensions

You will see a Commands icon there. Open it to access your presets.

## Commands

- Commands: Edit Presets
- Commands: Pick Preset

## Screenshots

Activity bar view:

![Commands activity bar view](media/screenshots/activity-bar.png)

Terminal in the editor area:

![Terminal in the editor area](media/screenshots/claude-terminal-area.png)

Preset editor:

![Commands preset editor](media/screenshots/commands-settings.png)

## Preset settings

Presets live in `settings.json` under `commands.presets`. Each preset supports:
- `nickname` (displayed name)
- `command` (shell command to run)
- `icon` (asset: name, codicon: name, or file path)
- `enabled` (show/hide preset)
- `showInStatusBar` (show/hide status bar button)
- `statusBarColor` (optional status bar text color)

Example:
```json
"commands.presets": [
  {
    "id": "claude",
    "nickname": "Claude",
    "command": "claude",
    "icon": "asset:claude",
    "enabled": true,
    "showInStatusBar": true
  }
]
```

## Terminal keybindings

When a terminal opened by Commands is focused, the extension can pass Shift+Tab through to the shell (so terminal UIs can use it). Toggle this with `commands.sendShiftTabToTerminal`. If your terminal UI expects a different sequence, set `commands.shiftTabSequence` (common values: `\u001b[Z` or `\u001b[1;2Z`).

## Theme-aware icons

If you add theme-aware assets, place `name-light.svg` and `name-dark.svg` in `media/` and use `asset:name`.

## License

MIT
