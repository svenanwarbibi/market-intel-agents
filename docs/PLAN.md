# Market-Intelligence Pipeline — Plan

> **Status:** proposal. Standalone project (separate repo, deployed to Vercel), independent of the
> Hokua web presence. This doc lives in the Hokua repo only as the planning artifact that produced it.
>
> **Grounding doc:** `IC-3 Market Analysis Plan` (manual desk-research playbook). Its six modules map
> 1:1 onto the chapters below; its source catalog and automation-readiness tags (🤖 fully automatable /
> 🤖👤 automatable with human validation / 👤 human judgement) are carried directly into the agent design.

An **on-demand** workflow: a user opens a chat interface and states **which industry vertical or
segment** to research (plus geography and time-horizon). That message **triggers** a run — a team of
Claude Agent-SDK agents (one per chapter) **scrapes** scoped sources → **analyzes** them → **pushes** a
structured six-chapter report to a dashboard. No fixed daily cadence; runs happen when asked, and can
be re-run or refreshed per scope.

The six chapters (IC-3 module names in parentheses):

1. **Landscape Analysis** *(M1)* — competitors, archetypes, white-space, market sizing.
2. **Signal Analysis** *(M2)* — leading demand indicators: leadership/hiring moves, capex, regulation, M&A.
3. **Pull / Push Factors** *(M3 — Drivers & Impact Factors)* — forces creating vs. suppressing demand, weighted by vertical.
4. **Market Shifts** *(M4)* — structural changes in how the service is bought/delivered/valued.
5. **Customer Expectations** *(M5)* — unmet needs, deal-killers, procurement journeys, buyer personas.
6. **Market Fit** *(M6)* — fit of the user's offering to chapters 1–5; gaps, adjustments, ranked pipeline.

---

## 1. The trigger: chat-driven scoping

The entry point is a conversational interface, not a scheduler. A run is parameterized by a **research
scope** the chat collects (with sensible defaults, and the ability to just type a sentence):

| Param | Example | Notes |
|---|---|---|
| `vertical(s)` | FMCG/CPG, Packaging Manufacturers | one or more; free-text accepted, normalized to a taxonomy |
| `segment` | mid-to-large enterprises, 500–5,000 employees | narrows the addressable view |
| `geographies` | DACH, EMEA, US | drives which source registry entries apply (e.g. Bundesanzeiger=DE, Companies House=UK, EDGAR=US) |
| `time_horizon` | near-term 6–12 months | bounds Signal/Shift windows |
| `offering_profile` | *(optional)* the user's own services to assess in chapter 6 | needed for Market Fit; can be omitted to skip/soften M6 |
| `depth` | quick scan / full report | trades cost/latency vs. coverage |

