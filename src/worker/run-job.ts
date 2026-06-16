// M3 keystone: one chapter agent end-to-end, chat-triggered.
//   parse a message -> resolve scope -> ingest corpus -> run Landscape -> (TODO) persist.
// Run: npm run job -- "Analyze systematic-innovation consulting for FMCG and packaging in DACH"
import { parseScope } from "../scope.js";
import { gatherLandscapeCorpus } from "../ingest/landscape-sources.js";
import { runLandscape } from "../agents/landscape.js";

const message =
  process.argv.slice(2).join(" ") ||
  "Analyze systematic-innovation consulting for FMCG and packaging in DACH, near-term";

const scope = await parseScope(message);
console.log("Resolved scope:\n", scope, "\n");

const corpus = await gatherLandscapeCorpus(scope);
console.log(`Ingested ${corpus.length} documents.\n`);

const landscape = await runLandscape(scope, corpus);
console.log("Landscape Analysis (validated, cited):\n");
console.log(JSON.stringify(landscape, null, 2));

// TODO (M4): persist to Supabase `research_jobs` / `chapter_outputs` / `claims`
//            (see supabase/schema.sql), then fan out chapters 2–5 in parallel and
//            run Market Fit (ch.6) last. See docs/PLAN.md §5–6.
