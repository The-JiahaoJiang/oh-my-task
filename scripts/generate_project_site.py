#!/usr/bin/env python3
"""Generate the standalone Oh My Task GitHub Pages site."""

from argparse import ArgumentParser
from datetime import datetime, timezone
from pathlib import Path
import html
import json
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
parser = ArgumentParser()
parser.add_argument("--output", default=str(ROOT / "_site"))
args = parser.parse_args()
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)

manifest = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
version = manifest.get("version", "development")
revision = os.environ.get("GITHUB_SHA", "local")[:7]
generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")

page = r'''<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Oh My Task provides durable, Markdown-first task continuity for Pi and other coding agents.">
  <meta name="theme-color" content="#0a0d17">
  <meta property="og:title" content="Oh My Task">
  <meta property="og:description" content="Plans survive sessions. Context survives agents.">
  <meta property="og:type" content="website">
  <title>Oh My Task — Durable task continuity for coding agents</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080b12; --bg-2: #0d1220; --card: rgba(19,26,43,.76); --card-solid: #131a2b;
      --text: #edf2ff; --muted: #9ca9c3; --line: rgba(158,177,215,.16);
      --purple: #9b87ff; --cyan: #48dfcf; --pink: #f28ad2; --yellow: #ffd479;
      --glow: rgba(129,103,255,.24); --shadow: 0 25px 80px rgba(0,0,0,.34);
      --code: #090e19; --max: 1180px;
    }
    html[data-theme="light"] {
      color-scheme: light;
      --bg: #f6f7fc; --bg-2: #edf1fa; --card: rgba(255,255,255,.82); --card-solid: #fff;
      --text: #162036; --muted: #62708b; --line: rgba(38,53,83,.14);
      --purple: #6755e7; --cyan: #007f75; --pink: #b93687; --yellow: #875700;
      --glow: rgba(103,85,231,.13); --shadow: 0 25px 70px rgba(52,65,94,.14); --code: #edf1f8;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 84px; }
    body { margin: 0; color: var(--text); background:
      radial-gradient(circle at 85% 4%, var(--glow), transparent 30rem),
      radial-gradient(circle at 3% 34%, rgba(72,223,207,.08), transparent 25rem), var(--bg);
      font: 16px/1.65 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: inherit; }
    .nav { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--line); background: color-mix(in srgb,var(--bg) 78%,transparent); backdrop-filter: blur(18px); }
    .nav-inner { max-width: var(--max); min-height: 68px; margin: auto; padding: 0 22px; display: flex; align-items: center; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 10px; margin-right: auto; text-decoration: none; font-weight: 800; letter-spacing: -.03em; }
    .logo { display: grid; place-items: center; width: 37px; height: 37px; border-radius: 11px; color: white; background: linear-gradient(135deg,var(--purple),#5944d0); box-shadow: 0 8px 28px var(--glow); }
    .nav-links { display: flex; gap: 20px; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: .9rem; font-weight: 650; }
    .nav-links a:hover { color: var(--text); }
    button, .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 11px; color: var(--text); background: var(--card); cursor: pointer; font: inherit; font-weight: 700; text-decoration: none; }
    button:hover, .button:hover { border-color: var(--purple); transform: translateY(-1px); }
    .primary { color: white; border-color: transparent; background: linear-gradient(135deg,var(--purple),#6d54e7); box-shadow: 0 12px 30px var(--glow); }
    main { overflow: hidden; }
    .hero { position: relative; max-width: var(--max); margin: auto; padding: 110px 22px 90px; }
    .hero-grid { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(320px,.85fr); gap: 65px; align-items: center; }
    .eyebrow { color: var(--cyan); font-size: .76rem; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
    h1 { max-width: 760px; margin: 14px 0 22px; font-size: clamp(3.3rem,8vw,6.8rem); line-height: .94; letter-spacing: -.072em; }
    .gradient { background: linear-gradient(95deg,var(--purple),var(--cyan) 74%); color: transparent; background-clip: text; -webkit-background-clip: text; }
    .lead { max-width: 690px; color: var(--muted); font-size: clamp(1.08rem,2vw,1.28rem); }
    .actions { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 30px; }
    .terminal { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: color-mix(in srgb,var(--code) 91%,transparent); box-shadow: var(--shadow); transform: rotate(1deg); }
    .terminal-bar { display: flex; align-items: center; gap: 7px; padding: 13px 16px; border-bottom: 1px solid var(--line); }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); opacity: .55; }
    .terminal pre { min-height: 310px; margin: 0; padding: 24px; white-space: pre-wrap; color: #c9d4eb; font: .83rem/1.75 "SFMono-Regular",Consolas,monospace; }
    .prompt { color: var(--cyan); } .cmd { color: #d9d2ff; } .success { color: #85e7b0; }
    .tab-demo { overflow: hidden; border: 1px solid var(--line); border-radius: 22px; background: var(--code); box-shadow: var(--shadow); }
    .tab-strip { display: flex; gap: 2px; padding: 10px 10px 0; border-bottom: 1px solid var(--line); background: color-mix(in srgb,var(--card-solid) 72%,var(--code)); }
    .term-tab { max-width: 31%; padding: 9px 13px; overflow: hidden; border: 1px solid transparent; border-radius: 9px 9px 0 0; color: var(--muted); font: .75rem/1.2 "SFMono-Regular",Consolas,monospace; text-overflow: ellipsis; white-space: nowrap; }
    .term-tab.active { color: var(--text); border-color: var(--line); border-bottom-color: var(--code); background: var(--code); }
    .term-screen { min-height: 290px; padding: 24px; color: #c9d4eb; font: .84rem/1.75 "SFMono-Regular",Consolas,monospace; }
    .term-screen .dim { color: #74819a; }
    .task-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 9px 15px; border-top: 1px solid rgba(72,223,207,.3); color: #d8fff9; background: rgba(21,93,87,.42); font: .76rem/1.35 "SFMono-Regular",Consolas,monospace; }
    .task-footer strong { color: #72eadc; }
    .scenario-points { display: grid; gap: 13px; margin-top: 24px; }
    .scenario-point { display: grid; grid-template-columns: 27px 1fr; gap: 10px; color: var(--muted); }
    .scenario-point b { color: var(--cyan); }
    section { max-width: var(--max); margin: auto; padding: 82px 22px; }
    .section-head { max-width: 720px; margin-bottom: 35px; }
    .section-head h2 { margin: 8px 0 12px; font-size: clamp(2.1rem,5vw,3.7rem); line-height: 1.02; letter-spacing: -.05em; }
    .section-head p { color: var(--muted); font-size: 1.06rem; }
    .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
    .card { position: relative; padding: 25px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); backdrop-filter: blur(12px); box-shadow: 0 12px 35px rgba(0,0,0,.08); }
    .card:hover { border-color: color-mix(in srgb,var(--purple) 55%,var(--line)); }
    .icon { display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 17px; border-radius: 12px; color: var(--purple); background: color-mix(in srgb,var(--purple) 14%,transparent); font-size: 1.15rem; }
    .card h3 { margin: 0 0 8px; font-size: 1.07rem; }
    .card p { margin: 0; color: var(--muted); font-size: .92rem; }
    .steps { counter-reset: steps; display: grid; gap: 14px; }
    .step { counter-increment: steps; display: grid; grid-template-columns: 50px minmax(0,1fr); gap: 16px; align-items: start; padding: 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
    .step::before { content: counter(steps); display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; color: white; background: linear-gradient(135deg,var(--purple),#5944d0); font-weight: 850; }
    .step h3 { margin: 3px 0 5px; } .step p { margin: 0; color: var(--muted); }
    .code-block { position: relative; overflow: auto; margin: 16px 0; padding: 19px 52px 19px 20px; border: 1px solid var(--line); border-radius: 14px; color: color-mix(in srgb,var(--text) 88%,var(--cyan)); background: var(--code); font: .86rem/1.7 "SFMono-Regular",Consolas,monospace; white-space: pre; }
    .copy { position: absolute; top: 8px; right: 8px; min-height: 32px; padding: 4px 8px; font-size: .72rem; }
    .split { display: grid; grid-template-columns: .8fr 1.2fr; gap: 32px; align-items: start; }
    .config-list { display: grid; gap: 12px; }
    .config-item { padding: 15px 17px; border-left: 3px solid var(--purple); background: var(--card); border-radius: 0 12px 12px 0; }
    .config-item code { color: var(--cyan); font-weight: 750; } .config-item span { display: block; color: var(--muted); font-size: .87rem; }
    .callout { padding: 25px; border: 1px solid color-mix(in srgb,var(--cyan) 40%,var(--line)); border-radius: 17px; background: color-mix(in srgb,var(--cyan) 7%,var(--card)); }
    .callout h3 { margin-top: 0; }
    footer { margin-top: 60px; border-top: 1px solid var(--line); }
    .footer-inner { max-width: var(--max); margin: auto; padding: 35px 22px; display: flex; justify-content: space-between; gap: 20px; color: var(--muted); font-size: .82rem; }
    .reveal { opacity: 0; transform: translateY(16px); transition: .55s ease; }
    .reveal.visible { opacity: 1; transform: none; }
    @media (max-width: 850px) { .nav-links { display:none; } .hero { padding-top: 70px; } .hero-grid,.split { grid-template-columns:1fr; } .terminal { transform:none; } .grid { grid-template-columns:1fr; } }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior:auto; } *,*::before,*::after { transition:none!important; } .reveal { opacity:1; transform:none; } }
  </style>
</head>
<body>
  <nav class="nav"><div class="nav-inner">
    <a class="brand" href="#top"><span class="logo">✓</span><span>Oh My Task</span></a>
    <div class="nav-links"><a href="#terminal-tabs">Terminal tabs</a><a href="#why">Why</a><a href="#use">Use it</a><a href="#extension">Extension</a><a href="#config">Config</a></div>
    <a class="button" href="https://github.com/The-JiahaoJiang/oh-my-task">GitHub ↗</a>
    <button id="theme" aria-label="Toggle theme">☼</button>
  </div></nav>

  <main id="top">
    <header class="hero"><div class="hero-grid">
      <div>
        <div class="eyebrow">Markdown-first · agent-independent</div>
        <h1>Plans survive sessions.<br><span class="gradient">Context survives agents.</span></h1>
        <p class="lead">Oh My Task keeps implementation plans, verified progress, decisions, blockers, and next actions in durable task documents—so work can continue without dragging an entire conversation along.</p>
        <div class="actions"><a class="button primary" href="#use">Get started</a><a class="button" href="OH-MY-TASK.html">Architecture reference</a><a class="button" href="https://github.com/The-JiahaoJiang/oh-my-task/blob/main/OH-MY-TASK.md">Markdown source</a></div>
      </div>
      <div class="terminal" aria-label="Example terminal workflow">
        <div class="terminal-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
        <pre><span class="prompt">›</span> <span class="cmd">/skill:oh-my-task show my current tasks</span>

<span class="success">Task: build-deploy-v2</span>
Status: in-progress
Progress: deployment path implemented
Next: verify rollback behavior

<span class="prompt">›</span> <span class="cmd">/skill:oh-my-task checkpoint this task</span>

<span class="success">✓ Checkpoint saved</span>
Revision 8 · 3 files · 1 decision

<span class="prompt">›</span> <span class="cmd">/skill:oh-my-task generate a completion doc</span></pre>
      </div>
    </div></header>

    <section id="terminal-tabs" class="reveal">
      <div class="split" style="align-items:center">
        <div>
          <div class="eyebrow">A familiar terminal problem</div>
          <div class="section-head" style="margin-bottom:0"><h2>Too many agent tabs. Which task is this one?</h2><p>When several Pi or coding-agent sessions are open, terminal tabs often look identical. You waste time opening each tab, scrolling through messages, and reconstructing what it was doing.</p></div>
          <div class="scenario-points">
            <div class="scenario-point"><b>01</b><span>Oh My Task associates the session with its durable task.</span></div>
            <div class="scenario-point"><b>02</b><span>The Pi extension shows the active <strong>task name in the bottom status area</strong> of that agent window.</span></div>
            <div class="scenario-point"><b>03</b><span>Switch tabs and identify the work immediately—without reading the conversation.</span></div>
          </div>
        </div>
        <figure style="margin:0" aria-label="Terminal illustration showing multiple agent tabs and an active task name in the bottom status area">
          <div class="tab-demo">
            <div class="tab-strip">
              <div class="term-tab">pi — api</div>
              <div class="term-tab active">pi — deploy</div>
              <div class="term-tab">pi — tests</div>
            </div>
            <div class="term-screen"><span class="dim">workspace</span>  CopilotEGP<br><span class="dim">model</span>      claude-sonnet<br><br><span class="prompt">›</span> Verify rollback behavior for deployment v2<br><br><span class="success">✓</span> Read deployment configuration<br><span class="success">✓</span> Checked rollback handler<br><span class="prompt">●</span> Updating integration tests…</div>
            <div class="task-footer"><span><strong>task: build-deploy-v2</strong></span><span>in-progress · revision 8</span></div>
          </div>
          <figcaption style="margin-top:10px;color:var(--muted);font-size:.78rem;text-align:center">The active task stays visible at the bottom of the Pi window.</figcaption>
        </figure>
      </div>
    </section>

    <section id="why" class="reveal">
      <div class="section-head"><div class="eyebrow">One durable source of truth</div><h2>Task continuity without transcript lock-in.</h2><p>Sessions remain useful references, but task documents hold the context required to continue across Pi, Claude Code, Codex CLI, Kimi CLI, OpenCode, and compatible agents.</p></div>
      <div class="grid">
        <article class="card"><div class="icon">◇</div><h3>Agent-independent</h3><p>Resume from compact task context even when the previous session belongs to another agent.</p></article>
        <article class="card"><div class="icon">✓</div><h3>Evidence-based checkpoints</h3><p>Track plan status, files, decisions, blockers, validation, and the exact next action.</p></article>
        <article class="card"><div class="icon">⌁</div><h3>Human-readable storage</h3><p>Transparent Markdown task files remain authoritative; the global index is safely rebuildable.</p></article>
        <article class="card"><div class="icon">↻</div><h3>Concurrent-safe</h3><p>Short-lived locks, atomic writes, revisions, and recovery copies protect parallel sessions.</p></article>
        <article class="card"><div class="icon">⌘</div><h3>One user interface</h3><p>Users interact only with the shared skill. Internal storage commands stay hidden.</p></article>
        <article class="card"><div class="icon">▤</div><h3>Reference-ready docs</h3><p>Generate complete introduction, architecture, design, usage, validation, and follow-up documentation.</p></article>
      </div>
    </section>

    <section id="use" class="reveal">
      <div class="section-head"><div class="eyebrow">Install and use</div><h2>A skill-first workflow.</h2><p>The extension works quietly in the background. Every explicit task operation uses the same skill interface across agents.</p></div>
      <div class="steps">
        <article class="step"><div><h3>Install the Pi package</h3><p>Install from Git, then restart Pi or run <code>/reload</code>.</p><div class="code-block">pi install git:github.com/The-JiahaoJiang/oh-my-task<button class="copy">Copy</button></div></div></article>
        <article class="step"><div><h3>Create or import a task</h3><p>Use natural instructions. Pi’s startup menu can prefill the same skill command and supports <code>@</code> plan-file completion.</p><div class="code-block">/skill:oh-my-task create a new task
/skill:oh-my-task import a task plan from @docs/PLAN.md<button class="copy">Copy</button></div></div></article>
        <article class="step"><div><h3>Resume and checkpoint</h3><p>The skill resolves the current workspace and task, then handles internal revisions and persistence for you.</p><div class="code-block">/skill:oh-my-task resume my current task
/skill:oh-my-task checkpoint the current task<button class="copy">Copy</button></div></div></article>
        <article class="step"><div><h3>Publish the final reference</h3><p>Generate a reviewed completion and design document inside the repository.</p><div class="code-block">/skill:oh-my-task generate a completion document for the current task<button class="copy">Copy</button></div></div></article>
      </div>
    </section>

    <section id="extension" class="reveal">
      <div class="section-head"><div class="eyebrow">Extension + skill</div><h2>Automation where it helps. Consistency where it matters.</h2></div>
      <div class="split">
        <div class="callout"><h3>The Pi extension stays invisible</h3><p>It provides startup discovery, workspace linking, compact context restoration, session metadata, and optional automatic checkpoints. It does not register a competing slash command.</p><p><strong>The skill is the only user-facing task interface.</strong></p></div>
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <article class="card"><h3>Manual mode</h3><p>The skill turns user intent into safe internal task operations and asks only for meaningful choices and approvals.</p></article>
          <article class="card"><h3>Auto mode</h3><p>Pi detects meaningful file changes and requests a guarded checkpoint after the agent settles. Shutdown never starts a model call.</p></article>
          <article class="card"><h3>Plan import</h3><p>Preview the normalized plan, then optionally approve a focused repository review to update real progress.</p></article>
          <article class="card"><h3>Cross-agent resume</h3><p>Native Pi sessions can resume in Pi; other transitions use compact task context rather than incompatible transcripts.</p></article>
        </div>
      </div>
    </section>

    <section id="config" class="reveal">
      <div class="section-head"><div class="eyebrow">Transparent configuration</div><h2>Small defaults, explicit safeguards.</h2><p>Ask the skill to change settings, or inspect <code>~/.oh-my-task/config.json</code> directly.</p></div>
      <div class="split">
        <div class="config-list">
          <div class="config-item"><code>checkpointMode</code><span><strong>manual</strong> or <strong>auto</strong>. The skill remains the only user interface in both modes.</span></div>
          <div class="config-item"><code>startupPrompt</code><span>Show project-filtered task discovery when a fresh interactive session starts.</span></div>
          <div class="config-item"><code>defaultSessionSearchDays</code><span>Default age range for approved Pi session-history discovery.</span></div>
          <div class="config-item"><code>lock</code><span>Retry, timeout, and stale-lock thresholds for safe concurrent mutations.</span></div>
          <div class="config-item"><code>ignoredPaths</code><span>Patterns excluded from summaries and repository progress reviews.</span></div>
        </div>
        <div><div class="code-block" id="config-code">{
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
}<button class="copy">Copy</button></div></div>
      </div>
    </section>

    <section class="reveal">
      <div class="section-head"><div class="eyebrow">Data ownership</div><h2>Your task files remain readable and recoverable.</h2></div>
      <div class="grid">
        <article class="card"><h3><code>~/.oh-my-task/tasks/</code></h3><p>Authoritative task plans, current projections, session references, and append-only checkpoint histories.</p></article>
        <article class="card"><h3><code>oh-my-task.md</code></h3><p>A rebuildable global index with a preserved manual inbox and generated task region.</p></article>
        <article class="card"><h3><code>project-links.json</code></h3><p>Remembers approved workspace-to-project links so users are not prompted on every session.</p></article>
      </div>
      <div class="callout" style="margin-top:16px"><h3>Privacy baseline</h3><p>Files are plaintext and user-private, not encrypted. Oh My Task stores curated summaries—not full transcripts, secret-file content, credentials, environment values, or raw tool output.</p></div>
    </section>
  </main>

  <footer><div class="footer-inner"><span>Oh My Task · version {{VERSION}} · revision {{REVISION}}</span><span>Generated {{GENERATED}} · <a href="https://github.com/The-JiahaoJiang/oh-my-task">Source on GitHub</a></span></div></footer>

  <script>
    const root=document.documentElement, key='oh-my-task-site-theme';
    const saved=localStorage.getItem(key)|| (matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');
    root.dataset.theme=saved; const theme=document.getElementById('theme');
    const icon=()=>theme.textContent=root.dataset.theme==='dark'?'☼':'☾'; icon();
    theme.onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem(key,root.dataset.theme);icon()};
    document.querySelectorAll('.copy').forEach(button=>button.onclick=async()=>{
      const block=button.parentElement; const clone=block.cloneNode(true); clone.querySelector('.copy')?.remove();
      await navigator.clipboard.writeText(clone.textContent.trim()); const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200);
    });
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.08});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  </script>
</body>
</html>
'''

page = (page.replace("{{VERSION}}", html.escape(str(version)))
            .replace("{{REVISION}}", html.escape(revision))
            .replace("{{GENERATED}}", html.escape(generated)))
(output / "index.html").write_text(page, encoding="utf-8", newline="\n")
architecture_source = ROOT / "OH-MY-TASK.html"
if not architecture_source.exists():
    raise SystemExit("OH-MY-TASK.html is missing; run scripts/generate_design_html.py first")
shutil.copyfile(architecture_source, output / "OH-MY-TASK.html")
(output / ".nojekyll").write_text("", encoding="utf-8")
print(f"Generated {output / 'index.html'}")
print(f"Published {output / 'OH-MY-TASK.html'}")
