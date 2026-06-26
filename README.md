# Tactical Momentum Tracker ⚽📈

**Tactical Momentum Tracker** is a real-time sports analytics platform designed to detect, quantify, and visualize match momentum shifts. Built for the **AQX Sports Analytics Hackathon**, it provides head coaches with live tactical insights, calculates dynamic victory probabilities, simulates "what-if" scenarios, and prompts fan engagement via simulated Discord bot alerts.

---

## 💡 Inspiration
Traditional sports metrics are static—possession percentages and total shot counts fail to convey the dynamic flow of a football match. Matches are won or lost in critical inflection points: a red card, a sequence of corners, or a miraculous double-save. We were inspired to create a tool that captures these invisible "waves" of energy and momentum in real time. Our goal was to design a platform that not only visualizes these swings but uses AI to predict comeback opportunities, simulate what-if scenarios, and recommend tactical formation updates immediately.

## 🎯 What it does
Tactical Momentum Tracker provides a premium suite of tools for sports analysts, coaches, and fans:
1. **Interactive Momentum Timeline**: A custom D3.js timeline that maps net match momentum minute-by-minute using rolling weighted moving averages. Users can hover over event markers to see details of key inflection points.
2. **Tactical Dominance Heatmap**: An interactive football pitch displaying real-time coordinate heat blobs of event intensity. It calculates attacking third territory penetration percentage and filters events by time blocks (0-30', 30-60', 60-90').
3. **Gemini Tactical AI Insights**: An LLM-backed analysis engine that contextually processes momentum graphs and event logs to deliver formation recommendations, substitution choices, and strategic feedback.
4. **Match Scenario Simulator**: A sandbox enabling users to queue hypothetical future events (e.g., *“What if the home team gets a Red Card at minute 75?”*) and instantly recalculate the win probability bar and momentum timeline.
5. **AI Auto-Simulate (Gemini)**: A button that queries Gemini to generate 3–5 high-fidelity future match events and 15–25 possession coordinate heat points, simulating the rest of the match in a single click.
6. **Export PDF Report**: A clean, vector-grade print layout engine that builds a comprehensive, beautiful tactical PDF summarizing simulated events, AI insights, and final win probability.
7. **World Cup 2026 Center**: Live standings, fixture grids, and a real-time sync button pulling match data directly from the World Cup 2026 API.
8. **User vs AI Manager Game**: An interactive simulation page where users can manage their chosen country in the World Cup 2026 against AI, configure attacking/defensive styles, adjust mentalities mid-match, and view a detailed post-match coaching report by Gemini.
9. **Gemini API Limit WhatsApp Reporter**: Automatically detects when Gemini API limits or quotas are exceeded, falling back to a rule-based engine and prompting the user with a notification popup containing a direct WhatsApp report button to the developer at `+6282166964069`.

## 🛠️ How we built it
We constructed this project as a monorepo splitting logic between:
*   **Backend**: Python FastAPI serving REST API endpoints. It calculates momentum scores using an Exponential Weighted Moving Average (EMA) and queries Google Gemini using structured schemas.
*   **Frontend**: React (Vite-based) with a custom Glassmorphic dark styling, styled using vanilla CSS.
*   **Data & Analytics**: SQLite database accessed via SQLAlchemy, pre-populated with realistic dummy data. Data is processed using Pandas.
*   **D3 Visualizations**: SVG elements built from scratch to animate heat maps and responsive momentum lines.

## 🚧 Challenges we ran into
*   **Smooth D3 Animations**: Generating fluid transitions when filtering events by time window (e.g., 30-60') required fine-tuning D3.js enter/exit/merge selections to smoothly scale and fade heat circles.
*   **Zero-Dependency PDF Export**: High-fidelity PDF libraries often add massive bundle sizes or render blurry canvases. We bypassed this by writing an elegant CSS print stylesheet inside a temporary iframe, launching the native browser print dialogue for crisp vector text output.
*   **Consistent Coordinate Generation**: Ensuring that simulated AI events fell within realistic X/Y boundary boxes on the pitch required structured prompt engineering and post-generation coordinate mapping.

## 🏆 Accomplishments that we're proud of
*   **Hover Synchronization**: We successfully bound the React state of the *Normalized Event Log* list hover to the D3 SVG field coordinates, making the matching event dot grow and highlight dynamically when hovered in the log list.
*   **Polished Dark Aesthetics**: Built a customized theme with Obsidian-style transparency, neon green (`#10b981`), electric magenta (`#d946ef`), and bright cyan (`#3b82f6`) representing home, away, and neutral states.
*   **Vibrant Offline Fallbacks**: Even without a Gemini API Key, the application remains fully functional by reverting to a robust procedural simulation generator that matches live soccer heuristics.

## 📖 What we learned
*   How to build highly responsive, customized SVG graphics in React using D3.js hook bindings.
*   Structured output schema generation for Gemini APIs, converting raw responses directly into validated Pydantic models.
*   Refining mathematical rolling averages to approximate realistic human perception of sports momentum.

## 🔮 What's next for Tactical Momentum Tracker
*   **Real-time WebSockets**: Replacing the current update checks with a bi-directional websocket connection to stream events instantly.
*   **Multi-Agent Coaching Staff**: Splitting the LLM recommendations into distinct AI agents (e.g., Defensive Coach, Attacking Analyst, and Sports Psychologist).
*   **Computer Vision Integration**: Consuming coordinate data streams parsed directly from camera feeds.

---

## 💻 Tech Stack & Tools

*   **Languages**: Python, JavaScript, HTML5, CSS3
*   **Frontend Frameworks/Libraries**: React.js, Vite, D3.js, Lucide React
*   **Backend Frameworks**: FastAPI (Python), Uvicorn
*   **Databases & ORMs**: SQLite, SQLAlchemy, Pandas
*   **Cloud & APIs**: Google Cloud, Gemini LLM API, World Cup 2026 API

---

## 📂 Project Structure

```
C:\dev\team-trackerai\
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI REST endpoints
│   │   ├── database.py          # SQLite schema, tables & seed records
│   │   ├── schemas.py           # Pydantic schemas for data validation
│   │   ├── calculator.py        # Momentum weighted logic & probability calculations
│   │   └── recommender.py       # Gemini API client & Heuristic fallback engine
│   ├── requirements.txt         # Python package dependencies
│   └── run.py                   # Backend entrypoint (port 8000)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx    # Central UI coordinator
│   │   │   ├── MatchTimeline.jsx# D3-drawn interactive momentum graph
│   │   │   ├── DominanceHeatmap.jsx # SVG field coordinate mapping
│   │   │   ├── ScenarioSimulator.jsx # Simulator form & hypothetical queue
│   │   │   ├── FanEngagement.jsx # Discord alert feeds & predictive polls
│   │   │   └── ManagerGame.jsx  # User vs AI football manager simulation game
│   │   ├── App.jsx              # Main React file
│   │   ├── index.css            # Dark tactical CSS styling
│   │   └── App.css              # Cleared config
│   ├── index.html               # Main HTML entry with SEO metadata
│   └── package.json             # NPM package dependencies
└── README.md
```

---

## ⚡ Quick Start

### 1. Launch the Backend API

1. Navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2. Activate the virtual environment:
    *   **Windows**:
        ```powershell
        .\venv\Scripts\Activate.ps1
        ```
    *   **Mac/Linux**:
        ```bash
        source venv/bin/activate
        ```
3. Set your Gemini API key (Optional - Heuristic fallbacks will run if omitted):
    *   **Windows (PowerShell)**:
        ```powershell
        $env:GEMINI_API_KEY="your-api-key-here"
        ```
    *   **Linux/Mac**:
        ```bash
        export GEMINI_API_KEY="your-api-key-here"
        ```
4. Start the server:
    ```bash
    python run.py
    ```
    The FastAPI backend will start at `http://localhost:8000`. You can visit `http://localhost:8000/docs` to explore the OpenAPI schema.

### 2. Launch the React Frontend

1. Open a new terminal in the `frontend` folder:
    ```bash
    cd frontend
    ```
2. Start the Vite dev server:
    ```bash
    npm run dev
    ```
    Open your browser and navigate to `http://localhost:5173`.
