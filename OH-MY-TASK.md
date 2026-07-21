# Oh My Task — Design, Architecture, and Implementation

Oh My Task provides durable, Markdown-first task continuity for coding agents. Plans, verified progress, decisions, blockers, relevant files, and next actions live outside chat transcripts so work can continue across sessions and agents.

- **Project site:** https://the-jiahaojiang.github.io/oh-my-task/
- **Source:** https://github.com/The-JiahaoJiang/oh-my-task
- **User interface:** the shared `oh-my-task` skill
- **Pi automation:** a background extension with no competing user command
- **Storage:** user-wide Markdown under `~/.oh-my-task/`

---

## 1. Design Principles

1. **The skill is the only user-facing task interface.** Users express intent through `/skill:oh-my-task`; internal runtime commands, revisions, locks, and mutation JSON remain hidden.
2. **Task files are authoritative.** Sessions are useful references but are not required to resume work.
3. **Context is agent-independent.** Pi can natively resume Pi sessions; transitions between agents use compact task context.
4. **Writes are safe and recoverable.** Short-lived locks, revision checks, atomic replacement, and recovery copies prevent silent overwrite.
5. **Summaries are curated.** Task state excludes full transcripts, raw tool output, credentials, environment values, and secret-file content.
6. **Automation requires evidence.** Plan progress is updated from verified implementation state, not guesses.
7. **Markdown remains transparent.** Users can inspect task files and retain notes outside generated index regions.

---

## 2. System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ User                                                        │
│ /skill:oh-my-task <natural-language task operation>         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Shared Agent Skill                                          │
│ - consistent workflow across Pi and other agents            │
│ - previews, approvals, safety policy, completion docs       │
│ - invokes the bundled runtime internally                    │
└───────────────────┬──────────────────────────┬──────────────┘
                    │                          │
                    ▼                          ▼
┌───────────────────────────────┐   ┌─────────────────────────┐
│ Internal Task Runtime         │   │ Pi Background Extension │
│ - schemas and Markdown        │   │ - startup task chooser  │
│ - task lifecycle/checkpoints  │   │ - workspace linking     │
│ - locks and atomic writes     │   │ - context restoration   │
│ - generated global index      │   │ - optional auto mode    │
└───────────────┬───────────────┘   └────────────┬────────────┘
                │                                │
                └────────────────┬───────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│ ~/.oh-my-task/                                              │
