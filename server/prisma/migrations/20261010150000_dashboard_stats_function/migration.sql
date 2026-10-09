-- Dashboard statistics computed in the database; called from repositories/stats.ts.
-- "Resolved by AI": resolved/closed ticket holding an agent reply without an author.
-- Chart days are UTC days, today included, zero-filled.
CREATE FUNCTION dashboard_stats(chart_days integer DEFAULT 30) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  WITH totals AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE t."status" = 'open') AS open_count,
      count(*) FILTER (
        WHERE t."status" IN ('resolved', 'closed')
          AND EXISTS (
            SELECT 1 FROM "reply" r
            WHERE r."ticketId" = t."id" AND r."authorId" IS NULL AND r."senderType" = 'agent'
          )
      ) AS ai_count,
      (avg(extract(epoch FROM (t."resolvedAt" - t."createdAt")))
        FILTER (WHERE t."resolvedAt" IS NOT NULL))::float8 AS avg_seconds
    FROM "ticket" t
  ),
  per_day AS (
    SELECT d.day, count(t."id") AS ticket_count
    FROM generate_series(
      date_trunc('day', now() AT TIME ZONE 'UTC') - ((chart_days - 1) * interval '1 day'),
      date_trunc('day', now() AT TIME ZONE 'UTC'),
      interval '1 day'
    ) AS d(day)
    LEFT JOIN "ticket" t ON date_trunc('day', t."createdAt" AT TIME ZONE 'UTC') = d.day
    GROUP BY d.day
  )
  SELECT jsonb_build_object(
    'totalTickets', totals.total,
    'openTickets', totals.open_count,
    'resolvedByAi', totals.ai_count,
    'resolvedByAiPercent',
      CASE WHEN totals.total = 0 THEN 0 ELSE round(totals.ai_count * 100.0 / totals.total, 1)::float8 END,
    'averageResolutionSeconds', totals.avg_seconds,
    'ticketsPerDay', (
      SELECT jsonb_agg(
        jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', ticket_count) ORDER BY day
      )
      FROM per_day
    )
  )
  FROM totals
$$;
