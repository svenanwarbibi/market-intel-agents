# market-intel-agents

A **chat-triggered, agentic market-intelligence pipeline**. A user states which industry
vertical/segment to research; that triggers a run where a team of Claude agents (one per chapter)
**scrapes** scoped sources → **analyzes** them → **pushes** a structured six-chapter report to a
dashboard. The six chapters mirror the IC-3 framework:

1. Landscape · 2. Signal · 3. Pull/Push · 4. Market Shifts · 5. Customer Expectations · 6. Market Fit

> Full design — architecture, data model, source registry, milestones — is in [`docs/PLAN.md`](docs/PLAN.md).

## What's in this scaffold (the M3 keystone)

The riskiest slice, end-to-end: **chat message → parsed scope → ingest corpus → Landscape agent
(cited, schema-validated) → console**. Prove this, then fan out to the other five chapters.

```
src/
  lib/anthropic.ts        Anthropic client + tiered models (haiku/sonnet/opus)
  lib/db.ts               Supabase client (service role; worker-side only)
  scope.ts                Zod scope schema + parseScope() — the chat trigger (M1)
  ingest/landscape-sources.ts   Corpus fetchers (STUB — wire real scrapers here)
  agents/landscape.ts     Chapter 1 agent: prompt + output schema + citation enforcement
  worker/run-job.ts       Orchestrator: parse → ingest → run Landscape → (TODO) persist
supabase/schema.sql       The job/documents/chapter_outputs/claims tables (§4)
```

## Run it

```bash
npm install                      # versions in package.json are indicative — npm will resolve latest patches
cp .env.example .env             # fill ANTHROPIC_API_KEY (Supabase optional until M4)
npm run job -- "Analyze systematic-innovation consulting for FMCG and packaging in DACH, near-term"
```

You'll see the resolved scope, the (stub) corpus, and a validated, cited Landscape Analysis. Swap
the stub in `src/ingest/landscape-sources.ts` for real sources and it analyzes live data.

## Push this to your own GitHub space

```bash
git init && git add -A && git commit -m "scaffold: market-intel pipeline (M3 keystone)"
# create an empty repo in your GitHub space first, then:
git remote add origin git@github.com:<you>/market-intel-agents.git
git push -u origin main
```

Then open the folder in VS Code, run `claude` in the integrated terminal to attach the Claude Code
extension, and keep building locally.

## Design notes (from the claude-api reference)

- **Models:** default `claude-opus-4-8`; this pipeline tiers them — Haiku 4.5 for dedup/relevance,
  Sonnet 4.6 per chapter, Opus 4.8 for Market-Fit synthesis and market sizing. Adaptive thinking
  (`thinking: { type: "adaptive" }`) + `output_config.effort`.
- **Structured output:** `messages.parse()` + `zodOutputFormat(...)` returns a validated object;
  citation enforcement rejects any claim whose `documentId` isn't in the corpus.
- **Prompt caching:** the corpus is a cached system block so the six chapter agents reuse it cheaply.
- **Upgrade path — Managed Agents:** for a fully autonomous coordinator + six subagents (Anthropic
  hosts the loop and a per-run container, with scheduled deployments and skills), port the agents to
  the Managed Agents API (`client.beta.agents` / `sessions`, `multiagent: { type: "coordinator" }`).
  This scaffold uses Claude API + tool-use-style structured calls because they run in your own
  worker (Vercel + a background runner) and are the lowest-risk way to land M3 first.

## Next steps

- **M2:** real scrapers + Supabase ingest (apply `supabase/schema.sql`).
- **M4:** persist outputs; fan out chapters 2–5 in parallel; run Market Fit last.
- **M5:** `npx create-next-app` for the chat + dashboard (six sections), deployed to Vercel; the
  chat triggers a job, a background worker runs the pipeline, the UI streams progress from Supabase.
