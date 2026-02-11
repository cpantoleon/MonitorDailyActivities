# Monitor Activities and Defects

This is a full-stack Kanban-style application designed to help QA teams and developers monitor project requirements, track defects, manage releases, and maintain daily project notes.

It features a powerful, integrated **AI Chatbot** that acts as a project assistant. You can choose to run the AI entirely locally using **Ollama** or via the cloud using **Google Gemini**. The chatbot can answer questions about your project data, provide daily information like weather and namedays, and even tell you a joke.

## Getting Started

Follow these steps to get the application running locally.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18.x or later)
-   [npm](https://www.npmjs.com/) (included with Node.js)
-   *(Optional - for Local AI)* [Ollama](https://ollama.com/)

### Installation & Setup

1.  **Install frontend dependencies** from the root directory:
    ```bash
    npm install
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install --prefix server
    ```
    *(This command is run from the root directory and installs dependencies for the `/server` folder.)*

### Running the Application

1.  **Start both frontend and backend servers concurrently** from the root directory:
    ```bash
    npm run dev
    ```
2.  The frontend will be available at `http://localhost:5173` (or another port if 5173 is busy).
3.  The backend server will run on `http://localhost:3001`.

---

## Jira Integration Setup

This application supports importing Requirements and Defects directly from Jira using JQL (Jira Query Language). To use this feature, you must generate a Personal Access Token (PAT).

### 1. How to Generate a Jira Personal Access Token

1.  Log in to your Jira instance.
2.  Click on your **Profile Avatar** in the top right corner.
3.  Select **Profile** (or "Manage Account" depending on your version).
4.  Look for **Personal Access Tokens** in the menu (usually under specific settings or security tabs).
5.  Click **Create Token**.
6.  Give the token a name (e.g., "Monitor App") and set an expiry duration (optional).
7.  **Copy the token immediately**. You will not be able to see it again.

### 2. Using the Import Feature

1.  In the application, click the **Options Menu (⋮)** on the Sprint Activities or Defects page.
2.  Select **"Import from Jira"**.
3.  Paste your **Personal Access Token** into the field provided.
    *   *Note: You can check "Save Token" to store it securely in the local database for future use.*
4.  Select the **Target Project**.
5.  Enter your **JQL Query** (e.g., `project = "MYPROJ" AND sprint in openSprints()`).
6.  Click **Fetch & Import**.

---

## AI Chatbot Setup

The chatbot uses **LanceDB** (an embedded vector database) to store project data locally. You can power the LLM (Large Language Model) using a Local provider (Ollama).

### 1. Get OpenWeatherMap API Key (Required for Weather)

-   Go to [OpenWeatherMap](https://openweathermap.org/price) and sign up for the "Free" plan.
-   Navigate to your account's **"API keys"** tab to find your default key.

### 2. Choose Your AI Provider

#### Local AI with Ollama (Privacy Focused)
1.  Download and install [Ollama](https://ollama.com/).
2.  Pull the required models via your terminal:
    ```bash
    ollama pull deepseek-r1:1.5b
    ollama pull nomic-embed-text
    ```
    *(Note: You can change these models in the `.env` file if you prefer others).*

### 3. Configure Environment Variables

1.  In the `/server` directory, create a new file named `.env`.
2.  Add the configuration based on your chosen method:

    **Configuration:**
    ```env
    # Server Configuration
    PORT=3001

    # Jira Integration (Required for Import features)
    JIRA_BASE_URL=https://jira.your-company-domain.com

    # Weather Integration (Required for Chatbot/UI)
    OPENWEATHER_API_KEY={api_key}
    VITE_OPENWEATHER_API_KEY={api_key}

    # AI Configuration (Local - Ollama)
    USE_OLLAMA=true
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_CHAT_MODEL=deepseek-r1:1.5b
    OLLAMA_EMBED_MODEL=all-minilm
    ```

### 4. Sync Your Data

For the chatbot to create the local vector index from your project data inside LanceDB, you must run an initial sync.

1.  Make sure your application is running (`npm run dev`).
2.  Open a **new terminal window** and run:
    ```bash
    # Windows PowerShell
    Invoke-WebRequest -Uri http://localhost:3001/api/chatbot/sync -Method POST
    
    # Mac/Linux/Git Bash
    curl -X POST http://localhost:3001/api/chatbot/sync
    ```
3.  You should see a success message. This creates a local `server/data/lancedb` folder.

> **Note:** The server is configured to **automatically re-sync** in the background whenever you add, update, or delete data. This manual command is only needed for the initial setup or if you ever need to force a full re-sync.

### 4. Start Chatting!

Once synced, you can start asking questions! For a full list of example commands, see the **[Chatbot Usage and Example Questions](./CHATBOT_EXAMPLES.md)** guide.

---

## Technologies Used

-   **Frontend:** React, React Router, Chart.js, Vite
-   **Backend:** Node.js, Express.js
-   **Database:** 
    -   **SQLite:** For relational data (requirements, defects, settings).
    -   **LanceDB:** Embedded vector database for AI context retrieval.
-   **AI Integration:** 
    -   **Ollama:** For local LLM inference.
-   **Jira Integration:** REST API with Bearer Token authentication.

## Project Structure

-   `/src`: Frontend React application.
-   `/server`: Backend Node.js server.
    -   `database.js`: SQLite connection schema.
    -   `chatbot.js`: Logic for LanceDB, Ollama/Gemini integration, and intent handling.
    -   `data/lancedb`: Local storage for vector embeddings (created after sync).
-   `/public`: Static assets.

## Application Pages & Functionality

#### 1. Sprint Activities
-   **Kanban Board:** View requirements (To Do, Scenarios created, Under testing, Done).
-   **Jira Import:** Import requirements directly via JQL using a Personal Access Token.
-   **Smart Sprint Selection:** Automatically selects the latest sprint.
-   **Scope Change Tracking:** Log and visualize significant scope changes.
-   **Release Management:** Assign requirements to active releases.
-   **Charts:** Visual summaries of sprint status and scope changes.
-   **Excel Import:** Bulk import from Excel files.
-   **Jira Import:** Import defects directly via JQL.

#### 2. Defects
-   **Kanban Board:** Track defects (Assigned to Developer, Assigned to Tester, Done).
-   **Excel Import:** Bulk import from Excel files.
-   **Jira Import:** Import defects directly via JQL.
-   **Move to Closed:** Keep the board clean by archiving resolved defects.
-   **FAT Defects:** Flag specific defects as "FAT" (Factory Acceptance Testing) related.
-   **Charts:** View distribution by area, status, and "Return to Developer" counts.

#### 3. Releases
-   **Active Releases:** Track real-time progress. Export reports to PDF/Excel.
-   **FAT Dashboard:** Manage Factory Acceptance Testing periods, select specific releases/requirements, and calculate KPIs (DRE, MTTD, MTTR).
-   **Archived Releases:** Permanent snapshots of completed releases.
-   **SAT Reporting:** Log System Acceptance Testing results and track specific SAT bugs.
-   **Comparison:** Compare metrics between multiple archived releases.

#### 4. Key Findings
-   Log sprint retrospective items (Went Well, Went Wrong, Improvements).

#### 5. Notes
-   Rich text editor for daily project notes.
-   **Keywords:** Highlights dates based on keywords (e.g., 'release date', 'FAT').
-   **Integrations:** Sidebar with Weather widget and Nameday calendar.

## API Documentation

The backend API is documented using Swagger/OpenAPI. Once the server is running, visit:
**[http://localhost:3001/api-docs](http://localhost:3001/api-docs)**
