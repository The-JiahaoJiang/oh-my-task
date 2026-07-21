# Oh My Task

Installation and usage documentation: **https://the-jiahaojiang.github.io/oh-my-task/**

## Install for Pi

```bash
pi install git:github.com/The-JiahaoJiang/oh-my-task
```

Restart Pi after the first installation. After an update, use `/reload` or restart Pi.

## Install the shared skill for another agent

Clone this repository, then copy the skill and its bundled runtime to the skill directory documented by your agent:

```bash
git clone https://github.com/The-JiahaoJiang/oh-my-task.git
cd oh-my-task
node scripts/install-skills.mjs --path /path/to/agent/skills/oh-my-task
```

For agents that support the shared `~/.agents/skills` location, omit `--path`:

```bash
node scripts/install-skills.mjs
```
