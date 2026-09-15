# Capstone

35% of the grade. Start it in Week 3, not Week 7.

## The requirement

Pick a real open problem in vLLM, llm-d, KServe or the GPU Operator and produce
seven artifacts:

1. A reproducible workload or failure — a script anyone can run
2. Measurements and a stated hypothesis, written **before** the analysis
3. Root-cause analysis
4. A test, patch, controller or instrumentation change
5. A runbook
6. An upstream issue or pull request
7. A technical blog post

**The patch does not have to be merged.** A minimal reproducer, a failing test
and a defensible analysis are real engineering output, and they are the signal
AI-infrastructure interviews currently find missing.

## Rubric

| | Weight | Fail | Pass | Strong |
|---|---|---|---|---|
| Reproducibility | 20% | "It happened once" | Script reproduces it | Reproduces on hardware you don't own |
| Measurement | 20% | Screenshots | Numbers with methodology | Predicted, then measured, gap explained |
| Analysis | 25% | Plausible story | Cause identified, alternatives eliminated | Evidence rules out each competing hypothesis |
| Artifact | 20% | Description of a fix | Working test/patch/controller | Upstream-quality, with a test |
| Communication | 15% | Notes | Clear runbook + post | A maintainer could act on it unedited |

## Viable subjects

Each of these is a real gap, not an exercise:

**Missing or misleading CUDA-graph metrics.** Graph capture consumed 0.29 GiB
on `gpu1` and is reported nowhere in `/metrics`. Memory that no dashboard
accounts for is memory you will misattribute during an incident.

**GPU memory attribution across sleep/wake.** `vllm:engine_sleep_state` exists
with `awake`/`weights_offloaded`/`discard_all`. What happens to attribution
across those transitions, and does anything notice a leak?

**Warm-capacity semantics in an inference autoscaler.** KServe and llm-d both
scale on queue depth now. Neither has a first-class notion of "hold N warm
replicas because cold start is 110 seconds." Design it, or show why it belongs
elsewhere.

**Per-request inference-time accounting.** Splitting a request's latency into
queue / prefill / decode server-side, per request, rather than as aggregate
histograms. This is what every Week 1 student wishes existed.

**Kernel and model cache supply-chain integrity.** JIT artifacts under
`~/.cache` are executable inputs to every later run. What would signing or
verifying them look like? (Note: the author has four published advisories in
this space — this subject has a natural mentor.)

**Reproducing and detecting a distributed inference hang.** A collective hang
produces high GPU utilization, zero tokens, and no errors. Build the reproducer
and the detector.

## Deliverable checkpoints

| Week | Due |
|---|---|
| 3 | Subject chosen, one paragraph on why it matters |
| 5 | Reproducer runs; hypothesis written down |
| 6 | Measurements complete |
| 7 | Root cause identified, artifact drafted |
| 8 | Upstream issue/PR filed, blog post drafted |

Filing upstream in Week 8 rather than after the course matters: maintainer
response arrives while the student still has the context loaded.
