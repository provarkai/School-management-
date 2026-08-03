import { gzipSync } from "node:zlib";
import { createAdminClient } from "@/lib/supabase/server";
import { buildSchoolSnapshot } from "@/lib/backup";
import { s3ConfigFromEnv, s3PutObject } from "@/lib/s3";

export const maxDuration = 300;

/**
 * Vercel Cron target — writes a complete snapshot of every school to
 * off-site object storage, nightly.
 *
 * One file per school per night rather than one big file, so a single
 * school can be restored without touching the others, and so one school's
 * failure doesn't cost you the rest of the run.
 *
 * Keys are `schools/{schoolId}/{YYYY-MM-DD}.json.gz`, which sorts
 * chronologically and makes "the state of this school on that date" a
 * single lookup. Re-running on the same day overwrites that day's file,
 * so a retry after a partial failure is safe.
 *
 * This protects against a bad migration, a mistaken delete, or losing the
 * Supabase project itself. It does NOT replace Supabase's own backups for
 * Storage files (student documents, resources, logos) — those live outside
 * Postgres and aren't in the snapshot.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const config = s3ConfigFromEnv();
  if (!config) {
    // Loud rather than silent: a backup job that quietly does nothing is
    // worse than no backup job, because it looks like one.
    return Response.json(
      {
        error:
          "Backup storage is not configured. Set BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, " +
          "BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY.",
      },
      { status: 500 }
    );
  }

  const admin = createAdminClient();

  const { data: schools, error } = await admin.from("schools").select("id, name");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const succeeded: { school: string; key: string; bytes: number; rows: number }[] = [];
  const failed: { school: string; error: string }[] = [];

  for (const school of schools ?? []) {
    try {
      const snapshot = await buildSchoolSnapshot(admin, school.id);
      const body = gzipSync(Buffer.from(JSON.stringify(snapshot)));
      const key = `schools/${school.id}/${day}.json.gz`;

      await s3PutObject(config, key, body, "application/gzip");

      succeeded.push({
        school: school.name,
        key,
        bytes: body.byteLength,
        rows: Object.values(snapshot.counts).reduce((sum, n) => sum + n, 0),
      });
    } catch (e) {
      // Carry on: one school's failure must not cost the others their
      // backup for the night.
      failed.push({ school: school.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json(
    { day, backedUp: succeeded.length, failedCount: failed.length, succeeded, failed },
    { status: failed.length > 0 ? 500 : 200 }
  );
}
