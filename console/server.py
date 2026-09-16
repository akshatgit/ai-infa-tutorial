#!/usr/bin/env python3
"""
Course website for Operating LLM Inference.

Serves the course brief and renders the runbooks from the labs repo. It has no
connection to a GPU and no authentication: everything that touches hardware
happens on the student's own box, through the labs repo.

    ./run.sh                      # http://127.0.0.1:8080
    HOST=0.0.0.0 ./run.sh         # serve it to the LAN

The labs repo is found as a sibling directory, or set LABS_REPO.
"""
import argparse
import os
import re
from pathlib import Path

from course import WEEKS, find_labs, LABS_URL
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

app = FastAPI(title="Operating LLM Inference")

HERE = Path(__file__).resolve().parent
SITE = HERE.parent


LABS_DIR = find_labs()
COURSE_DIR = SITE / "course"


@app.get("/api/weeks")
async def weeks():
    return {
        "weeks": [{**w, "available": (LABS_DIR / w["slug"] / "README.md").exists()}
                  for w in WEEKS],
        "labs_repo": str(LABS_DIR),
        "labs_url": LABS_URL,
    }


@app.get("/api/weeks/{n}")
async def week(n: int):
    meta = next((w for w in WEEKS if w["n"] == n), None)
    if meta is None:
        return JSONResponse({"error": "no such week"}, status_code=404)

    d = LABS_DIR / meta["slug"]
    readme = d / "README.md"
    if not readme.exists():
        return JSONResponse({"error": "not written yet", **meta}, status_code=404)

    docs = {}
    for name in ("CONCEPTS", "GRADING"):
        f = d / f"{name}.md"
        if f.exists():
            docs[name.lower()] = f.read_text()

    # A long week can be split into ordered parts named NN-title.md. The first
    # heading of each file is its label.
    parts = []
    for f in sorted(d.glob("[0-9][0-9]-*.md")):
        text = f.read_text()
        head = next((ln[2:].strip() for ln in text.splitlines() if ln.startswith("# ")),
                    f.stem)
        parts.append({"file": f.name, "title": head, "markdown": text})

    files = sorted(p.relative_to(d).as_posix() for p in d.rglob("*")
                   if p.is_file() and "__pycache__" not in p.as_posix()
                   and p.name not in ("README.md", "CONCEPTS.md", "GRADING.md")
                   and not re.match(r"^\d\d-.*\.md$", p.name))

    return {**meta, "markdown": readme.read_text(), "docs": docs,
            "parts": parts, "files": files}


@app.get("/api/docs/{name}")
async def doc(name: str):
    f = COURSE_DIR / f"{Path(name).name}.md"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"name": name, "markdown": f.read_text()}


@app.get("/{name}.js")
async def js(name: str):
    f = HERE / f"{Path(name).name}.js"
    if not f.exists():
        return PlainTextResponse("not found", status_code=404)
    return PlainTextResponse(f.read_text(), media_type="application/javascript")


@app.get("/", response_class=HTMLResponse)
async def index():
    return (HERE / "index.html").read_text()


if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    a = ap.parse_args()
    print(f"  labs repo  {LABS_DIR}")
    print(f"  site       http://{a.host}:{a.port}")
    uvicorn.run(app, host=a.host, port=a.port, log_level="warning")
