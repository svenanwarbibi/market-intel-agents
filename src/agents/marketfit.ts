import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { join } from "path";
import { anthropic, MODELS } from "../lib/anthropic.js";
import type { Scope } from "../scope.js";
import type { Doc } from "../ingest/landscape-sources.js";
import type { Landscape } from "./landscape.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OFFERING = readFileSync(join(__dirname, "ic3_offering_reference.md"), "utf-8");

const SYSTEM_INSTRUCTIONS = `You are the IC-3 Market-Fit Analyst (Chapter 6).

You will receive:
1. IC-3 OFFERING REFERENCE — full portfolio with scoring rules (§5.2), geography weights (§4), signal taxonomy (§3), and conversation-starter rules (§6).
2. RESEARCH DATA — the landscape analysis plus source corpus for this job.

SCORING FORMULA (§5.2):
  composite = (signalStrength×0.25 + offeringFit×0.35 + engagementLikelihood×0.25) × geographicWeight + recency_bonus
  All sub-scores: 0.0–1.0. geographicWeight from §4. recency_bonus: +0.05 if signal is ≤30 days old, else 0.

For each organisation identified in the landscape:
- List matched IC-3 offerings (exact offering names from the reference)
- Score each using the formula above
- Flag lowHangingFruit = true if composite ≥ 0.65
- Write a conversation starter (max 2 sentences, follow §6 rules)

For the heat map: count opportunities matched per offering category.

European focus: prioritise EU-headquartered organisations. Flag US/Asia organisations explicitly.`.trim();

const OfferingMatchSchema = z.object({
  offeringName: z.string(),
  signalStrength: z.number().min(0).max(1),
  offeringFit: z.number().min(0).max(1),
  engagementLikelihood: z.number().min(0).max(1),
  geographicWeight: z.number().min(0).max(2),
  recencyBonus: z.number().min(0).max(0.05),
  composite: z.number().min(0).max(2),
  rationale: z.string(),
});

const OpportunitySchema = z.object({
  organisation: z.string(),
  geography: z.string(),
  isEU: z.boolean(),
  signals: z.array(z.string()),
  matchedOfferings: z.array(OfferingMatchSchema),
  lowHangingFruit: z.boolean(),
  conversationStarter: z.string(),
});

const OfferingHeatSchema = z.object({
  offeringName: z.string(),
  opportunityCount: z.number().int(),
  avgComposite: z.number(),
});

export const MarketFitSchema = z.object({
  opportunities: z.array(OpportunitySchema),
  offeringHeatMap: z.array(OfferingHeatSchema),
  lowHangingFruitList: z.array(z.string()),
  executiveSummary: z.string(),
});
export type MarketFitOutput = z.infer<typeof MarketFitSchema>;

export async function runMarketFit(
  scope: Scope,
  corpus: Doc[],
  landscape: Landscape
): Promise<MarketFitOutput> {
  const landscapeJson = JSON.stringify(landscape, null, 2);
  const corpusText = corpus
    .map((d) => `[${d.id}] ${d.title} — ${d.source}\n${d.text}`)
    .join("\n\n---\n\n")
    .slice(0, 60_000);
  const inputText = `LANDSCAPE ANALYSIS:\n${landscapeJson}\n\nSOURCE CORPUS:\n${corpusText}`;

  const res = await anthropic.messages.parse({
    model: MODELS.chapter,
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 6000 },
    output_config: { effort: "medium", format: zodOutputFormat(MarketFitSchema) },
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      {
        type: "text",
        text: `IC-3 OFFERING REFERENCE:\n\n${OFFERING}`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `RESEARCH DATA:\n\n${inputText}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Scope: ${JSON.stringify(scope)}\n\nProduce the IC-3 market-fit analysis for this scope.`,
      },
    ],
  });

  if (!res.parsed_output) throw new Error("Market-Fit agent returned no structured output");
  return res.parsed_output;
}