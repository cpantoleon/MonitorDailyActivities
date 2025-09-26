const express = require('express');
const cors = require('cors');
const db = require('./database.js');

const ensureGeneralProjectExists = () => {
    const projectName = 'General';
    db.get("SELECT id FROM projects WHERE name = ?", [projectName], (err, row) => {
        if (err) {
            console.error("Error checking for General project:", err.message);
            return;
        }
        if (!row) {
            db.run(`INSERT INTO projects (name) VALUES (?)`, [projectName], function(err) {
                if (err) {
                    console.error("Error creating General project:", err.message);
                } else {
                    console.log("'General' project created successfully.");
                }
            });
        }
    });
};

ensureGeneralProjectExists();

const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

let syncWithQdrant, handleChatbotQuery;
let isChatbotEnabled = false;

try {
  const chatbotModule = require('./chatbot.js');
  syncWithQdrant = chatbotModule.syncWithQdrant;
  handleChatbotQuery = chatbotModule.handleChatbotQuery;
  isChatbotEnabled = true;
  console.log("Chatbot module loaded successfully.");
} catch (error) {
  console.warn("**************************************************");
  console.warn("WARNING: Chatbot module failed to load.");
  console.warn("The server will run without chatbot functionality.");
  console.warn("Reason:", error.message);
  console.warn("**************************************************");
  isChatbotEnabled = false;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

let syncTimeout = null;
let isSyncing = false;

const scheduleQdrantSync = () => {
    if (!isChatbotEnabled) return;

    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    console.log("Change detected. Scheduling Qdrant sync in 30 seconds...");
    syncTimeout = setTimeout(async () => {
        if (isSyncing) {
            console.log("Sync is already in progress. Will skip this scheduled sync.");
            return;
        }

        isSyncing = true;
        console.log("Starting debounced Qdrant sync...");
        const dummyRes = {
            status: () => ({
                json: (data) => console.log("Background sync completed.", data)
            })
        };
        try {
            await syncWithQdrant(db)({}, dummyRes);
        } catch (error) {
            console.error("Background Qdrant sync failed:", error.message);
        } finally {
            isSyncing = false;
            console.log("Sync process finished.");
        }
    }, 30000);
};


const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const getProjectId = (projectName) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT id FROM projects WHERE name = ?", [projectName], (err, row) => {
            if (err) reject(new Error("DB error checking project"));
            else if (!row) reject(new Error(`Project '${projectName}' not found.`));
            else resolve(row.id);
        });
    });
};

// Helper function to calculate duration based on special business rules.
const calculateBusinessHours = (start, end) => {
    let startDate = new Date(start);
    let endDate = new Date(end);

    if (endDate <= startDate) return 0;

    const endDayOfWeek = endDate.getUTCDay(); // Sunday = 0, Saturday = 6
    const isEndOnWeekend = (endDayOfWeek === 0 || endDayOfWeek === 6);

    // RULE 1: If the ticket is closed on a weekend, count all calendar days.
    if (isEndOnWeekend) {
        // Simple difference in hours between the two dates.
        const diffInMs = endDate.getTime() - startDate.getTime();
        return diffInMs / (1000 * 60 * 60);
    }

    // RULE 2: If the ticket is closed on a weekday, skip weekends.
    let totalHours = 0;
    let current = new Date(startDate);

    // Loop day by day from the start until we pass the end date
    while (current < endDate) {
        const dayOfWeek = current.getUTCDay();

        // Only perform calculations for weekdays
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            let startOfDay = new Date(current);
            startOfDay.setUTCHours(0, 0, 0, 0);

            let endOfDay = new Date(startOfDay);
            endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);

            let effectiveStart = (startDate > startOfDay) ? startDate : startOfDay;
            let effectiveEnd = (endDate < endOfDay) ? endDate : endOfDay;

            if (effectiveEnd > effectiveStart) {
                totalHours += (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
            }
        }
        
        // Move to the start of the next day
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(0, 0, 0, 0);
    }

    return totalHours;
};

const processExcelData = (fileBuffer) => {
    const validTypes = ['Change Request', 'Task', 'Bug', 'Story', "Incident"];
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    let keyColumn = null;
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = xlsx.utils.encode_cell({ r: 0, c: C });
        const cell = worksheet[address];
        if (cell && cell.v === 'Key') {
            keyColumn = xlsx.utils.encode_col(C);
            break;
        }
    }

    const results = {
        validRows: [],
        skippedCount: 0,
    };

    data.forEach((row, index) => {
        const summary = row['Summary'] ? String(row['Summary']).trim() : '';
        if (!summary) return;

        const type = row['T'] ? String(row['T']).trim() : '';
        if (!validTypes.includes(type)) {
            results.skippedCount++;
            return;
        }

        const linkRegex = /\[(.*?)\]/;
        const title = summary.replace(linkRegex, '').trim();
        const key = row['Key'] ? String(row['Key']).trim() : '';
        const tags = row['Sprint'] ? String(row['Sprint']).trim() : null;
        
        let link = null;
        if (keyColumn) {
            const excelRowNumber = index + 2; 
            const keyCellAddress = `${keyColumn}${excelRowNumber}`;
            const keyCell = worksheet[keyCellAddress];

            if (keyCell && keyCell.l) {
                link = keyCell.l.Target;
            }
        }

        results.validRows.push({ title, type, tags, link, key });
    });
    return results;
};

const processDefectExcelData = (fileBuffer) => {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    let keyColumn = null;
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = xlsx.utils.encode_cell({ r: 0, c: C });
        const cell = worksheet[address];
        if (cell && cell.v === 'Key') {
            keyColumn = xlsx.utils.encode_col(C);
            break;
        }
    }

    const results = {
        validRows: [],
        skippedCount: 0,
    };

    data.forEach((row, index) => {
        const type = row['T'] ? String(row['T']).trim() : '';
        if (type !== 'Defect') {
            results.skippedCount++;
            return;
        }

        const title = row['Summary'] ? String(row['Summary']).trim() : '';
        if (!title) {
            results.skippedCount++;
            return;
        }
        let link = null;
        if (keyColumn) {
            const excelRowNumber = index + 2; 
            const keyCellAddress = `${keyColumn}${excelRowNumber}`;
            const keyCell = worksheet[keyCellAddress];

            if (keyCell && keyCell.l) {
                link = keyCell.l.Target;
            }
        }

        const links = row['Links'] ? String(row['Links']).trim() : null;

        results.validRows.push({ title, link, links });
    });

    return results;
};

app.get("/api/projects", (req, res) => {
    const sql = "SELECT name FROM projects WHERE name != 'General' ORDER BY name ASC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ message: "success", data: rows.map(row => row.name) });
    });
});

app.post("/api/projects", (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: "Project name is required." });
    const trimmedName = name.trim();
    const sql = `INSERT INTO projects (name) VALUES (?)`;
    db.run(sql, [trimmedName], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ "error": `Project '${trimmedName}' already exists.` });
            return res.status(400).json({ "error": err.message });
        }
        scheduleQdrantSync();
        res.status(201).json({ message: "Project added successfully", data: { id: this.lastID, name: trimmedName } });
    });
});

app.delete("/api/projects/:name", (req, res) => {
    const projectName = decodeURIComponent(req.params.name);
    if (!projectName) return res.status(400).json({ error: "Project name is required." });

    const sql = 'DELETE FROM projects WHERE name = ?';
    db.run(sql, [projectName], function(err) {
        if (err) return res.status(500).json({ error: `Failed to delete project '${projectName}': ${err.message}` });
        if (this.changes === 0) return res.status(404).json({ error: `Project '${projectName}' not found.` });
        scheduleQdrantSync();
        res.json({ message: `Project '${projectName}' and all its associated data have been deleted.`, changes: this.changes });
    });
});

app.put("/api/projects/:name", (req, res) => {
    const currentName = decodeURIComponent(req.params.name);
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
        return res.status(400).json({ error: "New project name is required." });
    }

    const trimmedNewName = newName.trim();
    const sql = 'UPDATE projects SET name = ? WHERE name = ?';

    db.run(sql, [trimmedNewName, currentName], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).json({ "error": `A project named '${trimmedNewName}' already exists.` });
            }
            return res.status(500).json({ error: `Failed to rename project: ${err.message}` });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: `Project '${currentName}' not found.` });
        }
        scheduleQdrantSync();
        res.json({ 
            message: `Project '${currentName}' was successfully renamed to '${trimmedNewName}'.`,
            data: { oldName: currentName, newName: trimmedNewName }
        });
    });
});

