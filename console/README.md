# The site

A small FastAPI app for editing the course site locally. It reads the runbooks
from the labs repo on every request, so a change to a `README.md` there shows up
on reload.

It has no GPU connection, no authentication and no tunnel. Everything that
touches hardware happens in the labs repo, on the student's own machine.

## Run it

```bash
./run.sh                 # http://127.0.0.1:8080
HOST=0.0.0.0 ./run.sh    # serve it on your network
PORT=9000 ./run.sh       # somewhere else

./screen.sh              # detached screen session, survives your terminal
./screen.sh status
./screen.sh stop
```

First run creates `.venv` and installs `requirements.txt`.

It finds the labs repo as a sibling directory. To point somewhere else:

```bash
LABS_REPO=~/src/ai-tutorial-labs ./run.sh
```

That is the checkout it reads. The address it *links to* —
[`ai-infa-tutorial-labs`](https://github.com/akshatgit/ai-infa-tutorial-labs) —
is `LABS_URL` in `course.py`, and it is what the clone command on the front page
and every link to a lab script resolve against.

## Files

| | |
|---|---|
| `index.html` | shell and the whole stylesheet |
| `app.js` | routing, markdown renderer, per-week tools |
| `widgets.js` | interactive explainers for Week 0 |
| `course.py` | the week list and lab discovery — no dependencies, shared with `build.py` |
| `server.py` | the dev server |

## How a week is assembled

For week *N* the server looks in the lab directory for:

- `README.md` — the runbook. Required; without it the week renders as unwritten.
- `NN-*.md` — optional ordered parts. A long week becomes tabs instead of one
  long scroll.
- `CONCEPTS.md`, `GRADING.md` — optional, become their own tabs.

## Two conventions worth knowing

**`<!-- widget:name -->`** in a runbook mounts an interactive explainer there.
It is an invisible HTML comment everywhere else the same markdown is read, so
the labs repo stays a normal readable repo.

**Links between labs** are written as filesystem paths — `../lab00-primer/` —
so they work on disk and on a git host. The renderer rewrites them to site
routes, because a browser would otherwise resolve them against the site URL
and 404.

## Publishing

Editing happens here; publishing is `python3 build.py` in the parent directory,
which bakes this into a single static page. See the repo README.
