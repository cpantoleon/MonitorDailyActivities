const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const lancedb = require('@lancedb/lancedb');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const util = require('util');
const promisifiedExec = util.promisify(exec);

const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'deepseek-r1:1.5b';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

let genAI, db, table, embeddingModel, generativeModel;
const TABLE_NAME = "requirements_defects";
const DB_PATH = path.join(__dirname, "data/lancedb");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function getHybridEmbedding(text) {
    if (USE_OLLAMA) {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text })
            });
            
            if (!response.ok) {
                 const errText = await response.text();
                 throw new Error(`Ollama API Error: ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            
            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error("Invalid embedding received from Ollama");
            }

            return data.embedding;
        } catch (error) {
            throw error;
        }
    } else {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    }
}

async function getHybridCompletion(prompt, jsonMode = false) {
    let cleanResponse = "";
    
    if (USE_OLLAMA) {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_CHAT_MODEL,
                prompt: prompt,
                stream: false,
                format: jsonMode ? 'json' : undefined
            })
        });
        const data = await response.json();
        cleanResponse = data.response;
    } else {
        const result = await generativeModel.generateContent(prompt);
        cleanResponse = result.response.text();
    }

    cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (jsonMode) {
        const firstBrace = cleanResponse.indexOf('{');
        const lastBrace = cleanResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
        } else {
            cleanResponse = cleanResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        }
    }

    return cleanResponse;
}

function extractProjectFromMessage(message, intent) {
    let regex;
    switch (intent) {
        case 'get_release_date':
            regex = /release date for\s+(.+)/i;
            break;
        case 'get_project_summary':
            regex = /(?:summary for|everything for)\s+(.+)/i;
            break;
        case 'get_defects_list':
        case 'get_defects_count':
        case 'get_requirements_list':
        case 'get_requirements_count':
        case 'get_retrospective_summary':
        case 'get_releases_list':
        case 'get_fat_info':
            regex = /(?:defects?|requirements?|retrospectives?|releases?|fat|kpi|counter|number|undone|not done|done|closed)(?:.*?)(?: for| in| of)\s+(?:the\s+)?([a-zA-Z0-9\s-_]+)(?:\?|$)/i;
            break;
        default:
            return null;
    }

    const match = message.match(regex);
    let projectName = null;

    if (match && match[1]) {
        projectName = match[1].trim().replace(/\?$/, '').trim();
    }

    if (!projectName && (intent === 'get_defects_list' || intent === 'get_defects_count')) {
        const alternativeRegex = /defects?\s+([a-zA-Z0-9-]+)/i;
        const altMatch = message.match(alternativeRegex);
        if (altMatch && altMatch[1]) {
            projectName = altMatch[1].trim();
        }
    }
    
    if (projectName && projectName.toLowerCase().endsWith(' project')) {
        projectName = projectName.slice(0, -' project'.length).trim();
    }

    return projectName;
}

function extractConversationalProject(message) {
    const pattern = /(?:(?:for|in|on|to)\s+project|project|for|in|on|to)\s+(?:the\s+)?(['"]?)([\w\s-]+?)\1(?=\s|,\s|\.\s|\?\s|sprint|title|titled|called|requirement|defect|$)/i;
    let match = message.match(pattern);

    if (!match) {
        const startPattern = /^(['"]?)([\w\s-]+?)\1\s+(?:requirement|defect)/i;
        match = message.match(startPattern);
    }

    if (match && (match[2] || match[1])) {
        let projectName = (match[2] || match[1]).trim();
        if (projectName.toLowerCase().endsWith(' project')) {
            projectName = projectName.slice(0, -' project'.length).trim();
        }
        return projectName;
    }
    
    return null;
}

function extractTitleFromMessage(message) {
    const patterns = [
        /(?:requirement|defect)\s+(['"])(.+?)\1/i,
        /(?:titled|title is|title|with title|named|called|call it|the title should be)\s+(['"]?)(.+?)\1(?=[.,]?(\s+for|\s+in|\s+on|\s+sprint|project|$))/i,
        /:\s+(['"]?)(.+?)\1$/i,
        /(['"])(.+?)\1\s+title/i
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[2]) {
            let title = match[2].trim();
            if (/[.,?!"']$/.test(title)) {
                title = title.slice(0, -1);
            }
            if (title.startsWith('"') && title.endsWith('"')) {
                title = title.slice(1, -1);
            }
            return title;
        }
    }
    return null;
}

function extractSprintFromMessage(message) {
    const match = message.match(/(?:in\s+)?sprint\s+([a-zA-Z0-9_.-]+)|([a-zA-Z0-9_.-]+)\s+sprint/i);
    return match ? (match[1] || match[2]).trim() : null;
}

function detectIntentAndEntity(message) {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.match(/how many requirements|count of requirements|number of requirements/)) {
        const match = lowerMsg.match(/(?:for|in|of)\s+(.+)/);
        return {
            intent: 'get_requirements_count',
            parameters: { 
                project_name: match ? match[1].replace('?', '').trim() : null,
                req_status_filter: lowerMsg.includes('done') ? 'done' : 'all'
            }
        };
    }

    if (lowerMsg.match(/requirements (?:for|in)|list requirements|show me requirements|give me the requirements/)) {
        const match = lowerMsg.match(/(?:for|in|of)\s+(.+)/);
        return {
            intent: 'get_requirements_list',
            parameters: { 
                project_name: match ? match[1].replace('?', '').trim() : null,
                req_status_filter: lowerMsg.includes('done') ? 'done' : 'all'
            }
        };
    }

    if (lowerMsg.match(/how many defects|count of defects|number of defects/)) {
        const match = lowerMsg.match(/(?:for|in|of)\s+(.+)/);
        return {
            intent: 'get_defects_count',
            parameters: { 
                project_name: match ? match[1].replace('?', '').trim() : null,
                defect_status_filter: lowerMsg.includes('done') || lowerMsg.includes('closed') ? 'closed' : 'undone'
            }
        };
    }

    if (lowerMsg.match(/defects (?:for|in)|list defects|show me defects|give me the defects/)) {
        const match = lowerMsg.match(/(?:for|in|of)\s+(.+)/);
        return {
            intent: 'get_defects_list',
            parameters: { 
                project_name: match ? match[1].replace('?', '').trim() : null,
                defect_status_filter: lowerMsg.includes('done') || lowerMsg.includes('closed') ? 'closed' : 'undone'
            }
        };
    }

    if (lowerMsg.match(/show sprints|what sprints|list sprints|sprints in/)) {
        return { intent: 'get_sprint_info', parameters: { project_name: extractConversationalProject(message) } };
    }

    if (lowerMsg.match(/show releases|what releases|list releases|active releases/)) {
        return { intent: 'get_releases_list', parameters: { project_name: extractConversationalProject(message) } };
    }

    if (lowerMsg.match(/fat status|sat bugs|kpi|mttd|mttr|dre/)) {
        return { intent: 'get_fat_info', parameters: { project_name: extractConversationalProject(message) } };
    }

    if (lowerMsg.match(/retrospective|went well|went wrong|lessons learned/)) {
        return { intent: 'get_retrospective_summary', parameters: { project_name: extractConversationalProject(message) } };
    }

    if (lowerMsg.includes('release date')) {
        const match = lowerMsg.match(/release date (?:for|of) (.+)/);
        return { 
            intent: 'get_release_date', 
            parameters: { project_name: match ? match[1].replace('?', '').trim() : null } 
        };
    }

    if (lowerMsg.match(/create multiple|add requirements|add defects|create 2|create 3|create \d+/)) {
        return {
            intent: 'create_multiple_items',
            parameters: { project_name: extractConversationalProject(message) }
        };
    }

    if (lowerMsg.startsWith('create') || lowerMsg.startsWith('add') || lowerMsg.startsWith('new') || lowerMsg.includes('create a')) {
        const typeMatch = lowerMsg.match(/(requirement|defect)/);
        if (typeMatch) {
             return {
                intent: 'create_item',
                parameters: {
                    item_type: typeMatch[1],
                    title: extractTitleFromMessage(message),
                    project_name: extractConversationalProject(message),
                    sprint: extractSprintFromMessage(message)
                }
            };
        }
    }

    return null;
}

async function fetchNamedaysFromWidget() {
    try {
        const widgetUrl = 'https://www.eortologio.net/widget.php';
        const response = await fetch(widgetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch widget with status: ${response.status}`);
        }
        const html = await response.text();
        
        const $ = cheerio.load(html);
        const namedays = [];

        $('table tr').each((i, row) => {
            const dateText = $(row).find('td#date').text().trim();
            const namesText = $(row).find('td#maintd').text().trim();

            if (dateText) {
                namedays.push({
                    date: dateText,
                    names: (namesText && namesText !== '-') ? namesText : ""
                });
            }
        });

        return namedays;
    } catch (error) {
        return [];
    }
}

