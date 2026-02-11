Chatbot Usage and Example Questions

This document outlines the various questions and commands our Project Assistant chatbot can understand. The chatbot is designed to be conversational and can often understand variations of these phrases.

### General & Small Talk

You can interact with the bot for simple queries and greetings.

-   **Greetings:**
    -   `hello`
    -   `hi`
-   **Well-being:**
    -   `how are you`
-   **Date Information:**
    -   `what day is today`
    -   `what's the date`

## Project Information

These commands allow you to query your project data. For many commands, you must specify the project name in your question.

#### Asking for Release Dates

The bot can find release dates for an entire project or a specific requirement. It also features smart project name matching.

-   **By Project Name (Exact Match):**
    -   `what is the release date for TEST`
    -   `release date for TEST`
    > **Bot Response:** The current release for TEST is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

-   **By Project Name (Autocorrection - 1 character typo):**
    -   `what is the release date for TSET`
    > **Bot Response:** The current release for TEST is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

-   **By Project Name (Suggestion - 2 character typo):**
    -   `release date for TEST12`
    > **Bot Response:** I couldn't find a project named "TEST12". Did you mean "TEST"? Please ask your question again with the correct name.

-   **By Project Name (No Match):**
    -   `release date for NONEXISTENT`
    > **Bot Response:** I couldn't find a project named "NONEXISTENT". Please check the name and try again.

-   **By Specific Requirement ID:**
    -   `what is the release date for TEST-TEST-030`
    > **Bot Response:** The release for REQ-GAS-030 is "TEST v1.6.0-RC1.1", scheduled for 2025-11-14.

-   **Ambiguous Questions:**
    -   `give me the release date`
    > **Bot Response:** Please specify a project for the release date. For example, 'what is the release date for TEST?'
    -   `give me the date`
    > **Bot Response:** Your request is a bit unclear. If you're asking for a release date, please try again using the phrase 'release date for [project name]'.

#### Asking for a List of Defects

You can filter defects by their status. If no status is mentioned, the bot shows in-progress defects.

-   **List In-Progress Defects (Default):**
    -   `give me the defects for TEST`
    > **Bot Response:** Here are the in-progress defects for "TEST":
    >
    > - Bulk Import - File over 30MB (Status: Assigned to Developer)
    > - Public site Guideline - Error after adding a keyword (Status: Assigned to Tester)

-   **List Undone/Not Done Defects:**
    -   `show me the undone defects for TEST`
    -   `provide me the not done defects for TEST`

-   **List Done Defects:**
    -   `list the done defects for TEST`

-   **List Closed Defects:**
    -   `show me the closed defects for TEST`

-   **List All Defects (including closed):**
    -   `show me all the defects for TEST`

-   **Without Specifying a Project:**
    -   `give me the defects`
    > **Bot Response:** Please specify a project. For example, 'show me the defects for TEST'.

#### Asking for a Count of Defects

Similar to listing, you can get counts of defects based on their status.

-   **Count In-Progress Defects (Default):**
    -   `how many defects are in TEST?`
    > **Bot Response:** There are 2 in-progress defects in project "TEST".

-   **Count Undone/Not Done Defects:**
    -   `count the undone defects for TEST`
    -   `how many not done defects in TEST?`
    > **Bot Response:** There are 2 undone defects in project "TEST".

-   **Count Done Defects:**
    -   `how many done defects are there for TEST?`

-   **Count Closed Defects:**
    -   `count the closed defects for TEST`

-   **Count All Defects (including closed):**
    -   `count all the defects for TEST`

#### Asking for Project Summaries

Get a high-level overview of a project's requirements and open defects.

-   **By Project Name:**
    -   `show me everything for TEST`
    -   `summary for TEST`

#### General Questions (AI Search)

If your question doesn't match a specific command, the bot uses its AI search to find the most relevant information from the database.

-   `what is the status of defect "Bulk Import - File over 30MB"?`
-   `tell me about the 'User Login' requirement in the TEST project`
-   `how many defects are linked to requirement TEST-TEST-0230?`
-   `show me notes from last week for the CRM project`
-   `which requirements are in sprint 5 for TEST?`

## Creating New Items

The chatbot can create new requirements or defects for you. You can provide all the information at once or answer the bot's follow-up questions.

#### Providing All Information at Once

-   **Create a Requirement:**
    -   `create a requirement titled 'New User Profile Page' for project TEST in sprint 5`
    -   `In project TEST, I need a new requirement in sprint 7 called 'Add GDPR Compliance Banner'`
    -   `For the TEST project, please create a requirement with the title 'API Rate Limiting' and put it in sprint 10.`

-   **Create a Defect:**
    -   `create a defect for TEST called 'Login button is not working'`
    -   `Log a defect in project TEST, title is 'Submit button is disabled incorrectly'.`

#### Conversational Creation

If you provide incomplete information, the bot will ask for the missing details.

-   **Example 1: Creating a Defect**
    -   **You:** `I need to create a new defect.`
    > **Bot:** I can create a defect, but I need a title. For example: 'create a defect titled "My New Defect"'

-   **Example 2: Creating a Requirement**
    -   **You:** `create a requirement for TEST called "Implement Two-Factor Authentication"`
    > **Bot:** OK, I can create the requirement "Implement Two-Factor Authentication" for project "TEST". Which sprint should it be in? For example: '...in sprint 7'.

## Utilities & Daily Info

Get quick updates on weather and Greek namedays.

#### Weather

-   **For the default location (set in the app):**
    -   `what's the weather like?`
    -   `tell me the weather for tomorrow`
-   **For a specific city:**
    -   `what is the weather in Athens?`
    -   `tell me the weather in London for tomorrow`

#### Nameday (Eortologio)

-   **For Today:**
    -   `today nameday`
    -   `who has a nameday today?`
-   **For Tomorrow:**
    -   `tomorrow nameday`
-   **For the Week (Default):**
    -   `nameday`
    -   `eortologio`

## Fun & Miscellaneous

-   **Ask for a joke:**
    -   `tell me a joke`
    -   `joke`