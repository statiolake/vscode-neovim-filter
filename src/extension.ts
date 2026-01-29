import * as vscode from "vscode";
import { NeovimClient } from "./neovim/client";
import { CommandHistory } from "./ui/commandHistory";
import { runExCommand } from "./commands/runExCommand";

let neovimClient: NeovimClient;
let commandHistory: CommandHistory;

export function activate(context: vscode.ExtensionContext) {
  neovimClient = new NeovimClient();
  commandHistory = new CommandHistory(context.globalState);

  const runExCommandDisposable = vscode.commands.registerCommand(
    "neovimFilter.runExCommand",
    () => runExCommand(neovimClient, commandHistory)
  );

  const clearHistoryDisposable = vscode.commands.registerCommand(
    "neovimFilter.clearHistory",
    async () => {
      await commandHistory.clearHistory();
      vscode.window.showInformationMessage("Command history cleared");
    }
  );

  context.subscriptions.push(runExCommandDisposable, clearHistoryDisposable);
}

export function deactivate() {}
