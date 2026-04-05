-- Generic key-value store for plugin state that needs to survive across sessions.
-- Plugins like treehouse-pet and treehouse-tokens manage their own tables;
-- this table covers chess, pixelart, body, and pioneer (and any future plugins).

CREATE TABLE IF NOT EXISTS plugin_states (
  user_id    UUID    NOT NULL,
  plugin_id  TEXT    NOT NULL,
  state      JSONB   NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plugin_id)
);

-- Index for the common lookup: load one plugin's state for a user
CREATE INDEX IF NOT EXISTS idx_plugin_states_user
  ON plugin_states (user_id);

-- RPC: upsert plugin state in a single round-trip.
-- SECURITY DEFINER so the anon key can write via this function only.
CREATE OR REPLACE FUNCTION upsert_plugin_state(
  p_user_id   UUID,
  p_plugin_id TEXT,
  p_state     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO plugin_states (user_id, plugin_id, state, updated_at)
  VALUES (p_user_id, p_plugin_id, p_state, now())
  ON CONFLICT (user_id, plugin_id)
  DO UPDATE SET state = p_state, updated_at = now();
END;
$$;