async function initializeClients() {
  if (db) {
    return;
  }
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

  if (!OPENWEATHER_API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is missing.");
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }

  db = await lancedb.connect(DB_PATH);

  try {
      table = await db.openTable(TABLE_NAME);
  } catch (e) {
      table = null;
  }

  if (!USE_OLLAMA) {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing for Cloud mode.");
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
      generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
  }
}

async function embedBatchWithRetry(textsToEmbed, maxRetries = 5) {
    if (USE_OLLAMA) {
        const embeddings = [];
        for (const text of textsToEmbed) {
            try {
                const safeText = text.replace(/[\r\n]+/g, ' ').substring(0, 100);
                
                await new Promise(resolve => setTimeout(resolve, 20));
                const embedding = await getHybridEmbedding(safeText);
                embeddings.push(embedding);
            } catch (error) {
                embeddings.push(null);
            }
        }
        return embeddings;
    } else {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const embeddingResult = await embeddingModel.batchEmbedContents({
                    requests: textsToEmbed.map(text => ({ model: "models/embedding-001", content: { parts: [{ text }] } })),
                });
                return embeddingResult.embeddings.map(e => e.values);
            } catch (error) {
                if (error.status === 429 && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
        throw new Error("Failed to embed batch after multiple retries.");
    }
}

const syncWithQdrant = (dbInstance) => async (req, res) => {
    try {
        await initializeClients();
        
        const requirementsSql = `
            SELECT 
                a.id as activityDbId, a.requirementGroupId, a.requirementUserIdentifier, 
                a.status, a.sprint, p.name as project,
                rel.name as release_name, rel.release_date
            FROM activities a 
            JOIN projects p ON a.project_id = p.id 
            LEFT JOIN releases rel ON a.release_id = rel.id
            WHERE a.isCurrent = 1
        `;
        const defectsSql = `SELECT d.id, d.title, d.status, d.description, p.name as project FROM defects d JOIN projects p ON d.project_id = p.id`;
        const notesSql = `SELECT n.id, n.noteDate, n.noteText, p.name as project FROM notes n JOIN projects p ON n.project_id = p.id`;
        const retrospectivesSql = `SELECT r.id, r.column_type, r.description, r.item_date, p.name as project FROM retrospective_items r JOIN projects p ON r.project_id = p.id`;
        const releasesSql = `SELECT r.id, r.name, r.release_date, r.is_current, p.name as project FROM releases r JOIN projects p ON r.project_id = p.id`;
        const linksSql = `SELECT l.defect_id, l.requirement_group_id, d.title as defect_title, a.requirementUserIdentifier as req_title FROM defect_requirement_links l JOIN defects d ON l.defect_id = d.id JOIN activities a ON l.requirement_group_id = a.requirementGroupId WHERE a.isCurrent = 1`;

        const [requirements, defects, notes, retrospectives, releases, links] = await Promise.all([
            new Promise((resolve, reject) => dbInstance.all(requirementsSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => dbInstance.all(defectsSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => dbInstance.all(notesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => dbInstance.all(retrospectivesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => dbInstance.all(releasesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => dbInstance.all(linksSql, [], (err, rows) => err ? reject(err) : resolve(rows)))
        ]);

        const defectLinks = new Map();
        const requirementLinks = new Map();
        links.forEach(link => {
            if (!defectLinks.has(link.requirement_group_id)) defectLinks.set(link.requirement_group_id, []);
            defectLinks.get(link.requirement_group_id).push(link.defect_title);

            if (!requirementLinks.has(link.defect_id)) requirementLinks.set(link.defect_id, []);
            requirementLinks.get(link.defect_id).push(link.req_title);
        });

        const documents = [
            ...requirements.map(r => {
                const linkedDefects = defectLinks.get(r.requirementGroupId) || [];
                const linkText = linkedDefects.length > 0 ? ` Linked to ${linkedDefects.length} defect(s): ${linkedDefects.join(', ')}.` : '';
                let releaseText = '';
                if (r.release_name && r.release_date) {
                    releaseText = ` Release: ${r.release_name} (Date: ${r.release_date}).`;
                }
                return {
                    id: crypto.createHash('md5').update(`req_${r.requirementGroupId}`).digest('hex'),
                    text: `Type: Requirement. ID: ${r.requirementUserIdentifier}. Status: ${r.status}. Sprint: ${r.sprint}. Project: ${r.project}.${releaseText}${linkText}`,
                    type: 'requirement', 
                    item_id: String(r.requirementGroupId), 
                    title: r.requirementUserIdentifier, 
                    project: r.project, 
                    status: r.status, 
                    sprint: r.sprint, 
                    release_name: r.release_name || "", 
                    release_date: r.release_date || "",
                    source: 'db'
                };
            }),
            ...defects.map(d => {
                const linkedReqs = requirementLinks.get(d.id) || [];
                const linkText = linkedReqs.length > 0 ? ` Linked to ${linkedReqs.length} requirement(s): ${linkedReqs.join(', ')}.` : '';
                return {
                    id: crypto.createHash('md5').update(`def_${d.id}`).digest('hex'),
                    text: `Type: Defect. ID: DEF-${d.id}. Title: ${d.title}. Status: ${d.status}. Project: ${d.project}. Description: ${d.description || 'N/A'}.${linkText}`,
                    type: 'defect', 
                    item_id: String(d.id), 
                    title: d.title, 
                    project: d.project, 
                    status: d.status,
                    source: 'db'
                };
            }),
            ...notes.map(n => ({
                id: crypto.createHash('md5').update(`note_${n.id}`).digest('hex'),
                text: `Type: Note. ID: NOTE-${n.id}. Project: ${n.project}. Date: ${n.noteDate}. Content: ${n.noteText}`,
                type: 'note', 
                item_id: String(n.id), 
                project: n.project, 
                date: n.noteDate, 
                content: n.noteText, 
                source: 'db'
            })),
            ...retrospectives.map(ri => ({
                id: crypto.createHash('md5').update(`retro_${ri.id}`).digest('hex'),
                text: `Type: Retrospective Item. ID: RETRO-${ri.id}. Project: ${ri.project}. Category: ${ri.column_type}. Date: ${ri.item_date}. Description: ${ri.description}`,
                type: 'retrospective', 
                item_id: String(ri.id), 
                project: ri.project, 
                category: ri.column_type, 
                description: ri.description, 
                source: 'db'
            })),
            ...releases.map(rel => ({
                id: crypto.createHash('md5').update(`release_${rel.id}`).digest('hex'),
                text: `Type: Release. ID: REL-${rel.id}. Project: ${rel.project}. Name: ${rel.name}. Date: ${rel.release_date}. Status: ${rel.is_current ? 'Active' : 'Inactive'}.`,
                type: 'release', 
                item_id: String(rel.id), 
                project: rel.project, 
                name: rel.name, 
                date: rel.release_date, 
                status: rel.is_current ? 'Active' : 'Inactive', 
                source: 'db'
            }))
        ].filter(doc => doc.id);

        if (documents.length === 0) {
            return res.status(200).json({ message: "No valid documents to sync." });
        }

        const BATCH_SIZE = USE_OLLAMA ? 5 : 100;
        const dataToIngest = [];

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batchDocuments = documents.slice(i, i + BATCH_SIZE);
            const textsToEmbed = batchDocuments.map(d => d.text);
            const embeddings = await embedBatchWithRetry(textsToEmbed);

            const batchData = batchDocuments.map((doc, index) => {
                const vector = embeddings[index];
                if (!vector) return null;
                return { ...doc, vector };
            }).filter(d => d !== null);

            dataToIngest.push(...batchData);
        }

        if (dataToIngest.length > 0) {
            table = await db.createTable(TABLE_NAME, dataToIngest, { mode: "overwrite" });
        }

        res.status(200).json({ message: "Sync successful! LanceDB table updated.", synced: dataToIngest.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to sync data with LanceDB.", details: error.message });
    }
};

const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const findProjectMatch = async (db, userInput) => {
    if (!userInput) return { noMatch: true };
    const lowerUserInput = userInput.toLowerCase();

    const projects = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM projects", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.name));
        });
    });

    let bestMatch = null;
    let minDistance = Infinity;

    for (const proj of projects) {
        const lowerProj = proj.toLowerCase();
        if (lowerProj === lowerUserInput) {
            return { exact: proj };
        }
        const distance = levenshteinDistance(lowerUserInput, lowerProj);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = proj;
        }
    }

    if (bestMatch && minDistance <= 1) {
        return { autocorrect: bestMatch };
    }
    
    if (bestMatch && minDistance <= 2) {
        return { suggestion: bestMatch };
    }

    return { noMatch: true };
};

const handleChatbotQuery = (dbInstance, getProjectId, port) => async (req, res) => {
    try {
        await initializeClients();
        const { message, projectContext } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const lowerCaseMessage = message.toLowerCase().trim();

        if (lowerCaseMessage === 'github') {
            try {
                const projectRoot = path.resolve(__dirname, '..'); 
                await promisifiedExec('git add .', { cwd: projectRoot });
                const { stdout: statusOutput } = await promisifiedExec('git status --porcelain', { cwd: projectRoot });
                if (!statusOutput) {
                    return res.json({ reply: "No changes to commit. The working directory is clean." });
                }
                const commitMessage = "db updated";
                await promisifiedExec(`git commit -m "${commitMessage}"`, { cwd: projectRoot });
                await promisifiedExec('git push', { cwd: projectRoot });
                return res.json({ reply: "Success! Your changes have been added, committed, and pushed." });
            } catch (error) {
                const errorMessage = error.stderr || error.stdout || error.message;
                return res.json({ reply: `The GitHub command failed:\n\n\`\`\`\n${errorMessage}\n\`\`\`` });
            }
        }

        if (lowerCaseMessage === 'git pull') {
            try {
                const projectRoot = path.resolve(__dirname, '..'); 
                await promisifiedExec('git pull', { cwd: projectRoot });
                return res.json({ reply: "Success! Your local repository has been updated." });
            } catch (error) {
                const errorMessage = error.stderr || error.stdout || error.message;
                return res.json({ reply: `The GitHub pull command failed:\n\n\`\`\`\n${errorMessage}\n\`\`\`` });
            }
        }
        
        let preDeterminedIntent = null;
        if (['hello', 'hi', 'hey'].includes(lowerCaseMessage)) {
            return res.json({ reply: "Hello! How can I help you with your project data today?" });
        }
        if (lowerCaseMessage.includes('how are you')) {
            return res.json({ reply: "I'm a bot, but I'm ready to assist you!" });
        }
        if (lowerCaseMessage.includes('what day is today') || lowerCaseMessage.includes("what's the date") || lowerCaseMessage.includes('tell me the today date') || lowerCaseMessage.includes('today is')) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return res.json({ reply: `Today is ${today}.` });
        }
        if (lowerCaseMessage.includes('eortologio') || lowerCaseMessage.includes('nameday')) {
            preDeterminedIntent = 'get_nameday';
        }
        if (lowerCaseMessage.includes('joke')) {
            preDeterminedIntent = 'get_joke';
        }
        if (lowerCaseMessage.includes('weather')) {
            preDeterminedIntent = 'get_weather';
        }

        if (lowerCaseMessage.includes('release') && !lowerCaseMessage.includes('date') && !lowerCaseMessage.match(/show|what|list/)) {
            return res.json({ reply: "Your request is a bit unclear. If you're asking for a release date, please try asking again using the words 'release date'." });
        }
        if (lowerCaseMessage.includes('date') && !lowerCaseMessage.includes('release date') && !lowerCaseMessage.includes('today') && !lowerCaseMessage.includes('nameday')) {
            return res.json({ reply: "Your request is a bit unclear. If you're asking for a release date, please try again using the phrase 'release date for [project name]'." });
        }

        let intentData = {};

        if (!preDeterminedIntent) {
            intentData = detectIntentAndEntity(message);

            if (!intentData) {
                const intentPrompt = `
                Analyze the user's message to determine their primary intent and extract key parameters.
                Your response must be ONLY a single JSON object.
                **INTENTS:**
                - "get_defects_list": User wants a list of defects. Examples: "give me the defects for crm", "show undone defects".
                - "get_defects_count": User wants a count of defects. Examples: "how many defects are in crm?".
                - "get_requirements_list": User wants a list of requirements. Examples: "list requirements for project X", "what are the done requirements in sprint 2?".
                - "get_requirements_count": User wants a count of requirements.
                - "get_sprint_info": User asks about a specific sprint. Examples: "what is in sprint 3 for crm?".
                - "get_releases_list": User asks about releases. Examples: "show releases for crm".
                - "get_fat_info": User asks about FAT or SAT or KPIs. Examples: "what is the FAT status for crm?", "show SAT bugs".
                - "get_retrospective_summary": User asks about retrospectives or lessons learned. Examples: "summarize retrospectives for crm".
                - "create_item": User wants to create ONE requirement or defect.
                - "create_multiple_items": User wants to create MULTIPLE requirements or defects at once. Examples: "Add 3 defects: A, B, and C", "Create requirements: login, logout, register".
                - "get_joke": User asks for a joke.
                - "get_weather": User wants to know the weather.
                - "get_nameday": User wants to know who is celebrating.
                - "get_release_date": User asks for the release date.
                - "get_project_summary": User wants a general summary of a project's data.
                - "get_general_info": A general question requiring a vector search.
                - "unknown": Unclear intent.
                
                **PARAMETERS TO EXTRACT:**
                - "project_name": The name of the project.
                - "defect_status_filter": "closed", "undone", "done", "all".
                - "req_status_filter": "done", "todo", "all".
                - "item_type": "requirement" or "defect".
                - "title": Title for single item creation.
                - "sprint": Sprint name or number.
                - "items": Array of objects for multiple items, e.g., [{"type": "defect", "title": "login bug", "sprint": "1"}, {"type": "requirement", "title": "add button"}].
                - "location": City for weather.
                - "timeframe": "today", "tomorrow", "next 7 days".
                - "query": The user's core question.
                
                User message: "${message}"
                `;
                try {
                    const cleanedText = await getHybridCompletion(intentPrompt, true);
                    intentData = JSON.parse(cleanedText);
                } catch (apiError) {
                    intentData = { intent: "get_general_info", parameters: {} };
                }
            }
        } else {
            intentData = { intent: preDeterminedIntent, parameters: {} };
        }
        
        const { intent, parameters } = intentData || {};
        
        switch (intent) {
            case "get_joke": {
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything!",
                    "I told my computer I needed a break, and now it won’t stop sending me Kit-Kat ads.",
                    "Why did the scarecrow win an award? Because he was outstanding in his field!",
                    "What do you call a fake noodle? An Impasta!",
                    "Why did the programmer get stuck in the shower? Because the instructions said “lather, rinse, repeat”!",
                    "Why do programmers prefer dark mode? Because light attracts bugs!"
                ];
                const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
                return res.json({ reply: randomJoke });
            }

            case "get_nameday": {
                const timeframe = (parameters || {}).timeframe || '';
                const isTodayOnly = timeframe.toLowerCase().includes('today') || lowerCaseMessage.includes('today');
                const isTomorrowOnly = timeframe.toLowerCase().includes('tomorrow') || lowerCaseMessage.includes('tomorrow');

                try {
                    const allNamedays = await fetchNamedaysFromWidget();
                    if (!allNamedays || allNamedays.length === 0) {
                        return res.json({ reply: "I couldn't retrieve the nameday list at the moment." });
                    }

                    const dateOptions = { timeZone: 'Europe/Athens', day: 'numeric', month: 'short' };
                    const formatter = new Intl.DateTimeFormat('el-GR', dateOptions);
                    const now = new Date();
                    const tomorrowDate = new Date();
                    tomorrowDate.setDate(now.getDate() + 1);
                    const todayString = formatter.format(now).replace('.', '');
                    const tomorrowString = formatter.format(tomorrowDate).replace('.', '');

                    const todayEntry = allNamedays.find(day => day.date === 'Σήμερα' || day.date.startsWith(todayString));
                    const tomorrowEntry = allNamedays.find(day => day.date.startsWith(tomorrowString));

                    if (isTodayOnly) {
                        if (todayEntry) {
                            return res.json({ reply: todayEntry.names ? `Today (${todayEntry.date}) the namedays are: ${todayEntry.names}.` : `There are no namedays listed for today (${todayEntry.date}).` });
                        }
                        return res.json({ reply: "I couldn't find today's nameday information." });
                    } 
                    
                    if (isTomorrowOnly) {
                        if (tomorrowEntry) {
                            return res.json({ reply: tomorrowEntry.names ? `Tomorrow (${tomorrowEntry.date}) the namedays are: ${tomorrowEntry.names}.` : `There are no namedays listed for tomorrow (${tomorrowEntry.date}).` });
                        }
                        return res.json({ reply: "I couldn't retrieve tomorrow's nameday information." });
                    }

                    const todayIndex = allNamedays.findIndex(day => day.date.startsWith(todayString));
                    const upcomingNamedays = todayIndex !== -1 ? allNamedays.slice(todayIndex, todayIndex + 7) : allNamedays.slice(0, 7);

                    let replyText = "Here are the namedays for the next 7 days:\n\n";
                    upcomingNamedays.forEach(day => {
                        replyText += `${day.date}:\n- ${day.names ? day.names.split(', ').join('\n- ') : 'No namedays listed.'}\n\n`;
                    });
                    return res.json({ reply: replyText });

                } catch (apiError) {
                    return res.json({ reply: "Sorry, I was unable to connect to the nameday service at the moment." });
                }
            }

            case "get_weather": {
                const { location: queryLocation, timeframe } = parameters || {};
                let locationToFetch = queryLocation;
                if (!locationToFetch) {
                    const defaultLocation = await new Promise((resolve, reject) => {
                        dbInstance.get("SELECT value FROM app_settings WHERE key = 'weather_location'", [], (err, row) => err ? reject(err) : resolve(row ? row.value : null));
                    });
                    if (defaultLocation) {
                        locationToFetch = defaultLocation;
                    } else {
                        return res.json({ reply: "I can get the weather for you, but I don't have a default location saved. Which city are you interested in?" });
                    }
                }
                const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
                if (timeframe && (timeframe.toLowerCase().includes('tomorrow') || timeframe.toLowerCase().includes('next day'))) {
                    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(locationToFetch)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
                    try {
                        const weatherResponse = await fetch(url);
                        const weatherData = await weatherResponse.json();
                        if (weatherData.cod !== "200") {
                            return res.json({ reply: `I couldn't find weather data for "${locationToFetch}". Please check the location name.` });
                        }
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const tomorrowDateString = tomorrow.toISOString().split('T')[0];
                        const tomorrowForecast = weatherData.list.find(item => item.dt_txt.startsWith(tomorrowDateString) && item.dt_txt.includes("12:00:00"));
                        if (tomorrowForecast) {
                            const { main, weather } = tomorrowForecast;
                            return res.json({ reply: `Tomorrow in ${weatherData.city.name}, it will be around ${main.temp.toFixed(1)}°C with ${weather[0].description}.` });
                        }
                        return res.json({ reply: `I found ${weatherData.city.name}, but couldn't get a specific forecast for noon tomorrow.` });
                    } catch (apiError) {
                        return res.json({ reply: "Sorry, I was unable to connect to the weather service." });
                    }
                } else {
                    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(locationToFetch)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
                    try {
                        const weatherResponse = await fetch(url);
                        const weatherData = await weatherResponse.json();
                        if (weatherData.cod !== 200) {
                            return res.json({ reply: `I couldn't find weather data for "${locationToFetch}". Please check the location name.` });
                        }
                        const { name, main, weather } = weatherData;
                        return res.json({ reply: `Currently in ${name}, it's ${main.temp.toFixed(1)}°C and feels like ${main.feels_like.toFixed(1)}°C, with ${weather[0].description}.` });
                    } catch (apiError) {
                        return res.json({ reply: "Sorry, I was unable to connect to the weather service." });
                    }
                }
            }

            case "get_release_date": {
                const { item_id } = parameters || {};
                const dummyVector = await getHybridEmbedding("dummy query"); 

                if (item_id) {
                    const searchResult = await table.search(dummyVector) 
                        .where(`title = '${item_id}'`)
                        .limit(1)
                        .toArray();

                    if (searchResult.length > 0) {
                        const item = searchResult[0];
                        if (item.release_name && item.release_date) {
                            return res.json({ reply: `The release for ${item.title} is "${item.release_name}", scheduled for ${item.release_date}.` });
                        } else {
                            return res.json({ reply: `I found ${item.title}, but it doesn't have a release date assigned to it.` });
                        }
                    } else {
                        return res.json({ reply: `I couldn't find any information for the ID "${item_id}".` });
                    }
                } else {
                    const projectToQuery = (parameters || {}).project_name || extractProjectFromMessage(message, intent);

                    if (!projectToQuery) {
                        return res.json({ reply: "Please specify a project for the release date. For example, 'what is the release date for crm-project?'" });
                    }
                    
                    let finalProjectName = null;
                    const match = await findProjectMatch(dbInstance, projectToQuery);

                    if (match.exact || match.autocorrect) {
                        finalProjectName = match.exact || match.autocorrect;
                    } else if (match.suggestion) {
                        return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Did you mean "${match.suggestion}"? Please ask your question again with the correct name.` });
                    } else {
                        return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Please check the name and try again.` });
                    }

                    const allReleases = await table.search(dummyVector)
                        .where(`project = '${finalProjectName}' AND type = 'release'`)
                        .limit(25)
                        .toArray();

                    if (allReleases.length > 0) {
                        allReleases.sort((a, b) => new Date(b.date) - new Date(a.date));
                        const latestRelease = allReleases[0];

                        if (latestRelease && latestRelease.name && latestRelease.date) {
                            const statusInfo = latestRelease.status === 'Active' ? 'current' : 'latest';
                            return res.json({ reply: `The ${statusInfo} release for ${finalProjectName} is "${latestRelease.name}", scheduled for ${latestRelease.date}.` });
                        }
                         return res.json({ reply: `I found release information for ${finalProjectName}, but the data seems to be incomplete.` });
                    }
                    return res.json({ reply: `I couldn't find any release information for the project "${finalProjectName}".` });
                }
            }

            case "create_item": {
                let { item_type, title, sprint, project_name } = parameters || {};

                item_type = item_type || (message.match(/\b(requirement|defect)\b/i) || [])[1]?.toLowerCase();
                title = title || extractTitleFromMessage(message);
                project_name = project_name || extractConversationalProject(message);
                sprint = sprint || (item_type === 'requirement' ? extractSprintFromMessage(message) : null);

                if (!item_type) return res.json({ reply: `Please specify if you want to create a requirement or a defect.` });
                if (!title) return res.json({ reply: `I can create a ${item_type}, but I need a title.` });
                if (!project_name) return res.json({ reply: `Please specify a project for the ${item_type}.` });
                
                let finalProjectName = null;
                const match = await findProjectMatch(dbInstance, project_name);

                if (match.exact || match.autocorrect) {
                    finalProjectName = match.exact || match.autocorrect;
                } else if (match.suggestion) {
                    return res.json({ reply: `I couldn't find a project named "${project_name}". Did you mean "${match.suggestion}"?` });
                } else {
                    return res.json({ reply: `I couldn't find a project named "${project_name}".` });
                }

                if (item_type === 'requirement' && !sprint) {
                    return res.json({ reply: `OK, I can create the requirement "${title}" for project "${finalProjectName}". Which sprint should it be in?` });
                }

                try {
                    const projectId = await getProjectId(finalProjectName);
                    let reply = "";
                    let newItemDetails = {};

                    if (item_type === 'requirement') {
                        const sprintName = `Sprint ${sprint}`;
                        const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, isCurrent, created_at, updated_at) VALUES (?, ?, 'To Do', date('now'), ?, 1, datetime('now'), datetime('now'))`;
                        await new Promise((resolve, reject) => {
                            dbInstance.run(insertSql, [projectId, title, sprintName], function (err) {
                                if (err) return reject(err);
                                dbInstance.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [this.lastID, this.lastID], (err) => err ? reject(err) : resolve());
                            });
                        });
                        reply = `OK, I've created the requirement "${title}" in project "${finalProjectName}" and placed it in ${sprintName}.`;
                        newItemDetails = { project: finalProjectName, sprint: sprintName, title };
                    } else if (item_type === 'defect') {
                        const insertSql = `INSERT INTO defects (project_id, title, area, status, created_date) VALUES (?, ?, 'Imported', 'Assigned to Developer', date('now'))`;
                        await new Promise((resolve, reject) => dbInstance.run(insertSql, [projectId, title], (err) => err ? reject(err) : resolve()));
                        reply = `OK, I've created the defect "${title}" in project "${finalProjectName}".`;
                        newItemDetails = { project: finalProjectName, title };
                    } else {
                        return res.json({ reply: `I can create requirements and defects, but I don't know how to create an item of type "${item_type}" yet.` });
                    }
                    
                    setTimeout(() => {
                        fetch(`http://localhost:${port}/api/chatbot/sync`, { method: 'POST' }).catch(() => {});
                    }, 1000);

                    return res.json({ 
                        reply, 
                        data_changed: true,
                        new_item: newItemDetails 
                    });
                } catch (error) {
                    return res.json({ reply: `I couldn't find a project named "${finalProjectName}".` });
                }
            }

            case "create_multiple_items": {
                const { items, project_name } = parameters || {};
                const proj = project_name || extractConversationalProject(message) || projectContext;
                if (!proj) return res.json({ reply: "Please specify a project for these items." });
                
                const match = await findProjectMatch(dbInstance, proj);
                const finalProjectName = match.exact || match.autocorrect;
                if (!finalProjectName) return res.json({ reply: `I couldn't find a project named "${proj}".` });
                
                const projectId = await getProjectId(finalProjectName);
                let createdCount = 0;
                let replyDetails = [];

                for (const item of (items || [])) {
                    const type = (item.type || "requirement").toLowerCase();
                    const title = item.title;
                    const sprint = item.sprint ? `Sprint ${item.sprint.replace(/sprint/i, '').trim()}` : 'Backlog';

                    if (!title) continue;

                    if (type === 'requirement') {
                        const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, isCurrent, created_at, updated_at) VALUES (?, ?, 'To Do', date('now'), ?, 1, datetime('now'), datetime('now'))`;
                        await new Promise((resolve) => {
                            dbInstance.run(insertSql, [projectId, title, sprint], function () {
                                dbInstance.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [this.lastID, this.lastID], resolve);
                            });
                        });
                        createdCount++;
                        replyDetails.push(`Requirement: "${title}" (${sprint})`);
                    } else if (type === 'defect') {
                        const insertSql = `INSERT INTO defects (project_id, title, area, status, created_date) VALUES (?, ?, 'Imported', 'Assigned to Developer', date('now'))`;
                        await new Promise((resolve) => dbInstance.run(insertSql, [projectId, title], resolve));
                        createdCount++;
                        replyDetails.push(`Defect: "${title}"`);
                    }
                }
                
                if (createdCount > 0) {
                    setTimeout(() => { fetch(`http://localhost:${port}/api/chatbot/sync`, { method: 'POST' }).catch(() => {}); }, 1000);
                    return res.json({ 
                        reply: `I have created ${createdCount} items in "${finalProjectName}":\n- ${replyDetails.join('\n- ')}`,
                        data_changed: true 
                    });
                } else {
                    return res.json({ reply: "I didn't understand the items you wanted to create. Please provide them clearly, for example: 'Add 3 requirements: login, logout, and register'." });
                }
            }

            case "get_project_summary": {
                const projectToQuery = (parameters || {}).project_name || extractProjectFromMessage(message, intent) || projectContext;

                if (!projectToQuery) {
                   return res.json({ reply: "Which project would you like a summary for?" });
                }

                let finalProjectName = null;
                const match = await findProjectMatch(dbInstance, projectToQuery);

                if (match.exact || match.autocorrect) {
                    finalProjectName = match.exact || match.autocorrect;
                } else if (match.suggestion) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Did you mean "${match.suggestion}"?` });
                } else {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}".` });
                }

                const dummyVector = await getHybridEmbedding(finalProjectName);

                const reqs = await table.search(dummyVector)
                    .where(`project = '${finalProjectName}' AND type = 'requirement'`)
                    .limit(50)
                    .toArray();
                
                const defects = await table.search(dummyVector)
                    .where(`project = '${finalProjectName}' AND type = 'defect' AND status != 'Done' AND status != 'Closed'`)
                    .limit(50)
                    .toArray();

                const reqContext = reqs.map(p => JSON.stringify(p)).join("\n");
                const defectContext = defects.map(p => JSON.stringify(p)).join("\n");

                const finalPrompt = `
                You are a project assistant. Based on the following data, provide a concise summary for the user.
                The user wants to know all the data for the project "${finalProjectName}".
                Summarize the requirements and the open defects.

                REQUIREMENTS DATA:
                ${reqContext || "No requirements found."}
                
                OPEN DEFECTS DATA:
                ${defectContext || "No open defects found."}
                
                ---
                Provide a clear, bulleted summary. Do not output <think> tags.
                `;
                
                const finalResultText = await getHybridCompletion(finalPrompt);
                return res.json({ reply: finalResultText });
            }

            case "get_requirements_list":
            case "get_requirements_count": {
                const { project_name, req_status_filter, sprint } = parameters || {};
                const projectToQuery = project_name || extractProjectFromMessage(message, intent) || projectContext;
            
                if (!projectToQuery) {
                    return res.json({ reply: "Please specify a project." });
                }
            
                let finalProjectName = null;
                const match = await findProjectMatch(dbInstance, projectToQuery);

                if (match.exact || match.autocorrect) {
                    finalProjectName = match.exact || match.autocorrect;
                } else if (match.suggestion) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Did you mean "${match.suggestion}"?` });
                } else {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}".` });
                }
            
                let sql = "SELECT requirementUserIdentifier, status, sprint FROM activities WHERE isCurrent = 1 AND project_id = (SELECT id FROM projects WHERE name = ?)";
                const params = [finalProjectName];

                if (req_status_filter && req_status_filter.toLowerCase() === 'done') {
                    sql += " AND status = 'Done'";
                } else if (req_status_filter && req_status_filter.toLowerCase() === 'todo') {
                    sql += " AND status != 'Done'";
                }

                if (sprint) {
                    sql += " AND sprint LIKE ?";
                    params.push(`%${sprint}%`);
                }

                const rows = await new Promise((resolve) => dbInstance.all(sql, params, (err, rows) => resolve(rows || [])));

                if (intent === "get_requirements_count") {
                    return res.json({ reply: `There are ${rows.length} matching requirements in project "${finalProjectName}".` });
                } else {
                    if (rows.length === 0) {
                        return res.json({ reply: `I couldn't find any matching requirements for project "${finalProjectName}".` });
                    }
                    let replyText = `Here are the requirements for "${finalProjectName}":\n\n`;
                    rows.forEach(r => {
                        replyText += `- ${r.requirementUserIdentifier} (Status: ${r.status}, Sprint: ${r.sprint})\n`;
                    });
                    return res.json({ reply: replyText });
                }
            }
            
            case "get_defects_list":
            case "get_defects_count": {
                const { project_name, defect_status_filter } = parameters || {};
                const projectToQuery = project_name || extractProjectFromMessage(message, intent) || projectContext;
            
                if (!projectToQuery) {
                    return res.json({ reply: "Please specify a project. For example, 'show me the defects for crm-project'." });
                }
            
                let finalProjectName = null;
                const match = await findProjectMatch(dbInstance, projectToQuery);

                if (match.exact || match.autocorrect) {
                    finalProjectName = match.exact || match.autocorrect;
                } else if (match.suggestion) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Did you mean "${match.suggestion}"?` });
                } else {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}".` });
                }
            
                let whereClause = `project = '${finalProjectName}' AND type = 'defect'`;
                let replyDescription = "";
            
                let derivedFilter = (defect_status_filter || "").toLowerCase();
                if (!derivedFilter) {
                    if (lowerCaseMessage.includes("undone") || lowerCaseMessage.includes("not done")) derivedFilter = "undone";
                    else if (lowerCaseMessage.includes("done")) derivedFilter = "done";
                    else if (lowerCaseMessage.includes("closed")) derivedFilter = "closed";
                    else if (lowerCaseMessage.includes("all the defects")) derivedFilter = "all_including_closed";
                    else if (lowerCaseMessage.includes("defects")) derivedFilter = "all";
                }
            
                switch(derivedFilter) {
                    case "undone":
                        whereClause += ` AND (status = 'Assigned to Developer' OR status = 'Assigned to Tester')`;
                        replyDescription = "undone";
                        break;
                    case "done":
                        whereClause += ` AND status = 'Done'`;
                        replyDescription = "done";
                        break;
                    case "closed":
                        whereClause += ` AND status = 'Closed'`;
                        replyDescription = "closed";
                        break;
                    case "all":
                        whereClause += ` AND status != 'Done' AND status != 'Closed'`;
                        replyDescription = "in-progress";
                        break;
                    case "all_including_closed":
                        replyDescription = "total (including closed)";
                        break;
                    default:
                        whereClause += ` AND status != 'Done' AND status != 'Closed'`;
                        replyDescription = "in-progress";
                }
            
                const dummyVector = await getHybridEmbedding(finalProjectName);

                if (intent === "get_defects_count") {
                    const results = await table.search(dummyVector)
                        .where(whereClause)
                        .limit(1000)
                        .toArray();
                    const count = results.length;
                    return res.json({ reply: `There are ${count} ${replyDescription} defects in project "${finalProjectName}".` });
            
                } else {
                    const defects = await table.search(dummyVector)
                        .where(whereClause)
                        .limit(100)
                        .toArray();
            
                    if (defects.length === 0) {
                        return res.json({ reply: `I couldn't find any ${replyDescription} defects for project "${finalProjectName}".` });
                    }
            
                    let replyText = `Here are the ${replyDescription} defects for "${finalProjectName}":\n\n`;
                    defects.forEach(defect => {
                        replyText += `- ${defect.title} (Status: ${defect.status})\n`;
                    });
                    return res.json({ reply: replyText });
                }
            }

            case "get_sprint_info": {
                const proj = parameters.project_name || projectContext;
                if (!proj) return res.json({ reply: "Please specify a project to look up sprints." });
                const match = await findProjectMatch(dbInstance, proj);
                const finalProjectName = match.exact || match.autocorrect;
                if (!finalProjectName) return res.json({ reply: `I couldn't find project "${proj}".` });

                const rows = await new Promise((resolve) => dbInstance.all("SELECT DISTINCT sprint FROM activities WHERE project_id = (SELECT id FROM projects WHERE name = ?) AND isCurrent = 1", [finalProjectName], (err, r) => resolve(r || [])));
                
                if (rows.length === 0) return res.json({ reply: `No sprints found for project "${finalProjectName}".` });
                
                const sprints = rows.map(r => r.sprint).filter(Boolean);
                return res.json({ reply: `The following sprints exist in "${finalProjectName}": ${sprints.join(', ')}.` });
            }

            case "get_releases_list": {
                const proj = parameters.project_name || projectContext;
                if (!proj) return res.json({ reply: "Please specify a project to look up releases." });
                const match = await findProjectMatch(dbInstance, proj);
                const finalProjectName = match.exact || match.autocorrect;
                if (!finalProjectName) return res.json({ reply: `I couldn't find project "${proj}".` });

                const rows = await new Promise((resolve) => dbInstance.all("SELECT name, release_date, is_current FROM releases WHERE project_id = (SELECT id FROM projects WHERE name = ?)", [finalProjectName], (err, r) => resolve(r || [])));
                
                if (rows.length === 0) return res.json({ reply: `No releases found for project "${finalProjectName}".` });
                
                let text = `Releases for "${finalProjectName}":\n`;
                rows.forEach(r => {
                    text += `- ${r.name} (Date: ${r.release_date})${r.is_current ? ' [ACTIVE]' : ''}\n`;
                });
                return res.json({ reply: text });
            }

            case "get_fat_info": {
                const proj = parameters.project_name || projectContext;
                if (!proj) return res.json({ reply: "Please specify a project." });
                const match = await findProjectMatch(dbInstance, proj);
                const finalProjectName = match.exact || match.autocorrect;
                if (!finalProjectName) return res.json({ reply: `I couldn't find project "${proj}".` });

                const fatRows = await new Promise((resolve) => dbInstance.all("SELECT * FROM fat_periods WHERE project_id = (SELECT id FROM projects WHERE name = ?) ORDER BY start_date DESC LIMIT 5", [finalProjectName], (err, r) => resolve(r || [])));
                
                if (fatRows.length === 0) return res.json({ reply: `No FAT periods recorded for "${finalProjectName}".` });

                let text = `Recent FAT Periods for "${finalProjectName}":\n`;
                for (const row of fatRows) {
                    text += `- Started: ${row.start_date}, Status: ${row.status}\n`;
                }
                return res.json({ reply: text });
            }

            case "get_retrospective_summary": {
                const proj = parameters.project_name || projectContext;
                if (!proj) return res.json({ reply: "Which project's retrospectives would you like to summarize?" });
                
                const match = await findProjectMatch(dbInstance, proj);
                const finalProjectName = match.exact || match.autocorrect;
                if (!finalProjectName) return res.json({ reply: `I couldn't find project "${proj}".` });

                const rows = await new Promise((resolve) => dbInstance.all("SELECT column_type, description, details FROM retrospective_items WHERE project_id = (SELECT id FROM projects WHERE name = ?)", [finalProjectName], (err, r) => resolve(r || [])));

                if (rows.length === 0) return res.json({ reply: `No retrospective items found for "${finalProjectName}".` });

                const contextData = rows.map(r => `Category: ${r.column_type}, Description: ${r.description}, Details: ${r.details}`).join('\n');
                
                const prompt = `Summarize the following retrospective items for the project "${finalProjectName}". Group them nicely by what went well, what went wrong, and what to improve.\n\n${contextData}\n\nDo not output <think> tags.`;
                const summary = await getHybridCompletion(prompt);
                return res.json({ reply: summary });
            }

            case "get_general_info":
            default: {
                const projectToQuery = (parameters || {}).project_name || extractProjectFromMessage(message, intent) || projectContext;
                let finalProjectName = null;

                if (projectToQuery) {
                    const match = await findProjectMatch(dbInstance, projectToQuery);
                    if (match.exact || match.autocorrect) {
                        finalProjectName = match.exact || match.autocorrect;
                    }
                }

                const safeQuery = (parameters?.query || message).substring(0, 100);
                const queryEmbedding = await getHybridEmbedding(safeQuery);
                
                let queryBuilder = table.search(queryEmbedding).limit(5);
                if (finalProjectName) {
                    queryBuilder = queryBuilder.where(`project = '${finalProjectName}'`);
                }
                const searchResults = await queryBuilder.toArray();

                if (searchResults.length === 0) {
                    return res.json({ reply: "I couldn't find any information related to that." });
                }

                const context = searchResults.map(result => JSON.stringify(result)).join("\n");
                const finalPrompt = `
                You are a helpful project assistant. Based on the following search results, answer the user's question.
                
                SEARCH RESULTS:
                ${context}
                
                User's Question: ${message}
                
                Provide a concise, direct answer. Do not output <think> tags.`;
                
                const finalResultText = await getHybridCompletion(finalPrompt);
                return res.json({ reply: finalResultText });
            }
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
             return res.status(500).json({ error: "Sorry, I had trouble understanding that. Could you please rephrase your request?", details: "Failed to parse LLM response." });
        }
        res.status(500).json({ error: "Sorry, I encountered an error.", details: error.message });
    }
};

module.exports = {
    syncWithQdrant,
    handleChatbotQuery
};