app.get("/api/requirements", (req, res) => {
    const activitiesSql = `SELECT
                    act.id as activityDbId, act.requirementGroupId, p.name as project,
                    act.requirementUserIdentifier, act.status, act.statusDate,
                    act.comment, act.sprint, act.link, act.type, act.tags, act.isCurrent,
                    act.created_at, act.release_id,
                    rel.name as release_name, rel.release_date
                 FROM activities act
                 JOIN projects p ON act.project_id = p.id
                 LEFT JOIN releases rel ON act.release_id = rel.id
                 ORDER BY act.requirementGroupId, act.created_at DESC`;
    
    const linksSql = `SELECT l.requirement_group_id, d.id as defect_id, d.title as defect_title, d.status as defect_status, d.link as defect_link, p.name as project_name, d.is_fat_defect
                    FROM defect_requirement_links l
                    JOIN defects d ON l.defect_id = d.id
                    JOIN projects p ON d.project_id = p.id`;

    const changesSql = `SELECT requirement_group_id, COUNT(id) as change_count FROM requirement_changes GROUP BY requirement_group_id`;

    Promise.all([
        new Promise((resolve, reject) => db.all(activitiesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
        new Promise((resolve, reject) => db.all(linksSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
        new Promise((resolve, reject) => db.all(changesSql, [], (err, rows) => err ? reject(err) : resolve(rows)))
    ]).then(([activityRows, linkRows, changeRows]) => {
        const linksMap = new Map();
        linkRows.forEach(link => {
            if (!linksMap.has(link.requirement_group_id)) {
                linksMap.set(link.requirement_group_id, []);
            }
            linksMap.get(link.requirement_group_id).push({ id: link.defect_id, title: link.defect_title, status: link.defect_status, link: link.defect_link, project: link.project_name, is_fat_defect: link.is_fat_defect });
        });

        const changesMap = new Map();
        changeRows.forEach(change => {
            changesMap.set(change.requirement_group_id, change.change_count);
        });

        const requirementsGroupMap = new Map();
        activityRows.forEach(row => {
            let groupId = row.requirementGroupId;
            if (!groupId && groupId !== 0) {
                groupId = `${row.project}_${row.requirementUserIdentifier}`;
            }
            if (!requirementsGroupMap.has(groupId)) {
                requirementsGroupMap.set(groupId, {
                    id: groupId,
                    project: row.project ? row.project.trim() : 'Unknown Project',
                    requirementUserIdentifier: row.requirementUserIdentifier ? row.requirementUserIdentifier.trim() : 'Unknown Identifier',
                    history: [],
                    currentStatusDetails: {},
                    linkedDefects: linksMap.get(groupId) || [],
                    changeCount: changesMap.get(groupId) || 0
                });
            }
            const reqGroupEntry = requirementsGroupMap.get(groupId);
            if (reqGroupEntry) {
                reqGroupEntry.history.push({
                    activityId: row.activityDbId, status: row.status, date: row.statusDate,
                    comment: row.comment, sprint: row.sprint ? row.sprint.trim() : row.sprint,
                    link: row.link, type: row.type, tags: row.tags, isCurrent: row.isCurrent === 1,
                    createdAt: row.created_at,
                    releaseId: row.release_id,
                    releaseName: row.release_name,
                    releaseDate: row.release_date
                });
            }
        });

        const processedRequirements = [];
        requirementsGroupMap.forEach(reqGroup => {
            if (reqGroup.history.length > 0) {
                reqGroup.currentStatusDetails = reqGroup.history.find(h => h.isCurrent) || reqGroup.history[0];
            }
            processedRequirements.push(reqGroup);
        });
        res.json({ message: "success", data: processedRequirements });

    }).catch(err => {
        res.status(400).json({"error": err.message});
    });
});

app.post("/api/activities", async (req, res) => {
    let { project, requirementName, status, statusDate, comment, sprint, link, existingRequirementGroupId, type, tags, key, release_id } = req.body;
    if (!project || !requirementName || !status || !statusDate || !sprint) {
        return res.status(400).json({ error: "Missing required fields (project, requirementName, status, statusDate, sprint)" });
    }
    
    try {
        const projectId = await getProjectId(project.trim());
        const requirementUserIdentifier = requirementName.trim();
        status = status.trim();
        sprint = sprint.trim();
        comment = comment ? comment.trim() : null;
        link = link ? link.trim() : null;
        type = type ? type.trim() : null;
        tags = tags ? tags.trim() : null;
        const itemKey = key ? key.trim() : null;
        const finalReleaseId = release_id || null;
        const now = new Date().toISOString();

        db.serialize(() => {
            const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, comment, sprint, link, type, tags, key, release_id, isCurrent, requirementGroupId, created_at, updated_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`;
            db.run(insertSql, [projectId, requirementUserIdentifier, status, statusDate, comment, sprint, link, type, tags, itemKey, finalReleaseId, now, now], function(err) {
                if (err) {
                    return res.status(400).json({ error: "Failed to insert activity: " + err.message });
                }
                const newActivityDbId = this.lastID;
                let finalRequirementGroupId = existingRequirementGroupId || newActivityDbId;

                db.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [finalRequirementGroupId, newActivityDbId], (updateGroupIdErr) => {
                    if (updateGroupIdErr) console.error("Error setting requirementGroupId:", updateGroupIdErr.message);
                    
                    const updateOldSql = `UPDATE activities SET isCurrent = 0 WHERE requirementGroupId = ? AND id != ?`;
                    db.run(updateOldSql, [finalRequirementGroupId, newActivityDbId], (updateOldErr) => {
                        if (updateOldErr) console.error("Error updating old current status:", updateOldErr.message);
                        
                        scheduleQdrantSync();
                        res.json({
                            message: "success",
                            data: {
                                activityDbId: newActivityDbId, requirementGroupId: finalRequirementGroupId,
                                project, requirementUserIdentifier, status, statusDate, comment, sprint, link, isCurrent: 1, type, tags, release_id: finalReleaseId
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/activities/:activityId", (req, res) => {
    let { comment, statusDate, link, type, tags, release_id } = req.body;
    const activityDbId = req.params.activityId;
    if (comment === undefined && statusDate === undefined && link === undefined && type === undefined && tags === undefined && release_id === undefined) {
        return res.status(400).json({ error: "No fields to update provided" });
    }
    let fieldsToUpdate = [];
    let params = [];
    if (comment !== undefined) { fieldsToUpdate.push("comment = ?"); params.push(comment); }
    if (statusDate !== undefined) { fieldsToUpdate.push("statusDate = ?"); params.push(statusDate); }
    if (link !== undefined) { fieldsToUpdate.push("link = ?"); params.push(link); }
    if (type !== undefined) { fieldsToUpdate.push("type = ?"); params.push(type); }
    if (tags !== undefined) { fieldsToUpdate.push("tags = ?"); params.push(tags); }
    if (release_id !== undefined) { fieldsToUpdate.push("release_id = ?"); params.push(release_id); }

    fieldsToUpdate.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(activityDbId);
    const sql = `UPDATE activities SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
    db.run(sql, params, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: `Activity with id ${activityDbId} not found.` });
        scheduleQdrantSync();
        res.json({ message: "success", data: { id: activityDbId, changes: this.changes }});
    });
});

app.get("/api/requirements/:requirementGroupId/changes", (req, res) => {
    const groupId = parseInt(req.params.requirementGroupId, 10);
    if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid requirementGroupId format." });
    }
    const sql = "SELECT id, reason, changed_at FROM requirement_changes WHERE requirement_group_id = ? ORDER BY changed_at DESC";
    db.all(sql, [groupId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching changes." });
        }
        res.json({ message: "success", data: rows });
    });
});

app.post("/api/requirements/:requirementGroupId/changes", (req, res) => {
    const groupId = parseInt(req.params.requirementGroupId, 10);
    const { reason } = req.body;
    if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid requirementGroupId format." });
    }

    const sql = `INSERT INTO requirement_changes (requirement_group_id, reason) VALUES (?, ?)`;
    db.run(sql, [groupId, reason ? reason.trim() : null], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error while logging change." });
        }
        scheduleQdrantSync();
        res.status(201).json({
            message: "Change logged successfully.",
            data: { id: this.lastID, requirement_group_id: groupId, reason }
        });
    });
});

app.put("/api/requirements/:requirementGroupId/rename", (req, res) => {
    const groupId = parseInt(req.params.requirementGroupId, 10);
    let { newRequirementName } = req.body;
    if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid requirementGroupId format." });
    }
    if (!newRequirementName || !newRequirementName.trim()) {
        return res.status(400).json({ error: "New requirement name is required." });
    }
    const trimmedNewName = newRequirementName.trim();
    const sql = `UPDATE activities SET requirementUserIdentifier = ? WHERE requirementGroupId = ?`;
    db.run(sql, [trimmedNewName, groupId], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error while updating requirement name." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: `Requirement group with ID ${groupId} not found or name unchanged.` });
        }
        scheduleQdrantSync();
        res.json({
            message: `Requirement name updated for group ${groupId}. New name: '${trimmedNewName}'. Rows affected: ${this.changes}`,
            changes: this.changes
        });
    });
});

app.put("/api/requirements/:requirementGroupId/set-release", (req, res) => {
    const groupId = req.params.requirementGroupId;
    const { release_id } = req.body;

    const sql = `UPDATE activities SET release_id = ? WHERE requirementGroupId = ?`;
    db.run(sql, [release_id, groupId], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error while updating release." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: `Requirement group with ID ${groupId} not found.` });
        }
        scheduleQdrantSync();
        res.json({
            message: `Release updated for requirement group ${groupId}.`,
            changes: this.changes
        });
    });
});

app.delete("/api/requirements/:requirementGroupId", (req, res) => {
    const groupId = parseInt(req.params.requirementGroupId, 10);
    if (isNaN(groupId)) {
        return res.status(400).json({ error: "Invalid requirementGroupId format." });
    }
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const deleteChangesSql = "DELETE FROM requirement_changes WHERE requirement_group_id = ?";
        db.run(deleteChangesSql, [groupId], function(deleteChangesErr) {
            if (deleteChangesErr) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: deleteChangesErr.message });
            }

            const deleteLinksSql = "DELETE FROM defect_requirement_links WHERE requirement_group_id = ?";
            db.run(deleteLinksSql, [groupId], function(deleteLinksErr) {
                if (deleteLinksErr) {
                    db.run("ROLLBACK");
                    return res.status(400).json({ error: deleteLinksErr.message });
                }

                const deleteActivitiesSql = "DELETE FROM activities WHERE requirementGroupId = ?";
                db.run(deleteActivitiesSql, [groupId], function(deleteActivitiesErr) {
                    if (deleteActivitiesErr) {
                        db.run("ROLLBACK");
                        return res.status(400).json({ error: deleteActivitiesErr.message });
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK");
                        return res.status(404).json({ error: `Requirement group with ID ${groupId} not found.` });
                    }
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                        scheduleQdrantSync();
                        res.json({
                            message: `Requirement group ${groupId} and its associated data deleted.`,
                            changes: this.changes
                        });
                    });
                });
            });
        });
    });
});

