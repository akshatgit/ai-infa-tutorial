/* Interactive explainers for Week 0.
   Mounted where a lab file contains <!-- widget:name --> — invisible when the
   same markdown is read on disk or a git host. Nothing here touches a GPU. */

const WIDGETS = {};

function mountWidgets(root) {
  root.querySelectorAll("[data-widget]").forEach(el => {
    const fn = WIDGETS[el.dataset.widget];
    if (fn) fn(el);
    else el.remove();
  });
}

/* ---------------------------------------------------------------- tokenizer
   Real tokenizers apply a learned merge table we cannot ship here. What we can
   do exactly is the pre-tokenizer: the regex GPT-2 and friends use to cut text
   into candidate pieces before merging. Long or unusual words then split
   further, which the approximation below imitates. Labelled as approximate. */
const PRETOK = /'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+/gu;
const COMMON = new Set(("the of and to a in is it you that he was for on are with as i his they be at "
  + "one have this from or had by hot but some what there we can out other were all your when up use "
  + "word how said an each she which do their time if will way about many then them would write like "
  + "so these her long make thing see him two has look more day could go come did number sound no most "
  + "people my over know water than call first who may down side been now find any new work part take "
  + "get place made live where after back little only round man year came show every good me give our "
  + "under name very through just form much great think say help low line before turn cause same mean "
  + "differ move right boy old too does tell sentence set three want air well also play small end put "
  + "home read hand port large spell add even land here must big high such follow act why ask men "
  + "change went light kind off need house picture try us again animal point mother world near build "
  + "self earth father page capital france paris cache memory token model server request latency").split(" "));

function splitWord(piece) {
  const lead = piece.startsWith(" ") ? " " : "";
  const word = piece.slice(lead.length);
  if (!word) return [piece];
  if (word.length <= 3 || COMMON.has(word.toLowerCase())) return [piece];
  // Long or uncommon: BPE would keep a frequent stem and shed the rest.
  const out = [];
  let rest = word, first = true;
  while (rest.length > 0) {
    const take = first ? Math.min(rest.length, Math.max(3, Math.ceil(rest.length / 2)))
                       : Math.min(rest.length, 4);
    out.push((first ? lead : "") + rest.slice(0, take));
    rest = rest.slice(take);
    first = false;
  }
  return out;
}

function tokenize(text) {
  const pieces = text.match(PRETOK) || [];
  return pieces.flatMap(p => (/^\s+$/.test(p) ? [p] : splitWord(p)));
}

