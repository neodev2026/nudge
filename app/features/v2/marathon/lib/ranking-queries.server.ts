import { sql } from "drizzle-orm";
import db from "~/core/db/drizzle-client.server";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type LearnRankRow = {
  auth_user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  product_points: { product_id: string; product_name: string; points: number }[];
};

export type QuizRankRow = {
  auth_user_id: string;
  display_name: string;
  avatar_url: string | null;
  best_score_pct: number;
  attempt_count: number;
};

export type SeasonRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
};

// ---------------------------------------------------------------------------
// Season helpers
// ---------------------------------------------------------------------------

/** Returns the currently active season (now() BETWEEN starts_at AND ends_at), or null. */
export async function getActiveSeasonId(): Promise<SeasonRow | null> {
  const rows = await db.execute(sql`
    SELECT id, title, starts_at, ends_at, timezone
    FROM nv2_marathon_seasons
    WHERE NOW() BETWEEN starts_at AND ends_at
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    timezone: String(row.timezone),
  };
}

/** Returns the most recently ended season (ends_at < now()), or null. */
export async function getLastEndedSeason(): Promise<SeasonRow | null> {
  const rows = await db.execute(sql`
    SELECT id, title, starts_at, ends_at, timezone
    FROM nv2_marathon_seasons
    WHERE ends_at < NOW()
    ORDER BY ends_at DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    timezone: String(row.timezone),
  };
}

// ---------------------------------------------------------------------------
// Learn ranking
//
// Points = SUM(season_progress) per user per product.
// season_progress is incremented atomically in save-progress for each newly
// completed stage, so it counts only work done after the column was introduced —
// pre-season accumulated last_stage_index is never included.
// Filtered to runs touched during the season window (updated_at BETWEEN).
// Anonymous users excluded. Sorted: total_points DESC, auth_user_id ASC.
// ---------------------------------------------------------------------------

export async function getLearnRanking(seasonId: string): Promise<LearnRankRow[]> {
  const rows = await db.execute(sql`
    WITH season AS (
      SELECT starts_at, ends_at
      FROM nv2_marathon_seasons
      WHERE id = ${seasonId}
    ),
    product_agg AS (
      SELECT
        r.auth_user_id,
        r.product_id,
        lp.name AS product_name,
        SUM(r.season_progress)::int AS points
      FROM nv2_marathon_runs r
      CROSS JOIN season s
      JOIN nv2_learning_products lp ON lp.id = r.product_id
      WHERE r.updated_at >= s.starts_at
        AND r.updated_at <= s.ends_at
        AND r.season_progress > 0
        AND r.auth_user_id NOT LIKE 'anon:%'
      GROUP BY r.auth_user_id, r.product_id, lp.name
    )
    SELECT
      pa.auth_user_id,
      p.display_name,
      p.avatar_url,
      SUM(pa.points)::int AS total_points,
      json_agg(
        json_build_object(
          'product_id', pa.product_id,
          'product_name', pa.product_name,
          'points', pa.points
        )
        ORDER BY pa.points DESC
      ) AS product_points
    FROM product_agg pa
    JOIN nv2_profiles p ON p.auth_user_id = pa.auth_user_id
    GROUP BY pa.auth_user_id, p.display_name, p.avatar_url
    ORDER BY total_points DESC, pa.auth_user_id ASC
  `);

  return rows.map((row) => ({
    auth_user_id: String(row.auth_user_id),
    display_name: String(row.display_name ?? ""),
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    total_points: Number(row.total_points),
    product_points: (row.product_points as { product_id: string; product_name: string; points: number }[]) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Quiz ranking
//
// Considers only completed runs where completed_at is within the season window
// and total_questions > 0. Best score = MAX(ROUND(score * 100.0 / total_questions)).
// attempt_count = number of qualifying completed runs.
// Sorted: best_score_pct DESC, attempt_count ASC, auth_user_id ASC.
// ---------------------------------------------------------------------------

export async function getQuizRanking(seasonId: string): Promise<QuizRankRow[]> {
  const rows = await db.execute(sql`
    WITH season AS (
      SELECT starts_at, ends_at
      FROM nv2_marathon_seasons
      WHERE id = ${seasonId}
    )
    SELECT
      r.auth_user_id,
      p.display_name,
      p.avatar_url,
      MAX(ROUND(r.score * 100.0 / r.total_questions))::int AS best_score_pct,
      COUNT(*)::int AS attempt_count
    FROM nv2_marathon_runs r
    CROSS JOIN season s
    JOIN nv2_profiles p ON p.auth_user_id = r.auth_user_id
    WHERE r.status = 'completed'
      AND r.total_questions > 0
      AND r.completed_at >= s.starts_at
      AND r.completed_at <= s.ends_at
      AND r.auth_user_id NOT LIKE 'anon:%'
    GROUP BY r.auth_user_id, p.display_name, p.avatar_url
    ORDER BY best_score_pct DESC, attempt_count ASC, r.auth_user_id ASC
  `);

  return rows.map((row) => ({
    auth_user_id: String(row.auth_user_id),
    display_name: String(row.display_name ?? ""),
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    best_score_pct: Number(row.best_score_pct),
    attempt_count: Number(row.attempt_count),
  }));
}
