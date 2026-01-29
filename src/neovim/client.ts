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

export interface CursorInfo {
  line: number;
  col: number;
  selection?: {
    startLine: number;
    endLine: number;
  };
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
    cursors: CursorInfo[]
  ): Promise<ExecuteResult> {
    const nvimPath = await this.findNeovimPath();

    let proc: ChildProcess | null = null;
    let nvim: NvimClient | null = null;

    try {
      proc = spawn(nvimPath, ["--embed", "--headless", "--clean"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      nvim = attach({ proc });

      const buffer = await nvim.buffer;

      // Set buffer content
      await buffer.setLines(content, { start: 0, end: -1, strictIndexing: false });

      // Create namespace for extmarks
      const namespaceId = (await nvim.call("nvim_create_namespace", [
        "vscode-neovim-filter",
      ])) as number;

      // For each cursor, create extmarks for:
      //   - cursor position
      //   - selection start/end (if selection exists)
      const cursorMarks: Array<{
        cursorMarkId: number;
        selStartMarkId?: number;
        selEndMarkId?: number;
        hasSelection: boolean;
      }> = [];

      for (const cursor of cursors) {
        const clampedLine = Math.min(cursor.line, content.length - 1);
        const clampedCol = Math.min(
          cursor.col,
          (content[clampedLine] || "").length
        );

        const cursorMarkId = (await nvim.call("nvim_buf_set_extmark", [
          buffer.id,
          namespaceId,
          clampedLine,
          clampedCol,
          { right_gravity: false },
        ])) as number;

        if (cursor.selection) {
          const startLine = Math.min(cursor.selection.startLine, content.length - 1);
          const endLine = Math.min(cursor.selection.endLine, content.length - 1);

          const selStartMarkId = (await nvim.call("nvim_buf_set_extmark", [
            buffer.id,
            namespaceId,
            startLine,
            0,
            { right_gravity: false },
          ])) as number;

          const selEndMarkId = (await nvim.call("nvim_buf_set_extmark", [
            buffer.id,
            namespaceId,
            endLine,
            (content[endLine] || "").length,
            { right_gravity: true },
          ])) as number;

          cursorMarks.push({
            cursorMarkId,
            selStartMarkId,
            selEndMarkId,
            hasSelection: true,
          });
        } else {
          cursorMarks.push({ cursorMarkId, hasSelection: false });
        }
      }

      // Execute the ex command at each cursor position
      for (const marks of cursorMarks) {
        // Get current cursor position from extmark
        const cursorPos = (await nvim.call("nvim_buf_get_extmark_by_id", [
          buffer.id,
          namespaceId,
          marks.cursorMarkId,
          {},
        ])) as [number, number];

        // Move cursor (1-indexed line, 0-indexed col)
        await nvim.call("nvim_win_set_cursor", [
          0,
          [cursorPos[0] + 1, cursorPos[1]],
        ]);

        let cmd = command;

        if (marks.hasSelection) {
          // Get current selection range from extmarks
          const selStart = (await nvim.call("nvim_buf_get_extmark_by_id", [
            buffer.id,
            namespaceId,
            marks.selStartMarkId,
            {},
          ])) as [number, number];

          const selEnd = (await nvim.call("nvim_buf_get_extmark_by_id", [
            buffer.id,
            namespaceId,
            marks.selEndMarkId,
            {},
          ])) as [number, number];

          // Set '< and '> marks (1-indexed)
          await nvim.command(`${selStart[0] + 1}mark <`);
          await nvim.command(`${selEnd[0] + 1}mark >`);

          cmd = `'<,'>${command}`;
        }

        try {
          await nvim.command(cmd);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new ExCommandError(cmd, message);
        }
      }

      // Get the result
      const lines = (await buffer.getLines({
        start: 0,
        end: -1,
        strictIndexing: false,
      })) as string[];

      // Get updated cursor positions from extmarks
      const newPositions: (Position | null)[] = [];
      for (const marks of cursorMarks) {
        try {
          const result = (await nvim.call("nvim_buf_get_extmark_by_id", [
            buffer.id,
            namespaceId,
            marks.cursorMarkId,
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
          nvim.quit();
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
