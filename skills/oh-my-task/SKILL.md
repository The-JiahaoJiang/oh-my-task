---
name: oh-my-task
description: Manage durable coding tasks, implementation plans, checkpoints, blockers, completion documents, and cross-session context. Use when starting, resuming, checkpointing, switching, completing, documenting, archiving, validating, or importing a task.
compatibility: Requires Node.js; the skill bundles its internal task runtime. Native session resumption is agent-specific; context resume works across agents.
---

# Oh My Task

Use the task Markdown file as the durable source of truth. Sessions are optional references, not the cross-agent data model.

## Safety Rules

1. Use the bundled task runtime for structured mutations instead of rewriting generated fields by hand. Invoke it internally through `node <skill-directory>/cli.mjs`; never ask the user to run it.
2. Read the task and note its `revision` before mutation.
3. Pass that revision as `baseRevision`; after `STALE_REVISION`, reload and merge before retrying.
4. Never force-unlock or force-complete without explicit user approval.
5. Never store credentials, environment values, secret-file contents, full transcripts, or raw tool output.
6. Load compact current context first. Read older checkpoint history only when needed.
7. If the latest session belongs to another agent, explain that native resume is unavailable and use task-context resume.

## Internal Runtime — Never Expose to Users

The commands in this skill are implementation instructions for the agent, not user-facing commands.

- Resolve this skill's directory and invoke `node <skill-directory>/cli.mjs <arguments>` through the agent's shell tool.
- Never ask the user to execute the runtime, prepare checkpoint JSON, track revisions, rebuild the index, or manage locks.
- Translate user requests into internal operations and present only meaningful choices, previews, approvals, progress, and results.
- Do not mention the internal package or executable unless diagnosing an installation failure.
- Do not guess the package installation root.

## Discover or Resume

```bash
node <skill-directory>/cli.mjs list --project "<approved-project-name>"
node <skill-directory>/cli.mjs show <task-id> --compact
```

Ask the user to approve the current folder name as the project name or provide another name. State that other user-wide tasks are hidden by the project filter.

To continue from context, read the full selected task only as needed:

```bash
node <skill-directory>/cli.mjs show <task-id>
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
node <skill-directory>/cli.mjs new --title "<title>" --project "<project>" --objective "<objective>"
node <skill-directory>/cli.mjs new --title "<title>" --project "<project>" --plan ./PLAN.md
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
node <skill-directory>/cli.mjs associate <task-id> \
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
node <skill-directory>/cli.mjs checkpoint <task-id> --input /path/to/checkpoint.json
```

Delete temporary checkpoint files if they contain sensitive project details.

## Generate a Completion and Design Document

When the user asks to "generate a completion doc", "document the completed task", or produce a final reference for the current task, create a self-contained document in the current repository. In Pi, an explicit invocation is:

```text
/skill:oh-my-task generate a completion document for the current task
```

Use the equivalent skill invocation or natural-language request in other agents.

### Resolve the current task

1. Use the active task ID from injected Oh My Task context when available.
2. Otherwise list incomplete and completed tasks for the approved project name.
3. If more than one task could be current, ask the user to select one; never guess.
4. Read the selected task, including its plan, current state, checkpoints, decisions, relevant files, and safe session references.

```bash
node <skill-directory>/cli.mjs show <task-id>
```

Use the skill-relative internal runtime described above.

### Verify implementation context

Ask for approval before reading repository files beyond those already examined in the current session. After approval:

- Start with files explicitly named in the task and plan.
- Follow only direct implementation references needed to explain the final design.
- Inspect tests and configuration needed to verify behavior.
- Do not scan unrelated areas of the repository.
- Never copy secrets, environment values, private credentials, raw tool output, or large source excerpts.
- Distinguish verified facts from assumptions. Ask the user about material gaps.

If the task is not completed, warn the user and ask whether to generate a clearly marked draft snapshot or complete the task first.

### Draft the document

Read [the completion document template](assets/completion-doc-template.md) and fill it with verified, task-specific information. The document must be useful to readers who did not participate in the task and include:

- Executive summary and complete introduction
- Problem context, intended users, goals, and non-goals
- Final outcome and deviations from the original plan
- Complete final design: architecture, components, data model, flows, interfaces, commands, configuration, safety, failure handling, and tradeoffs
- Implementation summary mapped to completed plan items
- Important files and their responsibilities
- Setup and usage examples
- Tests and validation that were actually run
- Limitations, unresolved issues, and follow-up work
- Task revision and safe provenance references

Do not present an original proposal as the final design when implementation evidence shows it changed.

### Choose the repository path and approve

Suggest this default path:

```text
docs/oh-my-task/<task-id>-completion.md
```

Allow the user to choose another path inside the current repository. Reject paths outside the repository. Before writing:

1. Show the proposed path.
2. Present a concise outline and any unresolved factual gaps.
3. Ask the user to approve or edit the draft.
4. Write only after approval.
5. Re-read the written file and report its path.

Do not mark or force-complete the task merely because a document was generated. Task completion remains a separate, explicit operation.

## Complete or Archive

```bash
node <skill-directory>/cli.mjs complete <task-id> --base-revision <revision>
node <skill-directory>/cli.mjs complete <task-id> --base-revision <revision> --force --reason "<user-approved reason>"
node <skill-directory>/cli.mjs archive <task-id> --base-revision <revision>
```

Normal completion requires all plan items to be complete.

## Validate and Recover

```bash
node <skill-directory>/cli.mjs validate
node <skill-directory>/cli.mjs rebuild-index
node <skill-directory>/cli.mjs import-inbox
node <skill-directory>/cli.mjs import-inbox --apply --project "<project>"
```

Preview inbox imports before `--apply`. If generated-region markers are missing, show the reconciliation preview and do not overwrite the index. Use `unlock ... --force` only after user approval and verification that no writer is active.
