import * as vscode from "vscode";
import { NeovimClient, Position } from "../neovim/client";
import { CommandHistory } from "../ui/commandHistory";
import { CommandInput } from "../ui/commandInput";
import {
  NeovimNotFoundError,
  ExCommandError,
  NeovimFilterError,
} from "../utils/errors";

let isExecuting = false;

export async function runExCommand(
  neovimClient: NeovimClient,
  commandHistory: CommandHistory
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  if (isExecuting) {
    vscode.window.showWarningMessage("Command already in progress");
    return;
  }

  // Show input dialog
  const commandInput = new CommandInput(commandHistory);
  const command = await commandInput.show();

  if (!command) {
    return;
  }

  isExecuting = true;

  try {
    const document = editor.document;
    const content = document.getText().split("\n");

    // Get all cursor positions
    const cursorPositions: Position[] = editor.selections.map((sel) => ({
      line: sel.active.line,
      col: sel.active.character,
    }));

    // Check if there's a selection (non-empty)
    const hasSelection = editor.selections.some((sel) => !sel.isEmpty);

    let result;

    if (hasSelection) {
      // Use the first selection for the range
      const selection = editor.selection;
      const startLine = selection.start.line;
      let endLine = selection.end.line;

      // Adjust for selections ending at column 0 of the next line
      if (selection.end.character === 0 && endLine > startLine) {
        endLine = endLine - 1;
      }

      result = await neovimClient.executeWithSelection(
        content,
        command,
        { startLine, endLine },
        cursorPositions
      );
    } else {
      result = await neovimClient.execute(content, command, cursorPositions);
    }

    // Apply changes to the editor
    await editor.edit((editBuilder) => {
      const fullRange = new vscode.Range(
        0,
        0,
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length
      );
      editBuilder.replace(fullRange, result.lines.join("\n"));
    });

    // Update cursor positions
    const newSelections = result.cursorPositions
      .filter((pos): pos is Position => pos !== null)
      .map((pos) => {
        // Clamp to valid positions in new document
        const line = Math.min(pos.line, editor.document.lineCount - 1);
        const maxCol = editor.document.lineAt(line).text.length;
        const col = Math.min(pos.col, maxCol);
        return new vscode.Selection(line, col, line, col);
      });

    if (newSelections.length > 0) {
      editor.selections = newSelections;
    }

    // Save to history on success
    await commandHistory.addToHistory(command);
  } catch (error) {
    if (error instanceof NeovimNotFoundError) {
      const action = await vscode.window.showErrorMessage(
        error.message,
        "Install Neovim",
        "OK"
      );
      if (action === "Install Neovim") {
        vscode.env.openExternal(vscode.Uri.parse("https://neovim.io"));
      }
    } else if (error instanceof ExCommandError) {
      vscode.window.showErrorMessage(error.message);
    } else if (error instanceof NeovimFilterError) {
      vscode.window.showErrorMessage(error.message);
    } else {
      const message =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Unexpected error: ${message}`);
      console.error(error);
    }
  } finally {
    isExecuting = false;
  }
}
