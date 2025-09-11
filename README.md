# Monitor Activities and Defects

This is a full-stack Kanban-style application designed to help QA teams and developers monitor project requirements, track defects, manage releases, and maintain daily project notes. It features a powerful, integrated AI Chatbot to answer questions about your project data, provide daily information like weather and namedays, and even tell you a joke.

## Getting Started

Follow these steps to get the application running locally.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18.x or later)
-   [npm](https://www.npmjs.com/) (included with Node.js)

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

## AI Chatbot Setup (Optional but Recommended)

The application includes an AI-powered chatbot that can answer questions about your projects, requirements, defects, and releases. To enable it, you need to set up API keys for Google Gemini, Qdrant, and OpenWeatherMap.

### 1. Get API Keys

-   **Google Gemini API Key:**
    -   Go to [Google AI Studio](https://aistudio.google.com/).
    -   Log in with your Google account and click on **"Get API key"** to create a new key.

-   **Qdrant Cloud API Key & URL:**
    -   Go to [Qdrant Cloud](https://cloud.qdrant.io/) and create a free account.
    -   Create a new **Free Tier Cluster**.
    -   Once the cluster is "Healthy", click on it to find the **Cluster URL** and create an **API Key**.

-   **OpenWeatherMap API Key:**
    -   Go to [OpenWeatherMap](https://openweathermap.org/price) and sign up for the "Free" plan.
    -   After signing up, navigate to your account's **"API keys"** tab to find your default key.

### 2. Configure Environment Variables

1.  In the `/server` directory, create a new file named `.env`.
2.  Add your copied keys and URL to this file in the following format:

    ```env
    # /server/.env

    # Google Gemini API Key
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

    # Qdrant Cloud Cluster URL and API Key
    QDRANT_URL="YOUR_QDRANT_CLUSTER_URL_HERE"
    QDRANT_API_KEY="YOUR_QDRANT_API_KEY_HERE"

    # OpenWeatherMap API Key (for weather features)
    OPENWEATHER_API_KEY="YOUR_OPENWEATHERMAP_API_KEY_HERE"
    ```

### 3. Sync Your Data

For the chatbot to know about your project data, you must run an initial sync.

1.  Make sure your application is running (`npm run dev`).
2.  Open a **new terminal window** and run the following command:
    ```bash
    # For Windows Command Prompt or Git Bash
    curl -X POST http://localhost:3001/api/chatbot/sync

    # For Windows PowerShell
    Invoke-WebRequest -Uri http://localhost:3001/api/chatbot/sync -Method POST
    ```
3.  You should see a success message. The chatbot is now ready!

> **Note:** The server is configured to **automatically re-sync** in the background whenever you add, update, or delete data. This manual command is only needed for the initial setup or if you ever need to force a full re-sync.

### 4. Start Chatting!

Once synced, you can start asking questions! For a full list of example commands, see the **[Chatbot Usage and Example Questions](./CHATBOT_EXAMPLES.md)** guide.

---

## Technologies Used

-   **Frontend:** React, React Router, Chart.js, Vite
-   **Backend:** Node.js, Express.js, Cheerio (for web scraping)
-   **Database:** SQLite
-   **AI & Vector Search:** Google Gemini, Qdrant
-   **API Documentation:** Swagger/OpenAPI

## Project Structure

-   `/src`: Contains the frontend React application.
    -   `/src/components`: Reusable React components.
    -   `/src/pages`: Main application pages.
    -   `/src/hooks`: Custom React hooks.
    -   `/src/utils`: Utility functions.
-   `/server`: Contains the backend Node.js/Express server and SQLite database.
-   `/public`: Contains static assets for the frontend.

## Application Pages & Functionality

#### 1. Sprint Activities
-   View requirements on a Kanban board (To Do, Scenarios created, Under testing, Done).
-   **Drag and drop** requirements between columns to update their status, with a confirmation prompt.
-   Add, edit, and delete requirements and projects.
-   **Smart Sprint Selection**: When a project is selected, the latest sprint is automatically chosen, streamlining the workflow.
-   **Scope Change Tracking**: Log significant scope changes for any requirement during a sprint. View a history of these changes and visualize their frequency in a dedicated chart.
-   **Release Management**: Create and manage project-specific releases. Assign requirements to a release and track progress.
-   **Charts**: Visualize the status of the current sprint, the active release, and the frequency of scope changes with dynamic charts.
-   **Bulk Import**: Import multiple requirements at once from a JIRA-exported Excel file, with guidance provided via an in-app tooltip.
-   **Context-aware search** with autosuggestions to quickly find requirements across all projects or within a selected project/sprint.
-   **Filter Sidebar**: Refine the view with a powerful sidebar to filter requirements by type, linked defects (yes/no), associated release, and last updated date range.
-   View the complete, chronologically-ordered history of a requirement's status changes and logged scope changes.
-   See defects that are linked to a specific requirement for full traceability.

#### 2. Defects
-   Track defects on a separate Kanban board (Assigned to Developer, Assigned to Tester, Done).
-   **Drag and drop** active defects between columns to update their status.
-   **Move to Closed**: A dedicated button on each defect card allows you to move it to the "Closed" view, keeping the active board clean. A confirmation is required if the defect is not yet "Done".
-   Toggle between viewing active and closed defects.
-   Create, update, and delete defects with details like area, description, and external links.
-   **Bulk Import**: Import multiple defects at once from a JIRA-exported Excel file, with format guidance available in the import window.
-   **Context-aware search** with autosuggestions to find defects across all projects or within a selected one.
-   Link defects to one or more sprint requirements.
-   View a full, detailed history of changes for each defect.
-   Visualize defect distribution by area and "return to developer" counts with dynamic charts.

#### 3. Releases
-   View active and archived releases for a selected project.
-   For active releases, a pie chart shows the progress (done vs. not done requirements).
-   The card lists the requirements associated with each release and allows filtering them by sprint.
-   A dedicated "Defects" button allows quick access to view all defects linked to the release's requirements.
-   **Export to Excel**: Generate a comprehensive Excel report for the release, with separate sheets detailing requirements, linked defects (including their 'Return to Dev' count), and a full requirement-to-defect breakdown.
-   **Finalize a Release**: Archive a release with two options: "Archive Only" (creates a permanent record) or "Archive & Complete Items" (archives the release and marks all associated requirements as 'Done').
-   **Edit & Delete**: Modify release details or remove a release completely.
For archived releases, view the final metrics and the frozen list of requirements at the time of archival.

#### 4. Sprint Analysis
-   Log sprint retrospective items (What Went Well, What Went Wrong, What Can We Improve).
-   **Drag and drop** retrospective items between columns to re-categorize them.
-   Organize and view feedback on a per-project basis.
-   Add, edit, and delete retrospective items.

#### 5. Notes
-   Create and save daily notes for each project using a rich text editor with `Ctrl+S` support.
-   Use an interactive calendar to navigate and view notes for specific dates.
-   Format text with bold, italics, lists, links, tables, and embed images directly into notes.
-   Special keywords (e.g., 'release date', 'event', 'call') automatically highlight dates on the calendar with colored dots for quick reference.
-   View a sidebar with a Greek nameday calendar ('eortologio') and a persistent, searchable weather widget with dynamic backgrounds.

## API Documentation

The backend API is documented using Swagger/OpenAPI. Once the server is running, you can view and interact with the API endpoints here:

-   **[http://localhost:3001/api-docs](http://localhost:3001/api-docs)**