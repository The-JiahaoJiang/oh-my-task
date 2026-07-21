# Oh My Task — Final Design and Implementation Plan

## 1. Purpose

Oh My Task is a user-wide task continuity system for coding agents. It keeps durable, agent-independent implementation plans and progress summaries outside individual chat sessions, while retaining session references for optional native resumption.

The first release consists of:

1. A **Pi extension** for startup/resume UI, repository filtering, Pi session integration, and automatic checkpoint support.
2. A portable **`oh-my-task-cli`** package that owns storage, validation, locking, indexing, and task mutations.
3. An **Agent Skills-compatible `oh-my-task` skill** for Pi manual mode and other compatible coding agents, including Claude Code, Codex CLI, Kimi CLI, and OpenCode.

Task files—not chat sessions—are the source of truth for cross-agent continuity.

---

## 2. Goals

- Maintain a user-wide index of coding tasks.
- Keep one dedicated Markdown file per task.
- Resume work either through a compatible Pi session or by loading compact task context into a new/current session.
- Filter task discovery to the current repository or selected working directory.
- Track implementation-plan progress, edited files, decisions, unresolved issues, and blockers.
- Support manual and automatic checkpoint modes in Pi.
- Permit transparent human editing without requiring an opaque database.
- Safely serialize concurrent writes from multiple agent sessions.
- Import task context from selected Pi sessions in v1.
- Keep the durable format agent-independent.

## 3. Non-goals for v1

- Parsing or natively resuming Claude Code, Codex CLI, Kimi CLI, or OpenCode session histories.
- Treating session transcripts as the durable source of truth.
- Synchronizing a task with an imported plan file after the initial import.
- Copying full transcripts or raw tool output into task files.
- Encrypting task data at rest.
- Multi-repository tasks.
- Fully transactional updates across both a task file and the derived index. The index is recoverable and eventually consistent.

---

## 4. Terminology

- **Task:** A durable unit of work with an objective, implementation plan, current state, and checkpoint history.
- **Checkpoint:** An accepted progress update associated with one or more plan items.
- **Current-state projection:** The compact task summary derived from the plan and accepted checkpoints.
- **Session reference:** Agent name, session ID, working directory, and timestamps retained for traceability or native resumption.
- **Context resume:** Continue in the current/new session by injecting compact task context rather than loading an old transcript.
- **Project name:** A user-approved name used to associate and filter tasks. The current folder name is offered as the default.

---

## 5. Storage Layout

Default root:

```text
~/.oh-my-task/
├── oh-my-task.md
├── config.json
├── tasks/
│   └── <task-id>.md
├── locks/
└── recovery/
```

The environment variable `OH_MY_TASK_HOME` overrides the root.

### Responsibilities

- `oh-my-task.md`: Human-readable global index and manual initialization inbox.
- `config.json`: User-wide behavior and safety configuration.
- `tasks/*.md`: Authoritative task records.
- `locks/`: Short-lived per-task and index lock files/directories.
- `recovery/`: Recovery copies produced when a write cannot be safely completed.

All durable text files use UTF-8 and normalized LF line endings when written by the CLI.

---

## 6. Project Name and Filtering

Use the current working directory's folder name as the only automatic project-name suggestion. Do not inspect Git metadata, remotes, parent repositories, or neighboring folders.

When task management starts:

1. Read the basename of Pi's `ctx.cwd`.
2. Offer that folder name to the user for approval.
3. Let the user enter a different project name instead.
4. Use the approved name to associate and filter tasks.

### Filtering message

Whenever tasks are filtered, Pi must show a fixed, explicit hint such as:

> Showing incomplete tasks associated with `<project>`. Other user-wide tasks are hidden by the current-project filter.

Incomplete means `planned`, `in-progress`, or `blocked`.

---

## 7. Task Data Model

Each task file combines structured YAML frontmatter with readable Markdown.

