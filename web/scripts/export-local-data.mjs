import { PGlite } from "@electric-sql/pglite";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(".data");
await access(path.join(root, "plaionn/PG_VERSION"));
const db = new PGlite(path.join(root, "plaionn"));
const tables = {
 leagues: ["id", "name"],
 seasons: ["id", "league_id", "name"],
 divisions: ["id", "league_id", "season_id", "name"],
 teams: ["id", "league_id", "name"],
 team_entries: ["id", "league_id", "team_id", "division_id"],
};
try {
 const snapshot = {};
 const statements = ["-- Local test-data export. Apply after the Supabase schema migration.", "-- Existing matching IDs are retained; conflicting names cause rollback.", "begin;"];
 for (const [table, columns] of Object.entries(tables)) {
  const {rows} = await db.query("select " + columns.join(",") + " from " + table + " order by id");
  snapshot[table] = rows;
  for (const row of rows) {
   const values = columns.map(column => "'" + String(row[column]).replaceAll("'", "''") + "'").join(",");
   statements.push("insert into public." + table + "(" + columns.join(",") + ") values(" + values + ") on conflict(id) do nothing;");
  }
 }
 statements.push("commit;");
 const backup = path.join(root, "exports", new Date().toISOString().replaceAll(":","-"));
 await mkdir(backup, {recursive:true});
 await writeFile(path.join(backup,"local-data.json"), JSON.stringify(snapshot,null,2), {flag:"wx"});
 await writeFile(path.join(backup,"import-to-supabase.sql"), statements.join("\n"), {flag:"wx"});
 console.log("Preserved local records in " + path.relative(process.cwd(),backup));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(snapshot).map(([table,rows])=>[table,rows.length]))));
} finally { await db.close(); }

