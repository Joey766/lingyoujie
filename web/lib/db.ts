import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalPools = globalThis as typeof globalThis & { lyjAuthPool?: Pool; lyjCommunityPool?: Pool };

function newPool(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is required");
  return new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 });
}

export function authPool() {
  return globalPools.lyjAuthPool ??= newPool(process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL);
}

export async function withViewer<T>(id: string | null, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = globalPools.lyjCommunityPool ??= newPool(process.env.COMMUNITY_DATABASE_URL || process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE lyj_runtime");
    await client.query("SELECT set_config('lyj.user_id', $1, true)", [id ?? ""]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function query<T extends QueryResultRow>(viewer: string | null, text: string, params: unknown[] = []) {
  return withViewer(viewer, async client => (await client.query<T>(text, params)).rows);
}