The chat parses a message like *"Analyze the systematic-innovation consulting market for FMCG and
packaging in DACH, near-term"* into this scope, confirms it back to the user, and launches the job.
Follow-up messages can refine scope or drill into a chapter ("expand the white-space map", "re-run
Signals for US only").

Because Agent-SDK runs are minutes-long, the trigger is **asynchronous**: the chat creates a
`research_job`, a background worker executes the pipeline, and the chat **streams progress**
(per-chapter status, docs scraped, citations found) while the dashboard fills in. Recommended:
Next.js on Vercel for the UI + chat API, a durable background runner (Inngest / a queue + worker, or a
long-running Node worker) for the pipeline, and the DB as the source of truth the UI subscribes to.

---

## 2. Architecture at a glance

```
   ┌────────────────────────────────────────────────────────────────┐
   │  CHAT INTERFACE (Next.js on Vercel)                              │
   │  user states vertical/segment/geo/horizon  → confirms scope      │
   └───────────────┬───────────────────────────────▲─────────────────┘
                   │ create research_job            │ stream progress + report
                   ▼                                │
   ┌──────────────────────────┐   docs   ┌──────────┴───────┐  report  ┌──────────────────┐
   │  WORKER / ORCHESTRATOR    │ ───────► │  STORE (Postgres) │ ───────► │  DASHBOARD       │
   │  (background, Agent SDK)  │ ◄─────── │  Supabase / Neon  │          │  6 chapters +    │
   │  ingest → 6 chapter agents│  priors  └───────────────────┘          │  history per job │
   └──────────────────────────┘                                         └──────────────────┘
            │ scoped scrapers
            ▼
   ┌──────────────────────────────────────────────┐
   │  SOURCE REGISTRY (from IC-3 catalog)           │
   │  filings · regulators · news · reviews · social│
   └──────────────────────────────────────────────┘
```

---

## 3. Source registry (from the IC-3 catalog, not generic RSS)

The IC-3 plan supplies a far richer, structured source set than "news + social". Model these as rows in
a `sources` table tagged by `kind`, `geography`, and which chapter(s) they feed, so a scope selects the
applicable subset:

- **Company filings:** Bundesanzeiger (DE), Companies House (UK), SEC EDGAR (US) — revenue/headcount/EBIT, annual & sustainability reports. 🤖
- **Regulatory:** EUR-Lex, European Commission newsroom (PPWR, CSRD, ESPR) — time-bound demand windows. 🤖
- **Market sizing / industry:** Lünendonk, Source Global Research, Gartner/Forrester newsroom, Statista, BDU. 🤖👤 (summaries free; full reports paywalled — use summaries + press coverage)
- **Competitor intel:** competitor sites/blogs, Clutch.co, G2, ECSI. 🤖
- **People/hiring signals:** LinkedIn (Sales Navigator), Indeed, Stepstone — leadership changes & job postings. 🤖👤
- **Sustainability:** CDP, SBTi tracker, company sustainability reports. 🤖
- **News / M&A:** targeted news monitoring, Reuters/Handelsblatt/FT, Mergermarket summaries. 🤖👤
- **Voice-of-customer:** Glassdoor/Kununu reviews, LinkedIn polls/posts, event post-surveys (Interpack, FACHPACK, PackExpo). 🤖👤
- **Events:** programme PDFs / speaker lists for Interpack, FACHPACK, CFIA, PackExpo, Consumer Goods Forum. 🤖

Hygiene from day one: respect `robots.txt`, throttle, real User-Agent, cache, and store
`source + url + fetched_at` provenance on every document. Paywalled sources are summary-only; some
(LinkedIn) need an authenticated session — flagged in `sources.config`.

---

## 4. Data model (Postgres)

Keyed by `job_id` (the scope), not by date — history is the set of past jobs, and a job can be re-run.

```
sources(id, name, kind, geographies[], chapters[], url, enabled, config_jsonb)

research_jobs(id, scope_jsonb, status['queued'|'running'|'done'|'failed'],
              created_by, created_at, finished_at, token_cost)

documents(id, job_id, source_id, url, title, author, published_at,
          raw_text, lang, hash, fetched_at)              -- hash = dedup key

chapter_outputs(id, job_id, chapter[1..6], payload_jsonb, model, token_cost,
                automation_tag, needs_human_review bool) -- validated vs. JSON schema

claims(id, chapter_output_id, statement, confidence, document_id)  -- every claim cites a doc
```

`claims` is the anti-hallucination backbone: an agent may only assert what it can tie to a
`document_id`; uncited assertions are rejected at validation. `needs_human_review` surfaces the
👤/🤖👤 steps the IC-3 plan flags (see §6).

---

## 5. Pipeline stages (per triggered job)

1. **Resolve scope → sources.** From `scope_jsonb`, select applicable `sources` (vertical + geography +
   chapter). Build the target-account / competitor seed list (IC-3 starts from a 12-competitor shortlist
   expanded to 40–60 via Clutch categories).
2. **Ingest.** Scoped scrapers fetch filings, regulatory text, news, reviews, listings. JS-heavy pages →
   headless browser; APIs where available. Normalize, language-detect, dedup by `hash`.
3. **Analyze — six chapter agents** (Claude Agent SDK, see §6).
4. **Push.** Orchestrator validates each agent's structured output, writes `chapter_outputs` + `claims`,
   updates `research_jobs.status`, and streams completion to the chat. Dashboard renders live.

---

## 6. The six agents (Claude Agent SDK)

Each chapter is a **subagent** with a focused system prompt, a constrained toolset (read the job's
corpus; read prior jobs for comparison; optional targeted web fetch to enrich a citation; **no writes**),
and a strict per-chapter output schema. Automation tags come straight from the IC-3 plan — they decide
whether a chapter's output is auto-published or flagged `needs_human_review`.

| Chapter | Agent job (per scope) | Automation | Model |
|---|---|---|---|
| 1 Landscape | Longlist → archetype taxonomy → financial signals (Bundesanzeiger) → white-space → market sizing | 🤖 longlist/financials; 👤 white-space & sizing | Sonnet; **Opus** for sizing triangulation |
| 2 Signal | Leadership/hiring, capex/R&D, sustainability, M&A, regulation, events → urgency×fit scoring | 🤖 collection; 👤 scoring | Sonnet |
| 3 Pull/Push | Validate & weight drivers per vertical; net-effect by vertical; push-factor risk register | 🤖👤 validation; 👤 weighting | Sonnet |
| 4 Market Shifts | Corroborate each shift with ≥2 sources; map offering alignment; timing windows | 🤖👤 | Sonnet |
| 5 Customer Expectations | Synthesize voice-of-customer from reviews/social/events; reconstruct deal-killers; buyer personas | 🤖👤 — **primary interviews stay 👤** | Sonnet |
| 6 Market Fit | Score opportunities vs. `offering_profile` (methodology/reference/delivery/commercial); gaps; ranked pipeline | 👤 (decision-grade) | **Opus** |

- **Honest automation boundary.** Module 5's highest-value input (buyer interviews) and Module 6's
  scoring are 👤 in the IC-3 plan. The agentic version produces a *strong first pass* from public data and
  explicitly marks `needs_human_review`, leaving a slot for human-supplied interview notes / win-loss
  history to be fed back in (via chat) and re-synthesized.
- **Dependencies.** Chapters 1–5 run in parallel; **6 runs last** (depends on 1–5 and on `offering_profile`).
- **Tiered models for cost:** Haiku for dedup/relevance pre-filter, Sonnet per chapter, Opus for sizing
  (ch.1) and Market-Fit synthesis (ch.6). **Prompt caching** on the shared corpus so six agents don't
  re-bill the same context.
- **Structured output + validation:** each agent returns JSON matching its chapter schema; orchestrator
  validates and rejects uncited claims before insert.

---

## 7. Dashboard (Next.js on Vercel)

- A **chat panel** (launch/refine jobs, stream progress) beside a **report view**: six chapter sections
  mirroring the reference site, each rendering the job's `payload_jsonb` with clickable citations.
- A job list / history; compare two jobs (e.g. DACH vs. US scope) side by side.
- Chapters flagged `needs_human_review` show a banner + an inline way to add human input and re-run that chapter.
- Optional auth (this is internal intelligence).

---

## 8. Idempotency, observability, guardrails

- **Idempotent per job:** re-running a job upserts; a "refresh" clones scope into a new job for comparison.
- **Observability:** per-job log (docs scraped, tokens, $ cost, agent timings) on an ops view; failure →
  chat error + notification; partial success (one dead source) doesn't sink the run.
- **Guardrails:** schema validation, citation enforcement, per-job cost ceiling (depth setting),
  retry/backoff on scraper/API failures, confidence bands on estimates (IC-3 sizing carries ±30%).

---

## 9. Secrets & config

- Anthropic API key, DB connection string, source API keys / sessions (LinkedIn, news) → server-side env
  (worker) and Vercel env (UI, read-only DB role).
- Source registry + competitor seed lists live in the DB / a committed `sources.yaml`, editable without code.

---

## 10. Milestones

| # | Outcome | Deliverable |
|---|---|---|
| **M0** | Repo scaffold | Next.js dashboard + chat shell, worker skeleton, DB plumbing, env/secrets |
| **M1** | Scoping works | Chat parses a vertical/segment message → confirmed `research_job` scope |
| **M2** | Ingestion works | Scope → source selection → filings/news/reviews into `documents`, deduped |
| **M3** | One agent end-to-end | Landscape agent runs on a real scope → validated, cited output in DB |
| **M4** | All six agents | Orchestrator runs 1–5 parallel + 6 synthesis; automation tags & human-review flags honored |
| **M5** | Dashboard + streaming | Chat triggers a job, streams progress, renders all six chapters + history |
| **M6** | Hardened | Cost/observability, retries, partial-success, human-feedback re-run loop, runbook |

Roughly **7–11 focused days**; M3 is the keystone (one cited agent on a real scope before scaling to six).

---

## 11. Open questions / risks

- **Reference-site parity:** the Vercel reference site is access-protected (403); confirm the exact
  section/visual spec before building M5.
- **Source ToS:** LinkedIn/Glassdoor/review sites restrict scraping — prefer authenticated sessions or
  official APIs and document per-source legality; paywalled studies (Lünendonk/Gartner) are summary-only.
- **Human-in-the-loop honesty:** chapters 5–6 are decision-grade and partly 👤 in the source plan — the
  product must present them as a reviewable first pass, not ground truth, and make feeding back human
  input (interviews, win/loss) easy.
- **Cost & latency per run:** on-demand multi-agent runs over a fresh corpus are the main cost driver —
  the `depth` setting, tiered models, prompt caching, and a relevance pre-filter keep it bounded; track
  $/job from M3.
- **Data freshness/lag:** filings lag 6–18 months; some IC-3 evidence is from 2023 — agents should date-
  stamp claims and prefer the most recent corroboration.
