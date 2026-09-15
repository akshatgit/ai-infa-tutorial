# Prerequisites

## Required

- Linux: processes, memory, `/proc`, systemd, kernel modules
- Containers and Kubernetes: you have operated a cluster, not just used one
- Prometheus: you have written a recording rule and an alert
- Python or Go: you can read and modify a few hundred lines
- Incident response: you have been on call and written a postmortem

## Not required

- Any machine learning background
- Calculus, linear algebra, or transformer mathematics
- CUDA programming
- Prior GPU experience of any kind

## Self-check

If you can answer these, you are ready. If not, the course will still work but
Week 2 will be harder than it needs to be.

1. What is the difference between RSS and the page cache, and which does the
   kernel reclaim under pressure?
2. A service's p99 latency doubled but its CPU and error rate are flat. Name
   three hypotheses and the first command for each.
3. Why does `kubectl drain` sometimes hang, and what would you check?
4. Write a Prometheus alert for "p95 latency above 1s for 5 minutes".
5. What does DKMS do, and why would a kernel upgrade break a driver?

Question 1 is the important one. The entire VRAM model in Week 2 is built on
the analogy *weights are RSS, KV cache is the page cache* — sized by what is
left over, evicted under pressure, and decisive for performance. If that
analogy is already natural to you, Week 2 will feel obvious.

## What you need to bring

- An SSH client and a terminal you are comfortable in
- A GitHub account (for the capstone's upstream work)
- Willingness to write down a wrong prediction in front of other people