```markdown
---
schemaVersion: 1
id: omt-20260327-auth-refactor
title: Refactor authentication
status: in-progress
revision: 7
createdAt: 2026-03-25T09:00:00Z
updatedAt: 2026-03-27T10:30:00Z
project:
  name: my-app
activePlanItem: replace-token-validation
progressSummary: New validator implemented; integration tests remain.
nextAction: Update middleware and run authentication tests.
latestSession:
  agent: pi
  sessionId: 00000000-0000-0000-0000-000000000000
  cwd: /work/my-app
  updatedAt: 2026-03-27T10:30:00Z
sourcePlan:
  path: /work/my-app/PLAN.md
  importedAt: 2026-03-25T09:05:00Z
---

# Refactor authentication

## Objective

...

## Constraints

...

## Plan

- [x] **inspect-legacy-paths** — Identify legacy authentication paths
- [>] **replace-token-validation** — Replace token validation
- [ ] **update-middleware** — Update middleware
- [ ] **integration-tests** — Run integration tests

## Current State

### Progress
...

### Next Action
...

### Decisions
- ...

### Blockers and Unresolved Issues
- ...

### Relevant Files
- `src/auth/validator.ts` — edited; new validator

## Sessions

- Pi — `<session-id>` — `<cwd>` — last used `<timestamp>`

## Checkpoint History

### Checkpoint 7 — 2026-03-27T10:30:00Z

- **Plan item:** `replace-token-validation`
- **Status:** in progress
- **Progress:** ...
- **Files:** ...
- **Decisions:** ...
- **Blockers:** ...
- **Agent/session:** Pi / `<session-id>`
```

### Task statuses

- `planned`
- `in-progress`
- `blocked`
- `completed`
- `archived`

### Plan-item markers

- `[ ]` not started
- `[>]` in progress
- `[x]` completed
- `[!]` blocked

### Association invariants

- One session is associated with at most one task.
- One task may have many sessions and agents.
- Only one task is active in a given session.
- Switching a session to another task is explicit.
- Session references are optional for task continuity; the task file is sufficient.

---

## 8. Checkpoint Semantics

A checkpoint updates both a compact projection and append-only history.

### Required checkpoint content

- Plan item(s) affected.
- Completed plan items.
- Progress for active plan items.
- Edited/relevant files and their role.
- Final decisions made since the prior checkpoint.
- Current status.
- Unresolved issues and blockers for ongoing items.
- Next actionable step.
- Agent name and session ID when available.

### Projection versus history

- Plan statuses and `Current State` are updated in place.
- Every accepted checkpoint is appended under `Checkpoint History`.
- The frontmatter projection is updated for fast listing and index generation.
- The global index never contains full checkpoint history.

### Conflict behavior

Every proposed mutation includes the revision observed by the caller. After acquiring the lock, the CLI re-reads the task:

- If the revision still matches, apply the mutation.
- If it changed, return a structured stale-revision conflict.
- The agent/user must reload and merge against the latest task.
- Never silently overwrite incompatible plan/status changes.
- If a failure occurs during replacement, preserve recovery material in `recovery/`.

### Completion

A task may normally be completed only when no plan item remains incomplete or blocked. A user may force completion with an explicit reason, which is recorded as a final checkpoint.

---

## 9. Concurrency and File Safety

v1 supports multiple sessions reading and updating the same task. Mutations are serialized with short-lived locks; tasks are not locked for the lifetime of a session.

### Lock policy

- Use one atomic per-task lock for task mutations.
- Use a separate index lock for index writes/rebuilds.
- Lock metadata includes PID, hostname, agent, session ID, and creation time.
- Retry for a configurable bounded interval when a lock is busy.
- Reclaim a local stale lock only after verifying its PID is dead.
- Otherwise require explicit user confirmation or an explicit force-unlock operation.
- Use temp-file write, flush/close, and atomic replacement.
- Increment `revision` on every accepted task mutation.

### Deadlock avoidance

Do not hold a task lock while waiting for the index lock. The operation order is:

1. Lock, validate, and atomically update the task.
2. Release the task lock.
3. Snapshot task projections.
4. Lock and regenerate the index region.
5. Release the index lock.

