import { useState, useMemo } from "react";

/* ──────────────────────────────────────────────────────────
   EasyJob — job search + application tracker (mobile prototype)
   Design language: "quality gate" — borrowed from CI/CD dashboards.
   Freshness is a first-class filter; match scores read like pass rates.
   ────────────────────────────────────────────────────────── */

const T = {
  bg: "#F5F6F2",
  card: "#FFFFFF",
  ink: "#1A2421",
  sub: "#5C6B66",
  line: "#E3E7E1",
  gate: "#0D7A5F",
  gateDark: "#0A5C48",
  lime: "#C6F432",
  amber: "#E8A33D",
  red: "#D45B5B",
  chip: "#EDF0EA",
};

const TITLE_PRESETS = [
  "Lead SDET",
  "Test Automation Lead",
  "QA Automation Lead",
  "QA Engineering Manager",
  "Quality Engineering Lead",
];

const INDUSTRIES = [
  { id: "ai", label: "AI / ML" },
  { id: "fintech", label: "Fintech" },
  { id: "health", label: "Healthtech" },
  { id: "saas", label: "Enterprise SaaS" },
  { id: "auto", label: "Autonomy / Robotics" },
];

const SOURCES = ["Greenhouse", "Ashby", "Lever", "LinkedIn", "Indeed", "HN"];

// Seed data — modeled on a real search for QA-lead roles at AI companies
const SEED_JOBS = [
  {
    id: 1, title: "QA Engineering Manager", company: "Deepgram",
    industry: "ai", tag: "Voice AI", location: "Remote · US",
    comp: "$190K–235K", source: "Ashby", daysAgo: 1, match: 96,
    summary: "Own cross-product test strategy, automation frameworks, CI/CD quality gates, and lead the QA team across STT/TTS/voice-agent product lines.",
    notes: "Lead scope + AI-native company + automation ownership. Strongest overall fit.",
  },
  {
    id: 2, title: "QA Lead, AI Agent", company: "Cresta",
    industry: "ai", tag: "Agent AI", location: "Remote · US",
    comp: "Base + bonus + equity", source: "Greenhouse", daysAgo: 2, match: 91,
    summary: "End-to-end quality strategy for AI agents: LLM simulations, LLM-on-LLM rubrics, adversarial red-teaming; lead a pod of QA analysts.",
    notes: "Heavy LLM-eval focus — pairs well with DeepEval experience.",
  },
  {
    id: 3, title: "Lead SDET", company: "Coupa Software",
    industry: "saas", tag: "AI Spend", location: "Foster City, CA · Hybrid",
    comp: "$145K–170K", source: "LinkedIn", daysAgo: 2, match: 78,
    summary: "Lead automated test suites and strategy with product and dev teams; mentor SDETs on an AI-driven spend management platform.",
    notes: "AI-powered enterprise software rather than AI-native. Bay Area hybrid.",
  },
  {
    id: 4, title: "Lead Quality Engineer", company: "Replicant",
    industry: "ai", tag: "Voice AI", location: "Remote · US",
    comp: "Not listed", source: "Ashby", daysAgo: 5, match: 88,
    summary: "Raise the quality bar across a voice AI platform: automation frameworks, validation tooling, CI/CD quality gates, AI-expanded edge-case coverage.",
    notes: "8+ yrs QE/SDET with test-strategy ownership. AI-native QE culture.",
  },
  {
    id: 5, title: "QA Lead Engineer", company: "Deepgram",
    industry: "ai", tag: "Voice AI", location: "SF or Remote",
    comp: "$180K–230K", source: "Ashby", daysAgo: 1, match: 90,
    summary: "Hands-on automation lead: build and extend frameworks in CI/CD (Playwright, PyTest), run release qualification, drive exploratory testing.",
    notes: "IC-lead flavor; verify listing is live before applying.",
  },
  {
    id: 6, title: "Product Quality Assurance Lead", company: "Perplexity AI",
    industry: "ai", tag: "AI Search", location: "NYC or SF",
    comp: "$90K–130K", source: "Greenhouse", daysAgo: 9, match: 74,
    summary: "Lead QA for product features: test-driven culture, scale tooling across platforms, quality metrics over time.",
    notes: "Flagship brand; comp below lead-level band, leans manual.",
  },
  {
    id: 7, title: "QA Lead - Release & Automation", company: "Teramind",
    industry: "saas", tag: "AI Security", location: "Remote · US",
    comp: "Not listed", source: "Lever", daysAgo: 12, match: 70,
    summary: "Lead QA engineers and automate release validation; AI-powered overhaul of the QA automation landscape across web and desktop.",
    notes: "Outside 10-day window — shows only at the 15-day gate.",
  },
  {
    id: 8, title: "Lead SDET (Payments AI)", company: "Hyperline",
    industry: "fintech", tag: "Fintech AI", location: "NYC · Hybrid",
    comp: "$170K–195K", source: "Greenhouse", daysAgo: 4, match: 76,
    summary: "Stand up the SDET function for an AI-assisted billing platform: API/contract testing, quality gates in GitHub Actions.",
    notes: "Fintech industry filter demo entry.",
  },
  {
    id: 9, title: "Test Automation Lead", company: "Abridge",
    industry: "health", tag: "Clinical AI", location: "Remote · US",
    comp: "$165K–200K", source: "Greenhouse", daysAgo: 14, match: 80,
    summary: "Own automation for clinical AI documentation products; HIPAA-aware pipelines, model-output regression suites.",
    notes: "Healthtech filter demo entry; 15-day gate only.",
  },
];