app.post('/api/import/validate', upload.single('file'), async (req, res) => {
    const { project } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!project) return res.status(400).json({ error: 'Project is required.' });

    try {
        const projectId = await getProjectId(project);
        const { validRows, skippedCount } = processExcelData(req.file.buffer);

        const getExistingKeysSql = `SELECT key FROM activities WHERE project_id = ? AND key IS NOT NULL AND key != ''`;
        db.all(getExistingKeysSql, [projectId], (err, existingRows) => {
            if (err) return res.status(500).json({ error: "Failed to check for existing requirements." });

            const existingKeys = new Set(existingRows.map(r => r.key));
            
            const duplicates = validRows.filter(row => row.key && existingKeys.has(row.key));
            const newItems = validRows.filter(row => !row.key || !existingKeys.has(row.key));

            res.status(200).json({
                message: "Validation complete.",
                data: {
                    newCount: newItems.length,
                    duplicateCount: duplicates.length,
                    skippedCount: skippedCount,
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
    }
});

app.post('/api/import/requirements', upload.single('file'), async (req, res) => {
    const { project, sprint, release_id, importMode } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!project || !sprint) return res.status(400).json({ error: 'Project and Sprint are required.' });
    
    try {
        const projectId = await getProjectId(project);
        const finalReleaseId = release_id || null;
        const { validRows, skippedCount } = processExcelData(req.file.buffer);
        const now = new Date().toISOString();
        const statusDate = now.split('T')[0];

        const getExistingDataSql = `SELECT key, requirementUserIdentifier FROM activities WHERE project_id = ?`;
        db.all(getExistingDataSql, [projectId], (err, existingRows) => {
            if (err) return res.status(500).json({ error: "Failed to check for existing requirements." });
            
            const existingKeys = new Set(existingRows.map(r => r.key).filter(Boolean));
            const existingNames = new Set(existingRows.map(r => r.requirementUserIdentifier));

            let renamedCount = 0;
            let itemsToImport;

            if (importMode === 'new_only') {
                itemsToImport = validRows.filter(item => !item.key || !existingKeys.has(item.key));
            } else {
                itemsToImport = validRows.map(item => {
                    let newItem = { ...item };
                    if (newItem.key && existingKeys.has(newItem.key)) {
                        renamedCount++;
                        let newTitle = newItem.title;
                        let counter = 1;
                        while (existingNames.has(newTitle)) {
                            newTitle = `${item.title} (${counter})`;
                            counter++;
                        }
                        newItem.title = newTitle;
                        existingNames.add(newTitle);
                    }
                    return newItem;
                });
            }

            if (itemsToImport.length === 0) {
                let messageParts = ["Import finished. No valid items to import"];
                if (skippedCount > 0) messageParts.push(`Skipped: ${skippedCount}`);
                return res.status(200).json({ message: messageParts.join('. ') + '.' });
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, link, type, tags, key, release_id, isCurrent, requirementGroupId, created_at, updated_at)
                                   VALUES (?, ?, 'To Do', ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`;
                
                let completedInserts = 0;
                let successfulInserts = 0;

                itemsToImport.forEach(item => {
                    db.run(insertSql, [projectId, item.title, statusDate, sprint, item.link, item.type, item.tags, item.key, finalReleaseId, now, now], function(err) {
                        if (err) {
                            console.error("Error inserting imported activity:", err.message);
                        } else {
                            successfulInserts++;
                            const newId = this.lastID;
                            db.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [newId, newId]);
                        }
                        completedInserts++;
                        if (completedInserts === itemsToImport.length) {
                             db.run("COMMIT", (commitErr) => {
                                if (commitErr) return res.status(500).json({ error: "Failed to commit imported data: " + commitErr.message });
                                
                                let messageParts = [`Import complete. Imported: ${successfulInserts}`];
                                if (renamedCount > 0) messageParts.push(`Renamed ${renamedCount} duplicate(s)`);
                                if (skippedCount > 0) messageParts.push(`Skipped: ${skippedCount}`);
                                
                                scheduleQdrantSync();
                                res.status(201).json({
                                    message: messageParts.join('. ') + '.',
                                    data: { imported: successfulInserts, renamed: renamedCount, skipped: skippedCount }
                                });
                            });
                        }
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
    }
});

app.post('/api/import/defects/validate', upload.single('file'), async (req, res) => {
    const { project } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!project) return res.status(400).json({ error: 'Project is required.' });

    try {
        const projectId = await getProjectId(project);
        const { validRows, skippedCount } = processDefectExcelData(req.file.buffer);

        const getExistingLinksSql = `SELECT link FROM defects WHERE project_id = ? AND link IS NOT NULL`;
        db.all(getExistingLinksSql, [projectId], (err, existingRows) => {
            if (err) return res.status(500).json({ error: "Failed to check for existing defects." });

            const existingLinks = new Set(existingRows.map(r => r.link));
            
            const duplicates = validRows.filter(row => row.link && existingLinks.has(row.link));
            const newItems = validRows.filter(row => !row.link || !existingLinks.has(row.link));

            res.status(200).json({
                message: "Validation complete.",
                data: {
                    newCount: newItems.length,
                    duplicateCount: duplicates.length,
                    skippedCount: skippedCount,
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process Excel file for defects: ' + error.message });
    }
});

app.post('/api/import/defects', upload.single('file'), async (req, res) => {
    const { project, importMode } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!project) return res.status(400).json({ error: 'Project is required.' });

    try {
        const projectId = await getProjectId(project);
        const { validRows, skippedCount } = processDefectExcelData(req.file.buffer);
        const now = new Date().toISOString();

        const getExistingDataSql = `SELECT link, title FROM defects WHERE project_id = ?`;
        db.all(getExistingDataSql, [projectId], (err, existingRows) => {
            if (err) return res.status(500).json({ error: "Failed to check for existing defects." });

            const existingLinks = new Set(existingRows.map(r => r.link).filter(Boolean));
            const existingTitles = new Set(existingRows.map(r => r.title));
            let renamedCount = 0;
            
            let itemsToImport;

            if (importMode === 'new_only') {
                itemsToImport = validRows.filter(item => !item.link || !existingLinks.has(item.link));
            } else {
                itemsToImport = validRows.map(item => {
                    let newItem = { ...item };
                    if (newItem.link && existingLinks.has(newItem.link)) {
                        renamedCount++;
                        let newTitle = newItem.title;
                        let counter = 1;
                        while (existingTitles.has(newTitle)) {
                            newTitle = `${item.title} (${counter})`;
                            counter++;
                        }
                        newItem.title = newTitle;
                        existingTitles.add(newTitle);
                    }
                    return newItem;
                });
            }

            if (itemsToImport.length === 0) {
                let message = "Import finished. No valid defects to import";
                if (skippedCount > 0) message += `. Skipped: ${skippedCount}`;
                return res.status(200).json({ message: message + '.' });
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const insertDefectSql = `INSERT INTO defects (project_id, title, area, status, link, created_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const insertHistorySql = `INSERT INTO defect_history (defect_id, changes_summary, comment, changed_at) VALUES (?, ?, ?, ?)`;
                
                let completedInserts = 0;
                let successfulInserts = 0;

                itemsToImport.forEach(item => {
                    const defaultArea = 'Imported';
                    const defaultStatus = 'Assigned to Developer';

                    db.run(insertDefectSql, [projectId, item.title, defaultArea, defaultStatus, item.link, now, now, now], function(err) {
                        if (err) {
                            console.error("Error inserting imported defect:", err.message);
                        } else {
                            successfulInserts++;
                            const defectId = this.lastID;
                            const creationSummary = JSON.stringify({
                                status: { old: null, new: defaultStatus }, title: { old: null, new: item.title }, area: { old: null, new: defaultArea }
                            });
                            db.run(insertHistorySql, [defectId, creationSummary, "Defect created via import.", now]);

                            if (item.links) {
                                const linkParts = item.links.split(',').map(s => s.trim()).filter(Boolean);
                                if (linkParts.length > 0) {
                                    const placeholders = linkParts.map(() => '?').join(',');
                                    const findReqsSql = `SELECT requirementGroupId FROM activities WHERE isCurrent = 1 AND (${linkParts.map(() => "link LIKE ?").join(' OR ')})`;
                                    const findReqsParams = linkParts.map(linkPart => `%${linkPart}`);

                                    db.all(findReqsSql, findReqsParams, (err, reqs) => {
                                        if (err) {
                                            console.error("Error finding requirements to link:", err.message);
                                            return;
                                        }
                                        const insertLinkSql = `INSERT INTO defect_requirement_links (defect_id, requirement_group_id) VALUES (?, ?)`;
                                        const uniqueReqIds = [...new Set(reqs.map(r => r.requirementGroupId))];

                                        uniqueReqIds.forEach(reqId => {
                                            db.run(insertLinkSql, [defectId, reqId], (linkErr) => {
                                                if (linkErr) {
                                                    console.error(`Error linking defect ${defectId} to requirement ${reqId}:`, linkErr.message);
                                                }
                                            });
                                        });
                                    });
                                }
                            }
                        }
                        completedInserts++;
                        if (completedInserts === itemsToImport.length) {
                             db.run("COMMIT", (commitErr) => {
                                if (commitErr) return res.status(500).json({ error: "Failed to commit imported defects: " + commitErr.message });
                                
                                let message = `Import complete. Imported: ${successfulInserts}`;
                                if (renamedCount > 0) message += `. Renamed ${renamedCount} duplicate(s)`;
                                if (skippedCount > 0) message += `. Skipped: ${skippedCount}`;

                                scheduleQdrantSync();
                                res.status(201).json({
                                    message: message + '.',
                                    data: { imported: successfulInserts, renamed: renamedCount, skipped: skippedCount }
                                });
                            });
                        }
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process Excel file for defects: ' + error.message });
    }
});

app.get("/api/notes/:project", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const sql = "SELECT noteDate, noteText FROM notes WHERE project_id = ? ORDER BY noteDate DESC";
        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(400).json({ error: err.message });
            const notesMap = {};
            rows.forEach(row => { notesMap[row.noteDate] = row.noteText; });
            res.json({ message: "success", data: notesMap });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post("/api/notes", async (req, res) => {
    let { project, noteDate, noteText } = req.body;
    if (!project || !noteDate) {
        return res.status(400).json({ error: "Project and noteDate are required" });
    }
    try {
        const projectId = await getProjectId(project);
        const trimmedNoteText = noteText.trim();
        if (trimmedNoteText === "") {
            const deleteSql = "DELETE FROM notes WHERE project_id = ? AND noteDate = ?";
            db.run(deleteSql, [projectId, noteDate], function(err) {
                if (err) return res.status(400).json({ error: err.message });
                if (this.changes > 0) {
                    scheduleQdrantSync();
                    res.json({ message: "Note deleted successfully.", action: "deleted", data: { project, noteDate } });
                } else {
                    res.json({ message: "No note found to delete.", action: "none", data: { project, noteDate } });
                }
            });
        } else {
            const upsertSql = `INSERT INTO notes (project_id, noteDate, noteText) VALUES (?, ?, ?)
                               ON CONFLICT(project_id, noteDate) DO UPDATE SET noteText = excluded.noteText;`;
            db.run(upsertSql, [projectId, noteDate, trimmedNoteText], function(err) {
                if (err) return res.status(400).json({ error: err.message });
                scheduleQdrantSync();
                res.json({ message: "Note saved successfully.", action: "saved", data: { project, noteDate, noteText: trimmedNoteText } });
            });
        }
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.get("/api/retrospective/:project", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const sql = "SELECT * FROM retrospective_items WHERE project_id = ? ORDER BY created_at DESC";
        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ message: "success", data: rows });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post("/api/retrospective", async (req, res) => {
    let { project, column_type, description, details, item_date } = req.body;
    if (!project || !column_type || !description || !details || !item_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const projectId = await getProjectId(project.trim());
        column_type = column_type.trim(); 
        description = description.trim(); 
        details = details.trim(); 
        item_date = item_date.trim();
        const sql = `INSERT INTO retrospective_items (project_id, column_type, description, details, item_date) VALUES (?,?,?,?,?)`;
        db.run(sql, [projectId, column_type, description, details, item_date], function (err) {
            if (err) return res.status(400).json({ "error": err.message });
            scheduleQdrantSync();
            res.json({ message: "success", data: { id: this.lastID, project, column_type, description, details, item_date } });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/retrospective/:id", (req, res) => {
    const itemId = req.params.id;
    let { column_type, description, details, item_date } = req.body;
    if (!column_type && !description && !details && !item_date) {
        return res.status(400).json({ error: "No fields provided to update." });
    }
    let setClauses = []; let params = [];
    if (column_type) { setClauses.push("column_type = ?"); params.push(column_type.trim()); }
    if (description) { setClauses.push("description = ?"); params.push(description.trim()); }
    if (details) { setClauses.push("details = ?"); params.push(details.trim()); }
    if (item_date) { setClauses.push("item_date = ?"); params.push(item_date.trim()); }
    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    params.push(itemId);
    const sql = `UPDATE retrospective_items SET ${setClauses.join(", ")} WHERE id = ?`;
    db.run(sql, params, function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ error: `Item ${itemId} not found.`});
        scheduleQdrantSync();
        res.json({ message: "success", data: { id: itemId, changes: this.changes } });
    });
});

app.delete("/api/retrospective/:id", (req, res) => {
    const itemId = req.params.id;
    const sql = 'DELETE FROM retrospective_items WHERE id = ?';
    db.run(sql, itemId, function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ error: `Item ${itemId} not found.`});
        scheduleQdrantSync();
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.get("/api/releases/:project", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const sql = `
            SELECT
                r.id, r.name, r.release_date, r.is_current,
                fr.passed, fr.failed, fr.blocked, fr.caution, fr.not_run
            FROM releases r
            LEFT JOIN (
                SELECT 
                    fsr.release_id, 
                    MAX(fp.completion_date) as max_date
                FROM fat_selected_releases fsr
                JOIN fat_periods fp ON fsr.fat_period_id = fp.id
                WHERE fp.status = 'completed' AND fsr.release_type = 'active'
                GROUP BY fsr.release_id
            ) latest_fat ON r.id = latest_fat.release_id
            LEFT JOIN fat_periods fp ON latest_fat.max_date = fp.completion_date
            LEFT JOIN fat_reports fr ON fp.id = fr.fat_period_id
            WHERE r.project_id = ? AND r.status = 'active'
            ORDER BY r.release_date DESC
        `;

        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(400).json({ "error": err.message });
            
            const data = rows.map(row => {
                let fat_execution_report = null;
                if (row.passed !== null) {
                    fat_execution_report = {
                        passed: row.passed,
                        failed: row.failed,
                        blocked: row.blocked,
                        caution: row.caution,
                        not_run: row.not_run
                    };
                }
                return {
                    id: row.id,
                    name: row.name,
                    release_date: row.release_date,
                    is_current: row.is_current,
                    project: req.params.project,
                    fat_execution_report: fat_execution_report
                };
            });
            res.json({ message: "success", data });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post("/api/releases", async (req, res) => {
    let { project, name, release_date, is_current } = req.body;
    if (!project || !name || !release_date) {
        return res.status(400).json({ error: "Project, name, and release date are required." });
    }
    try {
        const projectId = await getProjectId(project);
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            if (is_current) {
                db.run(`UPDATE releases SET is_current = 0 WHERE project_id = ?`, [projectId]);
            }

            const releaseSql = `INSERT INTO releases (project_id, name, release_date, is_current) VALUES (?, ?, ?, ?)`;
            db.run(releaseSql, [projectId, name, release_date, is_current ? 1 : 0], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    if (err.message.includes("UNIQUE constraint failed")) {
                        return res.status(409).json({ "error": `A release named '${name}' already exists for project '${project}'.` });
                    }
                    return res.status(400).json({ "error": err.message });
                }
                const newId = this.lastID;

                const noteText = `release date: ${name}`;
                const noteSql = `INSERT INTO notes (project_id, noteDate, noteText) VALUES (?, ?, ?)
                                 ON CONFLICT(project_id, noteDate) DO UPDATE SET noteText = noteText || char(10) || excluded.noteText;`;
                db.run(noteSql, [projectId, release_date, noteText], (noteErr) => {
                    if (noteErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ "error": "Failed to create release note: " + noteErr.message });
                    }
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                        scheduleQdrantSync();
                        res.status(201).json({ message: "Release created successfully", data: { id: newId, project, name, release_date, is_current } });
                    });
                });
            });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/releases/:id", (req, res) => {
    const releaseId = req.params.id;
    const { name, release_date, is_current, project } = req.body;
    if (!name || !release_date || !project) {
        return res.status(400).json({ error: "Name, release date, and project are required for update." });
    }

    db.get("SELECT project_id, name, release_date FROM releases WHERE id = ?", [releaseId], (getErr, oldRelease) => {
        if (getErr) return res.status(500).json({ "error": "DB error fetching old release data." });
        if (!oldRelease) return res.status(404).json({ error: `Release with id ${releaseId} not found.` });

        const dateChanged = oldRelease.release_date !== release_date;
        const nameChanged = oldRelease.name !== name;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            if (is_current) {
                db.run(`UPDATE releases SET is_current = 0 WHERE project_id = ? AND id != ?`, [oldRelease.project_id, releaseId]);
            }

            const updateReleaseSql = `UPDATE releases SET name = ?, release_date = ?, is_current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            db.run(updateReleaseSql, [name, release_date, is_current ? 1 : 0, releaseId], function(updateErr) {
                if (updateErr) {
                    db.run("ROLLBACK");
                    if (updateErr.message.includes("UNIQUE constraint failed")) {
                        return res.status(409).json({ "error": `A release named '${name}' already exists for project '${project}'.` });
                    }
                    return res.status(400).json({ "error": updateErr.message });
                }
                if (this.changes === 0) {
                    db.run("ROLLBACK");
                    return res.status(404).json({ error: `Release with id ${releaseId} not found.` });
                }

                const handleNoteLogic = () => {
                    const oldNoteText = `release date: ${oldRelease.name}`;
                    db.get(`SELECT noteText FROM notes WHERE project_id = ? AND noteDate = ?`, [oldRelease.project_id, oldRelease.release_date], (getOldNoteErr, oldNoteRow) => {
                        if (getOldNoteErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ "error": "DB error getting old note: " + getOldNoteErr.message });
                        }

                        const cleanupCallback = (cleanupErr) => {
                            if (cleanupErr) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ "error": "DB error cleaning up old note: " + cleanupErr.message });
                            }
                            const newNoteText = `release date: ${name}`;
                            const upsertNewNoteSql = `INSERT INTO notes (project_id, noteDate, noteText) VALUES (?, ?, ?) ON CONFLICT(project_id, noteDate) DO UPDATE SET noteText = noteText || char(10) || excluded.noteText;`;
                            db.run(upsertNewNoteSql, [oldRelease.project_id, release_date, newNoteText], (upsertErr) => {
                                if (upsertErr) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ "error": "DB error creating new note: " + upsertErr.message });
                                }
                                db.run("COMMIT", (commitErr) => {
                                    if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                                    scheduleQdrantSync();
                                    res.json({ message: "Release updated successfully" });
                                });
                            });
                        };

                        if (oldNoteRow) {
                            const newNoteContent = oldNoteRow.noteText.split('\n').filter(line => line.trim() !== oldNoteText.trim()).join('\n');
                            if (newNoteContent.trim() === '') {
                                db.run(`DELETE FROM notes WHERE project_id = ? AND noteDate = ?`, [oldRelease.project_id, oldRelease.release_date], cleanupCallback);
                            } else {
                                db.run(`UPDATE notes SET noteText = ? WHERE project_id = ? AND noteDate = ?`, [newNoteContent, oldRelease.project_id, oldRelease.release_date], cleanupCallback);
                            }
                        } else {
                            cleanupCallback(null);
                        }
                    });
                };

                if (dateChanged || nameChanged) {
                    handleNoteLogic();
                } else {
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                        scheduleQdrantSync();
                        res.json({ message: "Release updated successfully" });
                    });
                }
            });
        });
    });
});

app.delete("/api/releases/:id", (req, res) => {
    const releaseId = req.params.id;
    db.get("SELECT project_id, name, release_date FROM releases WHERE id = ?", [releaseId], (getErr, releaseToDelete) => {
        if (getErr) return res.status(500).json({ "error": "DB error fetching release data for deletion." });
        if (!releaseToDelete) return res.status(404).json({ error: `Release with id ${releaseId} not found.` });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            db.run('DELETE FROM releases WHERE id = ?', releaseId, function(deleteErr) { 
                if (deleteErr) { db.run("ROLLBACK"); return res.status(400).json({ "error": deleteErr.message }); } 
                if (this.changes === 0) { db.run("ROLLBACK"); return res.status(404).json({ error: `Release with id ${releaseId} not found.` }); }

                const noteTextToRemove = `release date: ${releaseToDelete.name}`;
                db.get(`SELECT noteText FROM notes WHERE project_id = ? AND noteDate = ?`, [releaseToDelete.project_id, releaseToDelete.release_date], (getNoteErr, noteRow) => {
                    if (getNoteErr) { db.run("ROLLBACK"); return res.status(500).json({ "error": "DB error handling note on release deletion." }); }
                    if (noteRow) {
                        const newNoteContent = noteRow.noteText.split('\n').filter(line => line.trim() !== noteTextToRemove.trim()).join('\n');
                        if (newNoteContent.trim() === '') {
                            db.run(`DELETE FROM notes WHERE project_id = ? AND noteDate = ?`, [releaseToDelete.project_id, releaseToDelete.release_date]);
                        } else {
                            db.run(`UPDATE notes SET noteText = ? WHERE project_id = ? AND noteDate = ?`, [newNoteContent, releaseToDelete.project_id, releaseToDelete.release_date]);
                        }
                    }
                });

                db.run("COMMIT", (commitErr) => {
                    if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                    scheduleQdrantSync();
                    res.json({ message: "Release deleted successfully", changes: this.changes });
                });
            });
        });
    });
});

app.post("/api/releases/:id/close", async (req, res) => {
    const releaseId = req.params.id;
    const { closeAction } = req.body; 

    if (!['archive_only', 'archive_and_complete'].includes(closeAction)) {
        return res.status(400).json({ error: "Invalid closeAction specified." });
    }

    db.get("SELECT * FROM releases WHERE id = ?", [releaseId], (err, release) => {
        if (err) return res.status(500).json({ error: "DB error fetching release info." });
        if (!release) return res.status(404).json({ error: "Release not found." });

        const requirementsSql = `
            SELECT a.requirementGroupId, a.requirementUserIdentifier, a.status
            FROM activities a
            WHERE a.release_id = ? AND a.isCurrent = 1
        `;

        db.all(requirementsSql, [releaseId], (err, requirements) => {
            if (err) return res.status(500).json({ error: "DB error fetching requirements for release." });

            const doneCount = requirements.filter(r => r.status === 'Done').length;
            const notDoneCount = requirements.length - doneCount;
            const metrics = { doneCount, notDoneCount };
            const metricsJson = JSON.stringify(metrics);
            const closedAt = new Date().toISOString();

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const archiveSql = `
                    INSERT INTO archived_releases (original_release_id, project_id, name, closed_at, metrics_json, close_action)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.run(archiveSql, [releaseId, release.project_id, release.name, closedAt, metricsJson, closeAction], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: "Failed to create archive record." });
                    }
                    
                    const archiveId = this.lastID;
                    const archiveItemsSql = `
                        INSERT INTO archived_release_items (archive_id, requirement_group_id, requirement_title, final_status)
                        VALUES (?, ?, ?, ?)
                    `;
                    
                    let itemsProcessed = 0;
                    if (requirements.length === 0) {
                        finalizeProcess(archiveId);
                    } else {
                        requirements.forEach(req => {
                            db.run(archiveItemsSql, [archiveId, req.requirementGroupId, req.requirementUserIdentifier, req.status], (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    if (!res.headersSent) {
                                        res.status(500).json({ error: "Failed to archive requirement item." });
                                    }
                                    return;
                                }
                                itemsProcessed++;
                                if (itemsProcessed === requirements.length) {
                                    finalizeProcess(archiveId);
                                }
                            });
                        });
                    }

                    function finalizeProcess(archiveId) {
                        const checkFatSql = `
                            SELECT fr.id 
                            FROM fat_reports fr
                            JOIN fat_periods fp ON fr.fat_period_id = fp.id
                            JOIN fat_selected_releases fsr ON fp.id = fsr.fat_period_id
                            WHERE fsr.release_id = ? AND fp.status = 'completed'
                            ORDER BY fp.completion_date DESC
                            LIMIT 1
                        `;
                        db.get(checkFatSql, [releaseId], (fatErr, fatReport) => {
                            if (fatErr) {
                                console.error("Error checking for completed FAT reports:", fatErr.message);
                            }
                            if (fatReport) {
                                db.run("UPDATE archived_releases SET fat_report_id = ? WHERE id = ?", [fatReport.id, archiveId], (updateFatErr) => {
                                    if (updateFatErr) console.error("Error linking FAT report to new archive:", updateFatErr.message);
                                });
                            }

                            const updateReleaseSql = "UPDATE releases SET status = 'closed', closed_at = ? WHERE id = ?";
                            db.run(updateReleaseSql, [closedAt, releaseId], (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    if (!res.headersSent) res.status(500).json({ error: "Failed to close original release." });
                                    return;
                                }

                                if (closeAction === 'archive_only') {
                                    commitTransaction();
                                } else if (closeAction === 'archive_and_complete') {
                                    const now = new Date().toISOString();
                                    const statusDate = now.split('T')[0];
                                    const newSprintName = `Archived_from_${release.name.replace(/\s/g, '_')}`;
                                    
                                    const insertActivitySql = `INSERT INTO activities (requirementGroupId, project_id, requirementUserIdentifier, status, statusDate, comment, sprint, isCurrent, created_at, updated_at, release_id)
                                                               VALUES (?, ?, ?, 'Done', ?, ?, ?, 1, ?, ?, NULL)`;
                                    const updateOldSql = `UPDATE activities SET isCurrent = 0 WHERE requirementGroupId = ?`;

                                    let activitiesProcessed = 0;
                                    if (requirements.length === 0) {
                                        commitTransaction();
                                    } else {
                                        requirements.forEach(req => {
                                            db.run(updateOldSql, [req.requirementGroupId], function(err) {
                                                if (err) {
                                                    db.run("ROLLBACK");
                                                    if (!res.headersSent) res.status(500).json({ error: "Failed to update old activities." });
                                                    return;
                                                }
                                                const comment = `Item completed as part of finalizing release '${release.name}'`;
                                                db.run(insertActivitySql, [req.requirementGroupId, release.project_id, req.requirementUserIdentifier, statusDate, comment, newSprintName, now, now], function(err) {
                                                    if (err) {
                                                        db.run("ROLLBACK");
                                                        if (!res.headersSent) res.status(500).json({ error: "Failed to create archived activity record." });
                                                        return;
                                                    }
                                                    activitiesProcessed++;
                                                    if (activitiesProcessed === requirements.length) {
                                                        commitTransaction();
                                                    }
                                                });
                                            });
                                        });
                                    }
                                }
                            });
                        });
                    }

                    function commitTransaction() {
                        db.run("COMMIT", (err) => {
                            if (err) {
                                if (!res.headersSent) res.status(500).json({ error: "Failed to commit transaction." });
                                return;
                            }
                            scheduleQdrantSync();
                            if (!res.headersSent) res.json({ message: `Release '${release.name}' has been successfully finalized and archived.` });
                        });
                    }
                });
            });
        });
    });
});

app.get("/api/archives/:project", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const sql = `
            SELECT
                ar.id, ar.original_release_id, ar.name, ar.closed_at, ar.metrics_json, ar.close_action,
                sr.blocked, sr.failed, sr.executing, sr.aborted, sr.passed as sat_passed, sr.pending,
                fr.passed as fat_passed, fr.failed as fat_failed, fr.blocked as fat_blocked, fr.caution as fat_caution, fr.not_run as fat_not_run
            FROM archived_releases ar
            LEFT JOIN sat_reports sr ON ar.id = sr.archive_id
            LEFT JOIN fat_reports fr ON ar.fat_report_id = fr.id
            WHERE ar.project_id = ?
            ORDER BY ar.closed_at DESC
        `;
        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(400).json({ "error": err.message });
            const archives = rows.map(row => {
                let sat_report = null;
                if (row.blocked !== null) {
                    sat_report = {
                        blocked: row.blocked,
                        failed: row.failed,
                        executing: row.executing,
                        aborted: row.aborted,
                        passed: row.sat_passed,
                        pending: row.pending
                    };
                }

                let fat_execution_report = null;
                if (row.fat_passed !== null) {
                    fat_execution_report = {
                        passed: row.fat_passed,
                        failed: row.fat_failed,
                        blocked: row.fat_blocked,
                        caution: row.fat_caution,
                        not_run: row.fat_not_run
                    };
                }
                
                try {
                    return {
                        id: row.id,
                        project: req.params.project,
                        original_release_id: row.original_release_id,
                        name: row.name,
                        closed_at: row.closed_at,
                        metrics: row.metrics_json ? JSON.parse(row.metrics_json) : {},
                        sat_report: sat_report,
                        fat_execution_report: fat_execution_report,
                        close_action: row.close_action
                    };
                } catch (e) {
                    console.error("Failed to parse metrics_json for archive:", row.id, e);
                    return { ...row, project: req.params.project, metrics: {}, sat_report: sat_report, fat_execution_report: fat_execution_report };
                }
            });
            res.json({ message: "success", data: archives });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.get("/api/archives/details/:archiveId", (req, res) => {
    const archiveId = req.params.archiveId;
    const itemsSql = `
        SELECT id, requirement_group_id, requirement_title, final_status 
        FROM archived_release_items 
        WHERE archive_id = ?
    `;
    db.all(itemsSql, [archiveId], (err, items) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ message: "success", data: items });
    });
});

