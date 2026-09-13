// v33: Close Day snapshots. Append-only, like entry_audit.
//
// A closing RECORDS what a day totalled at the moment it was closed. It never
// deletes, moves or hides a cash entry, and it never blocks one: entries may still
// be added to a closed day, and the day view then shows the closed figure beside
// the current one rather than silently correcting either.
//
// Deliberately NO UNIQUE(user_id, business_date): re-closing a day must append a
// NEW row so the sequence of closings is itself preserved history.
//
// Money columns are integer paisa (v29 convention).
export const DAY_CLOSING_V33_SQL = `
CREATE TABLE IF NOT EXISTS day_closings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,                 -- whose day book was closed (the actor's branch)
  business_date TEXT NOT NULL,           -- YYYY-MM-DD, local calendar day
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL,               -- actor id
  closed_by_name TEXT NOT NULL,          -- actor name AT CLOSE TIME, like entry_audit
  cash_in_paisa INTEGER NOT NULL,
  cash_out_paisa INTEGER NOT NULL,
  closing_balance_paisa INTEGER NOT NULL,
  entry_count INTEGER NOT NULL,
  note TEXT,
  synced INTEGER DEFAULT 0,
  firestore_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_day_closings_day ON day_closings(user_id, business_date, closed_at);
CREATE INDEX IF NOT EXISTS idx_day_closings_actor ON day_closings(closed_by, closed_at);
CREATE TRIGGER IF NOT EXISTS day_closings_no_update BEFORE UPDATE ON day_closings
BEGIN SELECT RAISE(ABORT, 'A day closing cannot be changed'); END;
CREATE TRIGGER IF NOT EXISTS day_closings_no_delete BEFORE DELETE ON day_closings
BEGIN SELECT RAISE(ABORT, 'A day closing cannot be deleted'); END;
-- Also reject INSERT OR REPLACE, even when recursive_triggers is disabled.
CREATE TRIGGER IF NOT EXISTS day_closings_no_replace BEFORE INSERT ON day_closings
WHEN EXISTS (SELECT 1 FROM day_closings WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'A day closing cannot be replaced'); END;
`;
