import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

// Tiered models — keep cost bounded across the six chapters (see docs/PLAN.md §6).
//  - cheap:     dedup / relevance pre-filter
//  - chapter:   per-chapter analysis (chapters 1–5)
//  - synthesis: Market-Fit synthesis (ch.6) + Landscape market sizing (ch.1)
export const MODELS = {
  cheap: "claude-haiku-4-5",
  chapter: "claude-sonnet-4-6",
  synthesis: "claude-opus-4-8",
} as const;
