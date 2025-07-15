const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    } else {
        console.log('Connected to the SQLite database.');

        db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
            if (pragmaErr) {
                console.error("Error enabling foreign keys:", pragmaErr.message);
            } else {
                console.log("Foreign key enforcement is ON.");
            }
        });

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error creating projects table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS releases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                release_date TEXT NOT NULL,
                is_current INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, name),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating releases table", err.message);
            });
            
            db.run(`CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requirementGroupId INTEGER,
                project_id INTEGER NOT NULL,
                requirementUserIdentifier TEXT NOT NULL,
                status TEXT NOT NULL,
                statusDate TEXT NOT NULL,
                comment TEXT,
                sprint TEXT,
                link TEXT,
                type TEXT,
                tags TEXT,
                key TEXT,
                isCurrent INTEGER DEFAULT 0,
                release_id INTEGER,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL
            )`, (err) => {
                if (err) console.error("Error creating activities table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS requirement_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requirement_group_id INTEGER NOT NULL,
                reason TEXT,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error creating requirement_changes table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                noteDate TEXT NOT NULL,
                noteText TEXT,
                UNIQUE(project_id, noteDate),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating notes table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS retrospective_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                column_type TEXT NOT NULL CHECK(column_type IN ('well', 'wrong', 'improve')),
                description TEXT NOT NULL,
                item_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating retrospective_items table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS defects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                area TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('Assigned to Developer', 'Assigned to Tester', 'Done', 'Closed')),
                link TEXT,
                created_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating defects table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS defect_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                defect_id INTEGER NOT NULL,
                changes_summary TEXT,
                comment TEXT,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating defect_history table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS defect_requirement_links (
                defect_id INTEGER NOT NULL,
                requirement_group_id INTEGER NOT NULL,
                PRIMARY KEY (defect_id, requirement_group_id),
                FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating defect_requirement_links table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`, (err) => {
                if (err) console.error("Error creating app_settings table", err.message);
                else {
                    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, ['weather_location', 'Marousi, Athens']);
                }
            });

            console.log("All table checks/creations complete.");
        });
    }
});

module.exports = db;