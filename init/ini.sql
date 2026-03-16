CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS points (
    id SERIAL PRIMARY KEY,
    name TEXT,
    difficulty INTEGER,
    gaz BOOLEAN,
    notes TEXT,
    geom GEOMETRY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    name TEXT,
    notes TEXT,
    geom GEOMETRY(Polygon, 4326)
);

CREATE TABLE IF NOT EXISTS gpx_hikes (
    id SERIAL PRIMARY KEY,
    name TEXT,
    difficulty INTEGER,
    gaz BOOLEAN,
    notes TEXT,
    distance_km FLOAT,
    elevation_gain INTEGER,
    elevation_loss INTEGER,
    geom GEOMETRY(LineString, 4326)
);
