import { writeFileSync } from "fs";
import { db } from "../lib/db.js";
import { buildReportXlsx } from "../lib/report.js";
import type { Doc } from "../ingest/landscape-sources.js";

const { data: jobs } = await db.from("research_jobs").select("id, scope").order("created_at", { ascending: false }).limit(1);
const job = jobs![0];
const scope: any = job.scope ?? {};
const { data: ch1 } = await db.from("chapter_outputs").select("payload").eq("job_id", job.id).eq("chapter", 1).maybeSingle();
const { data: ch6 } = await db.from("chapter_outputs").select("payload").eq("job_id", job.id).eq("chapter", 6).maybeSingle();
const { data: docs } = await db.from("documents").select("url, title, source, raw_text, published_at").eq("job_id", job.id);
const corpus: Doc[] = (docs ?? []).map((d: any, i: number) => ({ id: `d${i + 1}`, url: d.url, title: d.title, source: d.source, text: d.raw_text, publishedAt: d.published_at }));
const xlsx = await buildReportXlsx({ scope, corpus, landscape: ch1?.payload, marketfit: ch6?.payload });

const title = (scope.verticals ?? []).join(", ") || "Research run";
const slug = (title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "report").slice(0, 40);
const day = new Date().toISOString().slice(0, 10);
const name = `market-intel_${slug}_${day}.xlsx`;
writeFileSync(`/tmp/${name}`, xlsx);
console.log("Wrote /tmp/" + name + " —", xlsx.length, "bytes");
