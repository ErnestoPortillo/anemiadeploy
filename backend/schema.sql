CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'nurse',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, role)
VALUES ('admin', 'admin-123', 'admin')
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
