// QAMAR : banc d'essai SQL local (PGlite = vrai PostgreSQL en WebAssembly). Applique supabase/migrations/001..NNN + seed.sql
// sur une base vide, avec une imitation minimale de Supabase (rôles anon / authenticated / service_role, auth.uid(), publication temps réel).
// PGlite n'est pas une dépendance du site : chemin pris dans PGLITE_DIR (dossier node_modules qui contient @electric-sql/pglite),
// sinon ./node_modules, sinon /private/tmp/claude-501/pgtest/node_modules. Absent : les tests SQL sont sautés (signalé).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = join(ROOT, 'supabase/migrations/');

export const SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`;

export function findPglite() {
  const dirs = [process.env.PGLITE_DIR, join(ROOT, 'node_modules'), '/private/tmp/claude-501/pgtest/node_modules'].filter(Boolean);
  return dirs.find(d => existsSync(join(d, '@electric-sql/pglite/dist/index.js'))) || null;
}

export async function setup({ upTo = 99, rerun = [] } = {}) {
  const dir = findPglite();
  if (!dir) return null;
  const { PGlite } = await import(pathToFileURL(join(dir, '@electric-sql/pglite/dist/index.js')).href);
  const { pgcrypto } = await import(pathToFileURL(join(dir, '@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SHIM);
  const files = readdirSync(MIG).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const n = +f.slice(0, 3); if (n > upTo) continue;
    try { await db.exec(`begin;\n${readFileSync(MIG + f, 'utf8')}\ncommit;`); }
    catch (e) { try { await db.exec('rollback'); } catch { /* ignore */ } throw new Error(`${f}: ${e.message}`); }
    // seed.sql (généré depuis data.js) : la durée du SOS 15 y est fausse (69 > 45 min), corrigée ici comme dans le vrai projet
    if (n === 5) await db.exec(readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8').replace('69, 69, null', '15, 69, null'));
  }
  for (const f of rerun) await db.exec(`begin;\n${readFileSync(MIG + f, 'utf8')}\ncommit;`);
  return db;
}

// Exécute une requête comme anon, comme un compte connecté (uuid) ou comme superutilisateur ('su')
export function actor(db) {
  return async function as(who, sql, params) {
    const role = who === 'anon' ? 'anon' : who === 'su' ? null : 'authenticated';
    const sub = who === 'anon' || who === 'su' ? '' : who;
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claim.role', '${role || ''}', false);` + (role ? `set role ${role};` : ''));
    try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
  };
}
