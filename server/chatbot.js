const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { QdrantClient } = require('@qdrant/js-client-rest');

let genAI, qdrantClient, embeddingModel, generativeModel;
const QDRANT_COLLECTION_NAME = "requirements_defects";

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

function initializeClients() {
  if (genAI) {
    return;
  }
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const QDRANT_URL = process.env.QDRANT_URL;
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

  if (!GEMINI_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
    throw new Error("One or more required environment variables are missing.");
  }

  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
  });

  embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
  generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite", safetySettings });

  console.log("Chatbot clients initialized successfully.");
}

const syncWithQdrant = (db) => async (req, res) => {
    try {
        initializeClients();

        try {
            await qdrantClient.getCollection(QDRANT_COLLECTION_NAME);
        } catch (e) {
            console.log(`Collection "${QDRANT_COLLECTION_NAME}" not found, creating it...`);
            await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
                vectors: { size: 768, distance: 'Cosine' },
            });
            console.log("Creating payload index for 'project', 'type', and 'status' fields...");
            await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'project', field_schema: 'keyword', wait: true });
            await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'type', field_schema: 'keyword', wait: true });
            await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'status', field_schema: 'keyword', wait: true });
            console.log("Payload indexes created successfully.");
        }

        console.log("Starting sync with Qdrant...");
        
        const requirementsSql = `SELECT a.id as activityDbId, a.requirementGroupId, a.requirementUserIdentifier, a.status, a.sprint, p.name as project FROM activities a JOIN projects p ON a.project_id = p.id WHERE a.isCurrent = 1`;
        const defectsSql = `SELECT d.id, d.title, d.status, d.description, p.name as project FROM defects d JOIN projects p ON d.project_id = p.id`;
        const notesSql = `SELECT n.id, n.noteDate, n.noteText, p.name as project FROM notes n JOIN projects p ON n.project_id = p.id`;
        const retrospectivesSql = `SELECT r.id, r.column_type, r.description, r.item_date, p.name as project FROM retrospective_items r JOIN projects p ON r.project_id = p.id`;
        const releasesSql = `SELECT r.id, r.name, r.release_date, r.is_current, p.name as project FROM releases r JOIN projects p ON r.project_id = p.id`;
        const linksSql = `SELECT l.defect_id, l.requirement_group_id, d.title as defect_title, a.requirementUserIdentifier as req_title FROM defect_requirement_links l JOIN defects d ON l.defect_id = d.id JOIN activities a ON l.requirement_group_id = a.requirementGroupId WHERE a.isCurrent = 1`;

        const [requirements, defects, notes, retrospectives, releases, links] = await Promise.all([
            new Promise((resolve, reject) => db.all(requirementsSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(defectsSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(notesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(retrospectivesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(releasesSql, [], (err, rows) => err ? reject(err) : resolve(rows))),
            new Promise((resolve, reject) => db.all(linksSql, [], (err, rows) => err ? reject(err) : resolve(rows)))
        ]);

        const defectLinks = new Map();
        const requirementLinks = new Map();
        links.forEach(link => {
            if (!defectLinks.has(link.requirement_group_id)) defectLinks.set(link.requirement_group_id, []);
            defectLinks.get(link.requirement_group_id).push({ id: link.defect_id, title: link.defect_title });

            if (!requirementLinks.has(link.defect_id)) requirementLinks.set(link.defect_id, []);
            requirementLinks.get(link.defect_id).push({ id: link.requirement_group_id, title: link.req_title });
        });

        const documents = [
            ...requirements.map(r => {
                const linkedDefects = defectLinks.get(r.requirementGroupId) || [];
                const linkText = linkedDefects.length > 0 ? ` Linked to ${linkedDefects.length} defect(s): ${linkedDefects.map(d => d.title).join(', ')}.` : '';
                return {
                    id: crypto.createHash('md5').update(`req_${r.requirementGroupId}`).digest('hex'),
                    text: `Type: Requirement. ID: REQ-${r.requirementGroupId}. Title: ${r.requirementUserIdentifier}. Status: ${r.status}. Sprint: ${r.sprint}. Project: ${r.project}.${linkText}`,
                    payload: { type: 'requirement', id: r.requirementGroupId, title: r.requirementUserIdentifier, project: r.project, status: r.status, sprint: r.sprint, linked_defects: linkedDefects, source: 'db' }
                };
            }),
            ...defects.map(d => {
                const linkedReqs = requirementLinks.get(d.id) || [];
                const linkText = linkedReqs.length > 0 ? ` Linked to ${linkedReqs.length} requirement(s): ${linkedReqs.map(r => r.title).join(', ')}.` : '';
                return {
                    id: crypto.createHash('md5').update(`def_${d.id}`).digest('hex'),
                    text: `Type: Defect. ID: DEF-${d.id}. Title: ${d.title}. Status: ${d.status}. Project: ${d.project}. Description: ${d.description || 'N/A'}.${linkText}`,
                    payload: { type: 'defect', id: d.id, title: d.title, project: d.project, status: d.status, linked_requirements: linkedReqs, source: 'db' }
                };
            }),
            ...notes.map(n => ({
                id: crypto.createHash('md5').update(`note_${n.id}`).digest('hex'),
                text: `Type: Note. ID: NOTE-${n.id}. Project: ${n.project}. Date: ${n.noteDate}. Content: ${n.noteText}`,
                payload: { type: 'note', id: n.id, project: n.project, date: n.noteDate, content: n.noteText, source: 'db' }
            })),
            ...retrospectives.map(ri => ({
                id: crypto.createHash('md5').update(`retro_${ri.id}`).digest('hex'),
                text: `Type: Retrospective Item. ID: RETRO-${ri.id}. Project: ${ri.project}. Category: ${ri.column_type}. Date: ${ri.item_date}. Description: ${ri.description}`,
                payload: { type: 'retrospective', id: ri.id, project: ri.project, category: ri.column_type, description: ri.description, source: 'db' }
            })),
            ...releases.map(rel => ({
                id: crypto.createHash('md5').update(`release_${rel.id}`).digest('hex'),
                text: `Type: Release. ID: REL-${rel.id}. Project: ${rel.project}. Name: ${rel.name}. Date: ${rel.release_date}. Status: ${rel.is_current ? 'Active' : 'Inactive'}.`,
                payload: { type: 'release', id: rel.id, project: rel.project, name: rel.name, date: rel.release_date, status: rel.is_current ? 'Active' : 'Inactive', source: 'db' }
            }))
        ]
        .filter(doc => doc.id && !doc.id.includes('_null') && !doc.id.includes('_undefined'));

        console.log(`Found ${documents.length} valid documents to process.`);
        if (documents.length === 0) {
            return res.status(200).json({ message: "No valid documents to sync." });
        }

        const BATCH_SIZE = 100;
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batchDocuments = documents.slice(i, i + BATCH_SIZE);
            const textsToEmbed = batchDocuments.map(d => d.text);
            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: textsToEmbed.map(text => ({ model: "models/embedding-001", content: { parts: [{ text }] } })),
            });
            const embeddings = embeddingResult.embeddings.map(e => e.values);
            await qdrantClient.upsert(QDRANT_COLLECTION_NAME, {
                wait: true,
                points: batchDocuments.map((doc, index) => ({ id: doc.id, vector: embeddings[index], payload: doc.payload })),
            });
        }

        console.log("Sync with Qdrant completed successfully.");
        res.status(200).json({ message: "Sync successful!", synced: documents.length });
    } catch (error) {
        console.error("Qdrant sync failed:", error.data || error.message); 
        res.status(500).json({ error: "Failed to sync data with Qdrant.", details: error.message });
    }
};

