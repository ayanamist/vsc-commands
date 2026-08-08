# Commands 2

Commands 2 is an independently maintained fork of [Daniel Raffel's Commands](https://github.com/danielraffel/Commands). It opens terminals in the editor area with commands of your choice, making your terminal a first-class citizen next to your files instead of tucking it away in the panel or sidebar.

## Compatibility with the original extension

Commands 2 deliberately keeps the original `commands.*` configuration keys so existing user and workspace settings continue to work without migration.

Do not enable Commands 2 and `GenerousCorp.commands-open-terminal-in-editor` at the same time. They share command, view, and configuration identifiers. If Commands 2 detects that the original extension is enabled, it stops activation and asks you to disable or uninstall one of them.

Commands 2 is maintained by ayanamist and is not affiliated with GenerousCorp or the vendors of the bundled CLI presets.

## What it does

- Launches terminals in the editor area and runs preset commands immediately
- Shows quick-launch buttons in the status bar for your most-used commands
- Supports **Command Sets** to open multiple terminals with one click
- Ships with presets for popular coding CLIs: Claude, Codex, Gemini, Claude Chrome, Cursor, Amp, OpenCode, and Copilot
- Lets you customize everything: presets, icons, status bar visibility, and button colors

## Default Setup

Out of the box, Commands shows these buttons in your status bar:

![Status bar buttons](media/screenshots/statusbar-buttons.png)

- **Claude** - launches Claude Code CLI
- **Codex** - launches OpenAI Codex CLI
- **Gemini** - launches Google Gemini CLI
- **Claude Chrome** - launches Claude with Chrome browser integration
- **Claude | Codex** - a Command Set that opens both Claude and Codex terminals side by side

Additional presets for Cursor, Amp, OpenCode, and Copilot are included but hidden from the status bar by default. You can enable them in the preset editor.

## Where to find it

Open the **activity bar** (the vertical strip of icons on the far left edge of the window). You'll see a Commands icon there. Click it to access your presets.

Commands runs as a local UI extension. In Remote SSH, WSL, Dev Containers, and
similar desktop remote windows, install it locally only; terminals created through
the VS Code API still run in the active remote environment.

![Commands activity bar view](media/screenshots/activity-bar.png)

Clicking any preset opens a terminal in the editor area:

![Terminal in the editor area](media/screenshots/claude-terminal-area.png)

## Customizing Presets

Open the preset editor from the activity bar (gear icon) or run **Commands: Edit Presets** from the command palette.

![Commands preset editor](media/screenshots/commands-settings.png)

Each preset supports:
- **Nickname** - display name shown in the activity bar and status bar
- **Command** - shell command to run when the terminal opens
- **Icon** - use `asset:name`, `codicon:name`, or choose a custom file
- **Status bar** - show/hide the quick-launch button
- **Button text color** - optional custom color for the status bar button
- **Enabled** - show/hide the preset entirely

## Command Sets

Command Sets let you launch multiple terminals with a single click. Perfect for workflows that need several tools running simultaneously.

![Command Sets editor](media/screenshots/commands-settings-command-sets.png)

Each Command Set includes:
- **Name** - custom name or auto-generated from selected presets (e.g., "Claude | Codex")
- **Presets** - ordered list of presets to launch
- **Status bar** - show/hide the Command Set button
- **Focus setting** - choose whether to focus the first or last terminal when launching

## Commands

- **Commands: Edit Presets** - open the visual preset editor
- **Commands: Pick Preset** - quick pick menu to launch any preset
- **Commands: Refresh Presets** - reload presets from settings

## Settings Reference

Presets live in `settings.json` under `commands.presets`:

```json
"commands.presets": [
  {
    "id": "claude",
    "nickname": "Claude",
    "command": "claude",
    "icon": "asset:claude",
    "enabled": true,
    "showInStatusBar": true,
    "statusBarColor": ""
  }
]
```

Command Sets live under `commands.commandSets`:

```json
"commands.commandSets": [
  {
    "id": "claude-codex",
    "name": "",
    "presetIds": ["claude", "codex"],
    "showInStatusBar": true,
    "enabled": true
  }
]
```

Additional settings:
- `commands.commandSetFocusFirst` - focus first preset when launching a set (default: true)
- `commands.sendShiftTabToTerminal` - pass Shift+Tab to the terminal (default: true)
- `commands.shiftTabSequence` - escape sequence for Shift+Tab (default: `\u001b[Z`)

## Terminal Keybindings

When a terminal opened by Commands is focused, the extension passes Shift+Tab through to the shell so terminal UIs (like Claude Code's mode switcher) can use it. Toggle this with `commands.sendShiftTabToTerminal`.

## Known Limitation: Pinned Terminal Restoration

Investigated on 2026-08-07. A terminal created by this extension receives its nickname and icon through `createTerminal({ name, iconPath })`, then the preset command is launched separately with `Terminal.sendText()`.

After a full VS Code restart, a pinned terminal editor can be revived as a plain shell tab with the preset title and icon missing. Not replaying the preset command is expected because `sendText()` input is not part of the terminal launch configuration. Losing the API-provided title and icon appears to be a VS Code terminal persistence defect: the current VS Code revival implementation explicitly attempts to restore the persisted [API title and icon](https://github.com/microsoft/vscode/blob/3c9d7f23bdc7399e1ce6bc3ef9f1de47b62539fe/src/vs/platform/terminal/node/ptyService.ts#L284-L291), and related upstream issues remain open for [terminal titles](https://github.com/microsoft/vscode/issues/287059) and [stable terminal identity across reloads](https://github.com/microsoft/vscode/issues/327326).

The stable extension API does not allow changing an existing terminal tab's title or icon in place: `Terminal.name`, `Terminal.creationOptions`, and editor `Tab` metadata are read-only, and there is no terminal icon setter. This rules out a clean metadata-only repair after restart.

Previously considered workarounds and their tradeoffs:

- Recreating the terminal during extension activation restores its title and icon, but eagerly launches the terminal and breaks VS Code's lazy tab restoration.
- Waiting until activation to recreate it preserves lazy loading, but the inactive tab displays the fallback shell title and icon until selected.
- A serialized Webview placeholder can own persistent title/icon metadata, but VS Code provides no way to embed a native integrated terminal inside it. Swapping between Webview and terminal changes the editor tab identity and complicates pinning, ordering, and shutdown.
- Replacing the terminal with a placeholder during extension shutdown is not reliable; extensions do not have a dependable asynchronous shutdown phase for editor-layout mutations.

Until VS Code exposes reliable terminal metadata restoration or mutable terminal-tab metadata, keep the native terminal implementation and manually close and relaunch an affected preset after restart. Re-test this limitation against stock VS Code before adding another workaround, since editor forks may behave differently.

## Theme-aware Icons

To add theme-aware custom icons, place `name-light.svg` and `name-dark.svg` in `media/icons/` and reference them with `asset:name`.

Built-in `asset:name` icons also appear in the status bar as single-color, theme-aware product icons. VS Code status bar items do not support arbitrary image URIs, so custom `file:` icons use the generic terminal icon there while retaining the selected image in the Commands view and terminal tab.

The status bar variants come from `media/icons/commands-statusbar-icons.woff`, which is built from the `-dark.svg` sources by `npm run build:icon-font`. Run it after editing any of those SVGs and commit the regenerated font. The build prints how much of each glyph's em square is inked; a value near 100% means a background rectangle, clip path, or mask leaked into the outline and the icon will render as a solid block.

## License

MIT
