# Instructor guide

## Shape of a week

| Block | Time | What happens |
|---|---|---|
| Systems lecture | 75 min | Concepts, with the SRE analogue named explicitly every time |
| Guided lab | 90 min | Students produce a measurement. Instructor does not demo it first. |
| Independent | 2–3 h | Extend the lab, or work the capstone |

**Never demo the lab before the students run it.** The pedagogy depends on them
predicting a number, being wrong, and explaining the gap. A demo destroys that.

## The prediction ritual

Every lab starts the same way: students write down a predicted number and their
reasoning, before running anything. Collect the predictions. After the run,
compare distributions.

This matters more than any single lab. The course's claim is that inference
infrastructure is *reasonable about* — that you can predict it from a model of
how it works. The predictions are how students discover whether their model is
any good, and where it breaks.

Weeks where nearly everyone predicts wrong in the same direction:

- **Week 2** — students underestimate KV cache, badly. Phi-3-mini vs Llama 3.1
  8B is the fastest way to show why GQA matters.
- **Week 3** — nearly everyone predicts the bottleneck is VRAM or GPU compute.
  It is `max_num_seqs`, a config default, with the KV cache at 9.3%.
- **Week 6** — students assume autoscaling solves spikes. Cold start is 110s.
- **Week 7** — students expect TP=2 to give 2×. On PCIe it does not.

## Running the eight weeks

| Week | Hardware | Notes |
|---|---|---|
| 1–3 | 1× L4 | Bare vLLM. **No Kubernetes.** It adds nothing and hides the engine. |
| 4 | 1× L4, **fresh box** | Must be rebuilt from bare OS. Do not reuse a working image. |
| 5–6 | 1× L4 + k3s | Prometheus, Grafana, KServe |
| 7 | **2× L4** | Resize to `gx3-32x160x2l4` |
| 8 | 1× L4 + k3s | Full stack, for the incident |

MIG needs an A100 (`gx3d`). The L4 cannot do it. Rent one for the few hours
Week 4 covers MIG, then drop back.

## Week 4 is the week that breaks

Do **not** pre-bake an image. The failures are the curriculum, and this course's
own build hit all of them:

1. `linux-headers-$(uname -r)` not in the archive — booted kernel superseded
2. Reboot required, which wipes `/tmp` and any staged scripts
3. `nvcc` missing — driver-only is not enough, `deep_gemm` JIT-compiles at warmup
4. The engine printing *correct KV sizing* and then dying anyway

Point 4 is the teaching moment. Every log line up to the crash looked healthy.
Students who stop reading at "Graph capturing finished" conclude the service is
fine. That is the shape of a real inference incident.

Budget 3 hours, not 90 minutes, the first time you run Week 4.

## Common instructor mistakes

**Explaining before measuring.** The temptation to say "the knee will be at 256
because max_num_seqs defaults to 256" is enormous. Don't. Let them find it.

**Letting GPU utilization into a dashboard.** It will anchor every subsequent
discussion. Ban it until Week 5, then introduce it specifically as a trap:
0% while holding 20.5 GiB, near-100% during memory-bound decode.

**Treating the capstone as optional.** It is 35% of the grade and the entire
reason the course produces a hiring signal. Start it in Week 3.

## Cohort size and cost

10–15 engineers, paired, so 5–8 GPU instances. At ~$1.30/hr and ~40 lab hours,
roughly $364 for the cohort. Use on-demand, not spot — a preemption during a
90-minute lab is the session.

Run the first cohort at cost or free. Their failure points are what turn this
from a syllabus into a course.