app.post("/api/archives/:id/complete", async (req, res) => {
    const archiveId = req.params.id;

    db.get("SELECT * FROM archived_releases WHERE id = ?", [archiveId], (err, archive) => {
        if (err) return res.status(500).json({ error: "DB error fetching archive info." });
        if (!archive) return res.status(404).json({ error: "Archived release not found." });
        if (archive.close_action !== 'archive_only') {
            return res.status(400).json({ error: "This release was not 'archive only'." });
        }

        db.get("SELECT * FROM releases WHERE id = ?", [archive.original_release_id], (err, release) => {
            if (err) return res.status(500).json({ error: "DB error fetching original release info." });
            
            const projectName = release ? release.name : archive.name;
            const projectId = release ? release.project_id : archive.project_id;

            const archiveItemsSql = `SELECT * FROM archived_release_items WHERE archive_id = ?`;
            db.all(archiveItemsSql, [archiveId], (err, items) => {
                if (err) return res.status(500).json({ error: "DB error fetching archived items." });

                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");

                    const now = new Date().toISOString();
                    const statusDate = now.split('T')[0];
                    const newSprintName = `Archived_from_${projectName.replace(/\s/g, '_')}`;
                    
                    const insertActivitySql = `INSERT INTO activities (requirementGroupId, project_id, requirementUserIdentifier, status, statusDate, comment, sprint, isCurrent, created_at, updated_at, release_id)
                                               VALUES (?, ?, ?, 'Done', ?, ?, ?, 1, ?, ?, NULL)`;
                    const updateOldSql = `UPDATE activities SET isCurrent = 0 WHERE requirementGroupId = ?`;

                    let activitiesProcessed = 0;
                    if (items.length === 0) {
                        finalizeCompletion();
                    } else {
                        items.forEach(item => {
                            db.run(updateOldSql, [item.requirement_group_id], function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    if (!res.headersSent) res.status(500).json({ error: "Failed to update old activities." });
                                    return;
                                }
                                const comment = `Item completed as part of completing archived release '${projectName}'`;
                                db.run(insertActivitySql, [item.requirement_group_id, projectId, item.requirement_title, statusDate, comment, newSprintName, now, now], function(err) {
                                    if (err) {
                                        db.run("ROLLBACK");
                                        if (!res.headersSent) res.status(500).json({ error: "Failed to create archived activity record." });
                                        return;
                                    }
                                    activitiesProcessed++;
                                    if (activitiesProcessed === items.length) {
                                        finalizeCompletion();
                                    }
                                });
                            });
                        });
                    }

                    function finalizeCompletion() {
                        const updateArchiveSql = "UPDATE archived_releases SET close_action = 'archive_and_complete' WHERE id = ?";
                        db.run(updateArchiveSql, [archiveId], (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                if (!res.headersSent) res.status(500).json({ error: "Failed to update archive record." });
                                return;
                            }
                            
                            db.run("COMMIT", (err) => {
                                if (err) {
                                    if (!res.headersSent) res.status(500).json({ error: "Failed to commit transaction." });
                                    return;
                                }
                                scheduleQdrantSync();
                                if (!res.headersSent) res.json({ message: `Archived release '${projectName}' has been successfully completed.` });
                            });
                        });
                    }
                });
            });
        });
    });
});

