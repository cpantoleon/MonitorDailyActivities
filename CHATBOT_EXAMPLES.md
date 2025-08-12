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

## Project Information

These commands allow you to query your project data. For many commands, you must specify the project name in your question.

#### Asking for Release Dates

- **By Project Name:**
  - `what is the release date for TEST`
  - `release date for TEST`
  > **Bot Response:** The current release for TEST is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

- **By Project Name (Fuzzy Match - 1 character error):**
  - `release date for TEST1`
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
  - `give me the release date`
  > **Bot Response:** Please specify a project for the release date. For example, 'what is the release date for TEST?'
  - `give me the date`
  > **Bot Response:** Your request is a bit unclear. If you're asking for a release date, please try again using the phrase 'release date for [project name]'.

#### Asking for a List of Defects

- **List In-Progress Defects (Not Done or Closed):**
  - `give me the defects for TEST`
  > **Bot Response:** Here are the in-progress defects for "TEST":
  >
  > - **Bulk Import - File over 30MB** (Status: Assigned to Developer)
  > - **Public site Guideline - Error after adding a keyword** (Status: Assigned to Tester)

- **List Undone/Not Done Defects:**
  - `show me the undone defects for TEST`
  - `provide me the not done defects for TEST`

- **List Done Defects:**
  - `list the done defects for TEST`

- **List Closed Defects:**
  - `show me the closed defects for TEST`

- **Without Specifying a Project:**
  - `give me the defects`
  > **Bot Response:** Please specify a project. For example, 'show me the defects for TEST'.

#### Asking for a Count of Defects

- **Count In-Progress Defects:**
  - `how many defects are in TEST?`
  > **Bot Response:** There are 2 in-progress defects in project "TEST".

- **Count Undone/Not Done Defects:**
  - `count the undone defects for TEST`
  - `how many not done defects in TEST?`
  > **Bot Response:** There are 2 undone defects in project "TEST".

- **Count Done Defects:**
  - `how many done defects are there for TEST?`

- **Count Closed Defects:**
  - `count the closed defects for TEST`

- **Without Specifying a Project:**
  - `how many defects are there?`
  > **Bot Response:** Please specify a project. For example, 'show me the defects for TEST'.

#### Asking for Project Summaries

- **By Project Name:**
  - `show me everything for TEST`
  - `summary for TEST`
- **Using UI Context:** (If "TEST" is selected in the app)
  - `give me a project summary`

#### General Questions (AI Search)

You can ask open-ended questions about your data. The bot will search its knowledge base to find the most relevant information.

- `what is the status of defect DEF-123?`
- `tell me about the 'User Login' requirement in the TEST project`
- `how many defects are linked to requirement REQ-GAS-030?`
- `show me notes from last week for the CRM project`

## Creating New Items (Requirements & Defects)

The chatbot can create new items for you. You can provide all the information at once or answer the bot's follow-up questions.

- **Full Command:**
  - `create a requirement titled 'New User Profile Page' for project TEST in sprint 5`
  - `create a defect for TEST called 'Login button is not working'`

- **Conversational Creation:**
  - **You:** `create a new defect`
  > **Bot:** I can create items, but I need a title. What would you like to call it?
  - **You:** `The main logo is blurry`
  > **Bot:** OK, I can create the defect "The main logo is blurry". Which project should I add it to?
  - **You:** `TEST`
  > **Bot Response:** OK, I've created the defect "The main logo is blurry" in project "TEST".

## Daily Information

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

## Fun & Miscellaneous

- **Ask for a joke:**
  - `tell me a joke`
  - `joke`