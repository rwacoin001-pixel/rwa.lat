-- Prediction favorites: per-user watchlist for event pages (the star button).
-- Additive only: new table + index, no changes to existing tables.
CREATE TABLE IF NOT EXISTS app.prediction_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prediction_favorites_user_event_uq
  ON app.prediction_favorites (user_id, event_id);
