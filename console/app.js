/* Course website. No GPU connection, no auth — everything that touches
   hardware happens in the labs repo on the student's own box. */

const $ = id => document.getElementById(id);
const fmt = (v, d = 0) => v == null || Number.isNaN(v) ? "—"
  : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ================= markdown =================
   A small renderer rather than a CDN dependency: the site has to work on a
   machine with no outbound internet. Covers what the lab files actually use. */
function mdToHtml(md) {
  const esc = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = [];
  const MARK = "⁣C";
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    MARK + (blocks.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`) - 1) + MARK);

  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      const to = siteHref(href);
      return to.external
        ? `<a href="${to.href}" target="_blank" rel="noopener">${text}</a>`
        : `<a href="${to.href}">${text}</a>`;
    });

  const isBlock = l => new RegExp("^" + MARK + "\\d+" + MARK + "$").test(l.trim());
  const out = [], lines = md.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlock(line)) { out.push(blocks[+line.trim().split(MARK).join("")]); i++; continue; }
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // <!-- widget:name --> is a mount point here and an invisible comment
    // anywhere else the same markdown is read.
    const wg = line.match(/^\s*<!--\s*widget:([a-z0-9_-]+)\s*-->\s*$/i);
    if (wg) { out.push(`<div data-widget="${wg[1]}"></div>`); i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${mdToHtml(buf.join("\n"))}</blockquote>`);
      continue;
    }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || "")) {
      const cells = r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="tscroll"><table><thead><tr>${
        head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")
      }</tbody></table></div>`);
      continue;
    }

    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i])) {
        let txt = lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) &&
               !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[i])) { txt += " " + lines[i].trim(); i++; }
        items.push(`<li>${inline(txt)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,4}\s|>|\||\s*(?:[-*]|\d+\.)\s|---+\s*$)/.test(lines[i]) &&
           !isBlock(lines[i])) { para.push(lines[i]); i++; }
    if (para.length) {
      const text = para.join(" ");
      // "Go deeper:" paragraphs are further-reading, not prose — set them apart.
      const cls = /^\*\*Go deeper:\*\*/.test(text) ? ' class="refs"' : "";
      out.push(`<p${cls}>${inline(text)}</p>`);
    }
  }
  return out.join("\n");
}

/* Lab READMEs link between each other with filesystem paths, so they stay
   correct when read on disk or on a git host. The browser would resolve
   "../lab00-primer/" against the site URL and 404, so map those onto routes. */