A crash between steps 2 and 4 may leave a stale index, but never loses the authoritative task update. Startup and subsequent CLI operations detect and repair this condition.

---

## 10. Global Index

`oh-my-task.md` is transparent and human-editable. It has a manual inbox and a generated region:

```markdown
# Oh My Task

## Manual Inbox

Users may add task ideas, plans, or initialization notes here.

<!-- OH-MY-TASK:GENERATED:START -->
## Active Tasks

### Refactor authentication

- Status: In progress
- Project: my-app
- Progress: New validator implemented; integration tests remain.
- Current item: Replace token validation
- Next: Update middleware and run authentication tests
- Updated: 2026-03-27 10:30
- Latest session: pi/00000000-0000-0000-0000-000000000000
- Task file: `tasks/omt-20260327-auth-refactor.md`

<!-- OH-MY-TASK:GENERATED:END -->
```

### Rules

- The CLI preserves all content outside the generated markers.
- It regenerates only the marked region from authoritative task projections.
- The index displays only the latest session reference for each task.
- Selecting a task shows up to three recent compatible session references.
- Manual-inbox entries can be validated and converted into dedicated tasks after user preview and approval.
- If generated markers are absent, validate the entire document and show a reconciliation preview before modifying it.
- Existing-task edits made only in the index are never silently applied to task files.
- Store enough revision metadata in the generated region (possibly as HTML comments) to detect a stale index without cluttering the visible document.

---

## 11. Configuration

Proposed `config.json`:

```json
{
  "schemaVersion": 1,
  "checkpointMode": "manual",
  "startupPrompt": true,
  "defaultSessionSearchDays": 30,
  "lock": {
    "retryMs": 250,
    "timeoutMs": 5000,
    "staleAfterMs": 300000
  },
  "sessionDisplayLimit": 3,
  "ignoredPaths": [
    "**/.env*",
    "**/*secret*",
    "**/*credential*",
    "**/.ssh/**"
  ]
}
```

`checkpointMode` is `manual` or `auto`. Startup prompting is independently configurable.

Configuration validation must reject unknown schema versions and report invalid values with actionable messages.

---

## 12. Pi Extension

### Always-enabled responsibilities

The extension remains active in both manual and auto modes to provide:

- Current-folder project-name suggestion and user approval.
- Project-filtered startup task discovery.
- New-task/resume chooser.
- Session-to-task association.
- Compact context injection.
- `/oh-my-task` UI and lifecycle commands.
- Pi session search/import initialization.
- Index consistency checks on startup.

### Startup behavior

On `session_start`:

1. Skip dialogs in print and JSON modes.
2. Suggest the current folder name and obtain the user's approved project name.
3. Check for an existing task association in the Pi session.
4. If associated, validate the task and load its compact context automatically.
5. Otherwise, when startup prompting is enabled, list relevant incomplete tasks and show the fixed filtering hint.
6. Offer:
   - Create a new task.
   - Select an incomplete task.
   - Continue without a task.
7. After task selection, show:
   - Up to three recent resumable Pi sessions.
   - **Continue in current session from task context.**
8. Add the current session reference only after association succeeds.

A resumed Pi session already mapped to a task does not show the chooser again.

### Resume behavior

- Selecting a compatible Pi session uses Pi's native session-switch API.
- Context resume stays in the current session and injects the compact task projection.
- If the latest task activity belongs to another agent, show an agent-switch notice and offer context resume only.
- Other-agent session IDs are informational and are never passed to Pi's native resume mechanism.

### Compact context injection

Inject only:

- Objective and constraints.
- Current plan and statuses.
- Latest checkpoint relevant to the active item.
- Current decisions and blockers.
- Next action.
- Relevant-file list.

Older checkpoint history is loaded only on demand.

### `/oh-my-task` command

Default invocation displays the same project-filtered information as startup. Proposed subcommands:

