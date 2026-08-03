/**
 * Applies every SQL file in supabase/migrations in filename order, once each.
 *
 * Deliberately tiny: one Postgres connection and a ledger table. The project is
 * maintained by one person and does not need a migration framework to babysit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

// .env.local wins over anything already in the process environment.
dotenv.config({ path: [".env.local", ".env"], override: true, quiet: true });

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// The ledger lives in the public schema, so it must be locked down like every
// other table there: PostgREST exposes public to the API roles by default.
await client.query(`
  create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
  alter table schema_migrations enable row level security;
  do $$
  begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
      revoke all on schema_migrations from anon, authenticated;
    end if;
  end
  $$;
`);

const { rows } = await client.query("select filename from schema_migrations");
const applied = new Set(rows.map((row) => row.filename));

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;

  const sql = readFileSync(join(migrationsDir, file), "utf8");
  process.stdout.write(`applying ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into schema_migrations (filename) values ($1)", [file]);
    await client.query("commit");
    console.log("ok");
    count += 1;
  } catch (error) {
    await client.query("rollback");
    console.log("failed");
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

console.log(count === 0 ? "Already up to date." : `Applied ${count} migration(s).`);
await client.end();
