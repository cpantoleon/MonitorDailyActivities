const express = require('express');
const cors = require('cors');
const db = require('./database.js');
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

let isSyncing = false;
let syncIsPending = false;

const scheduleQdrantSync = () => {
    if (!isChatbotEnabled) return;

    if (isSyncing) {
        console.log("Sync is already in progress. Queuing another sync.");
        syncIsPending = true;
        return;
    }

    isSyncing = true;

    const runSync = async () => {
        console.log("Starting Qdrant sync...");
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
            if (syncIsPending) {
                syncIsPending = false;
                console.log("Pending sync found. Running again immediately.");
                runSync();
            } else {
                isSyncing = false;
            }
        }
    };

    runSync();
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

        results.validRows.push({ title, link });
    });

    return results;
};

app.get("/api/projects", (req, res) => {
    const sql = "SELECT name FROM projects ORDER BY name ASC";
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
    
    const linksSql = `SELECT l.requirement_group_id, d.id as defect_id, d.title as defect_title, d.status as defect_status
                      FROM defect_requirement_links l
                      JOIN defects d ON l.defect_id = d.id`;

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
            linksMap.get(link.requirement_group_id).push({ id: link.defect_id, title: link.defect_title, status: link.defect_status });
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
        const created_date = new Date().toISOString().split('T')[0];

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
                const insertDefectSql = `INSERT INTO defects (project_id, title, area, status, link, created_date) VALUES (?, ?, ?, ?, ?, ?)`;
                const insertHistorySql = `INSERT INTO defect_history (defect_id, changes_summary, comment) VALUES (?, ?, ?)`;
                
                let completedInserts = 0;
                let successfulInserts = 0;

                itemsToImport.forEach(item => {
                    const defaultArea = 'Imported';
                    const defaultStatus = 'Assigned to Developer';

                    db.run(insertDefectSql, [projectId, item.title, defaultArea, defaultStatus, item.link, created_date], function(err) {
                        if (err) {
                            console.error("Error inserting imported defect:", err.message);
                        } else {
                            successfulInserts++;
                            const defectId = this.lastID;
                            const creationSummary = JSON.stringify({
                                status: { old: null, new: defaultStatus }, title: { old: null, new: item.title }, area: { old: null, new: defaultArea }
                            });
                            db.run(insertHistorySql, [defectId, creationSummary, "Defect created via import."]);
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
    let { project, column_type, description, item_date } = req.body;
    if (!project || !column_type || !description || !item_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const projectId = await getProjectId(project.trim());
        column_type = column_type.trim(); description = description.trim(); item_date = item_date.trim();
        const sql = `INSERT INTO retrospective_items (project_id, column_type, description, item_date) VALUES (?,?,?,?)`;
        db.run(sql, [projectId, column_type, description, item_date], function (err) {
            if (err) return res.status(400).json({ "error": err.message });
            scheduleQdrantSync();
            res.json({ message: "success", data: { id: this.lastID, project, column_type, description, item_date } });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/retrospective/:id", (req, res) => {
    const itemId = req.params.id;
    let { column_type, description, item_date } = req.body;
    if (!column_type && !description && !item_date) {
        return res.status(400).json({ error: "No fields provided to update." });
    }
    let setClauses = []; let params = [];
    if (column_type) { setClauses.push("column_type = ?"); params.push(column_type.trim()); }
    if (description) { setClauses.push("description = ?"); params.push(description.trim()); }
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
        const sql = "SELECT id, name, release_date, is_current FROM releases WHERE project_id = ? ORDER BY release_date DESC";
        db.all(sql, [projectId], (err, rows) => {
            if (err) return res.status(400).json({ "error": err.message });
            const data = rows.map(r => ({...r, project: req.params.project}));
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
    let { project, title, description, area, status, link, created_date, comment, linkedRequirementGroupIds } = req.body;
    if (!project || !title || !area || !status || !created_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        const projectId = await getProjectId(project.trim());
        title = title.trim(); area = area.trim(); status = status.trim();
        created_date = new Date(created_date).toISOString().split('T')[0];
        link = link ? link.trim() : null; description = description ? description.trim() : null;
        comment = comment ? comment.trim() : null;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const insertDefectSql = `INSERT INTO defects (project_id, title, description, area, status, link, created_date) VALUES (?,?,?,?,?,?,?)`;
            const defectParams = [projectId, title, description, area, status, link, created_date];
            
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
                const insertHistorySql = `INSERT INTO defect_history (defect_id, changes_summary, comment) VALUES (?, ?, ?)`;
                db.run(insertHistorySql, [defectId, creationSummary, initialCommentForHistory], (histErr) => {
                    if (histErr) console.error("Error inserting initial defect history:", histErr.message);
                });

                db.run("COMMIT", (commitErr) => {
                    if (commitErr) return res.status(500).json({ "error": "Failed to commit transaction: " + commitErr.message });
                    scheduleQdrantSync();
                    res.json({ message: "Defect created successfully", data: { id: defectId, project, title, status, created_date } });
                });
            });
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.put("/api/defects/:id", (req, res) => {
    const defectId = parseInt(req.params.id, 10);
    const { title, description, area, status, link, created_date, comment, linkedRequirementGroupIds } = req.body;

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

        const formattedNewDate = created_date ? new Date(created_date).toISOString().split('T')[0] : currentDefect.created_date;
        addChange("created_date", formattedNewDate, currentDefect.created_date);

        const hasFieldChanges = Object.keys(changedFieldsForSummary).length > 0;
        const hasComment = comment && comment.trim() !== "";

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            const handleLinks = (callback) => {
                if (linkedRequirementGroupIds !== undefined) {
                    db.run(`DELETE FROM defect_requirement_links WHERE defect_id = ?`, [defectId], (deleteErr) => {
                        if (deleteErr) return callback(deleteErr);
                        if (linkedRequirementGroupIds.length > 0) {
                            const insertLinkSql = `INSERT INTO defect_requirement_links (defect_id, requirement_group_id) VALUES (?, ?)`;
                            let completed = 0;
                            linkedRequirementGroupIds.forEach(reqId => {
                                db.run(insertLinkSql, [defectId, reqId], (insertErr) => {
                                    if(insertErr) console.error("Error inserting link:", insertErr.message);
                                    completed++;
                                    if (completed === linkedRequirementGroupIds.length) callback(null);
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

            handleLinks((linkErr) => {
                if (linkErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: "Failed to update links: " + linkErr.message });
                }

                const historyComment = comment ? comment.trim() : null;
                if (hasFieldChanges || historyComment) {
                    const changesSummaryString = hasFieldChanges ? JSON.stringify(changedFieldsForSummary) : null;
                    const historySql = `INSERT INTO defect_history (defect_id, changes_summary, comment) VALUES (?, ?, ?)`;
                    db.run(historySql, [defectId, changesSummaryString, historyComment]);
                }

                if (hasFieldChanges) {
                    updates.push("updated_at = CURRENT_TIMESTAMP");
                    const sqlUpdate = `UPDATE defects SET ${updates.join(", ")} WHERE id = ?`;
                    updateParamsList.push(defectId);
                    db.run(sqlUpdate, updateParamsList);
                }
                
                db.run("COMMIT", (commitErr) => {
                    if(commitErr) return res.status(500).json({ error: "Failed to commit transaction." });
                    scheduleQdrantSync();
                    res.json({ message: "Defect updated successfully.", defectId: defectId });
                });
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