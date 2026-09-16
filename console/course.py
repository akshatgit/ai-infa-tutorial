"""Course structure and lab discovery.

Deliberately dependency-free: both the dev server and the static builder import
this, and the builder must not need the server's web dependencies.
"""
import os
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent

# Where the labs live on a git host. The site renders their runbooks, but the
# files themselves are cloned onto a GPU box, so every link to one has to point
# here rather than at a path only this machine has.
LABS_URL = "https://github.com/akshatgit/ai-infa-tutorial-labs"

WEEKS = [
    {"n": 0, "slug": "lab00-primer", "title": "What you are actually operating",
     "needs": "just read it", "tool": None, "predict": None},
    {"n": 1, "slug": "lab01-request-anatomy", "title": "Anatomy of a request",
     "needs": "1 GPU", "tool": None,
     "predict": "At 64 concurrent requests, how many times higher will TTFT be "
                "than at 1? And inter-token latency?"},
    {"n": 2, "slug": "lab02-vram", "title": "VRAM accounting",
     "needs": "1 GPU", "tool": "vram",
     "predict": "How many tokens of KV cache will fit? Work it out before you run anything."},
    {"n": 3, "slug": "lab03-knee", "title": "Inside an inference engine",
     "needs": "1 GPU", "tool": None,
     "predict": "Which resource will stop you first — VRAM, GPU compute, or something else?"},
    {"n": 4, "slug": "lab04-k8s-gpu", "title": "Kubernetes GPU platform",
     "needs": "1 GPU, root", "tool": None,
     "predict": "How many distinct failures will you hit going from bare OS to a working CUDA device?"},
    {"n": 5, "slug": "lab05-observability", "title": "AI-specific observability",
     "needs": "1 GPU + k3s", "tool": "alerts",
     "predict": "Which signal moves first when the service degrades — TTFT, GPU utilization, or queue depth?"},
    {"n": 6, "slug": "lab06-autoscaling", "title": "Capacity and autoscaling",
     "needs": "1 GPU + k3s", "tool": None,
     "predict": "How long does a replica take to go from scheduled to serving?"},
    {"n": 7, "slug": "lab07-tensor-parallel", "title": "Distributed inference",
     "needs": "2 GPUs", "tool": None,
     "predict": "Will tensor parallelism across 2 GPUs give 2x throughput? If not, what fraction?"},
    {"n": 8, "slug": "lab08-incident", "title": "Reliability and security",
     "needs": "1 GPU", "tool": "faults",
     "predict": "Which failure mode returns HTTP 200 for its entire duration?"},
]


def find_labs() -> Path:
    """The labs live in their own repo — students clone that onto a GPU box.
    The site renders its runbooks so there is one source of truth, not two."""
    env = os.environ.get("LABS_REPO")
    if env:
        return Path(env).expanduser().resolve()
    for cand in (SITE.parent / "ai-tutorial-labs", SITE / "labs"):
        if cand.is_dir():
            return cand
    return SITE / "labs"