const STAGES = ["Saved", "Applied", "Interview", "Offer"];
const STAGE_COLOR = { Saved: T.sub, Applied: T.gate, Interview: T.amber, Offer: "#7A4DD8" };

const freshLabel = (d) => (d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`);

function FreshDot({ days }) {
  const c = days <= 3 ? T.gate : days <= 10 ? T.amber : T.sub;
  return <span style={{ background: c }} className="inline-block w-2 h-2 rounded-full mr-1.5" />;
}

function MatchBar({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: T.line }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 85 ? T.gate : pct >= 75 ? T.amber : T.sub }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: T.ink, fontFamily: "ui-monospace, monospace" }}>{pct}%</span>
    </div>
  );
}

export default function EasyJob() {
  const [tab, setTab] = useState("search");
  const [freshness, setFreshness] = useState(10);
  const [titles, setTitles] = useState(["Lead SDET", "Test Automation Lead", "QA Automation Lead"]);
  const [industry, setIndustry] = useState("ai");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(true);
  const [detail, setDetail] = useState(null);
  const [tracked, setTracked] = useState({ 2: "Applied", 4: "Saved" });
  const [toast, setToast] = useState(null);

  const ping = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  const results = useMemo(() => {
    return SEED_JOBS
      .filter((j) => j.daysAgo <= freshness)
      .filter((j) => industry === "all" || j.industry === industry)
      .filter((j) => !query || (j.title + j.company).toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.match - a.match);
  }, [freshness, industry, query]);

  const gateCounts = useMemo(() => {
    const inInd = SEED_JOBS.filter((j) => industry === "all" || j.industry === industry);
    return { 3: inInd.filter((j) => j.daysAgo <= 3).length, 10: inInd.filter((j) => j.daysAgo <= 10).length, 15: inInd.filter((j) => j.daysAgo <= 15).length };
  }, [industry]);

  const toggleTitle = (t) =>
    setTitles((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const setStage = (id, stage) => { setTracked((p) => ({ ...p, [id]: stage })); ping(stage === "remove" ? "Removed from tracker" : `Moved to ${stage}`); };
  const saveJob = (id) => { setTracked((p) => ({ ...p, [id]: p[id] || "Saved" })); ping("Saved to tracker"); };

  const trackedJobs = SEED_JOBS.filter((j) => tracked[j.id]);

  /* ── screens ─────────────────────────────────────────── */

  const SearchScreen = (
    <div className="px-5 pb-6">
      <p className="text-[13px] mt-1 mb-5" style={{ color: T.sub }}>
        Fresh roles only. Pick titles, an industry, and how recent is recent.
      </p>

      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: T.sub }}>Job titles</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {TITLE_PRESETS.map((t) => {
          const on = titles.includes(t);
          return (
            <button key={t} onClick={() => toggleTitle(t)}
              className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
              style={{ background: on ? T.ink : T.chip, color: on ? T.lime : T.ink }}>
              {on ? "✓ " : ""}{t}
            </button>
          );
        })}
      </div>

      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: T.sub }}>Industry</label>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-5 px-5">
        {INDUSTRIES.map((ind) => {
          const on = industry === ind.id;
          return (
            <button key={ind.id} onClick={() => setIndustry(on ? "all" : ind.id)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors"
              style={{ background: on ? T.gate : T.card, color: on ? "#fff" : T.ink, borderColor: on ? T.gate : T.line }}>
              {ind.label}
            </button>
          );
        })}
      </div>

      {/* Signature element: the freshness gate */}
      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: T.sub }}>Freshness gate</label>
      <div className="rounded-2xl p-1.5 flex gap-1.5 mb-2" style={{ background: T.ink }}>
        {[3, 10, 15].map((d) => {
          const on = freshness === d;
          return (
            <button key={d} onClick={() => setFreshness(d)}
              className="flex-1 rounded-xl py-2.5 text-center transition-colors"
              style={{ background: on ? T.lime : "transparent" }}>
              <div className="text-[16px] font-extrabold leading-none" style={{ color: on ? T.ink : "#9DB0A8" }}>{d}d</div>
              <div className="text-[10px] mt-1 font-semibold tabular-nums" style={{ color: on ? T.gateDark : "#6E7F78", fontFamily: "ui-monospace, monospace" }}>
                {gateCounts[d]} open
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] mb-6" style={{ color: T.sub }}>Only roles published within this window pass the gate.</p>

      <button onClick={() => { setSearched(true); setTab("results"); }}
        className="w-full py-3.5 rounded-2xl text-[15px] font-bold transition-transform active:scale-[0.98]"
        style={{ background: T.gate, color: "#fff" }}>
        Run search · {results.length} match{results.length === 1 ? "" : "es"}
      </button>

      <div className="mt-5 rounded-xl px-4 py-3 text-[12px] leading-relaxed" style={{ background: T.chip, color: T.sub }}>
        Sources scanned: Greenhouse · Lever · Ashby · LinkedIn · Indeed · HN "Who is hiring". Duplicates merged, ATS link kept as source of truth.
      </div>
    </div>
  );

  const ResultsScreen = (
    <div className="px-5 pb-6">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title or company"
        className="w-full mb-3 px-4 py-2.5 rounded-xl text-[14px] outline-none border"
        style={{ background: T.card, borderColor: T.line, color: T.ink }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold" style={{ color: T.sub }}>
          {results.length} roles · ≤{freshness} days · {industry === "all" ? "all industries" : INDUSTRIES.find((i) => i.id === industry)?.label}
        </span>
        <button onClick={() => setTab("search")} className="text-[12px] font-bold" style={{ color: T.gate }}>Edit filters</button>
      </div>

      {results.length === 0 && (
        <div className="rounded-2xl p-6 text-center" style={{ background: T.card, border: `1px solid ${T.line}` }}>
          <p className="text-[14px] font-semibold" style={{ color: T.ink }}>Nothing passes this gate yet.</p>
          <p className="text-[12px] mt-1" style={{ color: T.sub }}>Widen the freshness window to 15 days or add more titles.</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((j) => (
          <button key={j.id} onClick={() => setDetail(j)}
            className="w-full text-left rounded-2xl p-4 transition-transform active:scale-[0.99]"
            style={{ background: T.card, border: `1px solid ${T.line}` }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-bold leading-snug" style={{ color: T.ink }}>{j.title}</div>
                <div className="text-[13px] mt-0.5" style={{ color: T.sub }}>{j.company} · {j.location}</div>
              </div>
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide"
                style={{ background: T.chip, color: T.gateDark }}>{j.tag}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center text-[12px]" style={{ color: T.sub }}>
                <FreshDot days={j.daysAgo} />{freshLabel(j.daysAgo)}
                <span className="mx-2" style={{ color: T.line }}>|</span>
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{j.source}</span>
              </div>
              <MatchBar pct={j.match} />
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: T.ink }}>{j.comp}</span>
              {tracked[j.id]
                ? <span className="text-[12px] font-bold" style={{ color: STAGE_COLOR[tracked[j.id]] }}>● {tracked[j.id]}</span>
                : <span onClick={(e) => { e.stopPropagation(); saveJob(j.id); }}
                    className="text-[12px] font-bold px-3 py-1 rounded-full"
                    style={{ background: T.ink, color: T.lime }}>+ Save</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const TrackerScreen = (
    <div className="px-5 pb-6">
      <p className="text-[13px] mt-1 mb-4" style={{ color: T.sub }}>
        Your pipeline. Tap a stage chip to advance an application.
      </p>
      <div className="flex gap-2 mb-5">
        {STAGES.map((s) => (
          <div key={s} className="flex-1 rounded-xl py-2 text-center" style={{ background: T.card, border: `1px solid ${T.line}` }}>
            <div className="text-[16px] font-extrabold tabular-nums" style={{ color: STAGE_COLOR[s] }}>
              {trackedJobs.filter((j) => tracked[j.id] === s).length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.sub }}>{s}</div>
          </div>
        ))}
      </div>

      {trackedJobs.length === 0 && (
        <div className="rounded-2xl p-6 text-center" style={{ background: T.card, border: `1px solid ${T.line}` }}>
          <p className="text-[14px] font-semibold" style={{ color: T.ink }}>No applications tracked yet.</p>
          <p className="text-[12px] mt-1" style={{ color: T.sub }}>Save a role from search results to start your pipeline.</p>
        </div>
      )}

      <div className="space-y-3">
        {trackedJobs.map((j) => (
          <div key={j.id} className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.line}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[14px] font-bold" style={{ color: T.ink }}>{j.title}</div>
                <div className="text-[12px] mt-0.5" style={{ color: T.sub }}>{j.company} · {freshLabel(j.daysAgo)} · {j.source}</div>
              </div>
              <button onClick={() => { const c = { ...tracked }; delete c[j.id]; setTracked(c); ping("Removed from tracker"); }}
                className="text-[11px] font-bold" style={{ color: T.red }}>Remove</button>
            </div>
            <div className="flex gap-1.5 mt-3">
              {STAGES.map((s) => {
                const on = tracked[j.id] === s;
                return (
                  <button key={s} onClick={() => setStage(j.id, s)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                    style={{ background: on ? STAGE_COLOR[s] : T.chip, color: on ? "#fff" : T.sub }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const AlertsScreen = (
    <div className="px-5 pb-6">
      <p className="text-[13px] mt-1 mb-4" style={{ color: T.sub }}>
        Saved searches re-run daily. New roles inside the freshness gate notify you.
      </p>
      {[
        { name: "Lead SDET · AI companies", gate: "3d", hits: 2, on: true },
        { name: "Test Automation Lead · AI", gate: "10d", hits: 5, on: true },
        { name: "QE Manager · Healthtech", gate: "15d", hits: 1, on: false },
      ].map((a, i) => (
        <div key={i} className="rounded-2xl p-4 mb-3 flex items-center justify-between" style={{ background: T.card, border: `1px solid ${T.line}` }}>
          <div>
            <div className="text-[14px] font-bold" style={{ color: T.ink }}>{a.name}</div>
            <div className="text-[12px] mt-0.5" style={{ color: T.sub }}>
              Gate ≤{a.gate} · <span style={{ color: T.gate, fontWeight: 700 }}>{a.hits} new this week</span>
            </div>
          </div>
          <div className="w-11 h-6 rounded-full p-0.5 transition-colors" style={{ background: a.on ? T.gate : T.line }}>
            <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: a.on ? "translateX(20px)" : "none" }} />
          </div>
        </div>
      ))}
      <div className="mt-2 rounded-xl px-4 py-3 text-[12px] leading-relaxed" style={{ background: T.chip, color: T.sub }}>
        Push notification preview: "🟢 2 new Lead SDET roles at AI companies passed your 3-day gate — Deepgram, Cresta."
      </div>
    </div>
  );

  const DetailSheet = detail && (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={() => setDetail(null)}>
      <div className="absolute inset-0" style={{ background: "rgba(26,36,33,0.45)" }} />
      <div onClick={(e) => e.stopPropagation()}
        className="relative rounded-t-3xl px-5 pt-3 pb-7 max-h-[82%] overflow-y-auto"
        style={{ background: T.bg }}>
        <div className="mx-auto w-10 h-1 rounded-full mb-4" style={{ background: T.line }} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-extrabold leading-tight" style={{ color: T.ink }}>{detail.title}</h2>
            <p className="text-[14px] mt-1" style={{ color: T.sub }}>{detail.company} · {detail.location}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide mt-1"
            style={{ background: T.ink, color: T.lime }}>{detail.tag}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 my-4">
          {[
            ["Posted", freshLabel(detail.daysAgo)],
            ["Source", detail.source],
            ["Match", `${detail.match}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl py-2.5 text-center" style={{ background: T.card, border: `1px solid ${T.line}` }}>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.sub }}>{k}</div>
              <div className="text-[13px] font-extrabold mt-0.5" style={{ color: T.ink, fontFamily: "ui-monospace, monospace" }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="text-[14px] font-bold mb-1" style={{ color: T.ink }}>Compensation</div>
        <p className="text-[14px] mb-4 tabular-nums" style={{ color: T.sub }}>{detail.comp}</p>

        <div className="text-[14px] font-bold mb-1" style={{ color: T.ink }}>What you'd own</div>
        <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: T.sub }}>{detail.summary}</p>

        <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px] leading-relaxed" style={{ background: T.chip, color: T.gateDark }}>
          <span className="font-bold">Match notes — </span>{detail.notes}
        </div>

        <div className="flex gap-2">
          <button onClick={() => { saveJob(detail.id); }}
            className="flex-1 py-3 rounded-2xl text-[14px] font-bold" style={{ background: T.ink, color: T.lime }}>
            {tracked[detail.id] ? `In tracker · ${tracked[detail.id]}` : "Save to tracker"}
          </button>
          <button onClick={() => { setStage(detail.id, "Applied"); setDetail(null); setTab("tracker"); }}
            className="flex-1 py-3 rounded-2xl text-[14px] font-bold" style={{ background: T.gate, color: "#fff" }}>
            Apply → Applied
          </button>
        </div>
      </div>
    </div>
  );

  const TABS = [
    { id: "search", label: "Search", icon: "⌕" },
    { id: "results", label: "Results", icon: "≡" },
    { id: "tracker", label: "Tracker", icon: "▣" },
    { id: "alerts", label: "Alerts", icon: "◷" },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-6 px-3"
      style={{ background: "#22302B", fontFamily: "'Avenir Next','Segoe UI',system-ui,sans-serif" }}>
      {/* phone frame */}
      <div className="relative w-full max-w-[390px] h-[780px] rounded-[36px] overflow-hidden flex flex-col shadow-2xl"
        style={{ background: T.bg, border: "8px solid #121A17" }}>

        {/* header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between" style={{ background: T.bg }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-extrabold tracking-tight" style={{ color: T.ink }}>Easy<span style={{ color: T.gate }}>Job</span></span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: T.lime, color: T.gateDark }}>beta</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold" style={{ background: T.ink, color: T.lime }}>K</div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "search" && SearchScreen}
          {tab === "results" && ResultsScreen}
          {tab === "tracker" && TrackerScreen}
          {tab === "alerts" && AlertsScreen}
        </div>

        {/* toast */}
        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-[12px] font-bold shadow-lg"
            style={{ background: T.ink, color: T.lime }}>{toast}</div>
        )}

        {/* tab bar */}
        <div className="flex border-t" style={{ background: T.card, borderColor: T.line }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            const badge = t.id === "tracker" ? trackedJobs.length : t.id === "results" ? results.length : 0;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-2.5 flex flex-col items-center gap-0.5 relative">
                <span className="text-[17px] leading-none" style={{ color: on ? T.gate : T.sub }}>{t.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: on ? T.gate : T.sub }}>{t.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-[26%] text-[9px] font-extrabold px-1 rounded-full"
                    style={{ background: T.lime, color: T.gateDark }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {DetailSheet}
      </div>
    </div>
  );
}
