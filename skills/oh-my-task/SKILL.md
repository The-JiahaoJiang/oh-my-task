---
name: oh-my-task
description: Manage durable coding tasks, implementation plans, checkpoints, blockers, and cross-session context with oh-my-task-cli. Use when starting, resuming, checkpointing, switching, completing, archiving, validating, or importing a task.
compatibility: Requires Node.js and the oh-my-task-cli executable. Native session resumption is agent-specific; context resume works across agents.
---

# Oh My Task

Use the task Markdown file as the durable source of truth. Sessions are optional references, not the cross-agent data model.

## Safety Rules

1. Use `oh-my-task-cli` for structured mutations instead of rewriting generated fields by hand. If it is not on `PATH`, run `node <skill-directory>/cli.mjs` with the same arguments.
2. Read the task and note its `revision` before mutation.
3. Pass that revision as `baseRevision`; after `STALE_REVISION`, reload and merge before retrying.
4. Never force-unlock or force-complete without explicit user approval.
5. Never store credentials, environment values, secret-file contents, full transcripts, or raw tool output.
6. Load compact current context first. Read older checkpoint history only when needed.
7. If the latest session belongs to another agent, explain that native resume is unavailable and use task-context resume.

## CLI Invocation

Use `oh-my-task-cli` when it is available on `PATH`. Otherwise resolve this skill's directory and substitute `node <skill-directory>/cli.mjs` in every command below. Do not guess the package's installation root.

## Discover or Resume

```bash
oh-my-task-cli list --project "<approved-project-name>"
oh-my-task-cli show <task-id> --compact
```

Ask the user to approve the current folder name as the project name or provide another name. State that other user-wide tasks are hidden by the project filter.

To continue from context, read the full selected task only as needed:

```bash
oh-my-task-cli show <task-id>
```

Focus on Objective, Constraints, Plan, Current State, and Next Action.

## Create

When the user asks to create a task, provide the same workflow in every agent:

1. Ask for or infer a concise title.
2. Ask the user to approve the current folder name as the project name only when no workspace link can be found.
3. Clarify the objective and implementation plan collaboratively, or accept an existing plan file.
4. Preview the task before creating it.

Collaboratively clarify the objective and plan, or import an existing plan:

```bash
oh-my-task-cli new --title "<title>" --project "<project>" --objective "<objective>"
oh-my-task-cli new --title "<title>" --project "<project>" --plan ./PLAN.md
```

Show normalized imported content to the user before relying on it. Imported plans are copied, not synchronized.

After the user approves an imported plan, separately ask whether to review and update implementation progress. Only when approved:

1. Read the imported plan.
2. Identify directly related project files from its plan items.
3. Read only those related files to verify actual implementation state.
4. Compare verified evidence with every plan item.
5. Record completed, active, or blocked statuses through a checkpoint.
6. Treat ambiguous evidence as unresolved instead of guessing.

Do not inspect unrelated files or copy source content, secrets, environment values, or raw tool output into the task.

## Associate This Session

When the harness exposes a session ID:

```bash
oh-my-task-cli associate <task-id> \
  --base-revision <revision> \
  --agent "<pi|claude-code|codex-cli|kimi-cli|opencode|other>" \
  --session "<session-id>" \
  --cwd "$PWD"
```

If no session ID is available, continue without inventing one.

## Checkpoint

Review changes and create a small JSON input containing only durable facts:

```json
{
  "baseRevision": 3,
  "planItemStatuses": {
    "implement-parser": "completed",
    "add-tests": "in-progress"
  },
  "progress": "Parser implemented and unit tests started.",
  "files": [{ "path": "src/parser.ts", "note": "new parser" }],
  "decisions": ["Reject unknown schema versions."],
  "blockers": [],
  "nextAction": "Finish malformed-input tests.",
  "status": "in-progress"
}
```

Then run:

```bash
oh-my-task-cli checkpoint <task-id> --input /path/to/checkpoint.json
```

Delete temporary checkpoint files if they contain sensitive project details.

## Complete or Archive

```bash
oh-my-task-cli complete <task-id> --base-revision <revision>
oh-my-task-cli complete <task-id> --base-revision <revision> --force --reason "<user-approved reason>"
oh-my-task-cli archive <task-id> --base-revision <revision>
```

Normal completion requires all plan items to be complete.

## Validate and Recover

```bash
oh-my-task-cli validate
oh-my-task-cli rebuild-index
oh-my-task-cli import-inbox
oh-my-task-cli import-inbox --apply --project "<project>"
```

Preview inbox imports before `--apply`. If generated-region markers are missing, show the reconciliation preview and do not overwrite the index. Use `unlock ... --force` only after user approval and verification that no writer is active.
