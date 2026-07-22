#!/usr/bin/env python3
"""Generate the standalone OH-MY-TASK design review page from Markdown."""

from pathlib import Path
import html
import markdown

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "OH-MY-TASK.md"
OUTPUT = ROOT / "OH-MY-TASK.html"

source = SOURCE.read_text(encoding="utf-8")
md = markdown.Markdown(
    extensions=["toc", "fenced_code", "tables", "sane_lists", "smarty"],
    extension_configs={"toc": {"permalink": "#", "toc_depth": "2-3"}},
    output_format="html5",
)
article = md.convert(source)
toc = md.toc

page = r'''<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Oh My Task final design and implementation plan">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="favicon.svg">
  <title>Oh My Task — Design Review</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #090d18;
      --surface: rgba(18, 25, 43, .78);
      --surface-solid: #12192b;
      --surface-2: #192238;
      --text: #e8edf8;
      --muted: #9ba8c0;
      --line: rgba(153, 170, 204, .18);
      --accent: #8b7cff;
      --accent-2: #36d7c4;
      --accent-soft: rgba(139, 124, 255, .13);
      --warn: #ffca6a;
      --shadow: 0 24px 70px rgba(0, 0, 0, .34);
      --code: #0b1120;
      --max: 920px;
    }
    html[data-theme="light"] {
      color-scheme: light;
      --bg: #f4f6fb;
      --surface: rgba(255, 255, 255, .82);
      --surface-solid: #fff;
      --surface-2: #edf0f8;
      --text: #172033;
      --muted: #63708a;
      --line: rgba(33, 47, 75, .14);
      --accent: #6557e8;
      --accent-2: #008e82;
      --accent-soft: rgba(101, 87, 232, .09);
      --warn: #9b6100;
      --shadow: 0 24px 70px rgba(60, 72, 105, .13);
      --code: #eef1f8;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 80px; }
    body {
      margin: 0;
      min-width: 300px;
      background:
        radial-gradient(circle at 85% 0%, rgba(139,124,255,.13), transparent 30rem),
        radial-gradient(circle at 0% 35%, rgba(54,215,196,.08), transparent 26rem),
        var(--bg);
      color: var(--text);
      font: 16px/1.72 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: var(--accent-2); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .progress { position: fixed; inset: 0 0 auto; height: 3px; z-index: 100; background: transparent; }
    .progress span { display: block; width: 0; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
    .topbar {
      position: sticky; top: 0; z-index: 50;
      display: flex; align-items: center; gap: 12px;
      min-height: 62px; padding: 10px 22px;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg) 74%, transparent);
      backdrop-filter: blur(18px);
    }
    .brand { display: flex; align-items: center; gap: 10px; margin-right: auto; color: var(--text); font-weight: 760; letter-spacing: -.02em; }
    .brand:hover { text-decoration: none; }
    .logo { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: white; background: linear-gradient(135deg, var(--accent), #5a42c8); box-shadow: 0 8px 25px rgba(105,86,238,.32); }
    .toolbar { display: flex; gap: 8px; }
    button, .search {
      min-height: 38px; border: 1px solid var(--line); border-radius: 10px;
      color: var(--text); background: var(--surface); font: inherit;
    }
    button { cursor: pointer; padding: 7px 11px; }
    button:hover { border-color: var(--accent); background: var(--accent-soft); }
    .search { width: min(270px, 25vw); padding: 7px 11px; outline: none; }
    .search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 36px; max-width: 1320px; margin: 0 auto; padding: 30px 26px 80px; }
    .sidebar { position: sticky; top: 88px; height: calc(100vh - 112px); overflow: auto; padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); backdrop-filter: blur(16px); box-shadow: var(--shadow); }
    .sidebar-label { margin: 0 0 12px; color: var(--muted); font-size: .72rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
    .toc ul { list-style: none; margin: 0; padding: 0; }
    .toc li { margin: 2px 0; }
    .toc li ul { margin: 3px 0 8px 13px; padding-left: 10px; border-left: 1px solid var(--line); }
    .toc a { display: block; padding: 6px 9px; border-radius: 8px; color: var(--muted); font-size: .87rem; line-height: 1.35; }
    .toc a:hover, .toc a.active { color: var(--text); background: var(--accent-soft); text-decoration: none; }
    .toc a.active { box-shadow: inset 2px 0 var(--accent); }
    .toc li.filtered { display: none; }
    .sidebar-meta { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: .78rem; }
    main { min-width: 0; }
    .hero { position: relative; overflow: hidden; padding: 48px 50px; margin-bottom: 24px; border: 1px solid var(--line); border-radius: 24px; background: linear-gradient(145deg, var(--surface-solid), color-mix(in srgb, var(--surface-solid) 86%, var(--accent))); box-shadow: var(--shadow); }
    .hero::after { content: ""; position: absolute; width: 250px; height: 250px; right: -80px; top: -100px; border-radius: 50%; background: radial-gradient(circle, rgba(54,215,196,.23), transparent 68%); }
    .eyebrow { color: var(--accent-2); font-size: .76rem; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
    .hero h1 { max-width: 720px; margin: 10px 0 14px; font-size: clamp(2.2rem, 5vw, 4.25rem); line-height: 1.02; letter-spacing: -.055em; }
    .hero p { max-width: 690px; margin: 0; color: var(--muted); font-size: 1.05rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .chip { padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: rgba(255,255,255,.025); font-size: .78rem; }
    article { padding: 34px 50px 60px; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); backdrop-filter: blur(15px); box-shadow: var(--shadow); }
    article > h1:first-child { display: none; }
    h2, h3, h4 { position: relative; line-height: 1.25; letter-spacing: -.025em; }
    h2 { margin: 3.7rem 0 1.1rem; padding-top: .3rem; font-size: 1.72rem; }
    h2:first-of-type { margin-top: .5rem; }
    h2::before { content: ""; position: absolute; left: -18px; top: .35rem; width: 4px; height: 1.5rem; border-radius: 5px; background: linear-gradient(var(--accent), var(--accent-2)); }
    h3 { margin: 2.35rem 0 .8rem; font-size: 1.22rem; color: color-mix(in srgb, var(--text) 92%, var(--accent)); }
    h4 { margin-top: 1.8rem; }
    h2 .headerlink, h3 .headerlink { margin-left: .4em; opacity: 0; color: var(--muted); font-weight: 400; }
    h2:hover .headerlink, h3:hover .headerlink { opacity: 1; }
    p, li { max-width: var(--max); }
    strong { color: color-mix(in srgb, var(--text) 93%, white); }
    ul, ol { padding-left: 1.45rem; }
    li { margin: .28rem 0; }
    li::marker { color: var(--accent); }
    hr { height: 1px; margin: 3.3rem 0; border: 0; background: linear-gradient(90deg, transparent, var(--line) 12%, var(--line) 88%, transparent); }
    code { padding: .14em .38em; border: 1px solid var(--line); border-radius: 5px; color: color-mix(in srgb, var(--accent-2) 84%, var(--text)); background: var(--code); font: .88em/1.5 "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    pre { overflow: auto; padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--code); box-shadow: inset 0 1px rgba(255,255,255,.025); }
    pre code { padding: 0; border: 0; color: var(--text); background: none; }
    blockquote { margin: 1.4rem 0; padding: 12px 18px; border-left: 3px solid var(--accent-2); border-radius: 0 10px 10px 0; color: var(--muted); background: color-mix(in srgb, var(--accent-2) 7%, transparent); }
    table { display: block; overflow-x: auto; width: max-content; max-width: 100%; border-collapse: collapse; margin: 1.4rem 0; }
    th, td { padding: 10px 13px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: var(--surface-2); }
    .review-note { display: none; margin: 12px 0 24px; padding: 14px; border: 1px dashed color-mix(in srgb, var(--warn) 60%, var(--line)); border-radius: 12px; background: color-mix(in srgb, var(--warn) 6%, transparent); }
    body.reviewing .review-note { display: block; }
    .review-note label { display: block; margin-bottom: 7px; color: var(--warn); font-size: .76rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .review-note textarea { width: 100%; min-height: 74px; resize: vertical; padding: 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--text); background: var(--bg); font: inherit; outline: none; }
    .review-note textarea:focus { border-color: var(--warn); }
    .note-count { display: none; min-width: 20px; padding: 1px 6px; margin-left: 4px; border-radius: 999px; color: var(--bg); background: var(--warn); font-size: .7rem; font-weight: 800; }
    .note-count.visible { display: inline-block; }
    .mobile-toc { display: none; }
    .footer { max-width: 1320px; margin: -50px auto 0; padding: 0 26px 36px; color: var(--muted); font-size: .8rem; text-align: right; }
    @media (max-width: 900px) {
      .layout { display: block; padding: 18px 14px 70px; }
      .sidebar { display: none; }
      .mobile-toc { display: inline-flex; }
      .hero, article { padding: 30px 24px; border-radius: 18px; }
      .hero { padding-top: 38px; }
      h2::before { left: -11px; }
      .search { display: none; }
      .topbar { padding-inline: 14px; }
      button .button-label { display: none; }
    }
    @media print {
      :root { --bg: white; --surface: white; --surface-solid: white; --text: #111827; --muted: #4b5563; --line: #d5d9e2; --code: #f3f4f6; }
      .topbar, .sidebar, .progress, .review-note, .footer { display: none !important; }
      body { background: white; font-size: 10pt; }
      .layout { display: block; max-width: none; padding: 0; }
      .hero, article { padding: 0; border: 0; box-shadow: none; background: white; }
      .hero { margin-bottom: 25px; }
      .hero h1 { font-size: 30pt; }
      article > h1:first-child { display: none; }
      h2 { break-after: avoid; margin-top: 24px; }
      h3, pre, table { break-inside: avoid; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <div class="progress" aria-hidden="true"><span id="progress"></span></div>
  <header class="topbar">
    <a class="brand" href="#top"><span class="logo">✓</span><span>Oh My Task</span></a>
    <input id="search" class="search" type="search" placeholder="Filter sections…  /" aria-label="Filter table of contents">
    <div class="toolbar">
      <button id="reviewToggle" title="Toggle section review notes">✎ <span class="button-label">Review</span><span id="noteCount" class="note-count">0</span></button>
      <button id="exportNotes" title="Export review notes as Markdown">⇩ <span class="button-label">Notes</span></button>
      <button id="themeToggle" title="Toggle color theme">☼</button>
      <button class="mobile-toc" id="mobileToc" title="Jump to section">☰</button>
      <button onclick="window.print()" title="Print or save as PDF">⎙</button>
    </div>
  </header>

  <div class="layout" id="top">
    <aside class="sidebar" id="sidebar">
      <p class="sidebar-label">Design sections</p>
      <nav class="toc" aria-label="Table of contents">{{TOC}}</nav>
      <div class="sidebar-meta">Source: <code>OH-MY-TASK.md</code><br>Use Review mode to keep browser-local revision notes.</div>
    </aside>

    <main>
      <section class="hero">
        <div class="eyebrow">Final design · implementation plan</div>
        <h1>Durable task continuity for coding agents.</h1>
        <p>A reviewable specification for agent-independent plans, checkpoints, session handoffs, safe concurrent writes, and a portable CLI.</p>
        <div class="chips">
          <span class="chip">Pi extension</span><span class="chip">oh-my-task-cli</span><span class="chip">Agent Skills</span><span class="chip">Markdown-first</span><span class="chip">Concurrent-safe</span>
        </div>
      </section>
      <article id="design">{{ARTICLE}}</article>
    </main>
  </div>

  <footer class="footer">Generated from <code>OH-MY-TASK.md</code>. Regenerate after editing the source.</footer>

  <script>
    const root = document.documentElement;
    const article = document.getElementById('design');
    const links = [...document.querySelectorAll('.toc a')];
    const storagePrefix = 'oh-my-task-review:';

    const preferred = localStorage.getItem(storagePrefix + 'theme') ||
      (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    root.dataset.theme = preferred;
    document.getElementById('themeToggle').textContent = preferred === 'dark' ? '☼' : '☾';
    document.getElementById('themeToggle').addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem(storagePrefix + 'theme', next);
      document.getElementById('themeToggle').textContent = next === 'dark' ? '☼' : '☾';
    });

    const headings = [...article.querySelectorAll('h2[id], h3[id]')];
    headings.forEach(heading => {
      const box = document.createElement('div');
      box.className = 'review-note';
      box.innerHTML = '<label>Revision note for this section</label><textarea placeholder="Question an assumption, record a decision, or propose a change…"></textarea>';
      heading.insertAdjacentElement('afterend', box);
      const textarea = box.querySelector('textarea');
      textarea.value = localStorage.getItem(storagePrefix + 'note:' + heading.id) || '';
      textarea.addEventListener('input', () => {
        const value = textarea.value.trim();
        if (value) localStorage.setItem(storagePrefix + 'note:' + heading.id, textarea.value);
        else localStorage.removeItem(storagePrefix + 'note:' + heading.id);
        refreshNoteCount();
      });
    });

    function notes() {
      return headings.map(h => ({ heading: h.textContent.replace('#', '').trim(), id: h.id, value: localStorage.getItem(storagePrefix + 'note:' + h.id) || '' })).filter(n => n.value.trim());
    }
    function refreshNoteCount() {
      const count = notes().length;
      const badge = document.getElementById('noteCount');
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    }
    refreshNoteCount();

    document.getElementById('reviewToggle').addEventListener('click', () => {
      document.body.classList.toggle('reviewing');
    });
    document.getElementById('exportNotes').addEventListener('click', () => {
      const current = notes();
      if (!current.length) return alert('No review notes to export.');
      const text = '# Oh My Task — Review Notes\n\n' + current.map(n => `## ${n.heading}\n\n${n.value.trim()}\n`).join('\n');
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'OH-MY-TASK-REVIEW-NOTES.md';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    const search = document.getElementById('search');
    search.addEventListener('input', () => {
      const term = search.value.trim().toLowerCase();
      links.forEach(link => {
        const target = document.querySelector(link.getAttribute('href'));
        const sectionText = target ? collectSectionText(target).toLowerCase() : link.textContent.toLowerCase();
        link.closest('li').classList.toggle('filtered', !!term && !sectionText.includes(term));
      });
    });
    function collectSectionText(heading) {
      let text = heading.textContent;
      let node = heading.nextElementSibling;
      const level = Number(heading.tagName.slice(1));
      while (node && (!/^H[1-6]$/.test(node.tagName) || Number(node.tagName.slice(1)) > level)) {
        text += ' ' + node.textContent;
        node = node.nextElementSibling;
      }
      return text;
    }
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        event.preventDefault(); search.focus();
      }
    });

    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + visible.target.id));
    }, { rootMargin: '-12% 0px -76% 0px' });
    headings.filter(h => h.tagName === 'H2').forEach(h => observer.observe(h));

    addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      document.getElementById('progress').style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
    }, { passive: true });

    document.getElementById('mobileToc').addEventListener('click', () => {
      const choices = headings.filter(h => h.tagName === 'H2').map((h, i) => `${i + 1}. ${h.textContent.replace('#', '').trim()}`).join('\n');
      const selected = prompt('Jump to section (enter number):\n\n' + choices);
      const target = headings.filter(h => h.tagName === 'H2')[Number(selected) - 1];
      target?.scrollIntoView();
    });
  </script>
</body>
</html>
'''

page = page.replace("{{TOC}}", toc).replace("{{ARTICLE}}", article)
OUTPUT.write_text(page, encoding="utf-8")
print(f"Generated {OUTPUT.relative_to(ROOT)} from {SOURCE.relative_to(ROOT)}")
