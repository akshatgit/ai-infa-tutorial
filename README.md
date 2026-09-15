# Operating LLM Inference — AI Infrastructure for SREs

Eight weeks, ~40 hours. Takes an experienced SRE from "I can operate Kubernetes"
to "I can explain, benchmark, scale, and debug a GPU-backed inference service."

**Syllabus (web):** https://claude.ai/code/artifact/8335beb0-798c-4343-9e5a-2f5c8725f495

Not MLOps. Not a RAG chatbot. Production inference infrastructure, one coherent
stack, taught on real hardware, with every lab producing a measurement the
student has to defend.

## Stack

```
CUDA → vLLM → Kubernetes (k3s) → NVIDIA GPU Operator/DCGM → Prometheus → KServe
```

Self-managed k3s, not managed Kubernetes. Managed control planes hide exactly
the layer Week 4 teaches — watching the GPU Operator install break is the point.

## Running the labs on your own GPU

Nothing here is tied to the box below. The console and both lab scripts take a
vLLM endpoint and read everything device-specific from the engine, so the course
works on any GPU that vLLM supports (sm_70+) — your own card, a rented instance,
or a cloud VM.

```bash
cd console && ./run.sh http://your-gpu-host:8000
```

The reference numbers throughout were measured on the rig below; students should
expect different ones and be able to explain the difference. That explanation is
the course.

## Reference hardware

| | |
|---|---|
| Host | IBM Cloud VPC `gx3-16x80x1l4` |
| GPU | NVIDIA L4 24 GB, AD104GL, sm_89 — **bf16 native** |
| Reported VRAM | 23034 MiB (~22.5 GiB addressable) |
| CPU / RAM | 16 vCPU / 78 GiB |
| OS | Debian 13 trixie, kernel 6.12.107 |
| Driver | 615.71.09, CUDA UMD 13.4 |

A VM with GPU passthrough and **root**. Not a notebook. That distinction rules
out Kaggle, Colab, Lightning and Modal for Weeks 4 and 8 — none of them let you
load a kernel module, so the GPU Operator, the device plugin and every
driver-level failure injection are impossible there.

L4 over the originally-planned T4: sm_89 has native bf16 and 24 GB, so lab
numbers transfer to what students actually run. T4 (sm_75) would have forced
`--dtype half` and a caveat in every lab.

### Week 7 — multi-GPU

Resize to `gx3-32x160x2l4` for `--tensor-parallel-size 2`. Same VPC, same image.

### MIG

L4 cannot do MIG. Rent a `gx3d` A100 for the few hours Week 4 covers it, then
drop back. Do not size the plan around it.

## Cost

A GPU VM bills while it is idle. `nvidia-smi` will read **0% utilization** while
the engine holds 20 GB of VRAM and the card does nothing, so stop the instance
when you finish for the day.

Rough figures for a single 24 GB card at around $1.30/hour:

| Phase | Hours | Cost |
|---|---|---|
| Authoring weeks 1–6 | 75 | ~$98 |
| Week 7, two GPUs | 10 | ~$23 |
| MIG segment on an A100 | 8 | ~$35 |
| A cohort of 10–15, paired | 280 | ~$364 |

Note that Power (ppc64le) hardware cannot run this course at all: NVIDIA
deprecated ppc64le in CUDA 12.4 and removed it in 12.5, so there is no modern
vLLM for it.

## Repository

```
index.html                        published syllabus app
console/                          live lab console — runs anywhere, any vLLM endpoint
course/PREREQUISITES.md           self-check before week 1
course/INSTRUCTOR.md              how to run each week, and what breaks
course/CAPSTONE.md                rubric + six viable subjects
labs/week01-inference-request/    decompose.py — queue / prefill / TTFT / ITL
labs/week02-vram/                 predict → measure → explain the gap
labs/week03-engine-internals/     saturate.py — find the knee
labs/week04-gpu-platform/         bare OS → CUDA, with the real failure sequence
labs/week05-observability/        SLO alert rules, each with a proof injection
labs/week06-autoscaling/          CPU HPA vs queue HPA, admission control
labs/week07-distributed/          TP=2 vs 2 replicas on PCIe; collective hangs
labs/week08-reliability/          fault bank, timed incident, postmortem spec
```

## What was measured on real hardware

Everything below came off `gpu1`, not from documentation:

| | |
|---|---|
| Addressable VRAM | 22.49 GiB (`nvidia-smi` reports 23034 MiB, not 24576) |
| Workspace overhead | 1.93 GiB — back-solved, not assumed |
| KV cache | 578,000 tokens @ 141.11× concurrency |
| VRAM calculator error | **0.01%** against vLLM's own allocation |
| Cold start to healthy | 110 s (1.5B model, warm local weights) |
| Week 1 knee | TTFT ×5.3 vs ITL ×1.25 at 64 concurrent — queue-bound |
| Week 3 knee | concurrency 256, 6,680 tok/s; throughput *falls* past it |
| Limiting resource at saturation | `max_num_seqs=256`, with KV cache at **9.3%** |

That last row is the course's best single result: the bottleneck is a config
default, not the GPU and not the memory everyone spent Week 2 budgeting.

## The real exam

> The service is violating its TTFT SLO. Show me where the time and the GPU
> memory went.
