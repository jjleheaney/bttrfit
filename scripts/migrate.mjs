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

// Later paths win under `override`, so .env.local beats both .env and any
// stale value already exported into the process environment.
dotenv.config({ path: [".env", ".env.local"], override: true, quiet: true });

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

try {
  await client.connect();
} catch (error) {
  // db.<ref>.supabase.co resolves to IPv6 only, which many networks and CI
  // runners cannot reach. The session pooler host is dual-stack.
  if (error.code === "ENETUNREACH" || error.code === "EHOSTUNREACH") {
    console.error(
      "Could not reach the database host. Use the session pooler URI\n" +
        "(Supabase → Connect → Session pooler:\n" +
        "  postgresql://postgres.<ref>:<password>@aws-N-<region>.pooler.supabase.com:5432/postgres)\n" +
        "rather than the direct db.<ref>.supabase.co host, which is IPv6 only.",
    );
  }
  throw error;
}

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
