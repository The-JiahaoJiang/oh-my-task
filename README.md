# Oh My Task

Durable, Markdown-first task continuity for Pi and other coding agents.

## Components

- `oh-my-task-cli`: safe task storage, checkpoints, locking, indexing, and lifecycle commands.
- Pi extension: startup filtering, context/native resume, Pi session import, and optional auto checkpoints.
- Agent Skills-compatible `oh-my-task` skill for manual use from Pi, Claude Code, Codex CLI, Kimi CLI, OpenCode, and compatible harnesses.

See [OH-MY-TASK.md](OH-MY-TASK.md) for the complete design.

## Development

```bash
npm install
npm run validate
```

When the configured registry is unavailable on Node 24, the dependency-light runtime suite can be run with:

```bash
npm run test:local
```

## Pi installation from Git

```bash
pi install git:github.com/The-JiahaoJiang/oh-my-task
```

The repository package manifest exposes the Pi extension and shared skill.

## Install the skill manually

Pi and tools using the shared Agent Skills location:

```bash
node scripts/install-skills.mjs
```

A harness-specific documented directory can be supplied explicitly:

```bash
node scripts/install-skills.mjs --path /path/to/harness/skills/oh-my-task
```

Do not guess a harness's skill directory; consult that harness's current documentation.

## Data and privacy

Data defaults to `~/.oh-my-task/` and can be overridden with `OH_MY_TASK_HOME`. Task files are plaintext. Oh My Task stores curated summaries and must not be used to store credentials, secret-file content, full transcripts, or raw tool output.

## Configuration

Create defaults with:

```bash
oh-my-task-cli config-init
```

Set `checkpointMode` to `manual` or `auto` in `~/.oh-my-task/config.json`.

## Recovery

Task files are authoritative. The index can be rebuilt with `oh-my-task-cli rebuild-index`. Writes use short-lived locks, revision checks, atomic replacement, and recovery copies. Never force-remove a lock until you have verified no writer is active.
