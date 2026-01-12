# Codex Response: Shift+Tab Focus Leak in Editor Terminals

## Short take
The keybinding is firing and the sequence is sent, but the original `Shift+Tab` event is still allowed to move focus in the editor area. That suggests the focus traversal is happening at the workbench/DOM layer (or accessibility layer) in a way that the extension command cannot cancel. The terminal editor behaves like an editor, so it may be inheriting editor focus-navigation rules that the panel terminal does not.

## What to confirm first (fastest signal)
1. **Keyboard shortcut troubleshooting**
   - Run: `Developer: Toggle Keyboard Shortcuts Troubleshooting`
   - Press `Shift+Tab` while the terminal editor is focused.
   - If a command is listed, override that exact command (and its `when`) with a `-command` entry.
   - If no command is listed, the focus change is likely DOM/default behavior or a Cursor-level accessibility handler.

2. **Tab focus mode + accessibility toggles**
   - Run these commands and retest:
     - `Terminal: Toggle Tab Focus Mode`
     - `Toggle Tab Focus Mode` (editor)
     - `Toggle Screen Reader Accessibility Mode`
   - Also verify settings:
     - `terminal.integrated.tabFocusMode` (ensure `false`)
     - `editor.tabFocusMode` (ensure `false`)
     - `terminal.integrated.accessibilitySupport` (try `off` for testing)

3. **Vanilla VS Code comparison**
   - Reproduce in standard VS Code 1.95+ with a terminal moved to editor area.
   - If it only happens in Cursor, treat it as a Cursor regression and file a minimal repro.

## Likely causes
- **Editor focus chain**: Terminal editors sit in the editor area and may be part of the editor focus traversal, which is more aggressive about `Tab`/`Shift+Tab` for accessibility.
- **Non-command focus handling**: The focus jump might not be a keybinding at all, so removing bindings has no effect.
- **Keybinding dispatch is not enough**: `workbench.action.terminal.sendSequence` sends data but does not suppress the original DOM focus traversal.

## Workarounds to try (in order)
1. **Force tab focus mode off when a Commands terminal gains focus**
   - On focus, run `workbench.action.terminal.toggleTabFocusMode` and `editor.action.toggleTabFocusMode` if either is currently on.
   - You will need to track and restore state on blur to avoid surprising users.

2. **Send keybindings directly to the terminal**
   - Ensure `terminal.integrated.sendKeybindingsToShell` is `true`.
   - Adjust `terminal.integrated.commandsToSkipShell` if `Shift+Tab` is being retained by the workbench.

3. **Find and disable the actual focus command**
   - If troubleshooting shows a focus command, add a `-workbench.action.*` binding with the same `when` clause.
   - This is more precise than guessing commands.

## If none of the above helps
- The extension API does not expose a way to cancel the native `Shift+Tab` focus traversal in the editor area. At that point, the practical options are:
  - **Cursor issue report** (best chance of a real fix).
  - **Custom terminal host** (webview/custom editor), where you can capture and `preventDefault` on keydown. This is heavy but gives full control.

## Suggested minimal repro outline (for Cursor/VS Code issue)
- Create terminal in editor area via API.
- Bind `Shift+Tab` to `workbench.action.terminal.sendSequence`.
- Show that focus moves out of terminal editor even though sequence is sent.

If you want, I can help craft the repro and issue report once you confirm the troubleshooting output.
