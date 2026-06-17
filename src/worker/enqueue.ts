import { db } from "../lib/db.js";

const message = process.argv[2] ?? "HR Tech Germany";
const { data, error } = await db
  .from("research_jobs")
  .insert({ scope: { message }, status: "queued" })
  .select("id");

if (error) {
  console.error("Insert failed:", error);
  process.exit(1);
}
console.log("Queued job:", data?.[0]?.id, "—", message);
