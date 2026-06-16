import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODELS } from "./lib/anthropic.js";

// The research scope a chat message resolves to (docs/PLAN.md §1).
export const ScopeSchema = z.object({
  verticals: z.array(z.string()).min(1),
  segment: z.string().optional(),
  geographies: z
    .array(z.enum(["DACH", "EMEA", "US", "UK", "Nordics", "Benelux", "Global"]))
    .default(["DACH"]),
  timeHorizon: z.string().default("near-term 6-12 months"),
  // Required for Market Fit (ch.6); omit to soften/skip that chapter.
  offeringProfile: z.string().optional(),
  depth: z.enum(["quick", "full"]).default("full"),
});
export type Scope = z.infer<typeof ScopeSchema>;

// M1 — the chat trigger: turn a free-text message into a structured Scope.
export async function parseScope(message: string): Promise<Scope> {
  const res = await anthropic.messages.parse({
    model: MODELS.cheap,
    max_tokens: 1024,
    system:
      "Extract a market-research scope from the user's message. Infer sensible defaults; " +
      "if no geography is named, default to DACH. Do not invent an offeringProfile.",
    messages: [{ role: "user", content: message }],
    output_config: { format: zodOutputFormat(ScopeSchema) },
  });
  if (!res.parsed_output) throw new Error("Could not parse a scope from that message");
  return res.parsed_output;
}