app.post("/api/archives/:archiveId/sat-report", (req, res) => {
    const archiveId = req.params.archiveId;
    const { blocked, failed, executing, aborted, passed, pending } = req.body;

    const values = [blocked, failed, executing, aborted, passed, pending];
    const numericValues = values.map(v => v === '' || v === null ? 0 : parseInt(v, 10));

    if (numericValues.some(isNaN)) {
        return res.status(400).json({ error: "All fields must be numbers." });
    }

    const total = numericValues.reduce((sum, v) => sum + v, 0);

    if (total === 0) {
        const deleteSql = `DELETE FROM sat_reports WHERE archive_id = ?`;
        db.run(deleteSql, [archiveId], function(err) {
            if (err) {
                return res.status(500).json({ error: "Database error clearing SAT report: " + err.message });
            }
            return res.status(200).json({ message: "SAT report cleared successfully." });
        });
        return;
    }

    if (total !== 100) {
        return res.status(400).json({ error: `The sum of all fields must be 100%. Current sum is ${total}%.` });
    }

    const sql = `
        INSERT INTO sat_reports (archive_id, blocked, failed, executing, aborted, passed, pending)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(archive_id) DO UPDATE SET
            blocked = excluded.blocked,
            failed = excluded.failed,
            executing = excluded.executing,
            aborted = excluded.aborted,
            passed = excluded.passed,
            pending = excluded.pending,
            created_at = CURRENT_TIMESTAMP;
    `;

    db.run(sql, [archiveId, ...numericValues], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error saving SAT report: " + err.message });
        }
        res.status(201).json({ message: "SAT report saved successfully." });
    });
});

app.get("/api/archives/:archiveId/sat-bugs", (req, res) => {
    const archiveId = req.params.archiveId;
    const sql = `
        SELECT id, title, link, estimation, label
        FROM sat_bugs
        WHERE archive_id = ?
        ORDER BY created_at ASC
    `;
    db.all(sql, [archiveId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Database error fetching SAT bugs: " + err.message });
        }
        res.json({ message: "success", data: rows });
    });
});

