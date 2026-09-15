# Lab console

A web app over the lab. Live engine state, and a sweep runner that finds the
Week 3 knee while you watch it happen.

**It runs wherever you are, against any vLLM endpoint on any GPU.** The console
holds no knowledge of a particular machine — model name, KV cache size, block
count and `gpu_memory_utilization` are all read from the engine at runtime.

## Run it

```bash
cd console
./run.sh                                      # engine on this machine
./run.sh http://gpu-host:8000                 # engine on another machine
./run.sh http://127.0.0.1:8000 user@gpu-host  # engine via tunnel, device over SSH
```

First run creates `.venv` and installs `requirements.txt`. Then open
<http://127.0.0.1:8080>.

### Leaving it running

`run.sh` dies with your terminal. For a session that outlives it, use
`screen.sh`, which runs the console — and, when needed, its SSH tunnel — in
detached `screen` sessions:

```bash
./screen.sh                              # engine on this machine
./screen.sh http://gpu-host:8000         # engine reachable directly
./screen.sh tunnel user@gpu-host         # engine behind SSH; opens the tunnel too

./screen.sh status                       # what is up, and is it answering
./screen.sh stop                         # stop both
screen -r lab-console                    # attach (detach again with ctrl-a d)
screen -r lab-tunnel
```

The tunnel session runs its `ssh` in a retry loop with
`ServerAliveInterval=15`. A dropped link is the thing that actually fails during
a 90-minute lab, and it reconnects within about five seconds without touching
the console.

### Against a remote GPU

Anything that speaks vLLM's OpenAI API works — your own box, a rented
RunPod/Vast instance, a cloud VM. If the engine's port is not reachable, tunnel
it and point the console at the local end:

```bash
ssh -L 8000:localhost:8000 user@gpu-host
./run.sh http://127.0.0.1:8000 user@gpu-host
```

### Device tiles are opt-in, deliberately

VRAM and GPU-utilization tiles need `nvidia-smi`, and the console **cannot infer
where to run it**. A tunnel makes a remote engine look like `127.0.0.1`, so
reading `nvidia-smi` locally would report *this* machine's card with numbers
that look entirely plausible. Building this, the console briefly reported a
GTX 1080's 8 GiB while actually driving an L4.

So you state the source, or you get no tiles:

| Situation | Flag |
|---|---|
| Engine on this machine | `GPU_LOCAL=1 ./run.sh` |
| Engine elsewhere, SSH available | pass `user@host` as the 2nd argument |
| Neither | omit both — tiles disappear, nothing else changes |

Everything the labs actually need comes from `/metrics`, so the third row is a
perfectly good way to run the course.

### Exposing it

Default bind is `127.0.0.1`. To serve others:

```bash
HOST=0.0.0.0 PORT=8080 ./run.sh http://127.0.0.1:8000
```

A non-loopback bind **mints a token automatically** and prints it (also written
to `~/console.token`); open `http://host:8080/?t=<token>`. The console drives
arbitrary load on a billed GPU, and vLLM itself has no authentication — putting
an open load generator in front of an open engine is the Week 8 lesson, so the
lab does not model the mistake.

On a cloud VM you will also need an inbound rule for the port. On IBM Cloud VPC
the default security group admits only 22, which is why the tunnel above is the
path of least resistance.

## What it shows

**Tiles** — running, waiting, KV%, throughput, preemptions, and device stats
when available. GPU utilization is labelled a trap on purpose: it reads 0% while
the engine holds 20 GiB.

**Live charts** — queue, throughput, latency and KV cache over a 120-second
window. Four separate charts rather than one with two y-axes: tok/s and
milliseconds do not share a scale, and overlaying them invents a relationship.

**Sweep** — enter concurrency levels, press run, rows stream in one at a time
over SSE. The knee is detected server-side and marked on the chart. When the
engine stops admitting work while the KV cache is still mostly free, the verdict
says so — that inference is computed from the data, not hardcoded to any
particular `max_num_seqs`.

## Where the numbers come from

| Number | Source |
|---|---|
| running, waiting, KV%, preemptions | `/metrics` gauges, read directly |
| throughput | `generation_tokens_total` delta ÷ elapsed |
| live TTFT / ITL | histogram `_sum`/`_count` deltas — a true interval mean |
| sweep percentiles | measured client-side, per request |
| KV capacity, blocks, util | `vllm:cache_config_info` labels |
| model name | `/v1/models` |
| VRAM, util, temp | `nvidia-smi`, only where you said to run it |

## Three bugs worth knowing about

All three were found building this, and all three are silent:

**Prefix-matching metric names.** `vllm:num_requests_waiting` is a prefix of
`vllm:num_requests_waiting_by_reason`; a `startswith` match reads whichever
appears last. Match exactly, up to the label brace.

**Gating several peaks on one field.** Tracking the peak sample with
`if waiting >= peak.waiting` fails whenever the batch fits under `max_num_seqs`:
waiting stays 0, every sample passes the gate, and the final post-drain sample
overwrites running and KV with zeros. Track each field's own maximum.

**`pkill -f` matching its own shell.** Never used here — `run.sh` kills by
pidfile. See Week 8, where this happened three times in one afternoon.
