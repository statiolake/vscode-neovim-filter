import * as vscode from "vscode";
import { CommandHistory } from "./commandHistory";

export class CommandInput {
  constructor(private history: CommandHistory) {}

  async show(): Promise<string | undefined> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder =
      "Enter Neovim ex command (e.g., v/pattern/d, %s/foo/bar/g)";
    quickPick.matchOnDescription = true;

    // Populate with history
    const historyItems = this.history.getHistory();
    quickPick.items = historyItems.map((cmd, index) => ({
      label: cmd,
      description: index === 0 ? "(most recent)" : undefined,
    }));

    return new Promise<string | undefined>((resolve) => {
      quickPick.onDidAccept(() => {
        const value = quickPick.value || quickPick.selectedItems[0]?.label;
        quickPick.hide();
        resolve(value);
      });

      quickPick.onDidHide(() => {
        quickPick.dispose();
        resolve(undefined);
      });

      quickPick.show();
    });
  }
}