```text
/oh-my-task
/oh-my-task list
/oh-my-task new
/oh-my-task resume
/oh-my-task switch
/oh-my-task checkpoint
/oh-my-task complete
/oh-my-task archive
/oh-my-task init
/oh-my-task validate
/oh-my-task rebuild-index
/oh-my-task unlock
```

Interactive operations use Pi's UI APIs. Non-interactive invocations produce concise text or actionable errors without attempting dialogs.

### Session association persistence

Record the association in both places:

- Task file session references: durable cross-agent metadata.
- A Pi custom session entry: fast, branch-aware detection when resuming a Pi session.

The external task file remains authoritative if the two disagree; reconciliation requires confirmation when ambiguity could change the active task.

---

## 13. Pi Manual Mode

In manual mode:

- The extension still provides startup, filtering, association, context resume, and `/oh-my-task` UI.
- Automatic lifecycle checkpoint prompting is disabled.
- The Agent Skill is available as `/skill:oh-my-task`.
- The skill tells Pi to inspect current task state and call `oh-my-task-cli` for explicit checkpoint or lifecycle operations.
- Direct Markdown edits are allowed, but the next CLI operation validates schema and revisions before proceeding.

---

## 14. Pi Auto Mode

### Model-callable tool

The extension registers an auto-mode checkpoint tool, for example `oh_my_task_checkpoint`, with structured fields for:

- Base revision.
- Affected plan-item IDs and status changes.
- Progress summary.
- Edited/relevant files.
- Decisions.
- Blockers/unresolved issues.
- Next action.
- Proposed task status.

The tool delegates all mutation logic to the same core used by `oh-my-task-cli`.

### Lifecycle hooks

- Track file mutation signals during the agent run.
- At `agent_settled`, if an active task has meaningful uncheckpointed work, queue one guarded follow-up asking the agent to call the checkpoint tool.
- A reentrancy guard prevents checkpoint loops.
- Clear dirty state only after a successful checkpoint.
- At `session_shutdown`, flush already-collected non-semantic state and release resources; do not initiate another model call.

### Meaningful-work detection

Trigger when at least one is true:

- Built-in or extension file-write/edit tools changed files.
- Git status/diff indicates repository changes since the last checkpoint.
- Task/plan state changed.
- The agent explicitly identified a durable decision or blocker.

Pure discussion does not force an automatic checkpoint unless it produced a durable decision/blocker. Non-Git changes made indirectly through arbitrary shell commands may not be mechanically detectable; the agent can still call the tool explicitly.

---

## 15. New Task Flow

1. User selects **New task**.
2. Ask for title and optional initial objective.
3. Ask the user to choose:
   - Develop the implementation plan collaboratively with the agent.
   - Import an existing plan file.
4. Create a minimal `planned` task and associate the current session.
5. For collaborative planning, inject a prompt directing the agent to clarify scope and develop the plan with the user.
6. Save the approved plan as the first checkpoint.

### Existing plan import

- Read the plan once.
- Normalize it into the task schema.
- Show the proposed objective, constraints, and plan for approval.
- Copy approved content into the dedicated task file.
- Retain the original path and import timestamp as provenance.
- Do not maintain a live link or synchronize later changes.

---

## 16. Session-Based Initialization (Pi Only in v1)

When `/oh-my-task init` finds no task data, ask whether to search Pi session history.

### Filters

Users may narrow candidates with any combination of:

- Keywords.
- Date/day range.
- Repository or directory path.

Use Pi's structured session APIs (`SessionManager.list`/`listAll`) rather than filesystem-name assumptions where possible.

### Flow

1. Search metadata first; do not immediately read full transcripts.
2. Display candidate session name/ID, date, working directory, and a brief safe preview.
3. Let the user select sessions.
4. Let the user group selected sessions into one task or choose one task per session.
5. Analyze only approved sessions.
6. Propose task titles, objectives, plans, decisions, progress, blockers, next steps, and session references.
7. Show a preview.
8. Create task/index files only after explicit approval.
9. Read the resulting index and display initialized task information.

Raw transcripts and full tool output are not copied into task files.

---

## 17. `oh-my-task-cli`

