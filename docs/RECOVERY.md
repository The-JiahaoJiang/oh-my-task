# Backup, Recovery, and Migration

## Back up

Oh My Task data is plaintext under `OH_MY_TASK_HOME` or `~/.oh-my-task`. Before upgrades or manual bulk edits, copy the entire directory while no writer is active.

```bash
cp -R "${OH_MY_TASK_HOME:-$HOME/.oh-my-task}" "${OH_MY_TASK_HOME:-$HOME/.oh-my-task}.backup"
```

Use an equivalent recursive copy command on Windows.

## Validate and rebuild

```bash
oh-my-task-cli validate
oh-my-task-cli rebuild-index
```

Task files are authoritative. Deleting and rebuilding `oh-my-task.md` does not delete task history, but preserve the Manual Inbox before deleting a hand-edited index.

## Interrupted writes

Failed candidate writes are copied to `recovery/`. Compare a recovery file with the authoritative task before applying any content. Never replace a task blindly.

## Locks

Locks normally disappear after each mutation. A stale local lock is reclaimed automatically only when its recorded process is dead. For foreign-host or ambiguous locks:

1. Verify no agent or CLI process is writing.
2. Back up the data directory.
3. Ask the user for explicit approval.
4. Run `oh-my-task-cli unlock <task-id|index> --force`.

## Schema migrations

Every config and task has `schemaVersion`. A newer unsupported version is rejected rather than guessed. Before a future migration:

1. Back up the complete data directory.
2. Upgrade `oh-my-task-cli`.
3. Run its documented migration command or compatibility release.
4. Run `validate` and inspect the index.
5. Keep the backup until tasks have been opened and checkpointed successfully.

v1 has no earlier schema and therefore performs no destructive migrations.

## Name collisions

Project filtering intentionally uses only the user-approved project name. If two folders should have separate task sets, give them distinct project names when prompted.
