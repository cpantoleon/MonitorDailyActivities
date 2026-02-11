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
                details TEXT NOT NULL,
                item_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating retrospective_items table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS archived_releases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_release_id INTEGER NOT NULL,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                closed_at TEXT NOT NULL,
                metrics_json TEXT,
                close_action TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (original_release_id) REFERENCES releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating archived_releases table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS archived_release_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_id INTEGER NOT NULL,
                requirement_group_id INTEGER NOT NULL,
                requirement_title TEXT NOT NULL,
                final_status TEXT NOT NULL,
                FOREIGN KEY (archive_id) REFERENCES archived_releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating archived_release_items table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS sat_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_id INTEGER NOT NULL UNIQUE,
                blocked REAL DEFAULT 0,
                failed REAL DEFAULT 0,
                executing REAL DEFAULT 0,
                aborted REAL DEFAULT 0,
                passed REAL DEFAULT 0,
                pending REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (archive_id) REFERENCES archived_releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating sat_reports table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS sat_bugs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                link TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (archive_id) REFERENCES archived_releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating sat_bugs table", err.message);
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
            
            db.run(`CREATE TABLE IF NOT EXISTS fat_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                completion_date TEXT,
                status TEXT NOT NULL CHECK(status IN ('active', 'completed')) DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating fat_periods table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS fat_selected_releases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fat_period_id INTEGER NOT NULL,
                release_id INTEGER,
                archived_release_id INTEGER,
                release_name TEXT NOT NULL,
                release_type TEXT NOT NULL CHECK(release_type IN ('active', 'archived')),
                FOREIGN KEY (fat_period_id) REFERENCES fat_periods(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating fat_selected_releases table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS fat_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fat_period_id INTEGER NOT NULL UNIQUE,
                passed INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0,
                blocked INTEGER DEFAULT 0,
                caution INTEGER DEFAULT 0,
                not_run INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fat_period_id) REFERENCES fat_periods(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating fat_reports table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS fat_kpis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fat_period_id INTEGER NOT NULL UNIQUE,
                dre REAL NOT NULL,
                mttd REAL NOT NULL,
                mttr REAL NOT NULL,
                calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fat_period_id) REFERENCES fat_periods(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating fat_kpis table", err.message);
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

            db.run(`CREATE TABLE IF NOT EXISTS jira_project_configs (
                project_id INTEGER PRIMARY KEY,
                jql_query TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating jira_project_configs table", err.message);
            });

            db.all("PRAGMA table_info(retrospective_items)", (err, columns) => {
                if (err) {
                    console.error("Error fetching retrospective_items table info:", err.message);
                    return;
                }
                
                const hasDetailsColumn = columns.some(col => col.name === 'details');
                if (!hasDetailsColumn) {
                    db.run("ALTER TABLE retrospective_items ADD COLUMN details TEXT NOT NULL DEFAULT ''", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding details column to retrospective_items:", alterErr.message);
                        } else {
                            console.log("Column 'details' added to retrospective_items table.");
                        }
                    });
                }
            });

            db.all("PRAGMA table_info(releases)", (err, columns) => {
                if (err) {
                    console.error("Error fetching releases table info:", err.message);
                    return;
                }
                
                const hasStatusColumn = columns.some(col => col.name === 'status');
                if (!hasStatusColumn) {
                    db.run("ALTER TABLE releases ADD COLUMN status TEXT DEFAULT 'active'", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding status column to releases:", alterErr.message);
                        } else {
                            console.log("Column 'status' added to releases table.");
                        }
                    });
                }

                const hasClosedAtColumn = columns.some(col => col.name === 'closed_at');
                if (!hasClosedAtColumn) {
                    db.run("ALTER TABLE releases ADD COLUMN closed_at TEXT NULL", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding closed_at column to releases:", alterErr.message);
                        } else {
                            console.log("Column 'closed_at' added to releases table.");
                        }
                    });
                }
            });

            db.all("PRAGMA table_info(archived_releases)", (err, columns) => {
                if (err) {
                    console.error("Error fetching archived_releases table info:", err.message);
                    return;
                }
                
                const hasCloseActionColumn = columns.some(col => col.name === 'close_action');
                if (!hasCloseActionColumn) {
                    db.run("ALTER TABLE archived_releases ADD COLUMN close_action TEXT", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding close_action column to archived_releases:", alterErr.message);
                        } else {
                            console.log("Column 'close_action' added to archived_releases table.");
                        }
                    });
                }

                const hasFatReportIdColumn = columns.some(col => col.name === 'fat_report_id');
                if (!hasFatReportIdColumn) {
                    db.run("ALTER TABLE archived_releases ADD COLUMN fat_report_id INTEGER NULL REFERENCES fat_reports(id) ON DELETE SET NULL", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding fat_report_id column to archived_releases:", alterErr.message);
                        } else {
                            console.log("Column 'fat_report_id' added to archived_releases table.");
                        }
                    });
                }
            });

            db.all("PRAGMA table_info(sat_bugs)", (err, columns) => {
                if (err) {
                    console.error("Error fetching sat_bugs table info:", err.message);
                    return;
                }
                
                const hasEstimationColumn = columns.some(col => col.name === 'estimation');
                if (!hasEstimationColumn) {
                    db.run("ALTER TABLE sat_bugs ADD COLUMN estimation INTEGER NULL", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding estimation column to sat_bugs:", alterErr.message);
                        } else {
                            console.log("Column 'estimation' added to sat_bugs table.");
                        }
                    });
                }

                const hasLabelColumn = columns.some(col => col.name === 'label');
                if (!hasLabelColumn) {
                    db.run("ALTER TABLE sat_bugs ADD COLUMN label TEXT NULL", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding label column to sat_bugs:", alterErr.message);
                        } else {
                            console.log("Column 'label' added to sat_bugs table.");
                        }
                    });
                }
            });

            db.all("PRAGMA table_info(defects)", (err, columns) => {
                if (err) {
                    console.error("Error fetching defects table info:", err.message);
                    return;
                }

                const hasIsFatDefectColumn = columns.some(col => col.name === 'is_fat_defect');
                if (!hasIsFatDefectColumn) {
                    db.run("ALTER TABLE defects ADD COLUMN is_fat_defect INTEGER DEFAULT 0", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding is_fat_defect column to defects:", alterErr.message);
                        } else {
                            console.log("Column 'is_fat_defect' added to defects table.");
                        }
                    });
                }

                const hasFixedDateColumn = columns.some(col => col.name === 'fixed_date');
                if (!hasFixedDateColumn) {
                    db.run("ALTER TABLE defects ADD COLUMN fixed_date TEXT", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding fixed_date column to defects:", alterErr.message);
                        } else {
                            console.log("Column 'fixed_date' added to defects table.");
                        }
                    });
                }
            });

            console.log("All table checks/creations complete.");
        });
    }
});

module.exports = db;