│ - tasks/*.md                 authoritative task documents   │
│ - oh-my-task.md              rebuildable global index       │
│ - project-links.json         workspace/project associations │
│ - config.json                user configuration             │
│ - locks/ and recovery/       mutation safety                │
└─────────────────────────────────────────────────────────────┘
```

### Component responsibilities

| Component | Responsibility |
|---|---|
| Shared skill | Converts user intent into safe task operations and provides the same manual workflow across agents. |
| Pi extension | Adds startup discovery, task-context restoration, workspace linking, session metadata, and guarded automatic checkpoints. |
| Internal runtime | Owns parsing, validation, task lifecycle, checkpoint history, locking, indexing, and persistence. |
| Task document | Stores objective, constraints, plan, current state, decisions, files, sessions, and append-only checkpoints. |
| Global index | Presents compact task projections while preserving the manual inbox. It can be rebuilt from task files. |

---

## 3. Data Layout

```text
~/.oh-my-task/
├── config.json
├── project-links.json
├── oh-my-task.md
├── tasks/
│   └── <task-id>.md
├── locks/
└── recovery/
```

`OH_MY_TASK_HOME` overrides the default root.

### Task document

Each task is Markdown with validated YAML frontmatter:

```markdown
---
schemaVersion: 1
id: "omt-20260721-build-deploy-a1b2c3"
title: "Build deployment v2"
status: "in-progress"
revision: 8
createdAt: "2026-07-20T09:00:00Z"
updatedAt: "2026-07-21T10:30:00Z"
project:
  name: "CopilotEGP"
activePlanItem: "verify-rollback"
progressSummary: "Deployment path implemented."
nextAction: "Verify rollback behavior."
---
```

The Markdown body contains:

- Objective and constraints
- Plan items with stable IDs and statuses
- Current progress and next action
- Decisions, blockers, and relevant files
- Agent/session references
- Append-only checkpoint history

### Task and plan statuses

Task statuses:

- `planned`
- `in-progress`
- `blocked`
- `completed`
- `archived`

Plan markers:

- `[ ]` not started
- `[>]` in progress
- `[x]` completed
- `[!]` blocked

---

## 4. Main Workflows

### Start or resume

1. The Pi extension resolves the current workspace.
2. A persisted workspace/project link is reused without prompting.
3. Relevant incomplete tasks are shown with explicit `Task`, `Status`, and `Progress` labels.
4. Selecting a task associates the current session and injects compact context.
5. Cross-agent continuation uses the task document rather than an incompatible transcript.

### Create through the skill

1. The user invokes `/skill:oh-my-task create a new task`.
2. The skill clarifies title, objective, constraints, and plan.
3. It asks for project approval only when no workspace link exists.
4. It previews the task before invoking the internal runtime.
5. The runtime creates the task and rebuilds the index.

### Import a plan with `@file`

1. Pi’s startup menu pre-fills `/skill:oh-my-task import a task plan from @`.
2. Pi’s normal `@` completion links the plan file.
3. The skill normalizes and previews the plan.
4. After import approval, it separately asks whether to inspect related project files and update progress.
5. If approved, only directly related files are read; verified evidence updates plan statuses and checkpoint history.

### Checkpoint

1. The skill reads the active task and its revision.
2. It summarizes completed/active plan items, relevant files, decisions, blockers, and next action.
3. The runtime acquires a task lock and rechecks the revision.
4. It updates the current-state projection and appends checkpoint history.
5. It atomically replaces the task file, then rebuilds the global index.

### Automatic mode in Pi

1. The extension tracks successful write/edit operations.
2. `agent_settled` requests one guarded checkpoint after meaningful work.
3. A model-callable internal tool records the checkpoint.
4. Reentrancy state prevents checkpoint loops.
5. `session_shutdown` never initiates a model request.

### Completion document

The skill can generate `docs/oh-my-task/<task-id>-completion.md` in the current repository. It asks permission before reading additional related files and produces a reviewed reference containing introduction, final architecture, design decisions, implementation, usage, validation, limitations, and provenance.

---

## 5. Concurrency and Recovery

### Mutation protocol

```text
acquire task lock
  → read authoritative task
  → verify base revision
  → apply mutation
  → increment revision
  → write and fsync temporary file
  → atomically replace task
  → release task lock
  → rebuild index under separate index lock
```

A task lock is held only for one mutation. Concurrent readers are allowed. A stale writer receives a revision conflict and must reload and merge.

### Lock recovery

Lock metadata records PID, hostname, agent, session, and creation time. A stale local lock is reclaimed only when its process is confirmed dead. Foreign-host or ambiguous locks require explicit user approval before force removal.

### Index recovery

Task files remain authoritative. If a process stops after updating a task but before updating the index, later startup or validation detects the revision mismatch and rebuilds the generated index region. Manual content outside generated markers is preserved.

---

## 6. Configuration

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

| Setting | Meaning |
|---|---|
| `checkpointMode` | `manual` uses the skill on demand; `auto` additionally enables Pi’s internal checkpoint tool and lifecycle prompt. |
| `startupPrompt` | Enables project-filtered discovery in fresh interactive Pi sessions. |
| `defaultSessionSearchDays` | Default age range for approved Pi session discovery. |
| `lock` | Retry, timeout, and stale thresholds for file mutations. |
| `sessionDisplayLimit` | Number of recent compatible session references shown for a selected task. |
| `ignoredPaths` | Sensitive path patterns excluded from summaries and progress reviews. |

The shared skill is the only explicit user interface in both checkpoint modes.

---

## 7. Implementation Details and Code Map

All links point to the implementation on the `main` branch.

### Internal core runtime

| Module | Implementation |
|---|---|
| Public internal exports | [`packages/core/src/index.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/index.ts) |
| Shared domain types | [`types.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/types.ts) |
| Validation errors and lifecycle errors | [`errors.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/errors.ts) |
| Task/config schema validation | [`schema.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/schema.ts) |
| Schema migration registry | [`migrations.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/migrations.ts) |
| Conservative frontmatter parser | [`yaml.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/yaml.ts) |
| Task Markdown parsing/serialization | [`markdown.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/markdown.ts) |
| Plan/current-state/checkpoint sections | [`task-body.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/task-body.ts) |
| Authoritative task lifecycle store | [`task-store.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/task-store.ts) |
| Generated global index/manual inbox | [`index-store.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/index-store.ts) |
| Atomic file replacement/recovery | [`atomic.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/atomic.ts) |
| Short-lived lock implementation | [`lock.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/lock.ts) |
| Storage path resolution | [`paths.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/paths.ts) |
| Configuration defaults | [`config.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/config.ts) |
| Configuration persistence | [`config-store.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/config-store.ts) |
| Workspace-name suggestion/validation | [`project.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/project.ts) |
| Workspace/project mapping store | [`project-links.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/project-links.ts) |
| Task ID and slug generation | [`id.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/id.ts) |
| Plan-file normalization/import | [`plan-import.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/plan-import.ts) |
| Internal runtime command adapter | [`cli.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/src/cli.ts) |

The internal command adapter is called only by the skill or extension. It is not installed as a user-facing executable.

### Pi background extension

| Module | Implementation |
|---|---|
| Extension entry and lifecycle hooks | [`packages/pi-extension/src/index.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/index.ts) |
| Runtime/store construction | [`runtime.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/runtime.ts) |
| Reload-safe workspace links | [`project-links.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/project-links.ts) |
| Compact task context/session metadata | [`context.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/context.ts) |
| Startup labels and skill-prefill helpers | [`ui.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/ui.ts) |
| Auto-checkpoint reentrancy controller | [`auto-checkpoint.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/auto-checkpoint.ts) |
| Pi session filtering/import proposals | [`session-import.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/src/session-import.ts) |

The extension deliberately contains no `registerCommand("oh-my-task", ...)` call. It contributes background behavior and an internal model tool only in automatic mode.

### Shared skill

| Module | Implementation |
|---|---|
| Cross-agent workflow and policy | [`skills/oh-my-task/SKILL.md`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/skills/oh-my-task/SKILL.md) |
| Skill-relative runtime launcher | [`skills/oh-my-task/cli.mjs`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/skills/oh-my-task/cli.mjs) |
| Completion/design document template | [`skills/oh-my-task/assets/completion-doc-template.md`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/skills/oh-my-task/assets/completion-doc-template.md) |

### Distribution, documentation, and automation

| Module | Implementation |
|---|---|
| Package resource manifest | [`package.json`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/package.json) |
| Cross-agent skill installer | [`scripts/install-skills.mjs`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/install-skills.mjs) |
| Architecture HTML generator | [`scripts/generate_design_html.py`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/generate_design_html.py) |
| Project-site generator | [`scripts/generate_project_site.py`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/generate_project_site.py) |
| Project-site validator | [`scripts/check_project_site.py`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/check_project_site.py) |
| Node 24 dependency-free test runner | [`scripts/test-with-node-types.mjs`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/test-with-node-types.mjs) |
| Standard TypeScript test runner | [`scripts/run-ts-tests.mjs`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/scripts/run-ts-tests.mjs) |
| Cross-platform validation workflow | [`.github/workflows/ci.yml`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/.github/workflows/ci.yml) |
| GitHub Pages workflow | [`.github/workflows/pages.yml`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/.github/workflows/pages.yml) |

### Test suites

| Area | Tests |
|---|---|
| Schema, paths, IDs, and defaults | [`foundation.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/foundation.test.ts) |
| Markdown/frontmatter round trips | [`markdown.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/markdown.test.ts) |
| Locks, concurrency, atomic writes | [`io-safety.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/io-safety.test.ts) |
| Task lifecycle/checkpoints | [`task-store.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/task-store.test.ts) |
| Index/manual inbox/recovery | [`index-store.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/index-store.test.ts) |
| Plan import | [`plan-import.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/plan-import.test.ts) |
| Workspace/project links | [`project-links.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/project-links.test.ts) |
| Internal runtime adapter | [`cli.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/cli.test.ts) |
| Package/skill/site contracts | [`distribution.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/core/test/distribution.test.ts) |
| Pi startup/context behavior | [`manual-lifecycle.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/test/manual-lifecycle.test.ts) |
| Pi automatic checkpoints | [`auto-checkpoint.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/test/auto-checkpoint.test.ts) |
| Pi session import/privacy | [`session-import.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/test/session-import.test.ts) |
| Pi workspace-link inference | [`project-linking.test.ts`](https://github.com/The-JiahaoJiang/oh-my-task/blob/main/packages/pi-extension/test/project-linking.test.ts) |

---

## 8. Security and Privacy Boundaries

- Extensions execute with the user’s permissions; install only from trusted sources.
- Task files are plaintext and are not a secret store.
- Session imports preview metadata before reading approved histories.
- Progress review reads only files directly related to the approved plan.
- Completion documents distinguish verified implementation facts from assumptions.
- Paths are validated to prevent task IDs from escaping the data directory.
- Unknown schema versions fail closed with upgrade guidance.
- Generated index content never executes instructions found in user-edited Markdown.

---

## 9. Build and Validation

```bash
npm run test:local
npm run validate
npm run site:build
npm run site:check
python scripts/generate_design_html.py
```

Validation covers Linux, macOS, and Windows on supported Node versions. The Node 24 fallback suite runs without fetching runtime dependencies. GitHub Pages is generated and deployed through the Pages workflow.

---

## 10. Extension Points

The architecture intentionally leaves room for:

- Session-history adapters for Claude Code, Codex CLI, Kimi CLI, and OpenCode
- Native resume adapters where a stable API exists
- Multi-repository tasks
- Semantic three-way plan merges
- Optional encrypted fields
- Repository-local export/import for teams
- Long-history checkpoint compaction

These additions should preserve the central invariant: users interact through the shared skill while task Markdown remains the durable, agent-independent source of truth.