function siteHref(href) {
  if (/^(https?:|mailto:|#)/.test(href)) {
    return { href, external: /^https?:/.test(href) };
  }
  const m = href.match(/(?:^|\/)(lab(\d{2})-[a-z0-9-]+)\/?$/i);
  if (m) {
    const w = WEEKS.find(x => x.slug.toLowerCase() === m[1].toLowerCase());
    if (w) return { href: `#week/${w.n}`, external: false };
    return { href: `#week/${parseInt(m[2], 10)}`, external: false };
  }
  // A file inside the labs repo: nothing to serve it from, so point at the
  // repo path rather than producing a link that silently 404s.
  return { href: "#", external: false, file: href };
}

/* ================= progress, per browser ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem("c:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("c:" + k, JSON.stringify(v)); } catch {} },
};

let WEEKS = [];

function renderNav() {
  const done = store.get("done", {});
  const h = location.hash || "#home";
  $("nav").innerHTML =
    `<a href="#home" class="${h === "#home" ? "on" : ""}"><span class="wk">&#9632;</span><span>Course home</span></a>
     <div class="sep"></div><div class="navhead">Weeks</div>` +
    WEEKS.map(w => `<a href="#week/${w.n}"
        class="${h === "#week/" + w.n ? "on" : ""}${w.available ? "" : " soon"}">
        <span class="wk">${String(w.n).padStart(2, "0")}</span><span>${w.title}</span>
        ${done[w.n] ? '<span class="tick">&#10003;</span>' : ""}</a>`).join("");
}

function markDone(n) {
  const d = store.get("done", {});
  d[n] = true;
  store.set("done", d);
  renderNav();
}

async function route() {
  const h = location.hash || "#home";
  const m = h.match(/^#week\/(\d+)$/);
  if (m) await showWeek(+m[1]); else showHome();
  renderNav();
  window.scrollTo(0, 0);
}

/* ---- home ---- */
function showHome() {
  $("predict").hidden = true;
  $("pagetitle").textContent = "Operating LLM Inference";
  const done = store.get("done", {});
  const n = WEEKS.filter(w => done[w.n]).length;
  const next = WEEKS.find(w => w.available && !done[w.n]) || WEEKS[0];

  $("tool").innerHTML = `
    <div class="hero">
      <h2>From operating Kubernetes to debugging a GPU-backed inference service</h2>
      <p>Eight weeks for experienced SREs. No machine-learning background needed.
         Every week asks you to predict a number, measure it on a real GPU, and
         explain the gap between the two.</p>
      <p>This site is the brief. The measuring happens on your own box, through the
         labs repo.</p>
      <div class="progress">${WEEKS.map(w =>
        `<i class="${done[w.n] ? "on" : ""}" title="Week ${w.n}"></i>`).join("")}</div>
      <p class="prog-label">${n} of ${WEEKS.length} weeks complete</p>
      <div class="ctl" style="margin-top:18px">
        <button onclick="location.hash='#week/${next ? next.n : 1}'">
          ${n ? "Continue" : "Start"} &mdash; Week ${next ? next.n : 1}</button>
      </div>
    </div>

    <div class="steps">
      <div class="step"><span class="num">STEP 1</span><h3>Get a GPU</h3>
        <p>Any NVIDIA card of compute capability 7.0 or newer, with root access.
           A rented instance is fine; a hosted notebook is not.</p></div>
      <div class="step"><span class="num">STEP 2</span><h3>Clone the labs</h3>
        <p>The workloads and test scripts live in their own repo.</p>
        <code>git clone &lt;labs-repo&gt;
cd ai-tutorial-labs</code></div>
      <div class="step"><span class="num">STEP 3</span><h3>Check, then set up</h3>
        <p><code>check</code> changes nothing and tells you what is missing.</p>
        <code>./labctl check
./labctl setup</code></div>
      <div class="step"><span class="num">STEP 4</span><h3>Start and run</h3>
        <p>Then open Week 1 and work down the list.</p>
        <code>./labctl serve
./labctl run 01</code></div>
    </div>`;
  $("body").innerHTML = "";
}

/* ---- a week ---- */
async function showWeek(n) {
  const meta = WEEKS.find(w => w.n === n);
  $("pagetitle").innerHTML = `Week ${n}${meta ? " &mdash; " + meta.title : ""}` +
    (meta ? `<span class="needs">${meta.needs}</span>` : "");
  $("body").innerHTML = "<p>Loading&hellip;</p>";
  $("tool").innerHTML = "";

  let data, res;
  try {
    res = await fetch(`/api/weeks/${n}`);
    data = await res.json();
  } catch {
    $("predict").hidden = true;
    $("body").innerHTML = "<p><b>Could not reach the site's API.</b> Is it still running?</p>";
    return;
  }
  if (!res.ok) {
    $("predict").hidden = true;
    $("body").innerHTML =
      `<p><b>This week has not been written yet.</b></p>
       <p>The course is being built one week at a time. Week 1 is ready.</p>`;
    return;
  }

  renderPredict(data);
  renderTool(data);
  renderTabs(data);
}

function renderPredict(w) {
  const box = $("predict");
  if (!w.predict) { box.hidden = true; return; }
  box.hidden = false;
  $("predict-q").textContent = w.predict;
  const saved = store.get("predict:" + w.n, null);
  const row = $("predict-row");
  if (saved) {
    row.innerHTML = `<span class="locked"></span><button class="ghost" id="p-reset">Change</button>`;
    row.querySelector(".locked").textContent = saved;
    $("p-reset").onclick = () => { store.set("predict:" + w.n, null); renderPredict(w); };
  } else {
    row.innerHTML = `<input id="p-in" placeholder="your prediction, in your own words">
                     <button id="p-save">Lock it in</button>`;
    const save = () => {
      const v = $("p-in").value.trim();
      if (!v) return;
      store.set("predict:" + w.n, v);
      renderPredict(w);
    };
    $("p-save").onclick = save;
    $("p-in").onkeydown = e => { if (e.key === "Enter") save(); };
  }
}

/* Runbook / concepts / grading are separate files in the labs repo; show them
   as tabs rather than making the reader hunt for them. */
function renderTabs(w) {
  const docs = w.docs || {};
  // A week split into parts shows those as the tabs; its README is the index.
  const tabs = (w.parts && w.parts.length)
    ? w.parts.map((p, i) => ["part" + i, `${i + 1}. ${p.title}`, p.markdown])
    : [["runbook", "Runbook", w.markdown]];
  if (docs.concepts) tabs.push(["concepts", "Concepts", docs.concepts]);
  if (docs.grading) tabs.push(["grading", "Grading", docs.grading]);

  const body = $("body");
  if (tabs.length === 1) {
    body.innerHTML = mdToHtml(w.markdown);
    mountWidgets(body);
    return;
  }

  body.innerHTML = `<div class="tabs" id="tabs">${tabs.map(([k, label], i) =>
      `<button class="tab${i ? "" : " on"}" data-k="${k}">${label}</button>`).join("")}</div>
    <div id="tabbody"></div>`;
  const show = k => {
    $("tabbody").innerHTML = mdToHtml(tabs.find(t => t[0] === k)[2]);
    mountWidgets($("tabbody"));
    document.querySelectorAll("#tabs .tab").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  };
  document.querySelectorAll("#tabs .tab").forEach(b => { b.onclick = () => show(b.dataset.k); });
  show(tabs[0][0]);
}

function panel(title, eyebrow, inner) {
  return `<section class="panel"><div class="panel-head"><h2>${title}</h2>
    <p class="eyebrow">${eyebrow}</p></div><div class="panel-body">${inner}</div></section>`;
}

/* ---- tools: pure client-side arithmetic and checklists, no GPU involved ---- */
function renderTool(w) {
  const host = $("tool");
  if (w.tool === "vram") return toolVram(host, w);
  if (w.tool === "alerts") return toolAlerts(host, w);
  if (w.tool === "faults") return toolFaults(host, w);
}

/* Week 2 — the KV cache arithmetic, as something you can play with before you
   run anything on a box. Pure maths; nothing here talks to a GPU. */
function toolVram(host, w) {
  const PRESETS = {
    "Qwen2.5 1.5B": [1.54, 28, 2, 128],
    "Qwen2.5 7B": [7.62, 28, 4, 128],
    "Llama 3.1 8B": [8.03, 32, 8, 128],
    "Llama 3.2 3B": [3.21, 28, 8, 128],
    "Mistral 7B v0.3": [7.25, 32, 8, 128],
    "Phi-3-mini 3.8B": [3.82, 32, 32, 96],
  };
  const selStyle = "font-family:var(--f-mono);font-size:.84rem;padding:7px 9px;" +
    "border:1px solid var(--rule-strong);border-radius:3px;background:var(--surface);" +
    "color:var(--ink);min-width:170px";

  host.innerHTML = panel("KV cache calculator", "week 2",
    `<div class="ctl">
       <div class="field"><label for="v-preset">Model</label>
         <select id="v-preset" style="${selStyle}">
           ${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join("")}</select></div>
       <div class="field"><label for="v-params">Params (B)</label><input id="v-params" type="number" step="0.01"></div>
       <div class="field"><label for="v-layers">Layers</label><input id="v-layers" type="number"></div>
       <div class="field"><label for="v-kvh">KV heads</label><input id="v-kvh" type="number"></div>
       <div class="field"><label for="v-hd">Head dim</label><input id="v-hd" type="number"></div>
     </div>
     <div class="ctl" style="margin-top:13px">
       <div class="field"><label for="v-vram">GPU VRAM (GB)</label><input id="v-vram" type="number" value="24" step="1"></div>
       <div class="field"><label for="v-util">Memory fraction</label><input id="v-util" type="number" value="0.90" step="0.01" min="0.1" max="0.99"></div>
       <div class="field"><label for="v-bytes">Bytes per weight</label><input id="v-bytes" type="number" value="2" step="0.5" min="0.5"></div>
       <div class="field"><label for="v-seq">Tokens per request</label><input id="v-seq" type="number" value="2048" step="128"></div>
     </div>
     <div class="readout" style="margin-top:18px">
       <div><span class="r-k">Weights</span><span class="r-v" id="v-w">—</span><span class="r-sub">GiB</span></div>
       <div><span class="r-k">KV per token</span><span class="r-v" id="v-per">—</span><span class="r-sub" id="v-per-sub">KiB</span></div>
       <div><span class="r-k">KV budget</span><span class="r-v" id="v-bud">—</span><span class="r-sub">GiB left over</span></div>
       <div><span class="r-k">Concurrent requests</span><span class="r-v" id="v-conc">—</span><span class="r-sub" id="v-conc-sub"></span></div>
     </div>
     <div class="verdict" id="v-say"></div>`);

  const GIB = 1024 ** 3;
  const load = name => {
    const [p, l, k, h] = PRESETS[name];
    $("v-params").value = p; $("v-layers").value = l;
    $("v-kvh").value = k; $("v-hd").value = h;
  };

  const calc = () => {
    const p = +$("v-params").value * 1e9, L = +$("v-layers").value,
          kvh = +$("v-kvh").value, hd = +$("v-hd").value,
          vram = +$("v-vram").value, util = +$("v-util").value,
          bytes = +$("v-bytes").value, seq = +$("v-seq").value;

    // ~6% of the advertised VRAM is not addressable, and the engine keeps a
    // workspace for activations, CUDA graphs and fragmentation.
    const usable = vram * 0.937, workspace = 1.9;
    const perTok = 2 * L * kvh * hd * 2;          // K and V, always fp16
    const weights = p * bytes / GIB;
    const budget = usable * util - weights - workspace;
    const tokens = budget > 0 ? budget * GIB / perTok : 0;
    const conc = tokens / Math.max(seq, 1);

    $("v-w").textContent = fmt(weights, 1);
    $("v-per").textContent = fmt(perTok / 1024);
    $("v-per-sub").textContent = `KiB · ${fmt(tokens / 1000, 1)}K tokens total`;
    $("v-bud").textContent = fmt(budget, 1);
    $("v-bud").className = "r-v" + (budget <= 0 ? " bad" : budget < 2 ? " warn" : "");
    $("v-conc").textContent = conc >= 1 ? fmt(conc) : conc > 0 ? conc.toFixed(1) : "0";
    $("v-conc").className = "r-v" + (conc < 1 ? " bad" : conc < 8 ? " warn" : "");
    $("v-conc-sub").textContent = `at ${fmt(seq)} tokens each`;

    const say = $("v-say");
    if (budget <= 0) {
      say.innerHTML = `<b>Will not load.</b> The weights alone need ${fmt(weights, 1)} GiB and
        the engine is only claiming ${fmt(usable * util, 1)} GiB. Quantize, raise the memory
        fraction, or pick a smaller model.`;
    } else if (conc < 1) {
      say.innerHTML = `<b>Cannot serve even one request this long.</b> The budget holds
        ${fmt(tokens)} tokens and you asked for ${fmt(seq)}.`;
    } else if (conc < 8) {
      say.innerHTML = `<b>Only ${fmt(conc)} requests at a time.</b> There is almost nothing to
        batch together, so throughput collapses toward serving one request at a time.`;
    } else {
      say.innerHTML = `<b>${fmt(conc)} requests at a time.</b> Healthy headroom. Now raise the
        tokens per request and watch that number fall off a cliff — that cliff, not GPU
        utilization, is what capacity planning is about.`;
    }
  };

  $("v-preset").onchange = () => { load($("v-preset").value); calc(); };
  ["v-params", "v-layers", "v-kvh", "v-hd", "v-vram", "v-util", "v-bytes", "v-seq"]
    .forEach(id => { $(id).oninput = calc; });
  load(Object.keys(PRESETS)[0]);
  calc();
}

const ALERTS = [
  ["QueueBuildingUp", "requests waiting > 20", "Drive 384 concurrent requests", "leading"],
  ["TTFTSLOBurn", "TTFT p95 > 1s", "384 concurrent, 2048-token prompts", "coincident"],
  ["DecodeStalling", "ITL p95 > 100ms", "Restart the engine with --enforce-eager", "coincident"],
  ["KVCacheThrashing", "preemptions rising", "Restart with memory fraction 0.35", "silent"],
  ["EngineDown", "scrape fails", "Kill the engine process", "hard"],
];

function toolAlerts(host, w) {
  host.innerHTML = panel("Prove every alert", "week 5",
    `<p class="note">An alert you have never watched fire is an alert you do not have.
       Tick each one only once you have seen it trigger on your own box.</p>
     <div class="tscroll" style="margin-top:14px"><table class="plain">
       <thead><tr><th>Alert</th><th>Condition</th><th>How to fire it</th><th>Class</th><th>Proved</th></tr></thead>
       <tbody>${ALERTS.map((a, i) => `<tr><td><code>${a[0]}</code></td><td>${a[1]}</td>
         <td>${a[2]}</td><td>${a[3]}</td>
         <td><input type="checkbox" id="al-${i}" style="min-width:0;width:16px;height:16px"></td></tr>`).join("")}
       </tbody></table></div>`);
  const saved = store.get("alerts", {});
  ALERTS.forEach((_, i) => {
    const cb = $("al-" + i);
    cb.checked = !!saved[i];
    cb.onchange = () => {
      saved[i] = cb.checked;
      store.set("alerts", saved);
      if (ALERTS.every((__, j) => saved[j])) markDone(w.n);
    };
  });
}

function toolFaults(host, w) {
  host.innerHTML = panel("Fault bank", "week 8",
    `<p class="note">Have someone else pick one and inject it without telling you which.
       Diagnose it from the metrics and the engine log alone, then write the postmortem.</p>
     <div class="tscroll" style="margin-top:14px"><table class="plain">
       <thead><tr><th>Fault</th><th>Inject with</th><th>What you will see</th></tr></thead><tbody>
       <tr><td>KV starvation</td><td><code>./labctl serve &lt;model&gt; 4096 0.35</code></td><td>HTTP 200 throughout, latency doubles</td></tr>
       <tr><td>Silent eager mode</td><td><code>--enforce-eager</code></td><td>decode ~20% slower, nothing logged</td></tr>
       <tr><td>OOM at load</td><td><code>./labctl serve &lt;model&gt; 32768 0.98</code></td><td>engine never starts</td></tr>
       <tr><td>Driver pulled</td><td><code>rmmod nvidia_uvm</code></td><td>nvidia-smi fine, CUDA calls fail</td></tr>
       <tr><td>Self-killing pkill</td><td><code>pkill -f "vllm serve"</code></td><td>exit 0, no output, service dead</td></tr>
       <tr><td>Disk full</td><td>fill the model cache</td><td>download stalls mid-pull</td></tr>
       </tbody></table></div>
     <div class="ctl" style="margin-top:14px">
       <button id="f-done">I ran an incident and wrote the postmortem</button></div>`);
  $("f-done").onclick = e => {
    markDone(w.n);
    e.target.textContent = "Marked ✓";
    e.target.disabled = true;
  };
}

/* ---- boot ---- */
(async () => {
  try {
    const d = await (await fetch("/api/weeks")).json();
    WEEKS = d.weeks;
    $("reposub").textContent = "labs: " + d.labs_repo.split("/").pop();
  } catch { WEEKS = []; }
  window.addEventListener("hashchange", route);
  route();
})();