The npm package and shared core are named **`oh-my-task-cli`**. The Pi extension imports its core API; skills invoke its executable.

Proposed CLI surface:

```text
oh-my-task-cli list [--project NAME] [--status STATUS]
oh-my-task-cli show <task-id> [--compact]
oh-my-task-cli new [--title TITLE] [--objective TEXT] [--plan FILE]
oh-my-task-cli associate <task-id> --agent NAME --session ID --cwd PATH
oh-my-task-cli checkpoint <task-id> --input FILE|--json JSON
                                    --base-revision N
oh-my-task-cli switch <task-id> --agent NAME --session ID
oh-my-task-cli complete <task-id> [--force --reason TEXT]
oh-my-task-cli archive <task-id>
oh-my-task-cli init --agent pi [--keywords TEXT] [--days N] [--repo PATH]
oh-my-task-cli validate [<task-id>]
oh-my-task-cli rebuild-index
oh-my-task-cli import-inbox
oh-my-task-cli unlock <task-id|index> [--force]
```

### CLI output

- Human-readable output by default.
- `--json` for extension/skill integration.
- Stable error codes for lock busy, stale revision, validation failure, task not found, project mismatch, and unsupported session agent.
- Mutating commands return the new revision and updated compact projection.

---

## 18. Shared Agent Skill

Canonical package path:

```text
skills/oh-my-task/SKILL.md
```

Use Agent Skills-compatible frontmatter:

```yaml
---
name: oh-my-task
description: Manage durable coding tasks, implementation plans, checkpoints, blockers, and cross-session context with oh-my-task-cli. Use when starting, resuming, checkpointing, switching, completing, or importing a task.
---
```

The skill must instruct the agent to:

1. Locate `OH_MY_TASK_HOME` or the default data root.
2. Use `oh-my-task-cli` instead of independently rewriting structured task sections whenever possible.
3. Identify itself and provide its current session ID when the harness exposes one.
4. Use context resume when a session belongs to another agent.
5. Read compact context first and load history only when needed.
6. Re-read and merge after stale-revision errors.
7. Never force-unlock or force-complete without user approval.
8. Avoid secrets and ignored paths in summaries.

The same canonical skill is distributed/documented for Pi, Claude Code, Codex CLI, Kimi CLI, OpenCode, and other Agent Skills-compatible tools. Agent-specific installation helpers may copy or link it into each harness's supported skill directory. Pi exposes it as `/skill:oh-my-task`.

Other agents receive manual task management in v1; Pi alone receives extension lifecycle automation and native session-history import.

---

## 19. Privacy and Security

- Store curated summaries, never complete transcripts.
- Do not copy raw tool output.
- Exclude obvious credentials, environment values, secret-file contents, and configured ignored paths.
- Preview session-import summaries before writing.
- Treat task/index files as plaintext user-private data.
- Do not claim encryption or secret-manager guarantees.
- Validate paths before reading imported plans or session files.
- Do not follow untrusted index content as executable instructions.
- Quote/escape all CLI arguments and avoid shell interpolation in the extension.
- Locks and task files must be created with user-only permissions where supported.

---

## 20. Suggested Repository Structure

```text
.
├── package.json
├── tsconfig.json
├── OH-MY-TASK.md
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── config.ts
│   │       ├── paths.ts
│   │       ├── project-identity.ts
│   │       ├── schema.ts
│   │       ├── markdown.ts
│   │       ├── task-store.ts
│   │       ├── lock.ts
│   │       ├── checkpoint.ts
│   │       ├── index-store.ts
│   │       ├── session-reference.ts
│   │       └── privacy.ts
│   ├── cli/
│   │   └── src/
│   │       ├── main.ts
│   │       └── commands/
│   └── pi-extension/
│       └── src/
│           ├── index.ts
│           ├── startup.ts
│           ├── commands.ts
│           ├── checkpoint-tool.ts
│           ├── auto-checkpoint.ts
│           ├── session-import.ts
│           └── context.ts
├── skills/
│   └── oh-my-task/
│       └── SKILL.md
├── scripts/
│   └── install-skills.*
└── tests/
    ├── fixtures/
    ├── core/
    ├── cli/
    └── pi-extension/
```