WIDGETS.tokenizer = el => {
  el.innerHTML = `
    <div class="w">
      <div class="w-head"><span class="w-title">Tokenizer</span>
        <span class="w-note">approximate &mdash; see note below</span></div>
      <div class="w-body">
        <textarea id="tk-in" rows="3" spellcheck="false">The capital of France is Paris. Unbelievably, tokenization is not about words.</textarea>
        <div class="chips" id="tk-out"></div>
        <div class="w-stats">
          <div><b id="tk-chars">0</b><span>characters</span></div>
          <div><b id="tk-words">0</b><span>words</span></div>
          <div><b id="tk-tokens">0</b><span>tokens</span></div>
          <div><b id="tk-ratio">0</b><span>chars / token</span></div>
        </div>
        <p class="w-foot">Whitespace is part of the token that follows it &mdash; that is why
          <code>" Paris"</code> carries a leading space. Common short words are one token;
          long or unusual ones split. For the exact vocabulary of a real model, try the
          <a href="https://platform.openai.com/tokenizer" target="_blank" rel="noopener">OpenAI
          tokenizer</a>.</p>
      </div>
    </div>`;

  const inp = el.querySelector("#tk-in");
  const draw = () => {
    const text = inp.value;
    const toks = tokenize(text);
    el.querySelector("#tk-out").innerHTML = toks.map((t, i) =>
      `<span class="chip c${i % 6}">${t.replace(/ /g, "·").replace(/\n/g, "↵")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join("");
    const words = (text.trim().match(/\S+/g) || []).length;
    el.querySelector("#tk-chars").textContent = text.length;
    el.querySelector("#tk-words").textContent = words;
    el.querySelector("#tk-tokens").textContent = toks.length;
    el.querySelector("#tk-ratio").textContent =
      toks.length ? (text.length / toks.length).toFixed(1) : "0";
  };
  inp.addEventListener("input", draw);
  draw();
};

/* ------------------------------------------------------------ the loop
   Shows that generation is a loop over a growing context, and that KV cache
   grows with it — the two facts the rest of the course is built on. */
WIDGETS.loop = el => {
  const PROMPT = "The capital of France is";
  const NEXT = [" Paris", ",", " a", " city", " of", " about", " two", " million", " people", "."];
  const LAYERS = 28, KV_PER_TOKEN = 28;   // Qwen2.5-1.5B: 28 layers, 28 KiB/token

  el.innerHTML = `
    <div class="w">
      <div class="w-head"><span class="w-title">One answer, one token at a time</span>
        <span class="w-note" id="lp-step">step 0</span></div>
      <div class="w-body">

        <p class="w-sub">The context &mdash; what the model is looking at</p>
        <div class="ctx" id="lp-ctx"></div>

        <p class="w-sub" style="margin-top:18px">Its KV cache &mdash; one column per token, one row per layer</p>
        <div class="kvwrap" id="lp-wrap">
          <div class="kvgrid" id="lp-grid"></div>
          <div class="kvtip" id="lp-tip" hidden></div>
        </div>
        <div class="kv-legend" style="margin-top:9px">
          <span><i class="sw kvp"></i>cached from the prompt</span>
          <span><i class="sw kvg"></i>cached as it generates</span>
          <span><i class="sw"></i>not computed yet</span>
        </div>

        <div class="w-stats">
          <div><b id="lp-n">0</b><span>tokens generated</span></div>
          <div><b id="lp-ctxlen">0</b><span>tokens in the cache</span></div>
          <div><b id="lp-kv">0</b><span>KiB the cache holds</span></div>
          <div><b id="lp-phase">idle</b><span>phase</span></div>
        </div>

        <div class="ctl" style="margin-top:14px">
          <button id="lp-run">Generate</button>
          <button class="ghost" id="lp-reset">Reset</button>
        </div>

        <p class="w-foot">Watch the grid. <b>Prefill</b> fills every column of the prompt at
          once &mdash; that is one big parallel pass. Then each <b>decode</b> step adds exactly
          one new column and re-reads all the others. Nothing is ever recomputed, and nothing
          is ever freed until the request ends.</p>
        <p class="w-foot">Twenty-eight rows because this model has twenty-eight layers, and
          every layer keeps its own key and value for every token. That is where the 28 KiB
          per token comes from. <b>Hover any part of the grid</b> &mdash; running, paused or
          idle &mdash; to see which token and layer a block belongs to and what it holds.</p>
      </div>
    </div>`;

  const promptToks = tokenize(PROMPT);
  const TOTAL = promptToks.length + NEXT.length;
  const KV_PER_CELL = KV_PER_TOKEN / LAYERS;   // one layer's key+value for one token
  let made = [], timer = null;
  let curPhase = "idle", hover = null;         // hover survives redraws

  const draw = phase => {
    curPhase = phase;
    const tok = t => t.replace(/ /g, "\u00b7");
    el.querySelector("#lp-ctx").innerHTML =
      promptToks.map(t => `<span class="chip prompt">${tok(t)}</span>`).join("") +
      made.map((t, i) => `<span class="chip gen${i === made.length - 1 ? " new" : ""}">${
        tok(t)}</span>`).join("") +
      (phase === "decode" ? '<span class="caret"></span>' : "");

    // One column per token slot, one row per layer. Columns light up as their
    // token enters the cache; the newest column is highlighted.
    const filled = phase === "idle" ? 0 : promptToks.length + made.length;
    const newest = made.length ? filled - 1 : -1;
    let rows = "";
    for (let l = 0; l < LAYERS; l++) {
      let cells = "";
      for (let c = 0; c < TOTAL; c++) {
        const on = c < filled;
        const isPrompt = c < promptToks.length;
        cells += `<i class="${on ? (isPrompt ? "kvp" : "kvg") : ""}${
          c === newest && phase !== "idle" ? " fresh" : ""}"></i>`;
      }
      rows += `<div class="kvrow">${cells}</div>`;
    }
    el.querySelector("#lp-grid").innerHTML = rows;

    // The stats describe the cache, so they follow `filled` — at idle nothing
    // has been computed yet and the cache is genuinely empty.
    el.querySelector("#lp-n").textContent = made.length;
    el.querySelector("#lp-ctxlen").textContent = filled;
    el.querySelector("#lp-kv").textContent = filled * KV_PER_TOKEN;
    el.querySelector("#lp-step").textContent = `step ${made.length}`;
    el.querySelector("#lp-phase").textContent = phase;
    paint();
  };

  /* ---- what one block is ------------------------------------------------
     A cell is a single layer's key and value for a single token. A column is
     all 28 layers for that token — the 28 KiB the stats line counts. Hovering
     reads current state, so it stays correct while paused or mid-generation. */

  const cellsPerToken = () => promptToks.length + made.length;

  const tipHTML = (c, l) => {
    const isPrompt = c < promptToks.length;
    const gi = c - promptToks.length;                 // index among generated
    const filled = curPhase === "idle" ? 0 : cellsPerToken();
    const written = c < filled;
    const when = isPrompt ? "prefill" : `decode step ${gi + 1}`;
    const text = isPrompt ? promptToks[c] : (written ? made[gi] : null);

    const head = text === null
      ? `<div class="kvtip-tok pending">not generated yet</div>`
      : `<div class="kvtip-tok">${text.replace(/ /g, "\u00b7")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;

    const state = written
      ? `<div class="kvtip-row on">written during <b>${when}</b>, kept until the request ends</div>`
      : `<div class="kvtip-row off">empty &mdash; will be written at <b>${when}</b></div>`;

    return head
      + `<div class="kvtip-row">token <b>${c + 1}</b> of ${TOTAL}`
      + ` &middot; layer <b>${l + 1}</b> of ${LAYERS}</div>`
      + `<div class="kvtip-row">this block holds one key + one value vector`
      + ` &mdash; <b>${KV_PER_CELL} KiB</b></div>`
      + `<div class="kvtip-row">whole column: <b>${KV_PER_TOKEN} KiB</b> for this token</div>`
      + state;
  };

  const paint = () => {
    const grid = el.querySelector("#lp-grid");
    const tip = el.querySelector("#lp-tip");
    const wrap = el.querySelector("#lp-wrap");
    grid.classList.toggle("dim", !!hover);
    if (!hover) { tip.hidden = true; return; }

    Array.from(grid.children).forEach((row, l) =>
      Array.from(row.children).forEach((cell, c) => {
        cell.classList.toggle("col", c === hover.c);
        cell.classList.toggle("cell", c === hover.c && l === hover.l);
      }));

    tip.hidden = false;
    tip.innerHTML = tipHTML(hover.c, hover.l);
    const maxL = wrap.clientWidth - tip.offsetWidth - 2;
    tip.style.left = `${Math.max(0, Math.min(hover.x + 14, maxL))}px`;
    tip.style.top = `${hover.y + 16}px`;
  };

  const wrap = el.querySelector("#lp-wrap");
  wrap.addEventListener("mousemove", e => {
    const grid = el.querySelector("#lp-grid");
    if (!grid.children.length) return;
    // Derive the cell from pointer position rather than the event target: the
    // cells are 3px tall, so every pixel should map to one instead of leaving
    // dead gaps between them.
    const gb = grid.getBoundingClientRect();
    const wb = wrap.getBoundingClientRect();
    const l = Math.max(0, Math.min(LAYERS - 1,
      Math.floor((e.clientY - gb.top) / (gb.height / LAYERS))));
    const c = Math.max(0, Math.min(TOTAL - 1,
      Math.floor((e.clientX - gb.left) / (gb.width / TOTAL))));
    hover = { c, l, x: e.clientX - wb.left, y: e.clientY - wb.top };
    paint();
  });
  wrap.addEventListener("mouseleave", () => { hover = null; paint(); });

  const stop = () => {
    clearInterval(timer); timer = null;
    el.querySelector("#lp-run").textContent = "Generate";
  };

  el.querySelector("#lp-run").onclick = () => {
    if (timer) { stop(); return; }
    if (made.length >= NEXT.length) made = [];
    el.querySelector("#lp-run").textContent = "Pause";
    draw("prefill");                       // whole prompt cached in one pass
    setTimeout(() => {
      timer = setInterval(() => {
        if (made.length >= NEXT.length) { stop(); draw("done"); return; }
        made.push(NEXT[made.length]);
        draw("decode");
      }, 520);
    }, 900);
  };
  el.querySelector("#lp-reset").onclick = () => { stop(); made = []; draw("idle"); };
  draw("idle");
};

/* --------------------------------------------------------- batching
   Why an inference server exists. Six requests, served strictly one after
   another versus all together. The point is not scheduling cleverness: a
   decode step spends its time reading the model weights out of memory, and
   that read is shared by everyone in the batch. */
WIDGETS.batching = el => {
  const REQS = [
    { id: "A", arrive: 0, tokens: 4 },
    { id: "B", arrive: 0, tokens: 7 },
    { id: "C", arrive: 1, tokens: 3 },
    { id: "D", arrive: 2, tokens: 6 },
    { id: "E", arrive: 3, tokens: 2 },
    { id: "F", arrive: 4, tokens: 5 },
  ];

  // One at a time: each request has the whole GPU to itself until it finishes.
  const solo = [];
  let clock = 0;
  for (const r of REQS) {
    const start = Math.max(clock, r.arrive);
    solo.push({ ...r, start, end: start + r.tokens });
    clock = start + r.tokens;
  }
  // Together: every request that has arrived gets a token on every step.
  const batch = REQS.map(r => ({ ...r, start: r.arrive, end: r.arrive + r.tokens }));

  const span = Math.max(...solo.map(r => r.end));
  const doneSolo = span;
  const doneBatch = Math.max(...batch.map(r => r.end));

  const lanes = (rows, cls) => rows.map(r => `
    <div class="lane">
      <span class="lane-id">${r.id}</span>
      <div class="track">${Array.from({ length: span }, (_, t) =>
        `<i class="${t >= r.start && t < r.end ? "busy " + cls
                    : t >= r.arrive && t < r.start ? "wait" : ""}"></i>`).join("")}</div>
      <span class="lane-n">${r.end}</span>
    </div>`).join("");

  el.innerHTML = `
    <div class="w">
      <div class="w-head"><span class="w-title">Six requests, two ways to serve them</span>
        <span class="w-note">same work, same GPU</span></div>
      <div class="w-body">

        <p class="w-explain">Each <b>row</b> is one request. Each <b>column</b> is one step of
          the loop from section&nbsp;1 &mdash; the time it takes to produce a single token.
          Requests arrive at different moments, and each needs a different number of tokens.</p>

        <div class="kv-legend">
          <span><i class="sw busy s1"></i>generating a token</span>
          <span><i class="sw wait"></i>arrived, but waiting its turn</span>
          <span><i class="sw"></i>not here yet, or finished</span>
        </div>

        <p class="w-sub" style="margin-top:18px">Serving them one after another</p>
        <div class="lanes">${lanes(solo, "s1")}</div>
        <p class="w-cap">Request F arrives at step 4 and does not get to start until step
          ${solo[5].start}. Everything is done at step <b>${doneSolo}</b>.</p>

        <p class="w-sub" style="margin-top:20px">Serving them all together</p>
        <div class="lanes">${lanes(batch, "s2")}</div>
        <p class="w-cap">Nobody waits. Everything is done at step <b>${doneBatch}</b>.</p>

        <div class="w-stats" style="margin-top:18px">
          <div><b>${doneSolo}</b><span>steps, one at a time</span></div>
          <div><b>${doneBatch}</b><span>steps, all together</span></div>
          <div><b>${(doneSolo / doneBatch).toFixed(1)}&times;</b><span>faster</span></div>
          <div><b>${(REQS.reduce((a, r) => a + r.tokens, 0) / doneBatch).toFixed(1)}</b><span>tokens per step, batched</span></div>
        </div>

        <p class="w-foot"><b>Why is the second one not cheating?</b> A decode step spends
          almost all of its time reading the model&rsquo;s weights &mdash; gigabytes &mdash;
          out of GPU memory. That read happens once per step no matter how many requests are
          in flight, and every request in the batch uses the same weights. So producing six
          tokens for six requests costs barely more than producing one token for one request.
          Serving them one at a time pays for that expensive read and then throws away most
          of the benefit.</p>
        <p class="w-foot">Getting this right &mdash; deciding who joins the batch, who waits,
          and what happens when memory runs out &mdash; is most of what an inference server
          does for you.</p>
      </div>
    </div>`;
};

/* ------------------------------------------------------------- kv cache
   Why the cache exists at all: without it, every step re-reads the whole
   prefix, so work grows with the square of the length. With it, each step
   handles one token and looks the rest up. The memory strip shows what that
   trade costs. */
WIDGETS.kvcache = el => {
  const KV_PER_TOKEN = 28;          // KiB — Qwen2.5-1.5B, 28 layers, 2 KV heads
  const PROMPT_TOKENS = 5;

  el.innerHTML = `
    <div class="w">
      <div class="w-head"><span class="w-title">Recompute, or remember?</span>
        <span class="w-note" id="kv-step">step 0</span></div>
      <div class="w-body">
        <div class="ctl">
          <div class="field"><label for="kv-len">Tokens to generate</label>
            <input id="kv-len" type="range" min="4" max="200" value="24" style="min-width:200px"></div>
          <div class="field"><label>&nbsp;</label>
            <span class="w-range" id="kv-len-v">24</span></div>
          <button id="kv-run">Step through it</button>
          <button class="ghost" id="kv-reset">Reset</button>
        </div>

        <div class="kv-cols">
          <div>
            <p class="w-sub">Without a cache &mdash; re-read everything, every step</p>
            <div class="kv-bars" id="kv-no"></div>
          </div>
          <div>
            <p class="w-sub">With a cache &mdash; one new token, rest looked up</p>
            <div class="kv-bars" id="kv-yes"></div>
          </div>
        </div>

        <div class="w-stats">
          <div><b id="kv-work-no">0</b><span>token-steps, no cache</span></div>
          <div><b id="kv-work-yes">0</b><span>token-steps, cached</span></div>
          <div><b id="kv-mult">1&times;</b><span>less work</span></div>
          <div><b id="kv-mem">140</b><span>KiB the cache holds</span></div>
        </div>

        <p class="w-foot" id="kv-math"></p>
        <p class="w-foot">Each bar is one generation step; its width is how many tokens that
          step had to process. The left column is <code>N&middot;P + N(N-1)/2</code> &mdash; the
          curve with N&sup2; in it. The right column is <code>P + N</code>. The cache is what
          turns the first into the second, paid for in GPU memory that grows for as long as
          the request lives.</p>
      </div>
    </div>`;

  const lenEl = el.querySelector("#kv-len");
  let step = 0, timer = null;

  const draw = () => {
    const total = +lenEl.value;
    el.querySelector("#kv-len-v").textContent = total;

    const shown = Math.min(step, total);
    const maxCtx = PROMPT_TOKENS + total;      // widest bar, for scaling

    const bars = (fn, cls) => Array.from({ length: total }, (_, i) => {
      const w = fn(i) / maxCtx * 100;
      const on = i < shown;
      return `<i class="${cls}${on ? " on" : ""}" style="width:${w.toFixed(2)}%"></i>`;
    }).join("");

    // Without a cache, step i re-reads the prompt plus everything generated so far.
    el.querySelector("#kv-no").innerHTML = bars(i => PROMPT_TOKENS + i, "kvb no");
    // With a cache, every step handles exactly one new token.
    el.querySelector("#kv-yes").innerHTML = bars(() => 1, "kvb yes");

    let workNo = 0;
    for (let i = 0; i < shown; i++) workNo += PROMPT_TOKENS + i;
    const workYes = shown;
    const mem = (PROMPT_TOKENS + shown) * KV_PER_TOKEN;

    el.querySelector("#kv-step").textContent = `step ${shown} of ${total}`;
    el.querySelector("#kv-work-no").textContent = workNo.toLocaleString("en-US");
    el.querySelector("#kv-work-yes").textContent = workYes.toLocaleString("en-US");
    el.querySelector("#kv-mult").textContent =
      workYes ? (workNo / workYes).toFixed(1) + "×" : "1×";
    el.querySelector("#kv-mem").textContent = mem.toLocaleString("en-US");
  };

  const stop = () => {
    clearInterval(timer); timer = null;
    el.querySelector("#kv-run").textContent = "Step through it";
  };

  el.querySelector("#kv-run").onclick = () => {
    if (timer) { stop(); return; }
    if (step >= +lenEl.value) step = 0;
    el.querySelector("#kv-run").textContent = "Pause";
    timer = setInterval(() => {
      if (step >= +lenEl.value) { stop(); return; }
      step++; draw();
    }, 70);
  };
  el.querySelector("#kv-reset").onclick = () => { stop(); step = 0; draw(); };
  lenEl.oninput = () => { stop(); step = 0; draw(); };

  // Open showing the finished state, so the shape is visible before pressing anything.
  step = +lenEl.value;
  draw();
};
