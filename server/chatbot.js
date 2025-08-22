const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const cheerio = require('cheerio');

let genAI, qdrantClient, embeddingModel, generativeModel;
const QDRANT_COLLECTION_NAME = "requirements_defects";

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
            regex = /(?:defects|counter of(?: the)? defects|number of(?: the)? defects|undone defects|not done defects|done defects|closed defects)(?:.*?)(?: for| in| have| of)\s+(?:the\s+)?([a-zA-Z0-9\s-]+)(?:\?|$)/i;
            break;
        case 'create_item':
            regex = /(?:for|in)\s+project\s+([a-zA-Z0-9-]+)/i;
            break;
        default:
            return null;
    }
    const match = message.match(regex);
    if (!match && (intent === 'get_defects_list' || intent === 'get_defects_count')) {
        const alternativeRegex = /defects\s+([a-zA-Z0-9-]+)/i;
        const altMatch = message.match(alternativeRegex);
        return altMatch ? altMatch[1].trim() : null;
    }
    return match ? match[1].trim() : null;
}

function extractTitleFromMessage(message) {
    const match = message.match(/(?:titled|title|with title)\s+(['"]?)(.*?)\1(?: for| in| on| with|$)/i);
    return match ? match[2].trim() : null;
}

function extractSprintFromMessage(message) {
    const match = message.match(/(?:sprint)\s+(\d+)/i);
    return match ? match[1].trim() : null;
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
        console.error("Error scraping nameday widget:", error);
        return [];
    }
}

function initializeClients() {
  if (genAI) {
    return;
  }
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const QDRANT_URL = process.env.QDRANT_URL;
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

  if (!GEMINI_API_KEY || !QDRANT_URL || !QDRANT_API_KEY || !OPENWEATHER_API_KEY) {
    throw new Error("One or more required environment variables are missing (GEMINI_API_KEY, QDRANT_URL, QDRANT_API_KEY, OPENWEATHER_API_KEY).");
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
            await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
                vectors: { size: 768, distance: 'Cosine' },
            });
        }
        await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'project', field_schema: 'keyword', wait: true });
        await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'type', field_schema: 'keyword', wait: true });
        await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { field_name: 'status', field_schema: 'keyword', wait: true });
        await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, { 
            field_name: 'title', 
            field_schema: 'text',
            tokenizer: 'word',
            min_token_len: 2,
            lowercase: true,
            wait: true 
        });
        
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
                let releaseText = '';
                if (r.release_name && r.release_date) {
                    releaseText = ` Release: ${r.release_name} (Date: ${r.release_date}).`;
                }
                return {
                    id: crypto.createHash('md5').update(`req_${r.requirementGroupId}`).digest('hex'),
                    text: `Type: Requirement. ID: ${r.requirementUserIdentifier}. Status: ${r.status}. Sprint: ${r.sprint}. Project: ${r.project}.${releaseText}${linkText}`,
                    payload: { type: 'requirement', id: r.requirementGroupId, title: r.requirementUserIdentifier, project: r.project, status: r.status, sprint: r.sprint, release_name: r.release_name || null, release_date: r.release_date || null, linked_defects: linkedDefects, source: 'db' }
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
        ].filter(doc => doc.id && !doc.id.includes('_null') && !doc.id.includes('_undefined'));

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
        res.status(200).json({ message: "Sync successful!", synced: documents.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to sync data with Qdrant.", details: error.message });
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
        return { exact: bestMatch, suggestion: bestMatch };
    }
    
    if (bestMatch && minDistance > 1) {
        return { noMatch: true, suggestion: bestMatch };
    }

    return { noMatch: true };
};

