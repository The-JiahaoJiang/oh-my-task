# Oh My Task

Durable, Markdown-first task continuity for Pi and other coding agents.

## User interface

Users interact only through the Agent Skills-compatible `oh-my-task` skill in Pi, Claude Code, Codex CLI, Kimi CLI, OpenCode, and compatible harnesses.

```text
/skill:oh-my-task show my current tasks
/skill:oh-my-task create a new task
/skill:oh-my-task checkpoint the current task
/skill:oh-my-task generate a completion document for the current task
```

The bundled Pi extension provides startup discovery, context restoration, and optional automatic checkpoints without exposing a separate command. Storage, locking, revision checks, and index updates are internal implementation details.

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

Ask the skill to configure Oh My Task, for example:

```text
/skill:oh-my-task set checkpoint mode to manual
```

The persisted configuration lives at `~/.oh-my-task/config.json` for users who prefer transparent file inspection.

## Recovery

Ask the skill to validate or recover task state. Task files are authoritative, and the index can be rebuilt internally. Writes use short-lived locks, revision checks, atomic replacement, and recovery copies. The skill must request explicit approval before force-removing a lock.
