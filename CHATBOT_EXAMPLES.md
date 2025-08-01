# Chatbot Usage and Example Questions

This document outlines the various questions and commands our Project Assistant chatbot can understand. The chatbot is designed to be conversational and can often understand variations of these phrases.

### General & Small Talk

You can interact with the bot for simple queries and greetings.

- **Greetings:**
  - `hello`
  - `hi`
- **Well-being:**
  - `how are you`
- **Date Information:**
  - `what day is today`
  - `what's the date`

### Project Information

These commands allow you to query your project data. The bot is aware of the project you have selected in the main application, so you can often omit the project name if it's already set.

#### Asking for Release Dates

- **By Project Name (Exact Match):**
  - `what is the release date for TEST`
  - `release date for bod`
  > **Bot Response:** The current release for TEST is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

- **By Project Name (Fuzzy Match - 1 character error):**
  - `release date for TEST1`
  - `release date for opp`
  > **Bot Response:** I couldn't find a project named "TEST1". If you meant "TEST", please ask your question again with the correct name.

- **By Project Name (Invalid Name - more than 1 error):**
  - `release date for TEST12`
  > **Bot Response:** I couldn't find a project named "TEST12". Please check the name and try again.

- **Using UI Context:** (If "TEST" is selected in the app)
  - `what is the current release date?`
  > **Bot Response:** The current release for TEST is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

- **By Specific Requirement ID:**
  - `what is the release date for REQ-GAS-030`

- **Ambiguous Questions:**
  - `tell me the release for TEST`
  > **Bot Response:** Your request is a bit unclear. If you're asking for a release date, please try asking again using the words 'release date'.

#### Asking for Project Summaries

- **By Project Name:**
  - `show me everything for TEST`
  - `summary for BOD`
- **Using UI Context:** (If "TEST" is selected in the app)
  - `give me a project summary`

#### General Questions (AI Search)

You can ask open-ended questions about your data. The bot will search its knowledge base to find the most relevant information.

- `what is the status of defect DEF-123?`
- `tell me about the 'User Login' requirement in the TEST project`
- `how many defects are linked to requirement REQ-GAS-030?`
- `show me notes from last week for the CRM project`

### Creating New Items (Requirements & Defects)

The chatbot can create new items for you. You can provide all the information at once or answer the bot's follow-up questions.

- **Full Command:**
  - `create a requirement titled 'New User Profile Page' for project TEST in sprint 5`
  - `create a defect for BOD called 'Login button is not working'`

- **Conversational Creation:**
  - **You:** `create a new defect`
  > **Bot:** I can create items, but I need a title. What would you like to call it?
  - **You:** `The main logo is blurry`
  > **Bot:** OK, I can create the defect "The main logo is blurry". Which project should I add it to?
  - **You:** `TEST`
  > **Bot Response:** OK, I've created the defect "The main logo is blurry" in project "TEST".

### Daily Information

Get quick updates on weather and Greek namedays.

#### Weather

- **For the default location (set in the app):**
  - `what's the weather like?`
  - `tell me the weather for tomorrow`
- **For a specific city:**
  - `what is the weather in Athens?`
  - `tell me the weather in London for tomorrow`

#### Nameday (Eortologio)

- **For Today:**
  - `today nameday`
  - `who has a nameday today?`
- **For Tomorrow:**
  - `tomorrow nameday`
- **For the Week:**
  - `nameday`
  - `eortologio`

### Fun & Miscellaneous

- **Ask for a joke:**
  - `tell me a joke`
  - `joke`