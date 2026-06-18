import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODELS } from "../lib/anthropic.js";
import type { Scope } from "../scope.js";
import type { Doc } from "../ingest/landscape-sources.js";

// Chapter 1 — Landscape Analysis (IC-3 Module 1). Output schema with enforced citations.
const Claim = z.object({
  statement: z.string(),
  documentId: z.string(), // MUST be the id of a Doc in the corpus
  confidence: z.number().min(0).max(1),
});

const Competitor = z.object({
  name: z.string(),
  archetype: z.enum([
    "systematic-methodology",
    "design-and-build",
    "large-firm-subunit",
    "academic-licensor",
    "other",
  ]),
  geography: z.string(),
  servicesOverlap: z.string(),
  financialTrajectory: z.string().optional(),
});

export const LandscapeSchema = z.object({
  competitors: z.array(Competitor),
  whiteSpace: z.array(z.string()),
  marketSizing: z.object({
    estimate: z.string(),
    confidence: z.string(),
    basis: z.string(),
  }),
  claims: z.array(Claim),
});
export type Landscape = z.infer<typeof LandscapeSchema>;

const SYSTEM = `You are the Landscape Analysis agent (Chapter 1) of a market-intelligence pipeline.
From the supplied corpus, map the competitive and adjacent playing field for the requested scope:
- Build a competitor list and classify each by archetype. Aim to identify at least 10 competitors relevant to the requested vertical, drawing on the corpus and well-known European market players; provide fewer only if the vertical is genuinely too narrow to support ten.
- Identify white space the buyer's offering could occupy.
- Size the addressable market with an explicit confidence band and the basis for the estimate.

Regional focus (European): prioritise European companies, markets, and data points
(EU, UK, EFTA, DACH, Nordics, Benelux). When the corpus offers a European figure or
competitor, prefer it over a US/Asia one. Treat US/Asia data points as secondary context:
include one only when no European equivalent exists in the corpus, and when you do, flag it
explicitly in the statement (e.g. "(US figure — no European equivalent in corpus)"). Do not
size the European market by extrapolating from US/Asia numbers without stating that assumption.
Omit competitors whose relevance is purely US/Asia unless they materially compete in Europe.

Grounding rule (non-negotiable): every entry in "claims" MUST cite a real document via its
"documentId", taken verbatim from a [id] in the corpus. Never invent a documentId or a source.
If the corpus does not support a claim, do not make it.`;

export async function runLandscape(scope: Scope, corpus: Doc[]): Promise<Landscape> {
  const corpusText = corpus
    .map((d) => `[${d.id}] ${d.title} — ${d.source} (${d.url})\n${d.text}`)
    .join("\n\n---\n\n");

  const res = await anthropic.messages.parse({
    model: MODELS.chapter,
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 6000 },
    output_config: { effort: "medium", format: zodOutputFormat(LandscapeSchema) },
    system: [
      { type: "text", text: SYSTEM },
      // Cache the corpus prefix so the other chapter agents reuse it cheaply.
      { type: "text", text: `CORPUS (cite by [id]):\n\n${corpusText}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content:
          `Scope: ${JSON.stringify(scope)}\n\n` +
          `Produce the Landscape Analysis for this scope, citing the corpus.`,
      },
    ],
  });

  const out = res.parsed_output;
  if (!out) throw new Error("Landscape agent returned no structured output");

  // Citation enforcement — reject hallucinated or uncited references before persisting.
  const ids = new Set(corpus.map((d) => d.id));
  const bad = out.claims.filter((c) => !ids.has(c.documentId));
  if (bad.length) {
    throw new Error(`Rejected: claims cite unknown documentIds: ${bad.map((b) => b.documentId).join(", ")}`);
  }
  return out;
}