app.post("/api/archives/:archiveId/sat-bugs", (req, res) => {
    const archiveId = req.params.archiveId;
    const { title, link, estimation, estimation_unit, label } = req.body;

    if (!title || !link || title.trim() === '' || link.trim() === '') {
        return res.status(400).json({ error: "Title and link are required." });
    }

    let estimationInHours = null;
    if (estimation) {
        const est = parseInt(estimation, 10);
        if (!isNaN(est)) {
            if (estimation_unit === 'd') {
                estimationInHours = est * 8;
            } else {
                estimationInHours = est;
            }
        }
    }
    
    const finalLabel = label && label.trim() !== '' ? label.trim() : null;

    const sql = `INSERT INTO sat_bugs (archive_id, title, link, estimation, label) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [archiveId, title.trim(), link.trim(), estimationInHours, finalLabel], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error saving SAT bug: " + err.message });
        }
        res.status(201).json({
            message: "SAT bug added successfully.",
            data: { id: this.lastID, archive_id: archiveId, title: title.trim(), link: link.trim(), estimation: estimationInHours, label: finalLabel }
        });
    });
});

app.put("/api/archives/sat-bugs/:bugId", (req, res) => {
    const bugId = req.params.bugId;
    const { title, link, estimation, estimation_unit, label } = req.body;

    if (!title || !link || title.trim() === '' || link.trim() === '') {
        return res.status(400).json({ error: "Title and link are required." });
    }

    let estimationInHours = null;
    if (estimation) {
        const est = parseInt(estimation, 10);
        if (!isNaN(est)) {
            if (estimation_unit === 'd') {
                estimationInHours = est * 8;
            } else {
                estimationInHours = est;
            }
        }
    }
    
    const finalLabel = label && label.trim() !== '' ? label.trim() : null;

    const sql = `UPDATE sat_bugs SET title = ?, link = ?, estimation = ?, label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [title.trim(), link.trim(), estimationInHours, finalLabel, bugId], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error updating SAT bug: " + err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: `SAT bug with id ${bugId} not found.` });
        }
        res.json({ message: "SAT bug updated successfully.", changes: this.changes });
    });
});

app.delete("/api/archives/sat-bugs/:bugId", (req, res) => {
    const bugId = req.params.bugId;
    const sql = 'DELETE FROM sat_bugs WHERE id = ?';
    db.run(sql, [bugId], function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error deleting SAT bug: " + err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: `SAT bug with id ${bugId} not found.` });
        }
        res.json({ message: "SAT bug deleted successfully.", changes: this.changes });
    });
});

app.delete("/api/archives/:id", (req, res) => {
    const archiveId = req.params.id;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const deleteItemsSql = "DELETE FROM archived_release_items WHERE archive_id = ?";
        db.run(deleteItemsSql, [archiveId], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: err.message });
            }

            const deleteArchiveSql = "DELETE FROM archived_releases WHERE id = ?";
            db.run(deleteArchiveSql, [archiveId], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(400).json({ error: err.message });
                }

                if (this.changes === 0) {
                    db.run("ROLLBACK");
                    return res.status(404).json({ error: `Archived release with ID ${archiveId} not found.` });
                }

                db.run("COMMIT", (commitErr) => {
                    if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                    scheduleQdrantSync();
                    res.json({
                        message: `Archived release ${archiveId} and its associated data deleted.`,
                        changes: this.changes
                    });
                });
            });
        });
    });
});

const getFatTotalRequirements = (fatPeriodId) => {
    return new Promise((resolve, reject) => {
        const getSelectedReleasesSql = `SELECT release_id, archived_release_id, release_type FROM fat_selected_releases WHERE fat_period_id = ?`;
        db.all(getSelectedReleasesSql, [fatPeriodId], async (err, selectedReleases) => {
            if (err) return reject(new Error("DB error getting selected releases."));

            const activeReleaseIds = selectedReleases.filter(r => r.release_type === 'active').map(r => r.release_id);
            const archivedReleaseIds = selectedReleases.filter(r => r.release_type === 'archived').map(r => r.archived_release_id);

            const reqsPromises = [];
            if (activeReleaseIds.length > 0) {
                const activeReqsSql = `SELECT COUNT(*) as count FROM activities WHERE release_id IN (${activeReleaseIds.join(',')}) AND isCurrent = 1`;
                reqsPromises.push(new Promise((resolve, reject) => db.get(activeReqsSql, [], (err, row) => err ? reject(err) : resolve(row.count))));
            }
            if (archivedReleaseIds.length > 0) {
                const archivedReqsSql = `SELECT COUNT(*) as count FROM archived_release_items WHERE archive_id IN (${archivedReleaseIds.join(',')})`;
                reqsPromises.push(new Promise((resolve, reject) => db.get(archivedReqsSql, [], (err, row) => err ? reject(err) : resolve(row.count))));
            }

            try {
                const counts = await Promise.all(reqsPromises);
                const total = counts.reduce((sum, count) => sum + count, 0);
                resolve(total);
            } catch (error) {
                reject(error);
            }
        });
    });
};

