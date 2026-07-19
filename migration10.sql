ALTER TABLE users ADD COLUMN current_jti TEXT;

INSERT OR IGNORE INTO _migrations (name) VALUES ('migration10');
