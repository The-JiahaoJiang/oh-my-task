#!/usr/bin/env python3
"""Basic generated-site content and internal-link validation."""

from argparse import ArgumentParser
from html.parser import HTMLParser
from pathlib import Path

parser = ArgumentParser()
parser.add_argument("site", nargs="?", default="_site")
args = parser.parse_args()
site = Path(args.site)
index = site / "index.html"
architecture = site / "OH-MY-TASK.html"
source = index.read_text(encoding="utf-8")
architecture_source = architecture.read_text(encoding="utf-8")

required = [
    "Oh My Task",
    "/skill:oh-my-task create a new task",
    "The Pi extension stays invisible",
    "checkpointMode",
    "startupPrompt",
    "ignoredPaths",
    "project-links.json",
    "generate a completion document",
    "Too many agent tabs. Which task is this one?",
    "task: build-deploy-v2",
    "task name in the bottom status area",
    'href="#terminal-tabs"',
    'href="OH-MY-TASK.html"',
]
for value in required:
    if value not in source:
        raise SystemExit(f"Missing required site content: {value}")
if "oh-my-task-cli" in source:
    raise SystemExit("Internal CLI name must not be exposed on the user-facing site")
for value in ["System Architecture", "Implementation Details and Code Map", "packages/core/src/task-store.ts"]:
    if value not in architecture_source:
        raise SystemExit(f"Architecture page is missing required content: {value}")

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.fragments = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.add(values["id"])
        href = values.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.fragments.append(href[1:])

links = Links()
links.feed(source)
missing = sorted(set(links.fragments) - links.ids)
if missing:
    raise SystemExit(f"Broken internal links: {', '.join(missing)}")
print(f"Validated {index} ({len(source):,} bytes, {len(links.fragments)} internal links)")
print(f"Validated {architecture} ({len(architecture_source):,} bytes)")
