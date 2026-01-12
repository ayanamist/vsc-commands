# Gemini's Shift+Tab Investigation: Dual-Action Focus Issue

Building on the initial investigation in `ai/shift-tab-investigation.md`, this report provides additional technical insights and potential remediation strategies for the `Shift+Tab` interception problem in editor-area terminals.

## Deep Dive into the "Dual-Action" Problem

The core issue is that `Shift+Tab` is being consumed by two different layers of the application:
1. **Extension Layer**: Our `commands.sendShiftTab` command correctly intercepts the keybinding and sends the escape sequence to the terminal.
2. **Platform/Accessibility Layer**: The underlying Electron/Chromium environment or Cursor's workbench focus manager handles the `Shift+Tab` as a request to move focus to the previous focusable element in the DOM.

### Why does this happen only in the Editor Area?

VS Code (and Cursor) treats terminals in the **Integrated Terminal Panel** differently than terminals in the **Editor Area**:
- **Panel Terminals**: Benefit from a specialized focus trap and are often excluded from the standard workbench tab cycle unless explicitly configured.
- **Editor-Area Terminals**: Are treated as "Editors". The VS Code workbench has a complex focus management system for the editor area that prioritizes accessibility navigation (tabbing between editors, breadcrumbs, and toolbars).

## Technical Observations

### 1. The Keybinding Interception Paradox
In VS Code extensions, when a keybinding is mapped to a command, the command is executed, but the extension does *not* have the ability to call `event.preventDefault()` or `event.stopPropagation()` on the original hardware keyboard event. The workbench decides whether to let the event propagate further.

### 2. Tab Focus Mode
VS Code has a "Tab Focus Mode" (toggled via `Ctrl+M` on Windows/Linux, `Ctrl+Shift+M` on Mac). When enabled, `Tab` and `Shift+Tab` move focus instead of being sent to the editor. 
- **Hypothesis**: Editor-area terminals might be inheriting "Editor" behavior where accessibility navigation is more aggressive, or they might be failing to signal to the workbench that they have "trapped" the focus.

### 3. Chromium Accessibility
If Cursor has "Screen Reader Optimization" or similar accessibility features enabled, it may be hooking into `Shift+Tab` at a level even higher than the VS Code keybinding service.

## Proposed Solutions & Experiments

### A. Leverage `terminal.integrated.commandsToSkipShell`
Instead of manually sending the sequence, we should try to tell VS Code *not* to handle `Shift+Tab` as a workbench command when the terminal is focused.

**Action**: Add `Shift+Tab` to the list of commands that should be sent directly to the shell.
```json
"terminal.integrated.commandsToSkipShell": [
    "-workbench.action.terminal.focusPreviousPane",
    "-editor.action.outdentLines"
]
```
*(Note: Using the minus prefix in this setting tells VS Code to skip its own handler and send it to the terminal).*

### B. Use `terminal.integrated.sendKeybindingsToShell`
Verify the value of `terminal.integrated.sendKeybindingsToShell`. If it's false, the workbench intercepts most keys.

### C. The `tabFocusMode` Toggle
We can try to programmatically disable `tabFocusMode` when our terminals are focused.
```typescript
// Inside updateActiveTerminalContext
if (isCommands) {
    void vscode.commands.executeCommand('editor.action.toggleTabFocusMode', false);
}
```

### D. Investigation of `terminalEditorFocus` Context
The initial investigation mentioned `terminalEditorFocus` didn't work. However, we should check if `terminalFocus && inEditorArea` (or similar combined contexts) provides better targeting.

### E. Custom Terminal Profile Approach
Instead of `vscode.window.createTerminal({ location: ... })`, we could try registering a `TerminalProfileProvider`. This is a more formal way of defining terminal types and might give the workbench better hints about how to treat the focus.

## Questions for Further Testing

1. **Native VS Code Comparison**: Does this exact same dual-action occur in "Vanilla" VS Code 1.95+ when a terminal is moved to the editor area? If not, this is a Cursor-specific focus management regression.
2. **DOM Inspection**: Using the Developer Tools (`Developer: Toggle Developer Tools`), we can see which element receives focus after the `Shift+Tab`. Is it a toolbar button or the editor tab itself?
3. **Sequence Timing**: If we send the sequence `\u001b[Z` *after* a longer delay, does the focus still jump? (This helps determine if the jump is triggered by the keydown event or something else).

## Conclusion (Initial)
The "Dual-Action" is likely caused by the Editor-area container not having the same "Focus Trap" logic as the Panel container. Since we cannot prevent the browser's default behavior directly through the Extension API, we must find a way to make the Workbench ignore the `Shift+Tab` event when our specific terminal context is active.