const handleChatbotQuery = (db, getProjectId, port) => async (req, res) => {
    try {
        initializeClients();
        const { message, projectContext } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const lowerCaseMessage = message.toLowerCase().trim();
        
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

        if (lowerCaseMessage.includes('release') && !lowerCaseMessage.includes('date')) {
            return res.json({ reply: "Your request is a bit unclear. If you're asking for a release date, please try asking again using the words 'release date'." });
        }
        if (lowerCaseMessage.includes('date') && !lowerCaseMessage.includes('release date') && !lowerCaseMessage.includes('today') && !lowerCaseMessage.includes('nameday')) {
            return res.json({ reply: "Your request is a bit unclear. If you're asking for a release date, please try again using the phrase 'release date for [project name]'." });
        }

        let intentData = {};

        if (!preDeterminedIntent) {
            const intentPrompt = `
            Analyze the user's message to determine their primary intent and extract key parameters.
            Your response must be ONLY a single JSON object.
            **INTENTS:**
            - "get_defects_list": User wants a list of defects. Examples: "give me the defects for crm-project", "show me the undone defects for crm", "list all the closed defects".
            - "get_defects_count": User wants a count of defects. Examples: "how many defects are in crm-project?", "count the done defects for crm-project".
            - "create_item": User wants to create an item. Examples: "create a requirement titled 'New Login Page' for project crm-project in sprint 7", "add a defect with title 'API timeout' in the bod project", "for project bod create requirement with title my-new-feature in sprint 1", "create for project crm-project a requirement with title 'User Dashboard' for sprint 8".
            - "get_joke": User asks for a joke.
            - "get_weather": User wants to know the current or future weather.
            - "get_nameday": User wants to know who is celebrating their nameday (e.g., "eortologio", "nameday today").
            - "get_release_date": User is asking for the release date of a project or a specific item.
            - "get_project_summary": User wants a summary of a project's data (e.g., "show me everything for crm-project").
            - "get_general_info": A general question that requires searching the database that does not match any other intent.
            - "unknown": The intent is unclear.
            **PARAMETERS TO EXTRACT:**
            - "project_name": The name of the project (e.g., "crm-project", "bod").
            - "defect_status_filter": The status filter for defect queries. Infer from words like "undone", "not done", "done", "closed". If the user just asks for "defects", the filter is "all". If they ask for "undone" or "not done", the filter is "undone".
            - "item_type": The type of item, must be one of: "requirement", "defect".
            - "item_id": The specific ID of an item (e.g., "REQ-GAS-030", "DEF-123").
            - "title": The title for an item to be created.
            - "sprint": The name or number of the sprint.
            - "location": The city/place for the weather forecast (e.g., "Athens", "London").
            - "timeframe": When the user wants something for (e.g., "today", "tomorrow", "next 7 days").
            - "query": The user's core question for general info searches.
            User message: "${message}"
            `;
            try {
                // --- START: THE CRITICAL FIX ---
                // Start a new, stateless chat session for every intent detection call.
                // This prevents the AI from remembering previous turns and returning non-JSON responses.
                const chat = generativeModel.startChat({ history: [] });
                const result = await chat.sendMessage(intentPrompt);
                const responseText = result.response.text();
                // --- END: THE CRITICAL FIX ---

                const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                intentData = JSON.parse(cleanedText);
            } catch (apiError) {
                console.error("Error calling Google Generative AI:", apiError);
                if (apiError.status === 400) {
                    return res.json({ reply: "I'm sorry, I can't process that request. API key not valid. Please pass a valid API key." });
                }
                if (apiError.status === 429) {
                    return res.json({ reply: "The AI service is currently busy. Please wait a moment and try your request again." });
                }
                if (apiError.status === 503) {
                    return res.json({ reply: "The AI service is temporarily unavailable. Please try again in a moment." });
                }
                return res.json({ reply: "Sorry, I encountered an issue with an external service. Please try again." });
            }
        } else {
            intentData = { intent: preDeterminedIntent, parameters: {} };
        }
        
        const { intent, parameters } = intentData;
        
        switch (intent) {
            case "get_joke": {
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything!",
                    "I told my computer I needed a break, and now it won’t stop sending me Kit-Kat ads.",
                    "Why did the scarecrow win an award? Because he was outstanding in his field!",
                    "What do you call a fake noodle? An Impasta!",
                    "Why did the programmer get stuck in the shower? Because the instructions said “lather, rinse, repeat”!",
                    "Why do programmers prefer dark mode? Because light attracts bugs!",
                    "Why do Java developers wear glasses? Because they don't see sharp.",
                    "Why was the developer unhappy at their job? They wanted arrays.",
                    "Why do Python programmers prefer using snakes? Because they can’t find a good ‘list’!",
                    "Why did the web developer go broke? Because they used up all their cache.",
                    "Why did the developer go broke? Because they lost their domain in a bet.",
                    "Why do Java programmers wear glasses? Because they don’t C#!",
                    "Why did the developer go broke? Because they used up all their cache.",
                    "What kind of shoes to frogs wear? Open-toad sandals.",
                    "I just built an ATM that only gives out coins. I don’t know why no one’s thought of it before: it just makes cents!",
                    "Did I ever tell you about the time I went mushroom foraging? It’s a story with a morel at the end.",
                    "What happened when two slices of bread went on a date? It was loaf at first sight.",
                    "I had a quiet game of tennis today. There was no racket.",
                    "Why did the electric car feel discriminated against? Because the rules weren't current.",
                    "Watch what you say around the egg whites. They can't take a yolk.",
                    "I got a new pen that can write under water. It can write other words too.",
                    "My boss said “dress for the job you want, not for the job you have.” So I went in as Batman.",
                    "What do you call a sheep who can sing and dance? Lady Ba Ba.",
                    "Why can't dinosaurs clap their hands? Because they're extinct.",
                    "Where do rainbows go when they've been bad? To prism, so they have time to reflect on what they've done.",
                    "What did the skillet eat on its birthday? Pan-cakes.",
                    "How is my wallet like an onion? Every time I open it, I cry.",
                    "What do you call a dog who meditates? Aware wolf.",
                    "What kind of fish do penguins catch at night? Star fish.",
                    "Can a frog jump higher than a house? Of course, a house can't jump at all!",
                    "Why was the JavaScript developer sad? Because he didn't Node how to Express himself."
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
                            if (todayEntry.names) {
                                return res.json({ reply: `Today (${todayEntry.date}) the namedays are: ${todayEntry.names}.` });
                            } else {
                                return res.json({ reply: `There are no namedays listed for today (${todayEntry.date}).` });
                            }
                        } else {
                            return res.json({ reply: "I couldn't find today's nameday information in the calendar." });
                        }
                    } 
                    
                    if (isTomorrowOnly) {
                        if (tomorrowEntry) {
                             if (tomorrowEntry.names) {
                                return res.json({ reply: `Tomorrow (${tomorrowEntry.date}) the namedays are: ${tomorrowEntry.names}.` });
                            } else {
                                return res.json({ reply: `There are no namedays listed for tomorrow (${tomorrowEntry.date}).` });
                            }
                        } else {
                            return res.json({ reply: "I couldn't retrieve tomorrow's nameday information." });
                        }
                    }

                    // Logic for the 7-day list
                    const todayIndex = allNamedays.findIndex(day => day.date.startsWith(todayString));
                    
                    const upcomingNamedays = todayIndex !== -1
                        ? allNamedays.slice(todayIndex, todayIndex + 7)
                        : allNamedays.slice(0, 7); // Fallback if today isn't found

                    let replyText = "Here are the namedays for the next 7 days:\n\n";
                    upcomingNamedays.forEach(day => {
                        if (day.names) {
                            const namesArray = day.names.split(', ');
                            replyText += `${day.date}:\n- ${namesArray.join('\n- ')}\n\n`;
                        } else {
                            replyText += `${day.date}:\n- No namedays listed.\n\n`;
                        }
                    });
                    return res.json({ reply: replyText });

                } catch (apiError) {
                    console.error("Eortologio Scraping Error:", apiError);
                    return res.json({ reply: "Sorry, I was unable to connect to the nameday service at the moment." });
                }
            }

            case "get_weather": {
                const { location: queryLocation, timeframe } = parameters || {};
                let locationToFetch = queryLocation;
                if (!locationToFetch) {
                    const defaultLocation = await new Promise((resolve, reject) => {
                        db.get("SELECT value FROM app_settings WHERE key = 'weather_location'", [], (err, row) => err ? reject(err) : resolve(row ? row.value : null));
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
                            const reply = `Tomorrow in ${weatherData.city.name}, it will be around ${main.temp.toFixed(1)}°C with ${weather[0].description}.`;
                            return res.json({ reply });
                        } else {
                            return res.json({ reply: `I found ${weatherData.city.name}, but couldn't get a specific forecast for noon tomorrow.` });
                        }
                    } catch (apiError) {
                        console.error("Weather API Error:", apiError);
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
                        const reply = `Currently in ${name}, it's ${main.temp.toFixed(1)}°C and feels like ${main.feels_like.toFixed(1)}°C. The sky has ${weather[0].description}.`;
                        return res.json({ reply });
                    } catch (apiError) {
                        console.error("Weather API Error:", apiError);
                        return res.json({ reply: "Sorry, I was unable to connect to the weather service." });
                    }
                }
            }

            case "get_release_date": {
                const { item_id } = parameters || {};

                if (item_id) {
                    const itemTypePrefix = item_id.split('-')[0].toUpperCase();
                    let qdrantType;
                    if (itemTypePrefix === 'REQ') qdrantType = 'requirement';
                    else return res.json({ reply: `I can only find release dates for requirements, not for items like "${item_id}".` });
                    const searchResult = await qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
                        limit: 1, with_payload: true,
                        filter: { must: [{ key: "type", match: { value: qdrantType } }, { key: "title", match: { text: item_id } }] }
                    });
                    if (searchResult.points && searchResult.points.length > 0) {
                        const item = searchResult.points[0].payload;
                        if (item.release_name && item.release_date) {
                            return res.json({ reply: `The release for ${item.title} is "${item.release_name}", scheduled for ${item.release_date}.` });
                        } else {
                            return res.json({ reply: `I found ${item.title}, but it doesn't have a release date assigned to it.` });
                        }
                    } else {
                        return res.json({ reply: `I couldn't find any information for the ID "${item_id}".` });
                    }
                } else {
                    const manualProjectName = extractProjectFromMessage(message, intent);
                    const projectToQuery = manualProjectName || (parameters || {}).project_name;

                    if (!projectToQuery) {
                        return res.json({ reply: "Please specify a project for the release date. For example, 'what is the release date for crm-project?'" });
                    }
                    
                    const match = await findProjectMatch(db, projectToQuery);

                    if (match.exact) {
                        const exactProjectName = match.exact;
                        const scrollResult = await qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
                            limit: 1, with_payload: true,
                            filter: { must: [{ key: "project", match: { value: exactProjectName } }, { key: "type", match: { value: "release" } }, { key: "status", match: { value: "Active" } }] }
                        });
                        if (scrollResult.points && scrollResult.points.length > 0) {
                            const release = scrollResult.points[0].payload;
                            if (release && release.name && release.date) {
                                return res.json({ reply: `The current release for ${exactProjectName} is "${release.name}", scheduled for ${release.date}.` });
                            } else if (release && release.name) {
                                return res.json({ reply: `I found the release "${release.name}" for project ${exactProjectName}, but it does not have a date assigned.` });
                            } else {
                                return res.json({ reply: `I found release information for ${exactProjectName}, but the data seems to be incomplete.` });
                            }
                        } else {
                            return res.json({ reply: `I couldn't find an active release date for the project "${exactProjectName}".` });
                        }
                    } else if (match.suggestion) {
                        return res.json({ reply: `I couldn't find a project named "${projectToQuery}". If you meant "${match.suggestion}", please ask your question again with the correct name.` });
                    } else {
                        return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Please check the name and try again.` });
                    }
                }
            }

            case "create_item": {
                let { item_type, title, sprint } = parameters || {};
                const manualProjectName = extractProjectFromMessage(message, intent);
                const projectToQuery = manualProjectName || (parameters || {}).project_name;

                if (!item_type) {
                    if (lowerCaseMessage.includes('requirement')) item_type = 'requirement';
                    else if (lowerCaseMessage.includes('defect')) item_type = 'defect';
                }
                if (!title) {
                    title = extractTitleFromMessage(message);
                }
                if (item_type === 'requirement' && !sprint) {
                    sprint = extractSprintFromMessage(message);
                }

                if (!item_type) {
                    return res.json({ reply: `Please specify if you want to create a requirement or a defect. For example: 'create a **requirement** titled "My New Feature"'` });
                }
                if (!title) {
                    return res.json({ reply: `I can create a ${item_type}, but I need a title. For example: 'create a ${item_type} titled "My New Feature"'` });
                }
                if (!projectToQuery) {
                    return res.json({ reply: `Please specify a project for the ${item_type}. For example: 'create a ${item_type} titled "${title}" for project crm-project'` });
                }
                
                const match = await findProjectMatch(db, projectToQuery);
                let finalProjectName;

                if (match.exact) {
                    finalProjectName = match.exact;
                } else if (match.suggestion && !match.noMatch) {
                    finalProjectName = match.suggestion;
                } else {
                    if (match.noMatch && match.suggestion) {
                         return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Did you mean "${match.suggestion}"? Please ask your question again with the correct name.` });
                    }
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Please check the name and try again.` });
                }

                if (item_type === 'requirement' && !sprint) {
                    return res.json({ reply: `OK, I can create the requirement "${title}" for project "${finalProjectName}". Which sprint should it be in? For example: '...in sprint 7'.` });
                }

                try {
                    const projectId = await getProjectId(finalProjectName);
                    let reply = "";
                    let newItemDetails = {};

                    if (item_type === 'requirement') {
                        const sprintName = `Sprint ${sprint}`;
                        const insertSql = `INSERT INTO activities (project_id, requirementUserIdentifier, status, statusDate, sprint, isCurrent, created_at, updated_at) VALUES (?, ?, 'To Do', date('now'), ?, 1, datetime('now'), datetime('now'))`;
                        await new Promise((resolve, reject) => {
                            db.run(insertSql, [projectId, title, sprintName], function (err) {
                                if (err) return reject(err);
                                db.run(`UPDATE activities SET requirementGroupId = ? WHERE id = ?`, [this.lastID, this.lastID], (err) => err ? reject(err) : resolve());
                            });
                        });
                        reply = `OK, I've created the requirement "${title}" in project "${finalProjectName}" and placed it in ${sprintName}.`;
                        newItemDetails = { project: finalProjectName, sprint: sprintName, title };
                    } else if (item_type === 'defect') {
                        const insertSql = `INSERT INTO defects (project_id, title, area, status, created_date) VALUES (?, ?, 'Imported', 'Assigned to Developer', date('now'))`;
                        await new Promise((resolve, reject) => db.run(insertSql, [projectId, title], (err) => err ? reject(err) : resolve()));
                        reply = `OK, I've created the defect "${title}" in project "${finalProjectName}".`;
                        newItemDetails = { project: finalProjectName, title };
                    } else {
                        return res.json({ reply: `I can create requirements and defects, but I don't know how to create an item of type "${item_type}" yet.` });
                    }
                    
                    setTimeout(() => {
                        fetch(`http://localhost:${port}/api/chatbot/sync`, { method: 'POST' }).catch(err => console.error("Self-sync failed:", err));
                    }, 1000);

                    return res.json({ 
                        reply, 
                        data_changed: true,
                        new_item: newItemDetails 
                    });
                } catch (error) {
                    return res.json({ reply: `I couldn't find a project named "${finalProjectName}". Please check the name and try again.` });
                }
            }

            case "get_project_summary": {
                const manualProjectName = extractProjectFromMessage(message, intent);
                const projectToQuery = manualProjectName || (parameters || {}).project_name || projectContext;

                if (!projectToQuery) {
                   return res.json({ reply: "Which project would you like a summary for?" });
                }

                const match = await findProjectMatch(db, projectToQuery);
                if (match.suggestion && !match.exact) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". If you meant "${match.suggestion}", please ask your question again with the correct name.` });
                } else if (match.noMatch) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Please check the name and try again.` });
                }

                const finalProjectName = match.exact;

                const [reqs, defects] = await Promise.all([
                    qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
                        filter: { must: [{ key: "project", match: { value: finalProjectName } }, { key: "type", match: { value: "requirement" } }] },
                        limit: 50, with_payload: true
                    }),
                    qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
                        filter: { 
                            must: [{ key: "project", match: { value: finalProjectName } }, { key: "type", match: { value: "defect" } }],
                            must_not: [{ key: "status", match: { any: ["Done", "Closed"] } }]
                        },
                        limit: 50, with_payload: true
                    })
                ]);

                const reqContext = reqs.points.map(p => JSON.stringify(p.payload)).join("\n");
                const defectContext = defects.points.map(p => JSON.stringify(p.payload)).join("\n");

                const finalPrompt = `
                You are a project assistant. Based on the following data, provide a concise summary for the user.
                The user wants to know all the data for the project "${finalProjectName}".
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
            
            case "get_defects_list":
            case "get_defects_count": {
                const { project_name, defect_status_filter } = parameters || {};
                const manualProjectName = extractProjectFromMessage(message, intent);
                const projectToQuery = manualProjectName || project_name;
            
                if (!projectToQuery) {
                    return res.json({ reply: "Please specify a project. For example, 'show me the defects for crm-project'." });
                }
            
                const match = await findProjectMatch(db, projectToQuery);
                if (match.suggestion && !match.exact) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". If you meant "${match.suggestion}", please ask your question again with the correct name.` });
                } else if (match.noMatch) {
                    return res.json({ reply: `I couldn't find a project named "${projectToQuery}". Please check the name and try again.` });
                }
                const finalProjectName = match.exact;
            
                let qdrantFilter = {
                    must: [
                        { key: "project", match: { value: finalProjectName } },
                        { key: "type", match: { value: "defect" } }
                    ]
                };
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
                        qdrantFilter.must.push({
                            key: "status",
                            match: { any: ["Assigned to Developer", "Assigned to Tester"] }
                        });
                        replyDescription = "undone";
                        break;
                    case "done":
                        qdrantFilter.must.push({
                            key: "status",
                            match: { value: "Done" }
                        });
                        replyDescription = "done";
                        break;
                    case "closed":
                        qdrantFilter.must.push({
                            key: "status",
                            match: { value: "Closed" }
                        });
                        replyDescription = "closed";
                        break;
                    case "all":
                        qdrantFilter.must_not = [{
                            key: "status",
                            match: { any: ["Done", "Closed"] }
                        }];
                        replyDescription = "in-progress";
                        break;
                    case "all_including_closed":
                        replyDescription = "total (including closed)";
                        break;
                    default:
                         qdrantFilter.must_not = [{
                            key: "status",
                            match: { any: ["Done", "Closed"] }
                        }];
                        replyDescription = "in-progress";
                }
            
                if (intent === "get_defects_count") {
                    const countResult = await qdrantClient.count(QDRANT_COLLECTION_NAME, {
                        filter: qdrantFilter,
                        exact: true
                    });
                    const count = countResult.count;
                    return res.json({ reply: `There are ${count} ${replyDescription} defects in project "${finalProjectName}".` });
            
                } else {
                    const scrollResult = await qdrantClient.scroll(QDRANT_COLLECTION_NAME, {
                        filter: qdrantFilter,
                        limit: 100,
                        with_payload: true
                    });
            
                    if (!scrollResult.points || scrollResult.points.length === 0) {
                        return res.json({ reply: `I couldn't find any ${replyDescription} defects for project "${finalProjectName}".` });
                    }
            
                    const defects = scrollResult.points.map(p => p.payload);
                    let replyText = `Here are the ${replyDescription} defects for "${finalProjectName}":\n\n`;
                    defects.forEach(defect => {
                        replyText += `- ${defect.title} (Status: ${defect.status})\n`;
                    });
                    return res.json({ reply: replyText });
                }
            }

            case "get_general_info":
            default: {
                const manualProjectName = extractProjectFromMessage(message, intent);
                const projectToQuery = manualProjectName || (parameters || {}).project_name || projectContext;
                let finalProjectName = null;

                if (projectToQuery) {
                    const match = await findProjectMatch(db, projectToQuery);
                    if (match.exact) {
                        finalProjectName = match.exact;
                    }
                }

                const queryEmbedding = await embeddingModel.embedContent(parameters?.query || message);
                const searchResults = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
                    vector: queryEmbedding.embedding.values,
                    limit: 5,
                    with_payload: true,
                    ...(finalProjectName && { filter: { must: [{ key: "project", match: { value: finalProjectName } }] } })
                });

                if (searchResults.length === 0) {
                    return res.json({ reply: "I couldn't find any information related to that." });
                }

                const context = searchResults.map(result => JSON.stringify(result.payload)).join("\n");
                const finalPrompt = `
                You are a helpful project assistant. Based on the following search results, answer the user's question.
                
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