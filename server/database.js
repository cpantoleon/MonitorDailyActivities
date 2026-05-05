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
                status TEXT DEFAULT 'active',
                closed_at TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, name),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating releases table", err.message);
            });

            // UPDATED: Added release_ids, parent_id, expected_time, real_time_tc_creation, real_time_testing, release_time_tracking
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
                release_ids TEXT DEFAULT '[]',
                parent_id INTEGER DEFAULT NULL,
                display_order INTEGER DEFAULT 0,
                is_expanded INTEGER DEFAULT 1,
                expected_time REAL DEFAULT NULL,
                real_time_tc_creation REAL DEFAULT NULL,
                real_time_testing REAL DEFAULT NULL,
                release_time_tracking TEXT DEFAULT '{}',
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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

            db.run(`CREATE TABLE IF NOT EXISTS sticky_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT,
                color TEXT DEFAULT 'yellow',
                category TEXT DEFAULT 'General',
                display_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error creating sticky_notes table", err.message);
            });

            db.run(`CREATE TABLE IF NOT EXISTS retrospective_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                column_type TEXT NOT NULL CHECK(column_type IN ('well', 'wrong', 'improve')),
                description TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
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
                fat_report_id INTEGER NULL REFERENCES fat_reports(id) ON DELETE SET NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (original_release_id) REFERENCES releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating archived_releases table", err.message);
            });

            // UPDATED: Added tc_time and test_time
            db.run(`CREATE TABLE IF NOT EXISTS archived_release_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_id INTEGER NOT NULL,
                requirement_group_id INTEGER NOT NULL,
                requirement_title TEXT NOT NULL,
                final_status TEXT NOT NULL,
                tc_time REAL DEFAULT 0,
                test_time REAL DEFAULT 0,
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
                estimation INTEGER NULL,
                label TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (archive_id) REFERENCES archived_releases(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating sat_bugs table", err.message);
            });

            // UPDATED: Added is_fat_defect, fixed_date, is_expanded, display_order, real_time
            db.run(`CREATE TABLE IF NOT EXISTS defects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                area TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('Assigned to Developer', 'Assigned to Tester', 'Done', 'Closed')),
                link TEXT,
                created_date TEXT NOT NULL,
                fixed_date TEXT,
                is_fat_defect INTEGER DEFAULT 0,
                is_expanded INTEGER DEFAULT 1,
                display_order INTEGER DEFAULT 0,
                real_time REAL DEFAULT NULL,
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

            // UPDATED: Added release_ids
            db.run(`CREATE TABLE IF NOT EXISTS defect_requirement_links (
                defect_id INTEGER NOT NULL,
                requirement_group_id INTEGER NOT NULL,
                release_ids TEXT DEFAULT '[]',
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
                    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, ['default_card_expanded', '1']);
                    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, ['check_git_updates', '1']);
                    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, ['multi_release_mode', '0']);
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS jira_project_configs (
                project_id INTEGER PRIMARY KEY,
                jql_query TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating jira_project_configs table", err.message);
            });


            // =====================================================================================
            // MIGRATION CHECKS (PRAGMAS) - KEEP THESE SO EXISTING DATABASES DON'T LOSE DATA
            // =====================================================================================

            db.all("PRAGMA table_info(activities)", (err, columns) => {
                if (!err && columns) {
                    const hasReleaseIds = columns.some(c => c.name === 'release_ids');
                    if (!hasReleaseIds) {
                        db.run("ALTER TABLE activities ADD COLUMN release_ids TEXT DEFAULT '[]'", (alterErr) => {
                            if (!alterErr) {
                                db.run("UPDATE activities SET release_ids = '[' || release_id || ']' WHERE release_id IS NOT NULL");
                            }
                        });
                    }
                    const hasParentIdColumn = columns.some(col => col.name === 'parent_id');
                    if (!hasParentIdColumn) db.run("ALTER TABLE activities ADD COLUMN parent_id INTEGER DEFAULT NULL");

                    const hasDisplayOrderColumn = columns.some(col => col.name === 'display_order');
                    if (!hasDisplayOrderColumn) db.run("ALTER TABLE activities ADD COLUMN display_order INTEGER DEFAULT 0");

                    const hasIsExpandedColumn = columns.some(col => col.name === 'is_expanded');
                    if (!hasIsExpandedColumn) db.run("ALTER TABLE activities ADD COLUMN is_expanded INTEGER DEFAULT 1");

                    const hasExpectedTimeColumn = columns.some(col => col.name === 'expected_time');
                    if (!hasExpectedTimeColumn) db.run("ALTER TABLE activities ADD COLUMN expected_time REAL DEFAULT NULL");

                    const hasRealTimeTcCreationColumn = columns.some(col => col.name === 'real_time_tc_creation');
                    if (!hasRealTimeTcCreationColumn) db.run("ALTER TABLE activities ADD COLUMN real_time_tc_creation REAL DEFAULT NULL");

                    const hasRealTimeTestingColumn = columns.some(col => col.name === 'real_time_testing');
                    if (!hasRealTimeTestingColumn) db.run("ALTER TABLE activities ADD COLUMN real_time_testing REAL DEFAULT NULL");

                    const hasReleaseTimeTracking = columns.some(c => c.name === 'release_time_tracking');
                    if (!hasReleaseTimeTracking) db.run("ALTER TABLE activities ADD COLUMN release_time_tracking TEXT DEFAULT '{}'");
                }
            });

            db.all("PRAGMA table_info(defect_requirement_links)", (err, columns) => {
                if (!err && columns) {
                    const hasReleaseIds = columns.some(c => c.name === 'release_ids');
                    if (!hasReleaseIds) {
                        db.run("ALTER TABLE defect_requirement_links ADD COLUMN release_ids TEXT DEFAULT '[]'");
                    }
                }
            });

            db.all("PRAGMA table_info(sticky_notes)", (err, columns) => {
                if (!err && columns) {
                    const hasCategory = columns.some(c => c.name === 'category');
                    if (!hasCategory) {
                        db.run("ALTER TABLE sticky_notes ADD COLUMN category TEXT DEFAULT 'General'");
                    }
                }
            });

            db.all("PRAGMA table_info(sticky_notes)", (err, columns) => {
                if (!err && columns) {
                    const hasDisplayOrder = columns.some(c => c.name === 'display_order');
                    if (!hasDisplayOrder) {
                        db.run("ALTER TABLE sticky_notes ADD COLUMN display_order INTEGER DEFAULT 0");
                    }
                }
            });

            db.all("PRAGMA table_info(archived_release_items)", (err, columns) => {
                if (!err && columns) {
                    const hasTcTime = columns.some(c => c.name === 'tc_time');
                    if (!hasTcTime) {
                        db.run("ALTER TABLE archived_release_items ADD COLUMN tc_time REAL DEFAULT 0");
                        db.run("ALTER TABLE archived_release_items ADD COLUMN test_time REAL DEFAULT 0");
                    }
                }
            });

            db.all("PRAGMA table_info(defects)", (err, columns) => {
                if (!err && columns) {
                    const hasFixedDate = columns.some(c => c.name === 'fixed_date');
                    if (!hasFixedDate) db.run("ALTER TABLE defects ADD COLUMN fixed_date TEXT");

                    const hasIsFatDefectColumn = columns.some(col => col.name === 'is_fat_defect');
                    if (!hasIsFatDefectColumn) db.run("ALTER TABLE defects ADD COLUMN is_fat_defect INTEGER DEFAULT 0");

                    const hasIsExpandedColumn = columns.some(col => col.name === 'is_expanded');
                    if (!hasIsExpandedColumn) db.run("ALTER TABLE defects ADD COLUMN is_expanded INTEGER DEFAULT 1");

                    const hasDisplayOrderColumn = columns.some(col => col.name === 'display_order');
                    if (!hasDisplayOrderColumn) db.run("ALTER TABLE defects ADD COLUMN display_order INTEGER DEFAULT 0");

                    const hasRealTimeColumn = columns.some(col => col.name === 'real_time');
                    if (!hasRealTimeColumn) db.run("ALTER TABLE defects ADD COLUMN real_time REAL DEFAULT NULL");
                }
            });

            console.log("All table checks/creations complete.");
        });
    }
});

module.exports = db;