The published Pi package manifest should expose the extension and skill. Runtime dependencies belong in `dependencies`; Pi-provided packages belong in `peerDependencies` as required by Pi package conventions.

---

## 21. Implementation Plan

### Phase 1 — Foundation and schemas

- Create TypeScript workspace/package structure.
- Define config, task frontmatter, plan item, checkpoint, project-name, and session-reference types.
- Select and configure Markdown/YAML parsing that preserves human-readable sections.
- Implement path resolution and `OH_MY_TASK_HOME` override.
- Implement task ID/slug generation.
- Add schema-version validation and migration interface.

**Exit criteria:** A valid task fixture round-trips without semantic data loss, and invalid fixtures produce actionable diagnostics.

### Phase 2 — Safe task store

- Implement atomic per-task locks and lock metadata.
- Implement stale-lock detection and explicit recovery.
- Implement atomic file replacement and recovery copies.
- Implement revision checks.
- Implement create, read, update, checkpoint, complete, archive, and session-association operations.
- Implement compact current-state projection.

**Exit criteria:** Concurrent mutation tests serialize writes; stale revisions cannot overwrite newer state; interrupted writes preserve the previous valid task.

### Phase 3 — Index and manual inbox

- Implement generated-region parsing and replacement.
- Preserve all content outside markers byte-for-byte where practical.
- Generate active/completed task projections with latest session only.
- Add revision metadata for stale-index detection.
- Implement index validation and rebuild.
- Implement manual-inbox parsing, validation, preview, and conversion.
- Handle missing markers through a no-write reconciliation preview.

**Exit criteria:** Index rebuilding is deterministic, preserves manual content, and recovers after a simulated crash between task and index writes.

### Phase 4 — CLI

- Implement the agreed command surface.
- Add human-readable and JSON output modes.
- Define stable exit/error codes.
- Add config initialization and validation.
- Add project filtering and fixed filtering message data.
- Add plan-file copy-and-normalize import.

**Exit criteria:** All task lifecycle operations work without Pi and are scriptable through JSON output.

### Phase 5 — Pi extension: manual lifecycle

- Package the extension according to Pi package conventions.
- Suggest the basename of `ctx.cwd` and ask the user to approve or replace the project name.
- Implement `session_start` association restoration and startup chooser.
- Use Pi custom entries for branch-aware session association metadata.
- Implement `/oh-my-task` and subcommands.
- Implement compact context injection.
- Implement native Pi session switching with replacement-session-safe APIs.
- Guard UI behavior by `ctx.mode`/`ctx.hasUI`.

**Exit criteria:** A user can create, associate, context-resume, native-resume, switch, checkpoint manually, and complete a task from Pi.

### Phase 6 — Pi session initialization

- List/search Pi sessions through supported session APIs.
- Filter by keyword, days, and repo path.
- Build safe metadata previews.
- Support selected-session grouping.
- Generate proposed task summaries/plans using the current Pi model or current agent workflow.
- Require preview approval before writing.
- Add privacy filtering and ignored-path handling.

**Exit criteria:** An empty installation can initialize approved tasks from selected Pi sessions without copying raw transcripts.

### Phase 7 — Pi automatic mode

- Register the structured checkpoint tool only when appropriate for auto mode.
- Track file mutations and repository changes.
- Implement guarded `agent_settled` follow-up behavior.
- Prevent recursive checkpoint loops.
- Flush non-semantic state and clean up on `session_shutdown`.
- Add status notifications for dirty, checkpointing, conflict, and success states.

**Exit criteria:** Meaningful work produces one checkpoint, pure idle/discussion does not create noise, stale revisions request a merge, and shutdown never starts an unsafe model call.

### Phase 8 — Shared skill and distribution