const handleChatbotQuery = (db, getProjectId, port) => async (req, res) => {
    try {
        initializeClients();
        const { message, projectContext } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const lowerCaseMessage = message.toLowerCase().trim();
        
        if (['hello', 'hi', 'hey'].includes(lowerCaseMessage)) {
            return res.json({ reply: "Hello! How can I help you with your project data today?" });
        }
        if (lowerCaseMessage.includes('how are you')) {
            return res.json({ reply: "I'm a bot, but I'm ready to assist you!" });
        }
        if (lowerCaseMessage.includes('what day is today') || lowerCaseMessage.includes("what's the date")) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return res.json({ reply: `Today is ${today}.` });
        }

        const intentPrompt = `
        Analyze the user's message to determine their primary intent and extract key parameters.
        Your response must be ONLY a single JSON object.

        **INTENT PRIORITIZATION:**
        1. If the user explicitly asks to "create", "add", "make" an item, the intent MUST be "create_item".
        2. If the user asks for a "joke", the intent MUST be "get_joke".
        3. For other questions, determine the best fit from the list.

        **INTENTS:**
        - "create_item": User wants to create a requirement, defect, note, or retrospective.
        - "get_joke": User asks for a joke.
        - "get_release_date": User is asking for the release date of a project.
        - "get_project_summary": User wants a summary of a project's data (e.g., "show me everything for oipp").
        - "get_general_info": A general question that requires searching the database.
        - "unknown": The intent is unclear.

        **PARAMETERS TO EXTRACT:**
        - "project_name": The name of the project (e.g., "oipp", "crm-project").
        - "item_type": The type of item, must be one of: "requirement", "defect", "note", "retrospective".
        - "title": The specific title for the item to be created. Extract the text that comes after keywords like "title", "called", or "named".
        - "sprint": The name or number of the sprint (e.g., "Sprint 1", "current sprint").
        - "query": The user's core question for general info searches.

        **EXAMPLES:**
        - "create a defect with title login button is broken in oipp" -> {"intent": "create_item", "parameters": {"item_type": "defect", "title": "login button is broken", "project_name": "oipp"}}
        - "create a requirement called new user profile page" -> {"intent": "create_item", "parameters": {"item_type": "requirement", "title": "new user profile page"}}
        - "tell me a joke" -> {"intent": "get_joke", "parameters": {}}

        User message: "${message}"
        `;

        const intentResult = await generativeModel.generateContent(intentPrompt);
        const responseText = intentResult.response.text();
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const intentData = JSON.parse(cleanedText);
        
        const { intent, parameters } = intentData;
        const project = parameters?.project_name || projectContext;

        switch (intent) {
            case "get_joke": {
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything!",
                    "I told my computer I needed a break, and now it won’t stop sending me Kit-Kat ads.",
                    "Why did the scarecrow win an award? Because he was outstanding in his field!",
                    "What do you call a fake noodle? An Impasta!",
                    "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
                    "Did you hear the one about the guy with the broken hearing aid? Neither did he.",
                    "What do you call a fly without wings? A walk.",
                    "Why did the computer go to therapy? It had too many bytes of emotional baggage.",
                    "Why do programmers prefer dark mode? Because light attracts bugs!",
                    "Why did the developer go broke? Because he used up all his cache.",
                    "What did celery say when he broke up with his girlfriend? She wasn't right for me, so I really don't carrot all.",
                    "Why do programmers hate nature? It has too many bugs.",
                    "Why did the computer keep freezing? It left its Windows open!",
                    "Why did the developer go broke? Because he lost his domain in a bet.",
                    "Why do programmers prefer iOS development? Because they can't handle Android's Java.",
                    "How many optometrists does it take to change a light bulb? 1 or 2? 1... or 2?"
                ];
                const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
                return res.json({ reply: randomJoke });
            }

            case "create_item": {
                const { item_type, title, sprint } = parameters || {};

                if (!title) {
                    return res.json({ reply: "I can create items, but I need a title. What would you like to call it?" });
                }
                
                if (!item_type) {
                    return res.json({ reply: `I can create a requirement, defect, note, or retrospective. Please specify what type of item you want to create for '${title}'.` });
                }

                if (!project) {
                    return res.json({ reply: `OK, I can create the ${item_type} "${title}". Which project should I add it to?` });
                }

                if (item_type === 'requirement' && !sprint) {
                    return res.json({ reply: `OK, I can create the requirement "${title}" for project "${project}". Which sprint should it be in?` });
                }

                try {
                    const projectId = await getProjectId(project);
                    let reply = "";
                    let newItemDetails = {}; // --- NEW ---

                    if (item_type === 'requirement') {
                        const sprintName = `Sprint ${sprint}`;
                        const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, isCurrent, created_at, updated_at) VALUES (?, ?, 'To Do', date('now'), ?, 1, datetime('now'), datetime('now'))`;
                        await new Promise((resolve, reject) => {
                            db.run(insertSql, [projectId, title, sprintName], function (err) {
                                if (err) return reject(err);
                                db.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [this.lastID, this.lastID], (err) => err ? reject(err) : resolve());
                            });
                        });
                        reply = `OK, I've created the requirement "${title}" in project "${project}" and placed it in ${sprintName}.`;
                        // --- NEW: Populate details for the frontend ---
                        newItemDetails = { project, sprint: sprintName, title };
                    } else if (item_type === 'defect') {
                        const insertSql = `INSERT INTO defects (project_id, title, area, status, created_date) VALUES (?, ?, 'Imported', 'Assigned to Developer', date('now'))`;
                        await new Promise((resolve, reject) => db.run(insertSql, [projectId, title], (err) => err ? reject(err) : resolve()));
                        reply = `OK, I've created the defect "${title}" in project "${project}".`;
                        // --- NEW: Populate details for the frontend ---
                        newItemDetails = { project, title };
                    } else {
                        return res.json({ reply: `I can create requirements and defects, but I don't know how to create an item of type "${item_type}" yet.` });
                    }
                    
                    setTimeout(() => {
                        fetch(`http://localhost:${port}/api/chatbot/sync`, { method: 'POST' }).catch(err => console.error("Self-sync failed:", err));
                    }, 1000);

                    // --- MODIFIED: Return details of the new item ---
                    return res.json({ 
                        reply, 
                        data_changed: true,
                        new_item: newItemDetails 
                    });
                    // --- END MODIFIED ---

                } catch (error) {
                    return res.json({ reply: `I couldn't find a project named "${project}". Please check the name and try again.` });
                }
            }

            case "get_release_date": {
                if (!project) {
                    return res.json({ reply: "Which project's release date are you asking about?" });
                }
                const scrollResult = await qdrantClient.scroll(
                    QDRANT_COLLECTION_NAME,
                    {
                        limit: 1,
                        with_payload: true,
                        filter: {
                            must: [
                                { key: "project", match: { value: project } },
                                { key: "type", match: { value: "release" } },
                                { key: "status", match: { value: "Active" } }
                            ]
                        }
                    }
                );

                if (scrollResult.points && scrollResult.points.length > 0) {
                    const release = scrollResult.points[0].payload;
                    return res.json({ reply: `The current release for ${project} is "${release.name}", scheduled for ${release.date}.` });
                } else {
                    return res.json({ reply: `I couldn't find an active release date for the project "${project}".` });
                }
            }

            case "get_project_summary": {
                if (!project) {
                    return res.json({ reply: "Which project would you like a summary for?" });
                }
                const [reqs, defects] = await Promise.all([
                    qdrantClient.scroll({
                        collection: QDRANT_COLLECTION_NAME,
                        filter: { must: [{ key: "project", match: { value: project } }, { key: "type", match: { value: "requirement" } }] },
                        limit: 50, with_payload: true
                    }),
                    qdrantClient.scroll({
                        collection: QDRANT_COLLECTION_NAME,
                        filter: { 
                            must: [{ key: "project", match: { value: project } }, { key: "type", match: { value: "defect" } }],
                            must_not: [{ key: "status", match: { any: ["Done", "Closed"] } }]
                        },
                        limit: 50, with_payload: true
                    })
                ]);

                const reqContext = reqs.points.map(p => JSON.stringify(p.payload)).join("\n");
                const defectContext = defects.points.map(p => JSON.stringify(p.payload)).join("\n");

                const finalPrompt = `
                You are a project assistant. Based on the following data, provide a concise summary for the user.
                The user wants to know all the data for the project "${project}".
                Summarize the requirements and the open defects.

                REQUIREMENTS DATA:
                ${reqContext || "No requirements found."}
                
                OPEN DEFECTS DATA:
                ${defectContext || "No open defects found."}
                
                ---
                Provide a clear, bulleted summary.
                `;
                
                const finalResult = await generativeModel.generateContent(finalPrompt);
                return res.json({ reply: finalResult.response.text() });
            }
            
            case "get_general_info":
            default: {
                const queryEmbedding = await embeddingModel.embedContent(parameters?.query || message);
                const searchResults = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
                    vector: queryEmbedding.embedding.values,
                    limit: 5,
                    with_payload: true,
                    ...(project && { filter: { must: [{ key: "project", match: { value: project } }] } })
                });

                if (searchResults.length === 0) {
                    return res.json({ reply: "I couldn't find any information related to that." });
                }

                const context = searchResults.map(result => JSON.stringify(result.payload)).join("\n");
                const finalPrompt = `You are a helpful project assistant. Based on the following search results, answer the user's question.
                
                SEARCH RESULTS:
                ${context}
                
                User's Question: ${message}
                
                Provide a concise, direct answer.`;
                
                const finalResult = await generativeModel.generateContent(finalPrompt);
                return res.json({ reply: finalResult.response.text() });
            }
        }
    } catch (error) {
        console.error("Chatbot error:", error);
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