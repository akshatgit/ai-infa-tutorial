# Operating LLM Inference — course site

The website for an eight-week course taking experienced SREs from operating
Kubernetes to debugging a GPU-backed inference service.

**This repo is the site only.** It has no GPU connection, no authentication and
no server-side logic. The workloads and test scripts students actually run live
in a separate repo,
[`ai-infa-tutorial-labs`](https://github.com/akshatgit/ai-infa-tutorial-labs),
and this site
renders their runbooks so there is one source of truth rather than two copies
that drift.

## Layout

```
console/        the site — a small FastAPI app for local editing
  index.html      shell and stylesheet
  app.js          routing, markdown renderer, per-week tools
  widgets.js      interactive explainers (tokenizer, KV cache, batching)
  course.py       week list and lab discovery, dependency-free
  server.py       dev server; reads the labs repo from disk
build.py        bakes everything into one static page
dist/           the built page, committed so hosts need no build step
course/         instructor guide, capstone rubric, prerequisites
```

## Editing it

```bash
cd console
./run.sh                 # http://127.0.0.1:8080, live from the labs repo
HOST=0.0.0.0 ./run.sh    # serve it on your network
./screen.sh              # same, in a detached screen session
```

The dev server reads the labs repo on every request, so edits to a runbook show
up on reload.

## Publishing it

```bash
python3 build.py         # writes dist/index.html
git add dist && git commit && git push
```

`build.py` inlines the stylesheet, both scripts and every runbook into a single
self-contained page — about 90 KB, no external requests except web fonts. Any
static host will serve it; `netlify.toml` sets the publish directory.

The build needs the labs repo checked out next to this one:

```bash
git clone https://github.com/akshatgit/ai-infa-tutorial-labs.git ../ai-tutorial-labs
```

It looks for `../ai-tutorial-labs`, or set `LABS_REPO` to point somewhere else.
Because the hosting platform has no access to that repo, `dist/` is committed
rather than built remotely.

Two different things point at the labs, and they are set separately: `LABS_REPO`
is the checkout the build *reads*, and `LABS_URL` in `console/course.py` is the
address the finished page *links to*. Change the latter if the repo moves.

## The course

| Week | Subject | Needs |
|---|---|---|
| 0 | What you are actually operating | nothing — just read it |
| 1 | Anatomy of a request | 1 GPU |
| 2 | VRAM accounting | 1 GPU |
| 3 | Inside an inference engine | 1 GPU |
| 4 | Kubernetes GPU platform | 1 GPU, root |
| 5 | AI-specific observability | 1 GPU + k3s |
| 6 | Capacity and autoscaling | 1 GPU + k3s |
| 7 | Distributed inference | 2 GPUs |
| 8 | Reliability and security | 1 GPU |

Weeks are being written one at a time. A week whose runbook does not exist yet
renders a note saying so rather than failing.
