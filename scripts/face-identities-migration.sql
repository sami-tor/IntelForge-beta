-- Face Identity Persistence
-- Links multiple face images to a single identity (person) for investigation dossiers

CREATE TABLE IF NOT EXISTS face_identities (
    id              SERIAL PRIMARY KEY,
    name            TEXT,                -- human-readable label for the identity
    primary_face_id TEXT,                -- centroid face_id that best represents this identity
    merged_faces    TEXT[] DEFAULT '{}', -- array of face_ids merged into this identity
    threads_username TEXT,              -- linked Threads username
    notes           TEXT,                -- investigator notes
    tags            TEXT[] DEFAULT '{}', -- e.g. {'suspicious', 'threat-actor'}
    created_by      TEXT NOT NULL,       -- user_id who created this identity
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_identities_created_by ON face_identities(created_by);
CREATE INDEX IF NOT EXISTS idx_face_identities_threads ON face_identities(threads_username);
CREATE INDEX IF NOT EXISTS idx_face_identities_tags ON face_identities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_face_identities_merged_faces ON face_identities USING GIN(merged_faces);
