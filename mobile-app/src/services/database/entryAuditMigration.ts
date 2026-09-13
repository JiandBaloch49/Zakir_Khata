// v31: append-only field history. Values tagged money_paisa are integer paisa.
export const ENTRY_AUDIT_V31_SQL = `
CREATE TABLE IF NOT EXISTS entry_audit (
  id TEXT PRIMARY KEY NOT NULL,
  change_group_id TEXT NOT NULL,
  book_table TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  entry_owner_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value_kind TEXT NOT NULL CHECK(value_kind IN ('money_paisa','date','text','number','boolean')),
  old_value_json TEXT NOT NULL,
  new_value_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('edited','deleted'))
);
CREATE INDEX IF NOT EXISTS idx_entry_audit_entry ON entry_audit(book_table, entry_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_entry_audit_owner ON entry_audit(entry_owner_id, changed_at);
CREATE TRIGGER IF NOT EXISTS entry_audit_no_update BEFORE UPDATE ON entry_audit
BEGIN SELECT RAISE(ABORT, 'Entry history cannot be changed'); END;
CREATE TRIGGER IF NOT EXISTS entry_audit_no_delete BEFORE DELETE ON entry_audit
BEGIN SELECT RAISE(ABORT, 'Entry history cannot be deleted'); END;
-- Also reject INSERT OR REPLACE, even when recursive_triggers is disabled.
CREATE TRIGGER IF NOT EXISTS entry_audit_no_replace BEFORE INSERT ON entry_audit
WHEN EXISTS (SELECT 1 FROM entry_audit WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Entry history cannot be replaced'); END;
`;
