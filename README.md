# vscode-neovim-filter

> Use Neovim as a powerful filter

Run Neovim ex commands directly in VS Code with full compatibility.

## Features

- Run any Neovim ex command (global, substitute, delete, etc.)
- Command history with QuickPick dropdown
- Multi-cursor support with extmark-based position tracking
- Selection range support (automatically adds `'<,'>` prefix)
- Uses real Neovim for 100% compatibility

## Requirements

- [Neovim](https://neovim.io) 0.9.0 or later must be installed and available in your PATH

## Usage

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Select "Neovim Filter: Run ex command"
3. Enter your ex command (e.g., `v/pattern/d`, `%s/foo/bar/g`)
4. The command will be executed on the current editor

### Examples

| Command | Description |
|---------|-------------|
| `v/bar/d` | Delete lines NOT matching "bar" |
| `%s/foo/bar/g` | Replace all "foo" with "bar" |
| `s/foo/bar/g` | Replace "foo" with "bar" in current line(s) |
| `5,10d` | Delete lines 5-10 |

### Selection Range

When you have a selection, the command automatically adds `'<,'>` prefix to operate on the selection:

1. Select some text
2. Run "Neovim Filter: Run ex command"
3. Enter `s/foo/bar/g` → executes as `'<,'>s/foo/bar/g`

### Multi-cursor

With multiple cursors, the command runs at each cursor position independently:

```
command = "workbench.action.terminal.toggleTerminal"
command = "workbench.action.terminal.new"
```

Place cursors on both `command =` lines and run `s/workbench/work/g` → both lines are replaced.

## Commands

| Command | Description |
|---------|-------------|
| `Neovim Filter: Run ex command` | Run a Neovim ex command |
| `Neovim Filter: Clear command history` | Clear command history |

## License

MIT
