import { db } from "./db.js";
import type { Scope } from "../scope.js";
import type { Doc } from "../ingest/landscape-sources.js";

type Claim = { statement: string; confidence?: number; documentId: string };

export async function createJob(scope: Scope): Promise<string> {
  const { data, error } = await db
    .from("research_jobs")
    .insert({ scope, status: "running" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create job");
  return data.id as string;
}

export async function persistDocuments(jobId: string, corpus: Doc[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (corpus.length === 0) return map;
  const rows = corpus.map((d) => ({
    job_id: jobId,
    url: d.url,
    title: d.title,
    source: d.source,
    raw_text: d.text,
    published_at: d.publishedAt ?? null,
    hash: d.url || d.title,
  }));
  const { data, error } = await db.from("documents").insert(rows).select("id, hash");
  if (error || !data) throw error ?? new Error("Failed to insert documents");
  const byHash = new Map(data.map((r) => [r.hash as string, r.id as string]));
  for (const d of corpus) {
    const id = byHash.get(d.url || d.title);
    if (id) map.set(d.id, id);
  }
  return map;
}

export async function persistChapter(
  jobId: string,
  chapter: number,
  payload: unknown,
  model: string,
  claims: Claim[],
  docIdMap: Map<string, string>,
): Promise<void> {
  const { data, error } = await db
    .from("chapter_outputs")
    .insert({ job_id: jobId, chapter, payload, model })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to insert chapter output");
  const rows = claims.map((c) => ({
    chapter_output_id: data.id,
    statement: c.statement,
    confidence: c.confidence ?? null,
    document_id: docIdMap.get(c.documentId) ?? null,
  }));
  if (rows.length) {
    const { error: ce } = await db.from("claims").insert(rows);
    if (ce) throw ce;
  }
}

export async function finishJob(jobId: string, status: "done" | "failed"): Promise<void> {
  await db
    .from("research_jobs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("id", jobId);
}