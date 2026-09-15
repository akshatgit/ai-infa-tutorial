#!/usr/bin/env python3
"""
Build a static copy of the course site into dist/.

The site has no server-side logic — it renders markdown from the labs repo — so
it can be baked into one self-contained page and served by any static host.

    python3 build.py                       # labs repo found as a sibling
    LABS_REPO=../ai-tutorial-labs python3 build.py

Output is a single dist/index.html with the CSS, both scripts and every
runbook embedded. No build step is needed on the host; point the publish
directory at dist/.
"""
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONSOLE = HERE / "console"
DIST = HERE / "dist"

sys.path.insert(0, str(CONSOLE))
from course import WEEKS, find_labs  # noqa: E402

LABS = Path(os.environ.get("LABS_REPO") or find_labs()).resolve()


def collect():
    """Same shape the dev server's API returns, so the page cannot tell the
    difference between a live server and a baked file."""
    weeks, detail = [], {}
    for meta in WEEKS:
        d = LABS / meta["slug"]
        readme = d / "README.md"
        available = readme.exists()
        weeks.append({**meta, "available": available})
        if not available:
            continue

        docs = {}
        for name in ("CONCEPTS", "GRADING"):
            f = d / f"{name}.md"
            if f.exists():
                docs[name.lower()] = f.read_text()

        parts = []
        for f in sorted(d.glob("[0-9][0-9]-*.md")):
            text = f.read_text()
            head = next((ln[2:].strip() for ln in text.splitlines()
                         if ln.startswith("# ")), f.stem)
            parts.append({"file": f.name, "title": head, "markdown": text})

        files = sorted(
            p.relative_to(d).as_posix() for p in d.rglob("*")
            if p.is_file() and "__pycache__" not in p.as_posix()
            and p.name not in ("README.md", "CONCEPTS.md", "GRADING.md")
            and not re.match(r"^\d\d-.*\.md$", p.name))

        detail[meta["n"]] = {**meta, "markdown": readme.read_text(),
                             "docs": docs, "parts": parts, "files": files}
    return weeks, detail


def main():
    if not LABS.is_dir():
        sys.exit(f"labs repo not found at {LABS} — set LABS_REPO")

    weeks, detail = collect()
    built = sum(1 for w in weeks if w["available"])

    shell = (CONSOLE / "index.html").read_text()
    payload = json.dumps({"weeks": weeks, "labs_repo": LABS.name, "detail": detail},
                         ensure_ascii=False)
    # The runbooks contain "<!-- widget:... -->". Inside a <script> block that
    # sequence flips the HTML tokenizer into escaped-script-data state and the
    # rest of the page never parses. Escaping "<" is the standard fix and keeps
    # the JSON valid.
    payload = payload.replace("<", "\\u003c").replace("\u2028", "\\u2028") \
                     .replace("\u2029", "\\u2029")

    # Embed the content and both scripts, replacing the two <script src> tags.
    inline = (
        f'<script>window.__COURSE__ = {payload};</script>\n'
        f'<script>\n{(CONSOLE / "widgets.js").read_text()}\n</script>\n'
        f'<script>\n{(CONSOLE / "app.js").read_text()}\n</script>\n'
    )
    shell = shell.replace('<script src="/widgets.js"></script>\n<script src="/app.js"></script>',
                          inline)
    if "__COURSE__" not in shell:
        sys.exit("could not inject scripts — did the script tags in console/index.html change?")

    DIST.mkdir(exist_ok=True)
    out = DIST / "index.html"
    out.write_text(shell)
    (DIST / "_redirects").write_text("/*  /index.html  200\n")   # SPA fallback

    kb = len(shell.encode()) / 1024
    print(f"  labs      {LABS}")
    print(f"  weeks     {built} of {len(weeks)} written")
    print(f"  output    {out}  ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
