const MUTATING_TOOLS = new Set(["write", "edit"]);

export class AutoCheckpointController {
  private dirty = false;
  private promptInFlight = false;

  observeTool(toolName: string, isError: boolean): void {
    if (!isError && (MUTATING_TOOLS.has(toolName) || toolName === "oh_my_task_checkpoint")) {
      if (toolName !== "oh_my_task_checkpoint") this.dirty = true;
    }
  }

  markTaskStateChanged(): void { this.dirty = true; }

  checkpointSucceeded(): void {
    this.dirty = false;
    this.promptInFlight = false;
  }

  /**
   * Returns true once for dirty work. The next settled event merely clears the
   * in-flight guard if the prompted agent did not checkpoint, preventing loops.
   */
  shouldRequestCheckpoint(hasActiveTask: boolean): boolean {
    if (!hasActiveTask || !this.dirty) return false;
    if (this.promptInFlight) {
      this.promptInFlight = false;
      return false;
    }
    this.promptInFlight = true;
    return true;
  }

  snapshot(): { dirty: boolean; promptInFlight: boolean } {
    return { dirty: this.dirty, promptInFlight: this.promptInFlight };
  }
}
