import { spawn, ChildProcess } from "child_process";
import { attach, NeovimClient as NvimClient, findNvim } from "neovim";
import {
  NeovimNotFoundError,
  NeovimConnectionError,
  ExCommandError,
} from "../utils/errors";

export interface Position {
  line: number;
  col: number;
}

export interface ExecuteResult {
  lines: string[];
  cursorPositions: (Position | null)[];
}

export class NeovimClient {
  private nvimPath: string | null = null;

  async findNeovimPath(): Promise<string> {
    if (this.nvimPath) {
      return this.nvimPath;
    }

    const result = findNvim({ minVersion: "0.9.0" });
    if (!result.matches.length) {
      throw new NeovimNotFoundError();
    }
    this.nvimPath = result.matches[0].path;
    return this.nvimPath;
  }

  async execute(
    content: string[],
    command: string,
    cursorPositions: Position[]
  ): Promise<ExecuteResult> {
    const nvimPath = await this.findNeovimPath();

    let proc: ChildProcess | null = null;
    let nvim: NvimClient | null = null;

    try {
      proc = spawn(nvimPath, ["--embed", "--headless", "--clean"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      nvim = await attach({ proc });

      const buffer = await nvim.buffer;

      // Set buffer content
      await buffer.setLines(content, { start: 0, end: -1, strictIndexing: false });

      // Create namespace for extmarks
      const namespaceId = (await nvim.call("nvim_create_namespace", [
        "vscode-neovim-filter",
      ])) as number;

      // Set extmarks at cursor positions
      const markIds: number[] = [];
      for (const pos of cursorPositions) {
        const clampedLine = Math.min(pos.line, content.length - 1);
        const clampedCol = Math.min(
          pos.col,
          (content[clampedLine] || "").length
        );
        const id = (await nvim.call("nvim_buf_set_extmark", [
          buffer.id,
          namespaceId,
          clampedLine,
          clampedCol,
          { right_gravity: false },
        ])) as number;
        markIds.push(id);
      }

      // Execute the ex command
      try {
        await nvim.command(command);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ExCommandError(command, message);
      }

      // Get the result
      const lines = (await buffer.getLines({
        start: 0,
        end: -1,
        strictIndexing: false,
      })) as string[];

      // Get updated cursor positions from extmarks
      const newPositions: (Position | null)[] = [];
      for (const id of markIds) {
        try {
          const result = (await nvim.call("nvim_buf_get_extmark_by_id", [
            buffer.id,
            namespaceId,
            id,
            {},
          ])) as [number, number] | [];

          if (result.length === 2) {
            newPositions.push({ line: result[0], col: result[1] });
          } else {
            newPositions.push(null);
          }
        } catch {
          newPositions.push(null);
        }
      }

      return { lines, cursorPositions: newPositions };
    } catch (err) {
      if (
        err instanceof NeovimNotFoundError ||
        err instanceof ExCommandError
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new NeovimConnectionError(message);
    } finally {
      if (nvim) {
        try {
          await nvim.quit();
        } catch {
          // Ignore quit errors
        }
      }
      if (proc) {
        proc.kill();
      }
    }
  }

  async executeWithSelection(
    content: string[],
    command: string,
    selection: { startLine: number; endLine: number },
    cursorPositions: Position[]
  ): Promise<ExecuteResult> {
    const nvimPath = await this.findNeovimPath();

    let proc: ChildProcess | null = null;
    let nvim: NvimClient | null = null;

    try {
      proc = spawn(nvimPath, ["--embed", "--headless", "--clean"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      nvim = await attach({ proc });

      const buffer = await nvim.buffer;

      // Set buffer content
      await buffer.setLines(content, { start: 0, end: -1, strictIndexing: false });

      // Create namespace for extmarks
      const namespaceId = (await nvim.call("nvim_create_namespace", [
        "vscode-neovim-filter",
      ])) as number;

      // Set extmarks at cursor positions
      const markIds: number[] = [];
      for (const pos of cursorPositions) {
        const clampedLine = Math.min(pos.line, content.length - 1);
        const clampedCol = Math.min(
          pos.col,
          (content[clampedLine] || "").length
        );
        const id = (await nvim.call("nvim_buf_set_extmark", [
          buffer.id,
          namespaceId,
          clampedLine,
          clampedCol,
          { right_gravity: false },
        ])) as number;
        markIds.push(id);
      }

      // Set marks for '<,'> range (1-indexed for Vim)
      await nvim.command(`${selection.startLine + 1}mark <`);
      await nvim.command(`${selection.endLine + 1}mark >`);

      // Execute the ex command with range
      const rangeCommand = `'<,'>${command}`;
      try {
        await nvim.command(rangeCommand);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ExCommandError(rangeCommand, message);
      }

      // Get the result
      const lines = (await buffer.getLines({
        start: 0,
        end: -1,
        strictIndexing: false,
      })) as string[];

      // Get updated cursor positions from extmarks
      const newPositions: (Position | null)[] = [];
      for (const id of markIds) {
        try {
          const result = (await nvim.call("nvim_buf_get_extmark_by_id", [
            buffer.id,
            namespaceId,
            id,
            {},
          ])) as [number, number] | [];

          if (result.length === 2) {
            newPositions.push({ line: result[0], col: result[1] });
          } else {
            newPositions.push(null);
          }
        } catch {
          newPositions.push(null);
        }
      }

      return { lines, cursorPositions: newPositions };
    } catch (err) {
      if (
        err instanceof NeovimNotFoundError ||
        err instanceof ExCommandError
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new NeovimConnectionError(message);
    } finally {
      if (nvim) {
        try {
          await nvim.quit();
        } catch {
          // Ignore quit errors
        }
      }
      if (proc) {
        proc.kill();
      }
    }
  }
}
