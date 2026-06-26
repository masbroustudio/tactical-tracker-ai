import React, { useState, useEffect, useRef } from "react";
import { Activity, Tv, Flame, RefreshCw, PlusCircle, AlertCircle, Globe, FileText, Sparkles, Sun, Moon, LogOut } from "lucide-react";
import MatchTimeline from "./MatchTimeline";
import DominanceHeatmap from "./DominanceHeatmap";
import ScenarioSimulator from "./ScenarioSimulator";
import FanEngagement from "./FanEngagement";
import ManagerGame from "./ManagerGame";
import { doc, onSnapshot } from "firebase/firestore";
import { db, useFirebase } from "../firebase";



const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000/api"
  : "/api";

export default function Dashboard({ onBackToLanding, theme, toggleTheme, user, onLogout }) {
  const [matches, setMatches] = useState([]);
  const unsubscribeRef = useRef(null);
  const [activeMatchId, setActiveMatchId] = useState("");
  const [matchDetail, setMatchDetail] = useState(null);
  const [momentumData, setMomentumData] = useState(null);
  const [insights, setInsights] = useState(null);
  
  // App States
  const [isSimulated, setIsSimulated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState("");
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [activeTab, setActiveTab] = useState("match"); // 'match' or 'standings'
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // World Cup sub-tab and search/filter states
  const [worldCupSubTab, setWorldCupSubTab] = useState("standings");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureFilter, setFixtureFilter] = useState("all");
  const [fixturePhase, setFixturePhase] = useState("all");
  
  // Simulated events queue
  const [activeSimulatedEvents, setActiveSimulatedEvents] = useState([]);
  const [activeSimulatedHeatPoints, setActiveSimulatedHeatPoints] = useState([]);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  
  // Live Event Ingestion Input States
  const [ingestType, setIngestType] = useState("Shot on Target");
  const [ingestTeam, setIngestTeam] = useState("home");
  const [ingestPlayer, setIngestPlayer] = useState("");
  const [ingestDetail, setIngestDetail] = useState("");

  // 1. Fetch matches and groups on load
  useEffect(() => {
    fetchMatches();
    fetchGroups();
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/matches`);
      const data = await res.json();
      setMatches(data);
      if (data.length > 0 && !activeMatchId) {
        setActiveMatchId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to FastAPI backend. Ensure server is running on port 8000.");
    }
  };

  const handleSyncWorldCup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/matches/sync-worldcup`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchMatches();
        alert("World Cup 2026 matches synced successfully!");
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to synchronize World Cup matches.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend for synchronization.");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_BASE}/worldcup/groups`);
      const data = await res.json();
      if (data.status === "success") {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (activeTab === "standings" && groups.length === 0) {
      fetchGroups();
    }
  }, [activeTab]);

  // 2. Fetch match detail, momentum, and insights when activeMatchId changes
  useEffect(() => {
    if (!activeMatchId) return;
    loadMatchData(activeMatchId);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [activeMatchId]);

  const loadMatchDataHttp = async (matchId) => {
    try {
      // Fetch details
      const detailRes = await fetch(`${API_BASE}/matches/${matchId}`);
      const detailData = await detailRes.json();
      setMatchDetail(detailData);

      // Fetch momentum timeline
      const momentumRes = await fetch(`${API_BASE}/matches/${matchId}/momentum`);
      const momentumData = await momentumRes.json();
      setMomentumData(momentumData);

      // Fetch insights (asynchronously as it might call LLM)
      loadInsights(matchId);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch match metrics.");
    }
  };

  const loadMatchData = async (matchId) => {
    setLoading(true);
    setError("");
    setIsSimulated(false);
    setActiveSimulatedEvents([]);
    setActiveSimulatedHeatPoints([]);
    setHoveredEventId(null);

    // Clean up previous subscription if any
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (useFirebase && db) {
      try {
        const docRef = doc(db, "matches", matchId);
        unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
          setLoading(false);
          if (snapshot.exists()) {
            const data = snapshot.data();
            
            // Map details
            setMatchDetail({
              id: data.id,
              home_team: data.home_team,
              away_team: data.away_team,
              tournament: data.tournament,
              date: data.date,
              status: data.status,
              home_score: data.home_score,
              away_score: data.away_score,
              events: data.events || []
            });

            // Map momentum
            if (data.momentum) {
              setMomentumData({
                match_id: data.id,
                home_team: data.home_team,
                away_team: data.away_team,
                current_home_probability: data.momentum.current_home_probability,
                current_away_probability: data.momentum.current_away_probability,
                current_draw_probability: data.momentum.current_draw_probability,
                timeline: data.momentum.timeline || []
              });
            }
          } else {
            console.warn(`Firestore document for match ${matchId} does not exist yet. Falling back to HTTP.`);
            loadMatchDataHttp(matchId);
          }
        }, (err) => {
          console.error("Firestore snapshot error:", err);
          loadMatchDataHttp(matchId);
        });

        // Load insights separately
        loadInsights(matchId);
      } catch (err) {
        console.error("Failed to setup Firestore listener:", err);
        await loadMatchDataHttp(matchId);
        setLoading(false);
      }
    } else {
      await loadMatchDataHttp(matchId);
      setLoading(false);
    }
  };

  const loadInsights = async (matchId) => {
    setLoadingInsights(true);
    try {
      const insightsRes = await fetch(`${API_BASE}/matches/${matchId}/insights`);
      const insightsData = await insightsRes.json();
      setInsights(insightsData);
      if (insightsData && insightsData.gemini_limit_exceeded) {
        setShowQuotaModal(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  // 3. Live Event Ingestion Handler
  const handleIngestEvent = async (e) => {
    e.preventDefault();
    if (!activeMatchId || !matchDetail) return;
    
    // Determine the next minute to ingest
    const maxMin = matchDetail.events.length > 0 
      ? Math.max(...matchDetail.events.map(ev => ev.minute)) 
      : 0;
    const nextMinute = matchDetail.status === "completed" ? maxMin + 1 : Math.min(90, maxMin + Math.floor(Math.random() * 3) + 1);

    const payload = {
      minute: nextMinute,
      second: Math.floor(Math.random() * 60),
      team: ingestTeam,
      player: ingestPlayer.trim() || (ingestTeam === "home" ? "Home Player" : "Away Player"),
      event_type: ingestType,
      detail: ingestDetail.trim() || ingestType,
      location_x: ingestType === "Goal" ? (ingestTeam === "home" ? 95.0 : 5.0) : Math.floor(Math.random() * 40) + (ingestTeam === "home" ? 60 : 10),
      location_y: Math.floor(Math.random() * 80) + 10
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/matches/${activeMatchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Clear input form
        setIngestPlayer("");
        setIngestDetail("");
        // Reload match state
        await loadMatchData(activeMatchId);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to ingest event.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Scenario Simulation Handlers
  const handleSimulate = async (hypotheticalEvents) => {
    if (!activeMatchId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/matches/${activeMatchId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: activeMatchId, hypothetical_events: hypotheticalEvents })
      });
      if (res.ok) {
        const data = await res.json();
        setMomentumData(data);
        setIsSimulated(true);
        setActiveSimulatedEvents(hypotheticalEvents);
        // Fetch simulated insights
        loadSimulatedInsights(activeMatchId, hypotheticalEvents);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to run scenario simulation.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSimulate = async () => {
    if (!activeMatchId) return [];
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches/${activeMatchId}/auto-simulate`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.events) {
          setActiveSimulatedEvents(data.events);
          setActiveSimulatedHeatPoints(data.heat_points || []);
          setIsSimulated(true);
          
          // Call simulate endpoint to calculate momentum
          const simRes = await fetch(`${API_BASE}/matches/${activeMatchId}/simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match_id: activeMatchId, hypothetical_events: data.events })
          });
          if (simRes.ok) {
            const simData = await simRes.json();
            setMomentumData(simData);
            // Fetch simulated insights
            loadSimulatedInsights(activeMatchId, data.events);
          }
          return data.events;
        }
      }
    } catch (err) {
      console.error("Auto simulation failed:", err);
      setError("Failed to run automated AI simulation.");
    } finally {
      setLoading(false);
    }
    return [];
  };

  const loadSimulatedInsights = async (matchId, hypotheticalEvents) => {
    setLoadingInsights(true);
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, hypothetical_events: hypotheticalEvents })
      });
      if (res.ok) {
        const insightsData = await res.json();
        setInsights(insightsData);
        if (insightsData && insightsData.gemini_limit_exceeded) {
          setShowQuotaModal(true);
        }
      }
    } catch (err) {
      console.error("Failed to load simulated insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleResetSimulation = () => {
    loadMatchData(activeMatchId);
  };

  if (error) {
    return (
      <div className="app-container" style={{ justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="glass-panel" style={{ textAlign: "center", maxWidth: "500px", borderColor: "#ef4444" }}>
          <AlertCircle size={48} style={{ color: "#ef4444", marginBottom: "16px" }} />
          <h2 style={{ marginBottom: "8px" }}>Connection Error</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>{error}</p>
          <button onClick={fetchMatches} className="btn-primary" style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
            <RefreshCw size={16} /> Re-verify Server
          </button>
        </div>
      </div>
    );
  }

  if (!matchDetail || !momentumData) {
    return (
      <div className="app-container" style={{ justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div style={{ color: "var(--text-secondary)", display: "flex", gap: "10px", alignItems: "center" }}>
          <RefreshCw className="animate-spin" size={24} />
          <span>Synchronizing match tracking feeds...</span>
        </div>
      </div>
    );
  }

  // Calculate percentages for win probabilities
  const homeProb = Math.round(momentumData.current_home_probability * 100);
  const awayProb = Math.round(momentumData.current_away_probability * 100);
  const drawProb = 100 - homeProb - awayProb;

  // Combine real database events with active simulated events
  const combinedEvents = isSimulated
    ? [
        ...matchDetail.events,
        ...activeSimulatedEvents.map((e, idx) => ({
          id: `sim-${idx}`,
          match_id: activeMatchId,
          timestamp: new Date().toISOString(),
          ...e,
          is_simulated: true
        }))
      ]
    : matchDetail.events;

  // Sorted events from match details (including simulated ones)
  const sortedEvents = [...combinedEvents].sort((a, b) => b.minute - a.minute || b.second - a.second);

  // Find simulated score from the end of the simulation timeline
  const displayHomeScore = isSimulated && momentumData?.timeline?.length > 0
    ? momentumData.timeline[momentumData.timeline.length - 1].home_score
    : matchDetail.home_score;

  const displayAwayScore = isSimulated && momentumData?.timeline?.length > 0
    ? momentumData.timeline[momentumData.timeline.length - 1].away_score
    : matchDetail.away_score;

  const handleExportPDF = () => {
    if (!matchDetail || !momentumData) return;
    
    const printWindow = window.open("", "_blank");
    const isWc = matchDetail.tournament === "World Cup 2026";
    const statusText = isSimulated ? "Simulated Scenario" : (matchDetail.status === "live" ? "Live" : "Completed");
    
    // Calculate territory dominance
    const homeEventsList = sortedEvents.filter(e => e.team === "home" && e.location_x !== undefined);
    const awayEventsList = sortedEvents.filter(e => e.team === "away" && e.location_x !== undefined);
    const homeAttacks = homeEventsList.filter(e => e.location_x > 66.6).length;
    const awayAttacks = awayEventsList.filter(e => e.location_x < 33.3).length;
    const totalAttacks = homeAttacks + awayAttacks;
    const homeAttackPct = totalAttacks > 0 ? Math.round((homeAttacks / totalAttacks) * 100) : 50;
    const awayAttackPct = 100 - homeAttackPct;

    const html = `
      <html>
        <head>
          <title>Tactical Report - ${matchDetail.home_team} vs ${matchDetail.away_team}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Outfit:wght@500;700;800&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              margin: 40px;
              padding: 0;
              line-height: 1.5;
            }
            .header-container {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-title {
              font-family: 'Outfit', sans-serif;
              font-size: 24px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
            }
            .brand-subtitle {
              font-size: 12px;
              color: #64748b;
              margin: 2px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .report-date {
              text-align: right;
              font-size: 12px;
              color: #64748b;
            }
            .match-header {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 30px;
              text-align: center;
            }
            .match-teams {
              font-family: 'Outfit', sans-serif;
              font-size: 28px;
              font-weight: 700;
              color: #0f172a;
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 20px;
            }
            .match-score {
              background: #1e293b;
              color: #ffffff;
              padding: 6px 16px;
              border-radius: 8px;
              font-size: 24px;
              font-weight: 800;
            }
            .match-meta {
              margin-top: 10px;
              font-size: 13px;
              color: #64748b;
              display: flex;
              justify-content: center;
              gap: 15px;
            }
            .badge {
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
            }
            .badge-simulated {
              background: #dbeafe;
              color: #1e40af;
            }
            .badge-completed {
              background: #f1f5f9;
              color: #475569;
            }
            .badge-live {
              background: #fef2f2;
              color: #991b1b;
            }
            .section-title {
              font-family: 'Outfit', sans-serif;
              font-size: 18px;
              font-weight: 700;
              color: #1e3a8a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              margin-top: 30px;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .grid-2col {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .insight-box {
              background: #eff6ff;
              border-left: 4px solid #3b82f6;
              padding: 16px;
              border-radius: 0 8px 8px 0;
              margin-bottom: 15px;
            }
            .insight-label {
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 6px;
              font-size: 14px;
            }
            .stat-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px dashed #e2e8f0;
              font-size: 13px;
            }
            .stat-value {
              font-weight: 700;
            }
            .event-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            .event-table th {
              background: #f1f5f9;
              color: #475569;
              font-weight: 700;
              text-align: left;
              padding: 10px;
              border-bottom: 2px solid #e2e8f0;
            }
            .event-table td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
            }
            .event-simulated {
              background: #f8fafc;
              font-style: italic;
            }
            .probability-container {
              display: flex;
              height: 24px;
              border-radius: 6px;
              overflow: hidden;
              margin: 15px 0;
              text-align: center;
              font-weight: 700;
              font-size: 11px;
              color: white;
              line-height: 24px;
            }
            .prob-home { background: #10b981; }
            .prob-draw { background: #64748b; }
            .prob-away { background: #d946ef; }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="brand-title">AQX SPORTS ANALYTICS</h1>
              <p class="brand-subtitle">Tactical Performance & Projection Report</p>
            </div>
            <div class="report-date">
              Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
              Database Platform: SQLite / BigQuery
            </div>
          </div>
          
          <div class="match-header">
            <div class="match-teams">
              <span>${matchDetail.home_team}</span>
              <span class="match-score">${displayHomeScore} - ${displayAwayScore}</span>
              <span>${matchDetail.away_team}</span>
            </div>
            <div class="match-meta">
              <span>Tournament: <strong>${matchDetail.tournament}</strong></span>
              <span>|</span>
              <span>Status: <span class="badge ${isSimulated ? 'badge-simulated' : (matchDetail.status === 'live' ? 'badge-live' : 'badge-completed')}">${statusText}</span></span>
            </div>
          </div>

          <div class="section-title">Live Win Probabilities (Projection)</div>
          <div class="probability-container">
            <div class="prob-home" style="width: ${homeProb}%">${matchDetail.home_team} Win: ${homeProb}%</div>
            <div class="prob-draw" style="width: ${drawProb}%">Draw: ${drawProb}%</div>
            <div class="prob-away" style="width: ${awayProb}%">${matchDetail.away_team} Win: ${awayProb}%</div>
          </div>

          <div class="grid-2col">
            <div>
              <div class="section-title">Gemini Tactical AI Insights</div>
              ${insights ? `
                <div class="insight-box">
                  <div class="insight-label">Strategic Recommendation</div>
                  <div>${insights.recommendation}</div>
                </div>
                <div style="margin-bottom: 10px;">
                  <strong>Match Summary:</strong> ${insights.game_state_summary}
                </div>
                <div style="margin-bottom: 10px;">
                  <strong>Formation Recommendation:</strong> ${insights.suggested_formation_change}
                </div>
                <div>
                  <strong>Tactical Substitutions:</strong>
                  <ul>
                    ${insights.suggested_substitutions.map(sub => `<li>${sub}</li>`).join("")}
                  </ul>
                </div>
              ` : `
                <div style="color: #64748b; font-style: italic;">No tactical recommendations processed. Run AI simulation to generate insights.</div>
              `}
            </div>

            <div>
              <div class="section-title">Tactical Performance Stats</div>
              <div class="stat-row">
                <span>Territory Dominance (${matchDetail.home_team})</span>
                <span class="stat-value">${homeAttackPct}% in attacking third</span>
              </div>
              <div class="stat-row">
                <span>Territory Dominance (${matchDetail.away_team})</span>
                <span class="stat-value">${awayAttackPct}% in attacking third</span>
              </div>
              <div class="stat-row">
                <span>Total Recorded Match Events</span>
                <span class="stat-value">${sortedEvents.length} events</span>
              </div>
              <div class="stat-row">
                <span>Simulated Future Events</span>
                <span class="stat-value">${activeSimulatedEvents.length} events</span>
              </div>
              <div class="stat-row">
                <span>Match Duration</span>
                <span class="stat-value">${sortedEvents[0]?.minute ? Math.max(90, sortedEvents[0].minute) : 90}' mins</span>
              </div>
            </div>
          </div>

          <div class="section-title">Match Event Log</div>
          <table class="event-table">
            <thead>
              <tr>
                <th style="width: 80px;">Minute</th>
                <th style="width: 100px;">Team</th>
                <th style="width: 150px;">Event Type</th>
                <th>Involved Player & Details</th>
                <th style="width: 100px; text-align: right;">Pitch Pos</th>
              </tr>
            </thead>
            <tbody>
              ${sortedEvents.map(evt => {
                const isSim = evt.is_simulated;
                return `
                  <tr class="${isSim ? 'event-simulated' : ''}">
                    <td><strong>${evt.minute}'</strong></td>
                    <td style="color: ${evt.team === 'home' ? '#10b981' : '#d946ef'}; font-weight: 600;">${evt.team.toUpperCase()}</td>
                    <td><strong>${evt.event_type} ${isSim ? '[Simulated]' : ''}</strong></td>
                    <td>${evt.player} ${evt.detail ? `(${evt.detail})` : ""}</td>
                    <td style="text-align: right; color: #64748b;">X:${Math.round(evt.location_x)} Y:${Math.round(evt.location_y)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="app-container">
      {/* HEADER NAVBAR */}
      <header className="header">
        <div className="logo-container" onClick={onBackToLanding} style={{ cursor: "pointer" }} title="Back to Landing Page">
          <div className="logo-icon">T</div>
          <div className="logo-text">
            <h1>Tactical Momentum Tracker</h1>
            <p>AQX Sports Analytics Platform</p>
          </div>
        </div>

        {/* Match Selection Dropdown */}
        <div className="match-selector-bar">
          <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>ACTIVE MATCH:</span>
          <select 
            className="custom-select" 
            value={activeMatchId} 
            onChange={(e) => setActiveMatchId(e.target.value)}
          >
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.home_team} vs {m.away_team} ({m.tournament})
              </option>
            ))}
          </select>
          <button onClick={() => loadMatchData(activeMatchId)} className="btn-secondary" style={{ padding: "10px" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={handleSyncWorldCup} className="btn-primary" style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px 14px", fontSize: "13px" }}>
            <Globe size={14} /> Sync World Cup
          </button>
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              width: "38px",
              height: "38px",
              padding: "0"
            }}
            title="Toggle Light/Dark Theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          {useFirebase && user && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={user.email}>
                {user.email}
              </span>
              <button 
                onClick={onLogout} 
                className="btn-secondary" 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: "38px",
                  height: "38px",
                  padding: "0"
                }}
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* TABS SELECTOR BAR */}
      <div className="tabs-navigation" style={{ 
        display: "flex", 
        alignItems: "center", 
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <button 
          onClick={() => setActiveTab("match")} 
          className={`tab-btn ${activeTab === "match" ? "active" : ""}`}
        >
          ⚽ Live Match Analyst
        </button>
        <button 
          onClick={() => setActiveTab("standings")} 
          className={`tab-btn ${activeTab === "standings" ? "active" : ""}`}
        >
          🏆 World Cup 2026 Center
        </button>
        <button 
          onClick={() => setActiveTab("manager")} 
          className={`tab-btn ${activeTab === "manager" ? "active" : ""}`}
        >
          🎮 Manager Game
        </button>

        {activeTab === "match" && (
          <>
            <button 
              onClick={handleAutoSimulate} 
              className="btn-primary" 
              disabled={loading}
              style={{ 
                display: "flex", 
                gap: "6px", 
                alignItems: "center", 
                padding: "10px 16px", 
                fontSize: "13px", 
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)", 
                borderColor: "rgba(139, 92, 246, 0.4)", 
                boxShadow: "0 0 8px rgba(139, 92, 246, 0.25)",
                borderRadius: "8px",
                fontWeight: "600"
              }}
            >
              <Sparkles size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Simulating..." : "🤖 AI Auto-Simulate"}
            </button>
            <button 
              onClick={handleExportPDF} 
              className="btn-secondary" 
              style={{ 
                display: "flex", 
                gap: "6px", 
                alignItems: "center", 
                padding: "10px 16px", 
                fontSize: "13px", 
                background: "rgba(255,255,255,0.05)",
                borderRadius: "8px"
              }}
            >
              <FileText size={14} /> Export PDF Report
            </button>
          </>
        )}
      </div>

      {activeTab === "match" && (
        <div className="dashboard-grid">
          
          {/* Match Score & Status Header Panel */}
          <div className="glass-panel match-header-panel">
            {/* Home Team */}
            <div className="team-box home">
              <div className="team-logo-placeholder">{matchDetail.home_team.substring(0,2).toUpperCase()}</div>
              <h2 style={{ fontSize: "20px" }}>{matchDetail.home_team}</h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Home</span>
            </div>

            {/* Score & Time */}
            <div className="score-box">
              <div className="score-numbers">
                {displayHomeScore} - {displayAwayScore}
              </div>
              <div className="match-meta-info" style={{ marginTop: "8px" }}>
                {isSimulated ? (
                  <span className="badge-live" style={{ background: "var(--color-draw)", animation: "none" }}>Simulated Scenario</span>
                ) : matchDetail.status === "live" ? (
                  <span className="badge-live">Live - Min {sortedEvents[0]?.minute || 0}'</span>
                ) : (
                  <span className="badge-completed">Completed</span>
                )}
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{matchDetail.tournament}</span>
              </div>
            </div>

            {/* Away Team */}
            <div className="team-box away">
              <div className="team-logo-placeholder">{matchDetail.away_team.substring(0,2).toUpperCase()}</div>
              <h2 style={{ fontSize: "20px" }}>{matchDetail.away_team}</h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Away</span>
            </div>
          </div>

          {/* Victory Probability Bar */}
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Flame size={16} style={{ color: "var(--color-draw)" }} />
                Live Victory Probability
              </h3>
              {isSimulated && (
                <span style={{ fontSize: "11px", background: "rgba(59,130,246,0.15)", color: "var(--color-draw)", padding: "2px 8px", borderRadius: "12px", fontWeight: "600" }}>
                  Simulated
                </span>
              )}
            </div>

            <div className="probability-section">
              <div className="probability-bar-container">
                <div className="prob-segment home" style={{ width: `${homeProb}%` }}>{homeProb}%</div>
                <div className="prob-segment draw" style={{ width: `${drawProb}%` }}>{drawProb}%</div>
                <div className="prob-segment away" style={{ width: `${awayProb}%` }}>{awayProb}%</div>
              </div>
              <div className="prob-labels">
                <span>{matchDetail.home_team} Win</span>
                <span>Draw</span>
                <span>{matchDetail.away_team} Win</span>
              </div>
            </div>
          </div>

          {/* D3 Momentum Chart */}
          <div className="glass-panel" style={{ height: "360px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={18} style={{ color: "var(--color-home)" }} />
                Real-Time Match Momentum Timeline
              </h3>
              <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-home)" }}></span> {matchDetail.home_team}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-away)" }}></span> {matchDetail.away_team}</span>
              </div>
            </div>
            
            <div style={{ flex: 1, minHeight: 0 }}>
              <MatchTimeline 
                data={momentumData.timeline} 
                homeTeam={matchDetail.home_team} 
                awayTeam={matchDetail.away_team} 
                theme={theme}
              />
            </div>
          </div>

          {/* Heatmap & Event Log Row */}
          <div className="dashboard-row-2col">
            <DominanceHeatmap 
              events={combinedEvents} 
              heatPoints={isSimulated ? activeSimulatedHeatPoints : []}
              homeTeam={matchDetail.home_team} 
              awayTeam={matchDetail.away_team} 
              hoveredEventId={hoveredEventId}
              theme={theme}
            />

            {/* Normalized Event Log */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
              <div>
                <h3 style={{ fontSize: "15px" }}>Normalized Event Log</h3>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Aggregated match data cached in BigQuery / SQLite
                </p>
              </div>

              <div className="events-list-container" style={{ flex: 1, minHeight: 0 }}>
                {sortedEvents.map(evt => {
                  const isSim = evt.is_simulated;
                  return (
                    <div 
                      key={evt.id} 
                      className={`event-row ${evt.team}`}
                      onMouseEnter={() => setHoveredEventId(evt.id)}
                      onMouseLeave={() => setHoveredEventId(null)}
                      style={{
                        ...(isSim ? { 
                          borderStyle: "dashed", 
                          borderColor: evt.team === "home" ? "var(--color-home)" : "var(--color-away)", 
                          background: "rgba(59, 130, 246, 0.08)",
                          boxShadow: "0 0 8px rgba(59, 130, 246, 0.15)"
                        } : {}),
                        ...(hoveredEventId === evt.id ? {
                          transform: "translateX(4px)",
                          borderColor: evt.team === "home" ? "#10b981" : "#d946ef",
                          boxShadow: `0 0 8px ${evt.team === "home" ? "rgba(16,185,129,0.3)" : "rgba(217,70,239,0.3)"}`,
                          background: "rgba(255,255,255,0.04)"
                        } : {}),
                        transition: "all 0.2s ease"
                      }}
                    >
                      <span className="event-time-badge" style={isSim ? { background: "var(--color-draw)", color: "#fff" } : {}}>{evt.minute}'</span>
                      <span style={{ fontWeight: "700" }}>
                        {evt.event_type}
                        {isSim && <span style={{ fontSize: "9px", color: "var(--color-draw)", marginLeft: "6px", fontWeight: "800", textTransform: "uppercase" }}>[Simulated]</span>}
                      </span>
                      <span className="flex-grow" style={{ color: "var(--text-secondary)" }}>
                        {evt.player} {evt.detail ? `(${evt.detail})` : ""}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        X:{Math.round(evt.location_x)} Y:{Math.round(evt.location_y)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scenario Simulator & AI Insights Row */}
          <div className="dashboard-row-2col">
            <ScenarioSimulator 
              matchId={activeMatchId}
              onSimulate={handleSimulate}
              onReset={handleResetSimulation}
              homeTeam={matchDetail.home_team}
              awayTeam={matchDetail.away_team}
            />

            {/* AI Tactical Recommendations (Gemini Module) */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Tv size={18} style={{ color: "var(--color-draw)" }} />
                  Gemini Tactical AI Insights
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Coaching engine analyzing momentum inflection patterns
                </p>
              </div>

              {loadingInsights ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--text-secondary)", fontSize: "13px", padding: "16px 0" }}>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Generating tactical response report...</span>
                </div>
              ) : insights ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                  {/* Tactical Recommendation */}
                  <div style={{ padding: "12px", background: "rgba(59,130,246,0.05)", borderLeft: "3px solid var(--color-draw)", borderRadius: "0 8px 8px 0" }}>
                    <div style={{ fontWeight: "700", marginBottom: "4px", color: "var(--color-draw)" }}>Strategic Recommendation</div>
                    <p style={{ color: "#e5e7eb", lineHeight: "1.4" }}>{insights.recommendation}</p>
                  </div>

                  {/* Game State Summary */}
                  <div>
                    <div style={{ fontWeight: "700", marginBottom: "2px", color: "#f3f4f6" }}>Match State Summary</div>
                    <p style={{ color: "var(--text-secondary)" }}>{insights.game_state_summary}</p>
                  </div>

                  {/* Formation Recommendation */}
                  <div>
                    <div style={{ fontWeight: "700", marginBottom: "2px", color: "#f3f4f6" }}>Formation Adjustment</div>
                    <p style={{ color: "var(--text-secondary)" }}>{insights.suggested_formation_change}</p>
                  </div>

                  {/* Substitution Recommendations */}
                  <div>
                    <div style={{ fontWeight: "700", marginBottom: "4px", color: "#f3f4f6" }}>Tactical Substitutions</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {insights.suggested_substitutions.map((sub, idx) => (
                        <div key={idx} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", color: "var(--text-secondary)" }}>
                          {sub}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No analytical insights processed yet.</div>
              )}
            </div>
          </div>

          {/* Event Ingestion Form & Fan Engagement Alerts Row */}
          <div className="dashboard-row-2col">
            {/* Live Feed Event Ingestion Form */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "15px" }}>Live Feed Event Ingestion</h3>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Simulates parsed data streams passing through API endpoints
                </p>
              </div>

              <form onSubmit={handleIngestEvent} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>TEAM</label>
                    <select className="custom-select" value={ingestTeam} onChange={(e) => setIngestTeam(e.target.value)} style={{ padding: "8px 10px" }}>
                      <option value="home">Home ({matchDetail.home_team})</option>
                      <option value="away">Away ({matchDetail.away_team})</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>EVENT TYPE</label>
                    <select className="custom-select" value={ingestType} onChange={(e) => setIngestType(e.target.value)} style={{ padding: "8px 10px" }}>
                      <option value="Goal">Goal</option>
                      <option value="Shot on Target">Shot on Target</option>
                      <option value="Shot off Target">Shot off Target</option>
                      <option value="Corner">Corner</option>
                      <option value="Foul">Foul</option>
                      <option value="Card">Card</option>
                      <option value="Save">Save</option>
                      <option value="Turnover">Turnover</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>PLAYER</label>
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="e.g. Haaland"
                    value={ingestPlayer}
                    onChange={(e) => setIngestPlayer(e.target.value)}
                    style={{ padding: "8px 10px" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>DETAIL DESCRIPTION (OPTIONAL)</label>
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="e.g. Penalty, Yellow Card"
                    value={ingestDetail}
                    onChange={(e) => setIngestDetail(e.target.value)}
                    style={{ padding: "8px 10px" }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", padding: "8px 12px" }}>
                  <PlusCircle size={14} /> Ingest Live Event
                </button>
              </form>
            </div>

            <FanEngagement 
              timeline={momentumData.timeline}
              homeTeam={matchDetail.home_team}
              awayTeam={matchDetail.away_team}
            />
          </div>
        </div>
      )}

      {activeTab === "standings" && (
        /* WORLD CUP 2026 CENTER VIEW */
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "8px", background: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(59,130,246,0.05) 100%)" }}>
            <h2 style={{ fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
              🏆 FIFA World Cup 2026 Center
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Dynamic insights, group standings, fixtures and rolling analytics directly from World Cup API feeds.
            </p>
          </div>

          {/* Sub-tabs Selection */}
          <div className="sub-tabs-container">
            <button 
              onClick={() => setWorldCupSubTab("standings")} 
              className={`sub-tab-btn ${worldCupSubTab === "standings" ? "active" : ""}`}
            >
              📊 Group Standings
            </button>
            <button 
              onClick={() => setWorldCupSubTab("fixtures")} 
              className={`sub-tab-btn ${worldCupSubTab === "fixtures" ? "active" : ""}`}
            >
              📅 Fixtures & Results
            </button>
          </div>

          {worldCupSubTab === "standings" ? (
            loadingGroups ? (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "var(--text-secondary)", padding: "40px" }}>
                <RefreshCw className="animate-spin" size={24} />
                <span>Retrieving group tables and team stats...</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                {groups.map((group) => (
                  <div key={group.name} className="glass-panel" style={{ padding: "18px", borderTop: "3px solid var(--color-draw)", overflowX: "auto" }}>
                    <h3 style={{ color: "var(--color-draw)", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "12px", fontFamily: "Outfit, sans-serif" }}>
                      Group {group.name}
                    </h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left", minWidth: "280px" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", height: "30px" }}>
                          <th style={{ width: "24px" }}>#</th>
                          <th>Team</th>
                          <th style={{ textAlign: "center", width: "32px" }}>MP</th>
                          <th style={{ textAlign: "center", width: "32px" }}>GD</th>
                          <th style={{ textAlign: "center", width: "32px" }}>PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.teams.map((team, idx) => {
                          const isQualifying = idx < 2;
                          return (
                            <tr 
                              key={team.team_id} 
                              style={{ 
                                height: "40px", 
                                borderBottom: "1px solid rgba(255,255,255,0.03)",
                                background: isQualifying ? "rgba(16, 185, 129, 0.02)" : "transparent"
                              }}
                            >
                              <td style={{ fontWeight: "700", color: isQualifying ? "var(--color-home)" : "var(--text-muted)" }}>
                                {idx + 1}
                              </td>
                              <td style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px" }}>
                                {team.flag && (
                                  <img 
                                    src={team.flag} 
                                    alt="" 
                                    style={{ width: "18px", height: "12px", objectFit: "cover", borderRadius: "1px", transform: "skewX(-6deg)" }} 
                                  />
                                )}
                                <span style={{ fontWeight: "500", color: "var(--text-primary)" }}>{team.name}</span>
                              </td>
                              <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>{team.mp}</td>
                              <td style={{ 
                                textAlign: "center", 
                                fontWeight: "600",
                                color: parseInt(team.gd) > 0 ? "var(--color-home)" : parseInt(team.gd) < 0 ? "var(--color-away)" : "var(--text-muted)" 
                              }}>
                                {parseInt(team.gd) > 0 ? `+${team.gd}` : team.gd}
                              </td>
                              <td style={{ textAlign: "center", fontWeight: "700", color: "var(--color-home)" }}>{team.pts}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* FIXTURES & RESULTS VIEW */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Filter controls */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", flexGrow: 1 }}>
                  <input 
                    type="text"
                    placeholder="Search team name..."
                    className="custom-input"
                    value={fixtureSearch}
                    onChange={(e) => setFixtureSearch(e.target.value)}
                    style={{ maxWidth: "250px", padding: "8px 14px", fontSize: "13px" }}
                  />
                  <select
                    className="custom-select"
                    value={fixturePhase}
                    onChange={(e) => setFixturePhase(e.target.value)}
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                  >
                    <option value="all">All Phases</option>
                    <option value="Group Stage">Group Stage</option>
                    <option value="Round of 32">Round of 32</option>
                    <option value="Round of 16">Round of 16</option>
                    <option value="Quarterfinals">Quarterfinals</option>
                    <option value="Semifinals">Semifinals</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {["all", "completed", "scheduled", "live"].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setFixtureFilter(filter)}
                      className="btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        borderRadius: "8px",
                        background: fixtureFilter === filter ? "var(--color-draw)" : "",
                        borderColor: fixtureFilter === filter ? "var(--color-draw)" : "",
                        color: fixtureFilter === filter ? "#fff" : ""
                      }}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Fixtures */}
              <div className="fixtures-grid">
                {(() => {
                  const getMatchPhase = (matchId) => {
                    if (!matchId.startsWith("wc-2026-")) return "Local Match";
                    const num = parseInt(matchId.replace("wc-2026-", ""));
                    if (isNaN(num)) return "World Cup 2026";
                    if (num <= 72) return "Group Stage";
                    if (num <= 88) return "Round of 32";
                    if (num <= 96) return "Round of 16";
                    if (num <= 100) return "Quarterfinals";
                    if (num <= 102) return "Semifinals";
                    if (num === 103) return "Third Place Playoff";
                    if (num === 104) return "Final";
                    return "Knockout Stage";
                  };

                  // Resolve flags from groups data
                  const teamFlags = {};
                  groups.forEach(g => {
                    if (g && g.teams) {
                      g.teams.forEach(t => {
                        teamFlags[t.name] = t.flag;
                      });
                    }
                  });

                  // Filter matches
                  const filteredMatches = matches.filter(m => {
                    const isWc = m.tournament === "World Cup 2026";
                    const matchesSearch = m.home_team.toLowerCase().includes(fixtureSearch.toLowerCase()) || 
                                          m.away_team.toLowerCase().includes(fixtureSearch.toLowerCase());
                    
                    let matchesStatus = true;
                    if (fixtureFilter === "completed") matchesStatus = m.status === "completed";
                    else if (fixtureFilter === "scheduled") matchesStatus = m.status === "scheduled";
                    else if (fixtureFilter === "live") matchesStatus = m.status === "live";
                    
                    let matchesPhase = true;
                    if (fixturePhase !== "all") {
                      matchesPhase = getMatchPhase(m.id) === fixturePhase;
                    }
                    
                    return isWc && matchesSearch && matchesStatus && matchesPhase;
                  });

                  if (filteredMatches.length === 0) {
                    return (
                      <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", borderRadius: "12px" }}>
                        No matches matching the criteria found.
                      </div>
                    );
                  }

                  return filteredMatches.map(m => {
                    const homeFlag = teamFlags[m.home_team] || "";
                    const awayFlag = teamFlags[m.away_team] || "";
                    
                    return (
                      <div key={m.id} className="fixture-card">
                        <div className="fixture-header">
                          <span style={{ fontWeight: "600", color: "var(--color-draw)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {getMatchPhase(m.id)}
                          </span>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <span>{m.date}</span>
                            <span className={`status-badge ${m.status}`}>{m.status}</span>
                          </div>
                        </div>
                        
                        <div className="fixture-teams">
                          <div className="fixture-team-row">
                            <div className="fixture-team-info">
                              {homeFlag ? (
                                <img src={homeFlag} alt="" className="fixture-flag" />
                              ) : (
                                <div className="fixture-flag" style={{ background: "rgba(255,255,255,0.1)", display: "inline-block" }}></div>
                              )}
                              <span className="fixture-team-name">{m.home_team}</span>
                            </div>
                            {m.status !== "scheduled" && <span className="fixture-score">{m.home_score}</span>}
                          </div>
                          
                          <div className="fixture-team-row">
                            <div className="fixture-team-info">
                              {awayFlag ? (
                                <img src={awayFlag} alt="" className="fixture-flag" />
                              ) : (
                                <div className="fixture-flag" style={{ background: "rgba(255,255,255,0.1)", display: "inline-block" }}></div>
                              )}
                              <span className="fixture-team-name">{m.away_team}</span>
                            </div>
                            {m.status !== "scheduled" && <span className="fixture-score">{m.away_score}</span>}
                          </div>
                        </div>
                        
                        <div className="fixture-footer">
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.tournament}</span>
                          <button 
                            onClick={() => {
                              setActiveMatchId(m.id);
                              setActiveTab("match");
                            }}
                            className="btn-primary"
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                          >
                            {m.status === "scheduled" ? "Predict" : "Analyze"}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "manager" && (
        <ManagerGame theme={theme} />
      )}
      <QuotaLimitModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} />
    </div>
  );
}

function QuotaLimitModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleReport = () => {
    const waUrl = "https://wa.me/6282166964069?text=" + encodeURIComponent("Halo Developer, saya mengalami limit pada model Gemini AI di aplikasi Tactical Tracker. Mohon bantuannya untuk memeriksa kuota API.");
    window.open(waUrl, "_blank");
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      backdropFilter: "blur(8px)"
    }}>
      <div className="glass-panel" style={{
        maxWidth: "450px",
        width: "90%",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        border: "1px solid rgba(239, 68, 68, 0.4)",
        boxShadow: "0 0 25px rgba(239, 68, 68, 0.2)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "40px" }}>⚠️</div>
        <h2 style={{ fontSize: "20px", color: "#f87171" }}>Gemini AI Limit Terlampaui</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          Batas penggunaan kuota API Gemini telah terlampaui. Sistem telah beralih ke analisis lokal cadangan agar Anda tetap dapat menganalisis taktik pertandingan tanpa terputus. Silakan laporkan masalah ini ke pengembang.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button 
            onClick={onClose} 
            className="btn-secondary" 
            style={{ flex: 1, padding: "10px" }}
          >
            Tutup
          </button>
          <button 
            onClick={handleReport} 
            className="btn-primary" 
            style={{ 
              flex: 1, 
              padding: "10px", 
              background: "#25D366", 
              borderColor: "#25D366",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontWeight: "600"
            }}
          >
            💬 Laporkan (WhatsApp)
          </button>
        </div>
      </div>
    </div>
  );
}