- Write the canonical Agent Skills-compatible `SKILL.md`.
- Add instructions for Pi manual mode and supported external harnesses.
- Add installation helpers/documentation without duplicating skill logic.
- Publish/package `oh-my-task-cli`, Pi extension, and skill together where practical.

**Exit criteria:** Pi manual mode and at least one non-Pi harness can manage the same task through `oh-my-task-cli` and context resume.

### Phase 9 — Hardening and release

- Test Windows, macOS, and Linux path/atomic-write behavior.
- Test current-folder name suggestions, user-approved replacements, and same-name project warnings.
- Test malformed Markdown, manual edits, missing markers, stale locks, dead PIDs, and recovery files.
- Test Pi new/resume/fork/reload/shutdown lifecycles.
- Document plaintext-data and concurrency behavior.
- Add migration and backup guidance.

**Exit criteria:** v1 acceptance scenarios pass and data remains recoverable under forced interruption tests.

---

## 22. Test Strategy

### Unit tests

- Schema validation and version rejection.
- Markdown/frontmatter parsing and rendering.
- Folder-name extraction and project-name validation.
- Revision conflict detection.
- Lock acquisition, timeout, and stale-owner checks.
- Generated-region replacement.
- Compact-context construction.
- Privacy/path filtering.

### Concurrency tests

- Two checkpoint writers for one task.
- Task update racing index rebuild.
- Process termination while holding a lock.
- Process termination between temp write and replacement.
- Stale base revision after lock acquisition.

### Pi integration tests

- Fresh session with relevant tasks.
- Fresh session without tasks.
- Resumed session with an association custom entry.
- Pi-native session switch.
- Cross-agent latest session forcing context resume.
- Auto checkpoint after file edits.
- No checkpoint loop after checkpoint-tool execution.
- Shutdown with and without uncheckpointed changes.
- Print/JSON modes never opening dialogs.

### Acceptance scenarios

1. Create a task collaboratively and save the approved plan.
2. Import an existing plan and verify no live synchronization.
3. Resume from one of three recent Pi sessions.
4. Continue from compact context in a new Pi session.
5. Switch from another agent to Pi using task context only.
6. Run two concurrent checkpoints without lost writes.
7. Manually add an inbox task and import it after preview.
8. Rebuild a stale/deleted index from task files.
9. Initialize tasks from filtered Pi sessions.
10. Complete a task normally and force-complete one with a recorded reason.

---

## 23. v2 Roadmap / TODO

- Add session-history adapters for Claude Code, Codex CLI, Kimi CLI, OpenCode, and other agents.
- Add native session resume adapters only where a harness provides a stable, documented mechanism.
- Improve semantic three-way merging for concurrent plan/status edits.
- Add multi-repository task support.
- Add optional repository-local export/import for team sharing.
- Add optional encrypted or secret-store-backed fields.
- Add richer checkpoint compaction for very long-lived tasks.
- Add optional file watchers for non-Git changes made outside known write tools.

---

## 24. Final Agreed Product Rules

1. Storage is user-wide and project-filtered at display time.
2. The current folder name is the only automatic project suggestion; the user approves it or enters another name.
3. Task Markdown files are authoritative; the index is a recoverable projection with a preserved manual inbox.
4. Checkpoints update current state and append durable history.
5. Concurrent writes are supported through short-lived locks plus revision checks.
6. One task may span many sessions and agents, but each session has at most one active task.
7. Cross-agent continuation relies on compact task context, not compatible session formats.
8. Pi supports native resumption only for compatible Pi sessions.
9. The index shows one latest session; task selection shows up to three recent compatible sessions and a context-resume option.
10. Manual mode uses the skill and `oh-my-task-cli`; Pi's extension still owns startup and task-selection UX.
11. Auto mode uses Pi lifecycle hooks and a model-callable checkpoint tool.
12. Shutdown never initiates a new semantic model call.
13. v1 imports Pi session history only; other session adapters are explicit v2 work.
14. Imported plans are copied and normalized, not live-linked.
15. Session imports and checkpoints store curated summaries, not transcripts, secrets, or raw tool output.
