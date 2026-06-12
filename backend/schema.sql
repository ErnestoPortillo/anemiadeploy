CREATE TABLE IF NOT EXISTS medical_centers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) UNIQUE NOT NULL,
    distrito VARCHAR(60) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_medical_centers_nombre
    ON medical_centers (nombre);

CREATE INDEX IF NOT EXISTS ix_medical_centers_distrito
    ON medical_centers (distrito);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'nurse',
    full_name VARCHAR(120),
    medical_center_id INTEGER REFERENCES medical_centers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, role)
VALUES
    ('admin', 'admin123', 'admin'),
    ('enfermera1', 'enf123', 'nurse'),
    ('medico1', 'med123', 'doctor'),
    ('coordinador1', 'coor123', 'coordinator')
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