app.get("/api/releases/:project/selectable", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const activeSql = "SELECT id, name FROM releases WHERE project_id = ? AND status = 'active' ORDER BY release_date DESC";

        db.all(activeSql, [projectId], (err, activeRows) => {
            if (err) return res.status(500).json({ error: "DB error fetching selectable releases." });
            
            const selectableReleases = activeRows.map(r => ({ ...r, type: 'active' }));
            res.json({ message: "success", data: selectableReleases });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete("/api/fat/:fat_period_id", (req, res) => {
    const fatPeriodId = req.params.fat_period_id;
    const sql = 'DELETE FROM fat_periods WHERE id = ?';
    db.run(sql, [fatPeriodId], function (err) {
        if (err) return res.status(500).json({ error: "DB error deleting FAT period: " + err.message });
        if (this.changes === 0) return res.status(404).json({ error: `FAT period with id ${fatPeriodId} not found.`});
        res.json({ message: "FAT period successfully deleted.", changes: this.changes });
    });
});

app.get("/api/fat/:project", async (req, res) => {
    try {
        const projectId = await getProjectId(req.params.project);
        const sql = `
            SELECT fp.id, fp.project_id, fp.start_date, fp.completion_date, fp.status,
                   fsr.release_name, fsr.release_type,
                   fr.passed, fr.failed, fr.blocked, fr.caution, fr.not_run
            FROM fat_periods fp
            LEFT JOIN fat_selected_releases fsr ON fp.id = fsr.fat_period_id
            LEFT JOIN fat_reports fr ON fp.id = fr.fat_period_id
            WHERE fp.project_id = ?
            ORDER BY fp.start_date DESC, fsr.release_name ASC
        `;
        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: "DB error fetching FAT periods." });

            const fatPeriodsMap = new Map();
            rows.forEach(row => {
                if (!fatPeriodsMap.has(row.id)) {
                    let fat_report = null;
                    if (row.passed !== null) {
                        fat_report = {
                            passed: row.passed,
                            failed: row.failed,
                            blocked: row.blocked,
                            caution: row.caution,
                            not_run: row.not_run
                        };
                    }
                    fatPeriodsMap.set(row.id, {
                        id: row.id,
                        project_id: row.project_id,
                        start_date: row.start_date,
                        completion_date: row.completion_date,
                        status: row.status,
                        selected_releases: [],
                        fat_report: fat_report
                    });
                }
                if (row.release_name) {
                    fatPeriodsMap.get(row.id).selected_releases.push({
                        name: row.release_name,
                        type: row.release_type
                    });
                }
            });

            res.json({ message: "success", data: Array.from(fatPeriodsMap.values()) });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post("/api/fat/:project", async (req, res) => {
    const { start_date, release_id } = req.body; 
    if (!start_date || !release_id) {
        return res.status(400).json({ error: "Start date and a selected release are required." });
    }

    try {
        const projectId = await getProjectId(req.params.project);

        db.get("SELECT id FROM fat_periods WHERE project_id = ? AND status = 'active'", [projectId], (err, activeFat) => {
            if (err) return res.status(500).json({ error: "DB error checking for active FAT periods." });
            if (activeFat) return res.status(409).json({ error: "An active FAT period already exists for this project. Please complete it before starting a new one." });

            // --- THIS IS THE CRITICAL FIX ---
            // Create a date object representing 9 AM in Greece time (EEST = UTC+3)
            // Then convert it to a standard UTC ISO string for storage.
            // This will be stored in the DB as '...T06:00:00.000Z'
            const startDateUTC = new Date(`${start_date}T09:00:00+03:00`).toISOString();

            db.get("SELECT name FROM releases WHERE id = ?", [release_id], (nameErr, release) => {
                if (nameErr || !release) {
                    return res.status(404).json({ error: "Selected release not found." });
                }

                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    const insertPeriodSql = `INSERT INTO fat_periods (project_id, start_date) VALUES (?, ?)`;
                    // Use the new UTC string for the database insert
                    db.run(insertPeriodSql, [projectId, startDateUTC], function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: "Failed to create FAT period." });
                        }
                        const fatPeriodId = this.lastID;
                        const insertReleaseSql = `INSERT INTO fat_selected_releases (fat_period_id, release_id, archived_release_id, release_name, release_type) VALUES (?, ?, ?, ?, ?)`;
                        
                        db.run(insertReleaseSql, [fatPeriodId, release_id, null, release.name, 'active'], (insertErr) => {
                            if (insertErr) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: "Failed to link release to FAT period." });
                            }
                            
                            db.run("COMMIT", (commitErr) => {
                                if(commitErr) return res.status(500).json({ error: "Failed to commit transaction." });
                                res.status(201).json({ message: "FAT period started successfully.", data: { id: fatPeriodId } });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get("/api/fat/details/:fat_period_id", (req, res) => {
    const fatPeriodId = req.params.fat_period_id;
    
    const getSelectedReleasesSql = `SELECT release_id, archived_release_id, release_type FROM fat_selected_releases WHERE fat_period_id = ?`;

    db.all(getSelectedReleasesSql, [fatPeriodId], async (err, selectedReleases) => {
        if (err) return res.status(500).json({ error: "DB error getting selected releases." });

        try {
            const fatPeriod = await new Promise((resolve, reject) => db.get("SELECT project_id FROM fat_periods WHERE id = ?", [fatPeriodId], (err, row) => err ? reject(err) : resolve(row)));
            if (!fatPeriod) return res.status(404).json({ error: "FAT Period not found." });

            const activeReleaseIds = selectedReleases.filter(r => r.release_type === 'active').map(r => r.release_id);
            const archivedReleaseIds = selectedReleases.filter(r => r.release_type === 'archived').map(r => r.archived_release_id);

            const reqsPromises = [];
            if (activeReleaseIds.length > 0) {
                const activeReqsSql = `SELECT requirementGroupId as id, requirementUserIdentifier as title, 'active' as source FROM activities WHERE release_id IN (${activeReleaseIds.join(',')}) AND isCurrent = 1`;
                reqsPromises.push(new Promise((resolve, reject) => db.all(activeReqsSql, [], (err, rows) => err ? reject(err) : resolve(rows))));
            }
            if (archivedReleaseIds.length > 0) {
                const archivedReqsSql = `SELECT requirement_group_id as id, requirement_title as title, 'archived' as source FROM archived_release_items WHERE archive_id IN (${archivedReleaseIds.join(',')})`;
                reqsPromises.push(new Promise((resolve, reject) => db.all(archivedReqsSql, [], (err, rows) => err ? reject(err) : resolve(rows))));
            }
            
            const defectsSql = `SELECT id, title, link FROM defects WHERE project_id = ? AND is_fat_defect = 1 AND status != 'Closed'`;
            const defectsPromise = new Promise((resolve, reject) => db.all(defectsSql, [fatPeriod.project_id], (err, rows) => err ? reject(err) : resolve(rows)));

            const [reqsResults, defects] = await Promise.all([Promise.all(reqsPromises), defectsPromise]);
            const requirements = reqsResults.flat();

            res.json({ message: "success", data: { requirements, defects } });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch FAT details: " + error.message });
        }
    });
});

app.put("/api/fat/:fat_period_id/complete", (req, res) => {
    const fatPeriodId = req.params.fat_period_id;
    const completionDate = new Date().toISOString();

    db.get("SELECT id FROM fat_reports WHERE fat_period_id = ?", [fatPeriodId], (err, report) => {
        if (err) return res.status(500).json({ error: "DB error checking for FAT report." });
        if (!report) return res.status(400).json({ error: "Cannot complete a FAT period without results. Please add FAT results first." });

        const fatReportId = report.id;

        db.all("SELECT archived_release_id FROM fat_selected_releases WHERE fat_period_id = ? AND release_type = 'archived'", [fatPeriodId], (err, archivedReleasesInScope) => {
            if (err) {
                return res.status(500).json({ error: "DB error fetching selected archived releases." });
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                if (archivedReleasesInScope.length > 0) {
                    const updateArchivedSql = `UPDATE archived_releases SET fat_report_id = ? WHERE id = ?`;
                    archivedReleasesInScope.forEach(ar => {
                        if (ar.archived_release_id) {
                            db.run(updateArchivedSql, [fatReportId, ar.archived_release_id], (updateErr) => {
                                if (updateErr) console.error("Error linking FAT report to archived release:", updateErr.message);
                            });
                        }
                    });
                }

                const sql = `UPDATE fat_periods SET status = 'completed', completion_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`;
                db.run(sql, [completionDate, fatPeriodId], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: "DB error completing FAT period." });
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK");
                        return res.status(404).json({ error: "Active FAT period not found or already completed." });
                    }
                    
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) return res.status(500).json({ error: "Failed to commit transaction." });
                        res.json({ message: "FAT period completed successfully." });
                    });
                });
            });
        });
    });
});

app.get("/api/fat/:fat_period_id/kpis", async (req, res) => {
    const fatPeriodId = req.params.fat_period_id;

    // Helper function to handle both old and new timestamp formats
    const normalizeToUTCDate = (dateString) => {
        if (!dateString) return null;
        const s = String(dateString);
        if (s.includes('T') && s.includes('Z')) {
            return new Date(s);
        }
        // Assume old format is Greece Time (UTC+3)
        return new Date(s.replace(' ', 'T') + '+03:00');
    };

    try {
        const fatPeriod = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM fat_periods WHERE id = ?", [fatPeriodId], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!fatPeriod) {
            return res.status(404).json({ error: "FAT Period not found." });
        }

        const fatStartDate = normalizeToUTCDate(fatPeriod.start_date);

        const fatDefects = await new Promise((resolve, reject) => {
            const sql = "SELECT id, status, created_at FROM defects WHERE project_id = ? AND is_fat_defect = 1";
            db.all(sql, [fatPeriod.project_id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        if (fatDefects.length === 0) {
            return res.json({
                data: { dre: "0.00", mttd: "0.00", mttr: "0.00" },
                message: "No FAT defects found to calculate KPIs."
            });
        }
        
        const defectIds = fatDefects.map(d => d.id);
        const historyRecords = await new Promise((resolve, reject) => {
            const sql = `SELECT * FROM defect_history WHERE defect_id IN (${defectIds.join(',')}) ORDER BY changed_at ASC`;
            db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const historyMap = new Map();
        historyRecords.forEach(rec => {
            if (!historyMap.has(rec.defect_id)) {
                historyMap.set(rec.defect_id, []);
            }
            historyMap.get(rec.defect_id).push(rec);
        });

        // DRE Calculation
        const totalFatDefects = fatDefects.length;
        const fixedFatDefectsCount = fatDefects.filter(d => d.status === 'Done' || d.status === 'Closed').length;
        const dre = totalFatDefects > 0 ? (fixedFatDefectsCount / totalFatDefects) * 100 : 0;

        // MTTD Calculation
        let totalDetectionHours = 0;
        fatDefects.forEach(defect => {
            const defectCreatedAt = normalizeToUTCDate(defect.created_at);
            if (defectCreatedAt) {
                totalDetectionHours += calculateBusinessHours(fatStartDate, defectCreatedAt);
            }
        });
        const mttdInDays = totalFatDefects > 0 ? (totalDetectionHours / 24) / totalFatDefects : 0;

        // --- ADJUSTED MTTR CALCULATION STARTS HERE ---
        let totalRepairHours = 0;
        let fixedForMttrCount = 0;

        // Step 1: Include defects that are currently 'Done' OR 'Closed'.
        const fixedDefectsForMttr = fatDefects.filter(d => d.status === 'Done' || d.status === 'Closed');

        fixedDefectsForMttr.forEach(defect => {
            const defectHistory = historyMap.get(defect.id) || [];
            let lastDoneDate = null;

            // Step 2: Find the most recent history entry where the status became "Done".
            // We iterate backwards through the history to find the last one first.
            for (let i = defectHistory.length - 1; i >= 0; i--) {
                const historyItem = defectHistory[i];
                if (historyItem.changes_summary) {
                    try {
                        const changes = JSON.parse(historyItem.changes_summary);
                        // We are specifically looking for the "Done" event, as requested.
                        if (changes.status && changes.status.new === 'Done') {
                            lastDoneDate = normalizeToUTCDate(historyItem.changed_at);
                            break; // Stop after finding the most recent "Done" event.
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
            }
            
            // Step 3: If we found a "Done" date, calculate the duration.
            if (lastDoneDate) {
                const defectCreatedAt = normalizeToUTCDate(defect.created_at);
                if (defectCreatedAt) {
                    totalRepairHours += calculateBusinessHours(defectCreatedAt, lastDoneDate);
                    fixedForMttrCount++;
                }
            }
        });
        const mttrInDays = fixedForMttrCount > 0 ? (totalRepairHours / 24) / fixedForMttrCount : 0;
        // --- MTTR CALCULATION ENDS HERE ---

        res.json({
            message: "success",
            data: {
                dre: dre.toFixed(2),
                mttd: mttdInDays.toFixed(2),
                mttr: mttrInDays.toFixed(2)
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to calculate KPIs: " + error.message });
    }
});

app.post("/api/fat/:fat_period_id/report", async (req, res) => {
    const fatPeriodId = req.params.fat_period_id;
    const { passed, failed, blocked, caution, not_run } = req.body;

    const values = [passed, failed, blocked, caution, not_run];
    const numericValues = values.map(v => v === '' || v === null ? 0 : parseInt(v, 10));

    if (numericValues.some(isNaN)) {
        return res.status(400).json({ error: "All fields must be numbers." });
    }

    const totalFromUser = numericValues.reduce((sum, v) => sum + v, 0);

    if (totalFromUser === 0) {
        const deleteSql = `DELETE FROM fat_reports WHERE fat_period_id = ?`;
        db.run(deleteSql, [fatPeriodId], function(err) {
            if (err) return res.status(500).json({ error: "Database error clearing FAT report: " + err.message });
            return res.status(200).json({ message: "FAT report cleared successfully." });
        });
        return;
    }

    try {
        const totalRequirements = await getFatTotalRequirements(fatPeriodId);
        
        if (totalFromUser !== totalRequirements) {
            return res.status(400).json({ error: `The sum of all fields must be exactly ${totalRequirements}. Current sum is ${totalFromUser}.` });
        }

        const sql = `
            INSERT INTO fat_reports (fat_period_id, passed, failed, blocked, caution, not_run)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(fat_period_id) DO UPDATE SET
                passed = excluded.passed,
                failed = excluded.failed,
                blocked = excluded.blocked,
                caution = excluded.caution,
                not_run = excluded.not_run,
                created_at = CURRENT_TIMESTAMP;
        `;

        db.run(sql, [fatPeriodId, ...numericValues], function(err) {
            if (err) return res.status(500).json({ error: "Database error saving FAT report: " + err.message });
            res.status(201).json({ message: "FAT report saved successfully." });
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to process FAT report: " + error.message });
    }
});

app.get("/api/defects/all", (req, res) => {
    const defectsSql = `
        WITH LastComment AS (
            SELECT
                defect_id,
                comment,
                ROW_NUMBER() OVER(PARTITION BY defect_id ORDER BY changed_at DESC) as rn
            FROM defect_history
        )
        SELECT
            d.*,
            p.name as project,
            lc.comment as last_comment
        FROM defects d
        JOIN projects p ON d.project_id = p.id
        LEFT JOIN LastComment lc ON d.id = lc.defect_id AND lc.rn = 1
        ORDER BY d.created_at DESC
    `;
    const linksSql = `SELECT l.defect_id, l.requirement_group_id, a.requirementUserIdentifier, a.sprint
                      FROM defect_requirement_links l
                      JOIN activities a ON l.requirement_group_id = a.requirementGroupId
                      WHERE a.isCurrent = 1`;

    Promise.all([
        new Promise((resolve, reject) => db.all(defectsSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
        new Promise((resolve, reject) => db.all(linksSql, [], (err, rows) => err ? reject(err) : resolve(rows)))
    ]).then(([defectRows, linkRows]) => {
        const linksMap = new Map();
        linkRows.forEach(link => {
            if (!linksMap.has(link.defect_id)) {
                linksMap.set(link.defect_id, []);
            }
            linksMap.get(link.defect_id).push({
                groupId: link.requirement_group_id,
                name: link.requirementUserIdentifier,
                sprint: link.sprint
            });
        });

        const defectsWithLinks = defectRows.map(defect => ({
            ...defect,
            lastComment: defect.last_comment,
            linkedRequirements: linksMap.get(defect.id) || []
        }));

        res.json({ message: "success", data: defectsWithLinks });
    }).catch(err => {
        res.status(400).json({ "error": err.message });
    });
});

app.get("/api/defects/:project", async (req, res) => {
    const project = req.params.project.trim();
    const statusType = req.query.statusType || 'active';

    try {
        const projectId = await getProjectId(project);
        let statusCondition = "d.status != 'Closed'";
        let orderBy = "d.created_at DESC";
        if (statusType === 'closed') {
            statusCondition = "d.status = 'Closed'";
            orderBy = "d.updated_at DESC";
        }

        const defectsSql = `
            WITH LastComment AS (
                SELECT
                    defect_id,
                    comment,
                    ROW_NUMBER() OVER(PARTITION BY defect_id ORDER BY changed_at DESC) as rn
                FROM defect_history
            )
            SELECT
                d.*,
                lc.comment as last_comment
            FROM defects d
            LEFT JOIN LastComment lc ON d.id = lc.defect_id AND lc.rn = 1
            WHERE d.project_id = ? AND ${statusCondition}
            ORDER BY ${orderBy}
        `;
        
        const linksSql = `SELECT l.defect_id, l.requirement_group_id, a.requirementUserIdentifier, a.sprint
                          FROM defect_requirement_links l
                          JOIN activities a ON l.requirement_group_id = a.requirementGroupId
                          WHERE a.isCurrent = 1 AND a.project_id = ?`;

        Promise.all([
            new Promise((resolve, reject) => db.all(defectsSql, [projectId], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(linksSql, [projectId], (err, rows) => err ? reject(err) : resolve(rows)))
        ]).then(([defectRows, linkRows]) => {
            const linksMap = new Map();
            linkRows.forEach(link => {
                if (!linksMap.has(link.defect_id)) {
                    linksMap.set(link.defect_id, []);
                }
                linksMap.get(link.defect_id).push({
                    groupId: link.requirement_group_id,
                    name: link.requirementUserIdentifier,
                    sprint: link.sprint
                });
            });

            const defectsWithLinks = defectRows.map(defect => ({
                ...defect,
                project: project,
                lastComment: defect.last_comment,
                linkedRequirements: linksMap.get(defect.id) || []
            }));

            res.json({ message: "success", data: defectsWithLinks });
        }).catch(err => {
            res.status(400).json({ "error": err.message });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.get("/api/defects/:defectId/history", (req, res) => {
    const defectId = req.params.defectId;
    const sql = "SELECT * FROM defect_history WHERE defect_id = ? ORDER BY changed_at ASC";
    db.all(sql, [defectId], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ message: "success", data: rows });
    });
});

app.get("/api/defects/:project/return-counts", async (req, res) => {
    const project = req.params.project.trim();
    const statusType = req.query.statusType || 'active';

    try {
        const projectId = await getProjectId(project);
        let statusCondition = "d.status != 'Closed'";
        if (statusType === 'closed') {
            statusCondition = "d.status = 'Closed'";
        }

        const sql = `
            SELECT
                d.id,
                d.title,
                COUNT(h.id) as return_count
            FROM
                defects d
            JOIN
                defect_history h ON d.id = h.defect_id
            WHERE
                d.project_id = ?
                AND ${statusCondition}
                AND h.changes_summary LIKE '%"new":"Assigned to Developer"%'
            GROUP BY
                d.id, d.title
            HAVING
                return_count > 0
            ORDER BY
                return_count DESC
        `;
        db.all(sql, [projectId], (err, rows) => {
            if (err) {
                return res.status(400).json({ "error": err.message });
            }
            res.json({ message: "success", data: rows });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post("/api/defects", async (req, res) => {
    let { project, title, description, area, status, link, created_date, comment, linkedRequirementGroupIds, is_fat_defect } = req.body;
    if (!project || !title || !area || !status || !created_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        const projectId = await getProjectId(project.trim());
        title = title.trim(); area = area.trim(); status = status.trim();
        
        const createdAtTimestamp = new Date(created_date).toISOString();

        link = link ? link.trim() : null; 
        description = description ? description.trim() : null;
        comment = comment ? comment.trim() : null;
        const isFatDefect = is_fat_defect ? 1 : 0;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // --- THIS IS THE FIX ---
            // Add BOTH created_date and created_at to the INSERT statement.
            const insertDefectSql = `INSERT INTO defects (project_id, title, description, area, status, link, is_fat_defect, created_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`;
            
            // Add the timestamp for both columns in the parameters array.
            const defectParams = [projectId, title, description, area, status, link, isFatDefect, createdAtTimestamp, createdAtTimestamp, createdAtTimestamp];
            
            db.run(insertDefectSql, defectParams, function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(400).json({ "error": err.message });
                }
                const defectId = this.lastID;
                
                if (linkedRequirementGroupIds && linkedRequirementGroupIds.length > 0) {
                    const linkInsertSql = `INSERT INTO defect_requirement_links (defect_id, requirement_group_id) VALUES (?, ?)`;
                    linkedRequirementGroupIds.forEach(reqId => {
                        db.run(linkInsertSql, [defectId, reqId], (linkErr) => {
                            if (linkErr) console.error("Error creating defect-requirement link:", linkErr.message);
                        });
                    });
                }

                const initialCommentForHistory = comment || "Defect created.";
                const creationSummary = JSON.stringify({
                    status: { old: null, new: status }, title: { old: null, new: title }, area: { old: null, new: area }
                });
                const insertHistorySql = `INSERT INTO defect_history (defect_id, changes_summary, comment, changed_at) VALUES (?, ?, ?, ?)`;
                db.run(insertHistorySql, [defectId, creationSummary, initialCommentForHistory, createdAtTimestamp], (histErr) => {
                    if (histErr) console.error("Error inserting initial defect history:", histErr.message);
                });

                db.run("COMMIT", (commitErr) => {
                    if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                    scheduleQdrantSync();
                    res.json({ message: "Defect created successfully", data: { id: defectId, project, title, status, created_date: createdAtTimestamp } });
                });
            });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/defects/:id", (req, res) => {
    const defectId = parseInt(req.params.id, 10);
    const { title, description, area, status, link, created_date, comment, linkedRequirementGroupIds, is_fat_defect } = req.body;

    db.get("SELECT * FROM defects WHERE id = ?", [defectId], (err, currentDefect) => {
        if (err) return res.status(500).json({ error: "Error fetching current defect state." });
        if (!currentDefect) return res.status(404).json({ error: `Defect with id ${defectId} not found.` });

        let updates = [];
        let updateParamsList = [];
        let changedFieldsForSummary = {};
        
        const addChange = (field, newValue, oldValue) => {
            const normalizedNewValue = (newValue === undefined || newValue === null) ? null : String(newValue).trim();
            const normalizedOldValue = (oldValue === undefined || oldValue === null) ? null : String(oldValue).trim();
            if (normalizedNewValue !== normalizedOldValue) {
                updates.push(`${field} = ?`);
                updateParamsList.push(normalizedNewValue);
                changedFieldsForSummary[field] = { old: normalizedOldValue, new: normalizedNewValue };
            }
        };

        addChange("title", title, currentDefect.title);
        addChange("description", description, currentDefect.description);
        addChange("area", area, currentDefect.area);
        addChange("status", status, currentDefect.status);
        addChange("link", link, currentDefect.link);

        const newCreatedAt = created_date ? new Date(created_date).toISOString() : currentDefect.created_at;
        if (newCreatedAt !== currentDefect.created_at) {
            updates.push(`created_at = ?`);
            updateParamsList.push(newCreatedAt);
            changedFieldsForSummary['created_at'] = { old: currentDefect.created_at, new: newCreatedAt };
        }

        if (is_fat_defect !== undefined && (is_fat_defect ? 1 : 0) !== currentDefect.is_fat_defect) {
            updates.push(`is_fat_defect = ?`);
            updateParamsList.push(is_fat_defect ? 1 : 0);
            changedFieldsForSummary['is_fat_defect'] = { old: currentDefect.is_fat_defect, new: is_fat_defect ? 1 : 0 };
        }

        const hasFieldChanges = Object.keys(changedFieldsForSummary).length > 0;
        const hasComment = comment && comment.trim() !== "";
        
        // Check if linked requirements have changed
        const currentLinks = currentDefect.linkedRequirementGroupIds || [];
        const newLinks = linkedRequirementGroupIds || [];
        const linksChanged = linkedRequirementGroupIds !== undefined && (currentLinks.length !== newLinks.length || !currentLinks.every(id => newLinks.includes(id)));

        // --- FIX 1: Early exit if no changes are detected ---
        if (!hasFieldChanges && !hasComment && !linksChanged) {
            return res.json({ message: "No changes detected.", defectId: defectId });
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION", (beginErr) => {
                if (beginErr) return res.status(500).json({ error: "Failed to start transaction: " + beginErr.message });

                const handleLinks = (callback) => {
                    if (linksChanged) {
                        db.run(`DELETE FROM defect_requirement_links WHERE defect_id = ?`, [defectId], (deleteErr) => {
                            if (deleteErr) return callback(deleteErr);
                            if (newLinks.length > 0) {
                                const insertLinkSql = `INSERT INTO defect_requirement_links (defect_id, requirement_group_id) VALUES (?, ?)`;
                                let completed = 0;
                                newLinks.forEach(reqId => {
                                    db.run(insertLinkSql, [defectId, reqId], (insertErr) => {
                                        if(insertErr) console.error("Error inserting link:", insertErr.message); // Log but don't halt transaction
                                        completed++;
                                        if (completed === newLinks.length) callback(null);
                                    });
                                });
                            } else {
                                callback(null);
                            }
                        });
                    } else {
                        callback(null);
                    }
                };

                // --- FIX 2: Chain the database calls using callbacks ---
                handleLinks((linkErr) => {
                    if (linkErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: "Failed to update links: " + linkErr.message });
                    }

                    const historyComment = comment ? comment.trim() : null;
                    if (hasFieldChanges || historyComment) {
                        const changesSummaryString = hasFieldChanges ? JSON.stringify(changedFieldsForSummary) : null;
                        const nowUTC = new Date().toISOString();
                        const historySql = `INSERT INTO defect_history (defect_id, changes_summary, comment, changed_at) VALUES (?, ?, ?, ?)`;
                        db.run(historySql, [defectId, changesSummaryString, historyComment, nowUTC], (historyErr) => {
                            if (historyErr) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: "Failed to log history: " + historyErr.message });
                            }
                            executeUpdate();
                        });
                    } else {
                        executeUpdate();
                    }
                });

                const executeUpdate = () => {
                    if (hasFieldChanges) {
                        updates.push("updated_at = ?");
                        updateParamsList.push(new Date().toISOString());
                        const sqlUpdate = `UPDATE defects SET ${updates.join(", ")} WHERE id = ?`;
                        updateParamsList.push(defectId);
                        db.run(sqlUpdate, updateParamsList, (updateErr) => {
                            if (updateErr) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: "Failed to update defect: " + updateErr.message });
                            }
                            commitTransaction();
                        });
                    } else {
                        commitTransaction();
                    }
                };

                const commitTransaction = () => {
                    db.run("COMMIT", (commitErr) => {
                        if(commitErr) return res.status(500).json({ error: "Failed to commit transaction: " + commitErr.message });
                        scheduleQdrantSync();
                        res.json({ message: "Defect updated successfully.", defectId: defectId });
                    });
                };
            });
        });
    });
});

app.delete("/api/defects/:id", (req, res) => {
    const defectId = req.params.id;
    const sql = 'DELETE FROM defects WHERE id = ?';
    db.run(sql, defectId, function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        if (this.changes === 0) return res.status(404).json({ error: `Defect with id ${defectId} not found.`});
        scheduleQdrantSync();
        res.json({ message: "Defect deleted successfully", changes: this.changes });
    });
});

app.get("/api/settings/weather-location", (req, res) => {
    const sql = "SELECT value FROM app_settings WHERE key = 'weather_location'";
    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json({ location: row ? row.value : 'Marousi, Athens' });
    });
});

app.post("/api/settings/weather-location", (req, res) => {
    const { location } = req.body;
    if (!location || location.trim() === '') {
        return res.status(400).json({ error: "Location cannot be empty." });
    }
    const sql = `INSERT INTO app_settings (key, value) VALUES ('weather_location', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value;`;
    db.run(sql, [location.trim()], function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({ message: "Location saved successfully.", location: location.trim() });
    });
});

if (isChatbotEnabled) {
  app.post("/api/chatbot/sync", syncWithQdrant(db));
  app.post("/api/chatbot", handleChatbotQuery(db, getProjectId, PORT));
} else {
  const chatbotDisabledHandler = (req, res) => {
    res.status(503).json({ 
      error: "Chatbot functionality is currently disabled.",
      reply: "I'm sorry, my AI features are currently unavailable. Please check the server configuration."
    });
  };
  app.post("/api/chatbot/sync", chatbotDisabledHandler);
  app.post("/api/chatbot", chatbotDisabledHandler);
}

app.use(function(req, res){
    res.status(404).json({"error": "Endpoint not found"});
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});