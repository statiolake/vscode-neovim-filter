export class NeovimFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeovimFilterError";
  }
}

export class NeovimNotFoundError extends NeovimFilterError {
  constructor() {
    super(
      "Neovim not found. Please install Neovim (https://neovim.io) and ensure it is in your PATH."
    );
    this.name = "NeovimNotFoundError";
  }
}

export class NeovimConnectionError extends NeovimFilterError {
  constructor(details: string) {
    super(`Failed to connect to Neovim: ${details}`);
    this.name = "NeovimConnectionError";
  }
}

export class ExCommandError extends NeovimFilterError {
  constructor(command: string, vimError: string) {
    super(`Ex command "${command}" failed: ${vimError}`);
    this.name = "ExCommandError";
  }
}
