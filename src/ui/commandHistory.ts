import * as vscode from "vscode";

const HISTORY_KEY = "neovimFilter.commandHistory";
const MAX_HISTORY_ITEMS = 50;

export class CommandHistory {
  constructor(private globalState: vscode.Memento) {}

  getHistory(): string[] {
    return this.globalState.get<string[]>(HISTORY_KEY, []);
  }

  async addToHistory(command: string): Promise<void> {
    const history = this.getHistory();

    // Remove if already exists (to move to front)
    const index = history.indexOf(command);
    if (index !== -1) {
      history.splice(index, 1);
    }

    // Add to front
    history.unshift(command);

    // Limit size
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }

    await this.globalState.update(HISTORY_KEY, history);
  }

  async clearHistory(): Promise<void> {
    await this.globalState.update(HISTORY_KEY, []);
  }
}
