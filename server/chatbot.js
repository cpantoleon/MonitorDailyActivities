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
  generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings }); 

  console.log("Chatbot clients initialized successfully.");
}

const syncWithQdrant = (db) => async (req, res) => {
    try {
        initializeClients();

        try {
            await qdrantClient.getCollection(QDRANT_COLLECTION_NAME);
            console.log(`Collection "${QDRANT_COLLECTION_NAME}" already exists.`);
        } catch (e) {
            console.log(`Collection "${QDRANT_COLLECTION_NAME}" not found, creating it...`);
            await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
                vectors: { size: 768, distance: 'Cosine' },
            });
            console.log("Collection created successfully.");
            
            console.log("Creating payload index for 'project' field...");
            await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, {
                field_name: 'project',
                field_schema: 'keyword',
                wait: true,
            });
            console.log("Payload index created successfully.");
        }

        console.log("Starting sync with Qdrant...");
        
        const requirementsSql = `SELECT a.requirementGroupId, a.requirementUserIdentifier, a.status, a.sprint, p.name as project FROM activities a JOIN projects p ON a.project_id = p.id WHERE a.isCurrent = 1`;
        const defectsSql = `SELECT d.id, d.title, d.status, d.description, p.name as project FROM defects d JOIN projects p ON d.project_id = p.id`;
        const notesSql = `SELECT n.id, n.noteDate, n.noteText, p.name as project FROM notes n JOIN projects p ON n.project_id = p.id`;
        const retrospectivesSql = `SELECT r.id, r.column_type, r.description, r.item_date, p.name as project FROM retrospective_items r JOIN projects p ON r.project_id = p.id`;
        const releasesSql = `SELECT r.id, r.name, r.release_date, r.is_current, p.name as project FROM releases r JOIN projects p ON r.project_id = p.id`;

        const requirements = await new Promise((resolve, reject) => db.all(requirementsSql, [], (err, rows) => err ? reject(err) : resolve(rows)));
        const defects = await new Promise((resolve, reject) => db.all(defectsSql, [], (err, rows) => err ? reject(err) : resolve(rows)));
        const notes = await new Promise((resolve, reject) => db.all(notesSql, [], (err, rows) => err ? reject(err) : resolve(rows)));
        const retrospectives = await new Promise((resolve, reject) => db.all(retrospectivesSql, [], (err, rows) => err ? reject(err) : resolve(rows)));
        const releases = await new Promise((resolve, reject) => db.all(releasesSql, [], (err, rows) => err ? reject(err) : resolve(rows)));

        const documents = [
            ...requirements.map(r => ({
                id: crypto.createHash('md5').update(`req_${r.requirementGroupId}`).digest('hex'),
                text: `Type: Requirement. Title: ${r.requirementUserIdentifier}. Status: ${r.status}. Sprint: ${r.sprint}. Project: ${r.project}.`,
                payload: { type: 'requirement', title: r.requirementUserIdentifier, project: r.project, status: r.status, source: 'db', original_id: `req_${r.requirementGroupId}` }
            })),
            ...defects.map(d => ({
                id: crypto.createHash('md5').update(`def_${d.id}`).digest('hex'),
                text: `Type: Defect. Title: ${d.title}. Status: ${d.status}. Project: ${d.project}. Description: ${d.description || 'N/A'}`,
                payload: { type: 'defect', title: d.title, project: d.project, status: d.status, source: 'db', original_id: `def_${d.id}` }
            })),
            ...notes.map(n => ({
                id: crypto.createHash('md5').update(`note_${n.id}`).digest('hex'),
                text: `Type: Note. Project: ${n.project}. Date: ${n.noteDate}. Content: ${n.noteText}`,
                payload: { type: 'note', project: n.project, date: n.noteDate, content: n.noteText, source: 'db', original_id: `note_${n.id}` }
            })),
            ...retrospectives.map(ri => ({
                id: crypto.createHash('md5').update(`retro_${ri.id}`).digest('hex'),
                text: `Type: Retrospective Item. Project: ${ri.project}. Category: ${ri.column_type}. Date: ${ri.item_date}. Description: ${ri.description}`,
                payload: { type: 'retrospective', project: ri.project, category: ri.column_type, description: ri.description, source: 'db', original_id: `retro_${ri.id}` }
            })),
            ...releases.map(rel => ({
                id: crypto.createHash('md5').update(`release_${rel.id}`).digest('hex'),
                text: `Type: Release. Project: ${rel.project}. Name: ${rel.name}. Date: ${rel.release_date}. Status: ${rel.is_current ? 'Active' : 'Inactive'}.`,
                payload: { type: 'release', project: rel.project, name: rel.name, date: rel.release_date, status: rel.is_current ? 'Active' : 'Inactive', source: 'db', original_id: `release_${rel.id}` }
            }))
        ]
        .filter(doc => doc.id && !doc.id.includes('_null') && !doc.id.includes('_undefined'));

        console.log(`Found ${documents.length} valid documents to process.`);
        if (documents.length === 0) {
            return res.status(200).json({ message: "No valid documents to sync." });
        }

        const BATCH_SIZE = 100;
        let totalSynced = 0;
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batchDocuments = documents.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}... (items ${i + 1} to ${i + batchDocuments.length})`);
            const textsToEmbed = batchDocuments.map(d => d.text);
            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: textsToEmbed.map(text => ({ model: "models/embedding-001", content: { parts: [{ text }] } })),
            });
            const embeddings = embeddingResult.embeddings.map(e => e.values);
            await qdrantClient.upsert(QDRANT_COLLECTION_NAME, {
                wait: true,
                points: batchDocuments.map((doc, index) => ({ id: doc.id, vector: embeddings[index], payload: doc.payload })),
            });
            totalSynced += batchDocuments.length;
        }

        console.log("Sync with Qdrant completed successfully.");
        res.status(200).json({ message: "Sync successful!", synced: totalSynced });
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
        const greetings = ['hello', 'hi', 'hey', 'how are you'];
        if (greetings.includes(lowerCaseMessage)) {
            return res.json({ reply: "Hello! How can I help you with your project data today?" });
        }

        const intentPrompt = `Analyze the user's message to determine the intent and extract parameters. The possible intents are: "get_information", "create_requirement", "unknown". User message: "${message}" Respond with ONLY a JSON object with "intent" and "parameters" keys. For "create_requirement", parameters should include a "title". For "get_information", parameters should include the "query".`;

        const intentResult = await generativeModel.generateContent(intentPrompt);
        const responseText = intentResult.response.text();
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const intentData = JSON.parse(cleanedText);

        switch (intentData.intent) {
            case "get_information": {
                const queryEmbedding = await embeddingModel.embedContent(intentData.parameters.query);
                const searchResults = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
                    vector: queryEmbedding.embedding.values,
                    limit: 5,
                    with_payload: true,
                });

                if (searchResults.length === 0) {
                    return res.json({ reply: "I couldn't find any information related to that." });
                }

                const context = searchResults
                    .map(result => JSON.stringify(result.payload))
                    .join("\n");

                const finalPrompt = `You are a helpful project assistant. Based on the following search results from the database, answer the user's question.

                SEARCH RESULTS:
                ${context}
                
                ---
                User's Question: ${message}
                
                INSTRUCTIONS:
                - If the user asks for a release date, look for a result with "type": "release" and "status": "Active" for the relevant project. State the date clearly.
                - If you don't find any release information for the project, or if none of the releases are "Active", state that there is no active release scheduled for that project.
                - Provide a concise, direct answer.`;
                
                const finalResult = await generativeModel.generateContent(finalPrompt);
                return res.json({ reply: finalResult.response.text() });
            }
            case "create_requirement": {
                if (!projectContext) {
                    return res.json({ reply: "Please select a project from the dropdown first." });
                }
                const payload = {
                    project: projectContext,
                    requirementName: intentData.parameters.title,
                    status: 'To Do',
                    sprint: 'Sprint 1',
                    statusDate: new Date().toISOString().split('T')[0]
                };
                const projectId = await getProjectId(payload.project);
                const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, isCurrent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`;
                await new Promise((resolve, reject) => {
                    db.run(insertSql, [projectId, payload.requirementName, payload.status, payload.statusDate, payload.sprint], function (err) {
                        if (err) return reject(err);
                        const newId = this.lastID;
                        db.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [newId, newId], (err) => {
                            if (err) reject(err); else resolve({ id: newId });
                        });
                    });
                });
                
                setTimeout(() => {
                    fetch(`http://localhost:${port}/api/chatbot/sync`, { method: 'POST' }).catch(err => console.error("Self-sync failed:", err));
                }, 1000);

                return res.json({ reply: `OK, I've created the requirement "${payload.requirementName}" in project "${payload.project}".` });
            }
            default:
                return res.json({ reply: "I can answer questions or create new requirements. Try 'create a requirement for...'" });
        }
    } catch (error) {
        console.error("Chatbot error:", error);
        res.status(500).json({ error: "Sorry, I encountered an error.", details: error.message });
    }
};

module.exports = {
    syncWithQdrant,
    handleChatbotQuery
};