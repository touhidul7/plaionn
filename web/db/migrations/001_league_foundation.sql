CREATE TABLE IF NOT EXISTS leagues (
 id uuid PRIMARY KEY, name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seasons (
 id uuid PRIMARY KEY, league_id uuid NOT NULL REFERENCES leagues(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 UNIQUE(id, league_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS seasons_name_unique ON seasons(league_id, lower(name));
CREATE TABLE IF NOT EXISTS divisions (
 id uuid PRIMARY KEY, league_id uuid NOT NULL REFERENCES leagues(id), season_id uuid NOT NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 FOREIGN KEY(season_id, league_id) REFERENCES seasons(id, league_id), UNIQUE(id, league_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_unique ON divisions(season_id, lower(name));
CREATE TABLE IF NOT EXISTS teams (
 id uuid PRIMARY KEY, league_id uuid NOT NULL REFERENCES leagues(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100), UNIQUE(id, league_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams(league_id, lower(name));
CREATE TABLE IF NOT EXISTS team_entries (
 id uuid PRIMARY KEY, league_id uuid NOT NULL REFERENCES leagues(id),
 team_id uuid NOT NULL, division_id uuid NOT NULL,
 FOREIGN KEY(team_id, league_id) REFERENCES teams(id, league_id),
 FOREIGN KEY(division_id, league_id) REFERENCES divisions(id, league_id),
 UNIQUE(team_id, division_id)
);
