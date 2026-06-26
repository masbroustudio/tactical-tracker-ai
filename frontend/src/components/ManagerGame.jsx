import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RefreshCw, Sparkles, ShieldAlert, Award, ArrowRight, Settings, Info, Users, Shield } from "lucide-react";
import MatchTimeline from "./MatchTimeline";
import DominanceHeatmap from "./DominanceHeatmap";

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000/api"
  : "/api";

// List of World Cup 2026 Teams
const TEAMS = [
  { name: "Indonesia", code: "IDN", rating: 80, flag: "🇮🇩" },
  { name: "Japan", code: "JPN", rating: 88, flag: "🇯🇵" },
  { name: "Argentina", code: "ARG", rating: 92, flag: "🇦🇷" },
  { name: "Brazil", code: "BRA", rating: 90, flag: "🇧🇷" },
  { name: "France", code: "FRA", rating: 93, flag: "🇫🇷" },
  { name: "Germany", code: "GER", rating: 89, flag: "🇩🇪" },
  { name: "England", code: "ENG", rating: 91, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Spain", code: "ESP", rating: 90, flag: "🇪🇸" },
  { name: "United States", code: "USA", rating: 83, flag: "🇺🇸" },
  { name: "Morocco", code: "MAR", rating: 86, flag: "🇲🇦" },
  { name: "Saudi Arabia", code: "KSA", rating: 81, flag: "🇸🇦" },
  { name: "South Korea", code: "KOR", rating: 85, flag: "🇰🇷" }
];

const FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"];
const ATTACK_TACTICS = ["Tiki-Taka", "Direct Counter", "Wing Play", "Long Ball"];
const DEFENSE_TACTICS = ["High Press", "Mid Press", "Low Block"];
const INTENSITIES = ["Cautious", "Balanced", "Aggressive"];

export default function ManagerGame({ theme }) {
  // Pre-match Setup States
  const [userTeam, setUserTeam] = useState(TEAMS[0]);
  const [aiTeam, setAiTeam] = useState(TEAMS[1]);
  const [userFormation, setUserFormation] = useState("4-3-3");
  const [userAttackTactic, setUserAttackTactic] = useState("Tiki-Taka");
  const [userDefenseTactic, setUserDefenseTactic] = useState("High Press");
  const [userIntensity, setUserIntensity] = useState("Balanced");

  // AI Tactical State (Auto-selected based on team rating)
  const [aiFormation, setAiFormation] = useState("4-2-3-1");
  const [aiAttackTactic, setAiAttackTactic] = useState("Direct Counter");
  const [aiDefenseTactic, setAiDefenseTactic] = useState("Mid Press");
  const [aiIntensity, setAiIntensity] = useState("Balanced");

  // Gameplay Simulation States
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [minute, setMinute] = useState(0);
  const [scoreUser, setScoreUser] = useState(0);
  const [scoreAI, setScoreAI] = useState(0);
  const [events, setEvents] = useState([]);
  const [heatPoints, setHeatPoints] = useState([]);
  const [netMomentum, setNetMomentum] = useState(0);
  const [timeline, setTimeline] = useState([]);

  // Stats Counters
  const [possession, setPossession] = useState(50);
  const [shotsUser, setShotsUser] = useState(0);
  const [shotsAI, setShotsAI] = useState(0);
  const [cornersUser, setCornersUser] = useState(0);
  const [cornersAI, setCornersAI] = useState(0);
  const [foulsUser, setFoulsUser] = useState(0);
  const [foulsAI, setFoulsAI] = useState(0);

  // Post-match AI analysis
  const [analysis, setAnalysis] = useState("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  // References for live scroll
  const logEndRef = useRef(null);

  // Refs for tracking mutable match state inside the interval loop
  const userFormationRef = useRef(userFormation);
  const userAttackTacticRef = useRef(userAttackTactic);
  const userDefenseTacticRef = useRef(userDefenseTactic);
  const userIntensityRef = useRef(userIntensity);
  const scoreUserRef = useRef(0);
  const scoreAIRef = useRef(0);
  const aiFormationRef = useRef(aiFormation);
  const aiAttackTacticRef = useRef(aiAttackTactic);
  const aiDefenseTacticRef = useRef(aiDefenseTactic);
  const aiIntensityRef = useRef(aiIntensity);

  // Sync refs with their respective state updates
  useEffect(() => { userFormationRef.current = userFormation; }, [userFormation]);
  useEffect(() => { userAttackTacticRef.current = userAttackTactic; }, [userAttackTactic]);
  useEffect(() => { userDefenseTacticRef.current = userDefenseTactic; }, [userDefenseTactic]);
  useEffect(() => { userIntensityRef.current = userIntensity; }, [userIntensity]);
  useEffect(() => { aiFormationRef.current = aiFormation; }, [aiFormation]);
  useEffect(() => { aiAttackTacticRef.current = aiAttackTactic; }, [aiAttackTactic]);
  useEffect(() => { aiDefenseTacticRef.current = aiDefenseTactic; }, [aiDefenseTactic]);
  useEffect(() => { aiIntensityRef.current = aiIntensity; }, [aiIntensity]);

  // Automatically select AI strategy when teams change
  useEffect(() => {
    if (aiTeam) {
      if (aiTeam.rating > 90) {
        setAiFormation("4-3-3");
        setAiAttackTactic("Tiki-Taka");
        setAiDefenseTactic("High Press");
        setAiIntensity("Aggressive");
      } else if (aiTeam.rating > 85) {
        setAiFormation("4-2-3-1");
        setAiAttackTactic("Wing Play");
        setAiDefenseTactic("Mid Press");
        setAiIntensity("Balanced");
      } else {
        setAiFormation("5-3-2");
        setAiAttackTactic("Direct Counter");
        setAiDefenseTactic("Low Block");
        setAiIntensity("Cautious");
      }
    }
  }, [aiTeam]);

  // Scroll event log to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  // Fast-forward game loop simulation (1 tick = 1 game minute)
  useEffect(() => {
    if (!isStarted || isFinished || isPaused) return;

    const interval = setInterval(() => {
      setMinute((prevMin) => {
        const nextMin = prevMin + 1;
        if (nextMin >= 90) {
          clearInterval(interval);
          setIsFinished(true);
          // Add final whistle event
          setEvents((prev) => [
            ...prev,
            {
              id: "ft",
              minute: 90,
              team: "neutral",
              event_type: "Whistle",
              player: "Referee",
              detail: "Full Time! The match has concluded.",
              location_x: 50,
              location_y: 50
            }
          ]);
          return 90;
        }

        // Calculate dynamic factors based on current setups & ratings
        // Tactical match-ups:
        // - High Press counters Tiki-Taka slightly
        // - Direct Counter counters High Press
        // - Low Block counters Long Ball
        let userTacticFactor = 1.0;
        let aiTacticFactor = 1.0;

        if (userDefenseTacticRef.current === "High Press" && aiAttackTacticRef.current === "Tiki-Taka") userTacticFactor += 0.15;
        if (aiDefenseTacticRef.current === "High Press" && userAttackTacticRef.current === "Tiki-Taka") aiTacticFactor += 0.15;

        if (userAttackTacticRef.current === "Direct Counter" && aiDefenseTacticRef.current === "High Press") userTacticFactor += 0.2;
        if (aiAttackTacticRef.current === "Direct Counter" && userDefenseTacticRef.current === "High Press") aiTacticFactor += 0.2;

        if (userIntensityRef.current === "Aggressive") userTacticFactor += 0.15;
        if (aiIntensityRef.current === "Aggressive") aiTacticFactor += 0.15;

        // Apply team rating weight
        const baseUserWeight = userTeam.rating * userTacticFactor;
        const baseAIWeight = aiTeam.rating * aiTacticFactor;
        const totalWeight = baseUserWeight + baseAIWeight;

        // Calculate live possession fluctuation
        const targetPossession = Math.round((baseUserWeight / totalWeight) * 100) + Math.round((Math.random() * 10 - 5));
        setPossession((prev) => Math.max(25, Math.min(75, Math.round(prev * 0.8 + targetPossession * 0.2))));

        // In-game Event generator
        const eventChance = Math.random();
        let newEvent = null;

        // 12% chance of key event per minute
        if (eventChance < 0.12) {
          const isUserEvent = Math.random() * totalWeight < baseUserWeight;
          const activeTeam = isUserEvent ? "user" : "ai";
          const activeTeamName = isUserEvent ? userTeam.name : aiTeam.name;

          const eventTypes = ["Shot on Target", "Shot off Target", "Corner", "Foul", "Turnover"];
          const weights = [0.2, 0.25, 0.2, 0.25, 0.1];
          const choice = eventTypes[
            eventTypes.reduce((acc, curr, idx) => {
              if (acc.found) return acc;
              const nextSum = acc.sum + weights[idx];
              if (Math.random() < nextSum) return { found: true, idx };
              return { found: false, sum: nextSum };
            }, { found: false, sum: 0, idx: 0 }).idx
          ];

          const playerRole = ["Striker", "Midfielder", "Winger", "Defender"][Math.floor(Math.random() * 4)];
          const playerName = `${activeTeamName} ${playerRole}`;

          let locX = isUserEvent ? Math.random() * 40 + 50 : Math.random() * 40 + 10;
          let locY = Math.random() * 80 + 10;

          if (choice === "Shot on Target") {
            locX = isUserEvent ? 92 : 8;
            locY = Math.random() * 20 + 40;
            
            // Check if Goal scored (25% chance of goal on shot on target)
            if (Math.random() < 0.25) {
              newEvent = {
                id: `ev-${nextMin}`,
                minute: nextMin,
                team: activeTeam,
                event_type: "Goal",
                player: playerName,
                detail: "Goal! Clinical finish into the bottom corner!",
                location_x: isUserEvent ? 97 : 3,
                location_y: 50
              };
              if (isUserEvent) {
                const nextScore = scoreUserRef.current + 1;
                scoreUserRef.current = nextScore;
                setScoreUser(nextScore);
              } else {
                const nextScore = scoreAIRef.current + 1;
                scoreAIRef.current = nextScore;
                setScoreAI(nextScore);
              }
            } else {
              newEvent = {
                id: `ev-${nextMin}`,
                minute: nextMin,
                team: activeTeam,
                event_type: "Save",
                player: isUserEvent ? `${aiTeam.name} Goalkeeper` : `${userTeam.name} Goalkeeper`,
                detail: `Outstanding save preventing ${playerName}'s strike!`,
                location_x: isUserEvent ? 96 : 4,
                location_y: locY
              };
              if (isUserEvent) setShotsUser(s => s + 1);
              else setShotsAI(s => s + 1);
            }
          } else if (choice === "Shot off Target") {
            newEvent = {
              id: `ev-${nextMin}`,
              minute: nextMin,
              team: activeTeam,
              event_type: "Shot off Target",
              player: playerName,
              detail: "Shot fires wide of the post.",
              location_x: locX,
              location_y: locY
            };
            if (isUserEvent) setShotsUser(s => s + 1);
            else setShotsAI(s => s + 1);
          } else if (choice === "Corner") {
            newEvent = {
              id: `ev-${nextMin}`,
              minute: nextMin,
              team: activeTeam,
              event_type: "Corner",
              player: playerName,
              detail: "In-swinging cross from the corner flag.",
              location_x: isUserEvent ? 99 : 1,
              location_y: Math.random() < 0.5 ? 1 : 99
            };
            if (isUserEvent) setCornersUser(s => s + 1);
            else setCornersAI(s => s + 1);
          } else if (choice === "Foul") {
            const isCard = Math.random() < 0.2;
            newEvent = {
              id: `ev-${nextMin}`,
              minute: nextMin,
              team: activeTeam === "user" ? "ai" : "user", // who committed the foul
              event_type: "Foul",
              player: isUserEvent ? `${aiTeam.name} Defender` : `${userTeam.name} Defender`,
              detail: isCard ? "Yellow Card for a late tackle." : "Foul committed in midfield.",
              location_x: locX,
              location_y: locY
            };
            if (isUserEvent) setFoulsAI(f => f + 1); // AI fouled user
            else setFoulsUser(f => f + 1);
          }
        }

        if (newEvent) {
          setEvents((prev) => [...prev, newEvent]);
        }

        // Recalculate momentum net swing
        const momentumShift = (baseUserWeight - baseAIWeight) / 10 + (scoreUserRef.current - scoreAIRef.current) * 2;
        const netSwing = Math.max(-5, Math.min(5, momentumShift + (Math.random() * 2 - 1)));
        setNetMomentum(netSwing);

        // Append to timeline array
        setTimeline((prev) => [
          ...prev,
          {
            minute: nextMin,
            net_momentum: netSwing,
            home_score: scoreUserRef.current,
            away_score: scoreAIRef.current,
            event_marker: newEvent ? newEvent.event_type : null,
            event_description: newEvent ? `${newEvent.player} - ${newEvent.detail}` : null
          }
        ]);

        // Dynamically add a heat point based on active location
        setHeatPoints((prev) => {
          const list = [...prev];
          list.push({
            team: Math.random() * totalWeight < baseUserWeight ? "home" : "away",
            location_x: Math.round(Math.random() * 100),
            location_y: Math.round(Math.random() * 100),
            intensity: Math.random() * 0.8 + 0.6,
            minute: nextMin
          });
          return list;
        });

        return nextMin;
      });
    }, 500); // 500ms per simulated minute (total match ~ 45s)

    return () => clearInterval(interval);
  }, [isStarted, isFinished, isPaused, userTeam, aiTeam]);

  // Start the Manager Match Game
  const handleStartMatch = () => {
    if (userTeam.name === aiTeam.name) {
      alert("Please select different teams for the match!");
      return;
    }
    // Clean old states
    setMinute(0);
    setScoreUser(0);
    setScoreAI(0);
    scoreUserRef.current = 0;
    scoreAIRef.current = 0;
    setEvents([
      {
        id: "ko",
        minute: 0,
        team: "neutral",
        event_type: "Kickoff",
        player: "Referee",
        detail: `Kickoff! The match between ${userTeam.name} and ${aiTeam.name} has begun.`,
        location_x: 50,
        location_y: 50
      }
    ]);
    setHeatPoints([]);
    setTimeline([]);
    setPossession(50);
    setShotsUser(0);
    setShotsAI(0);
    setCornersUser(0);
    setCornersAI(0);
    setFoulsUser(0);
    setFoulsAI(0);
    setAnalysis("");
    setIsFinished(false);
    setIsPaused(false);
    setIsStarted(true);
  };

  // Reset simulator back to configuration setup
  const handleResetMatch = () => {
    setIsStarted(false);
    setIsFinished(false);
    setMinute(0);
    setEvents([]);
    setTimeline([]);
    setAnalysis("");
  };

  // Call Gemini (or Heuristic fallback) to generate post-match tactical analysis
  const handleGetAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const matchSummary = {
        userTeam: userTeam.name,
        aiTeam: aiTeam.name,
        userScore: scoreUser,
        aiScore: scoreAI,
        userTactics: {
          formation: userFormation,
          attack: userAttackTactic,
          defense: userDefenseTactic,
          intensity: userIntensity
        },
        aiTactics: {
          formation: aiFormation,
          attack: aiAttackTactic,
          defense: aiDefenseTactic,
          intensity: aiIntensity
        },
        stats: {
          possession,
          shotsUser,
          shotsAI,
          cornersUser,
          cornersAI,
          foulsUser,
          foulsAI
        },
        events: events.map(e => `Min ${e.minute}: ${e.event_type} (${e.player} - ${e.detail})`)
      };

      const response = await fetch(`${API_BASE}/manager/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(matchSummary)
      });
      const data = await response.json();
      setAnalysis(data.analysis);
      if (data && data.gemini_limit_exceeded) {
        setShowQuotaModal(true);
      }
    } catch (err) {
      console.error(err);
      // Fallback response if offline
      setAnalysis(`Post-Match Report: ${userTeam.name} ${scoreUser} - ${scoreAI} ${aiTeam.name}. You deployed a ${userFormation} ${userAttackTactic} system against the AI's ${aiFormation}. Your ${userDefenseTactic} successfully managed central spaces, allowing you to secure ${possession}% possession. Good strategic execution!`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div className="manager-game-container">
      {!isStarted ? (
        /* PRE-MATCH SETUP MODE */
        <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h2 style={{ fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={22} style={{ color: "var(--color-draw)" }} />
              FIFA World Cup 2026 - Manager Game
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Customize your country's strategy, formations, and playing styles to battle against the tactical AI.
            </p>
          </div>

          <div className="dashboard-row-2col">
            {/* User Team Setup Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                <span style={{ fontSize: "20px" }}>🧠</span>
                <h3 style={{ fontSize: "16px" }}>YOUR TEAM SETUP</h3>
              </div>

              {/* Select Team */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>CHOOSE COUNTRY</label>
                <select 
                  className="custom-select"
                  value={userTeam.name}
                  onChange={(e) => setUserTeam(TEAMS.find(t => t.name === e.target.value))}
                >
                  {TEAMS.map(t => (
                    <option key={t.name} value={t.name}>{t.flag} {t.name} (Rating: {t.rating})</option>
                  ))}
                </select>
              </div>

              {/* Select Formation */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>FORMATION</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {FORMATIONS.map(f => (
                    <button 
                      key={f}
                      onClick={() => setUserFormation(f)}
                      className={`btn-secondary ${userFormation === f ? "active" : ""}`}
                      style={{ padding: "8px 12px", fontSize: "12px", borderRadius: "6px", background: userFormation === f ? "var(--color-draw)" : "", color: userFormation === f ? "#fff" : "" }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attacking Tactics */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>ATTACKING STYLE</label>
                <select className="custom-select" value={userAttackTactic} onChange={(e) => setUserAttackTactic(e.target.value)}>
                  {ATTACK_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Defensive Tactics */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>DEFENSIVE STYLE</label>
                <select className="custom-select" value={userDefenseTactic} onChange={(e) => setUserDefenseTactic(e.target.value)}>
                  {DEFENSE_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Mentality/Intensity */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>TEAM MENTALITY</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {INTENSITIES.map(i => (
                    <button 
                      key={i}
                      onClick={() => setUserIntensity(i)}
                      className={`btn-secondary ${userIntensity === i ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px 10px", fontSize: "12px", borderRadius: "6px", background: userIntensity === i ? "var(--color-draw)" : "", color: userIntensity === i ? "#fff" : "" }}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Opponent Setup Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                <span style={{ fontSize: "20px" }}>🤖</span>
                <h3 style={{ fontSize: "16px" }}>AI OPPONENT SETUP</h3>
              </div>

              {/* Select AI Team */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>CHOOSE AI COUNTRY</label>
                <select 
                  className="custom-select"
                  value={aiTeam.name}
                  onChange={(e) => setAiTeam(TEAMS.find(t => t.name === e.target.value))}
                >
                  {TEAMS.map(t => (
                    <option key={t.name} value={t.name}>{t.flag} {t.name} (Rating: {t.rating})</option>
                  ))}
                </select>
              </div>

              <div style={{ padding: "12px", background: "rgba(255,255,255,0.01)", border: "1px dashed var(--border-color)", borderRadius: "8px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h4 style={{ fontSize: "13px", color: "var(--text-primary)" }}>Predicted AI Strategies</h4>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div>Formation: <strong style={{ color: "#fff" }}>{aiFormation}</strong></div>
                  <div>Attacking Style: <strong style={{ color: "#fff" }}>{aiAttackTactic}</strong></div>
                  <div>Defensive Block: <strong style={{ color: "#fff" }}>{aiDefenseTactic}</strong></div>
                  <div>Mentality: <strong style={{ color: "#fff" }}>{aiIntensity}</strong></div>
                </div>
              </div>

              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "11px" }}>
                <Info size={14} />
                <span>AI setups adjust dynamically according to their team rating metrics.</span>
              </div>
            </div>
          </div>

          <button onClick={handleStartMatch} className="btn-primary" style={{ padding: "14px", display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>
            <Play size={16} /> Play Match - Start Simulation
          </button>
        </div>
      ) : (
        /* ACTIVE MATCH SIMULATION MODE */
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Header Scoreboard */}
          <div className="glass-panel" style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "16px 24px" }}>
            {/* User Team */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "32px", marginBottom: "4px" }}>{userTeam.flag}</div>
              <h3 style={{ fontSize: "18px" }}>{userTeam.name}</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>User ({userFormation})</span>
            </div>

            {/* Score / Time */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "36px", fontWeight: "800", letterSpacing: "2px", fontFamily: "monospace" }}>
                {scoreUser} - {scoreAI}
              </div>
              <div style={{ marginTop: "4px" }}>
                {isFinished ? (
                  <span className="badge-completed">Full Time</span>
                ) : (
                  <span className="badge-live" style={{ background: isPaused ? "#b45309" : "#ef4444" }}>
                    {isPaused ? "Paused" : `Min ${minute}'`}
                  </span>
                )}
              </div>
            </div>

            {/* AI Team */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "32px", marginBottom: "4px" }}>{aiTeam.flag}</div>
              <h3 style={{ fontSize: "18px" }}>{aiTeam.name}</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>AI ({aiFormation})</span>
            </div>
          </div>

          {/* Sim Action Controls */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            {!isFinished && (
              <button 
                onClick={() => setIsPaused(!isPaused)} 
                className="btn-secondary"
                style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px 20px" }}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                {isPaused ? "Resume" : "Pause Match"}
              </button>
            )}
            <button 
              onClick={handleResetMatch} 
              className="btn-secondary"
              style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px 20px" }}
            >
              <RefreshCw size={14} />
              Exit to Setup
            </button>
          </div>

          <div className="dashboard-row-2col">
            {/* Live Visual Dominance Pitch */}
            <DominanceHeatmap 
              events={events}
              heatPoints={heatPoints}
              homeTeam={userTeam.name}
              awayTeam={aiTeam.name}
              hoveredEventId={null}
              theme={theme}
            />

            {/* Live Stats & Match Engine Logs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Match Stats Panel */}
              <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontSize: "14px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>MATCH STATS</h3>
                
                {/* Possession */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span>{possession}% Possession</span>
                    <span>{100 - possession}% Possession</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ width: `${possession}%`, background: "var(--color-home)" }}></div>
                    <div style={{ width: `${100 - possession}%`, background: "var(--color-away)" }}></div>
                  </div>
                </div>

                {/* Shots */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "4px" }}>
                  <span>{shotsUser}</span>
                  <span style={{ color: "var(--text-muted)" }}>Shots on Target</span>
                  <span>{shotsAI}</span>
                </div>

                {/* Corners */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "4px" }}>
                  <span>{cornersUser}</span>
                  <span style={{ color: "var(--text-muted)" }}>Corner Kicks</span>
                  <span>{cornersAI}</span>
                </div>

                {/* Fouls */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span>{foulsUser}</span>
                  <span style={{ color: "var(--text-muted)" }}>Fouls Committed</span>
                  <span>{foulsAI}</span>
                </div>
              </div>

              {/* Dynamic Commentaries Log */}
              <div className="glass-panel" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px" }}>
                <h3 style={{ fontSize: "14px" }}>MATCH COMMENTARY</h3>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                  {events.map((e, idx) => (
                    <div 
                      key={e.id || idx}
                      style={{ 
                        display: "flex", 
                        gap: "10px", 
                        fontSize: "12px", 
                        padding: "6px 8px", 
                        background: e.event_type === "Goal" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)", 
                        borderLeft: `3px solid ${e.team === "user" ? "var(--color-home)" : e.team === "ai" ? "var(--color-away)" : "var(--text-muted)"}`, 
                        borderRadius: "0 6px 6px 0" 
                      }}
                    >
                      <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>{e.minute}'</span>
                      <div className="flex-grow">
                        <span style={{ fontWeight: "600", marginRight: "6px" }}>{e.event_type}:</span>
                        <span style={{ color: "var(--text-secondary)" }}>{e.player ? `${e.player} - ` : ""}{e.detail}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={logEndRef}></div>
                </div>
              </div>
            </div>
          </div>

          {/* In-Game Tactical Manager adjustments */}
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} /> Mid-Match Tactical Adjustments
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              {/* Change Formation */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>ADJUST FORMATION</label>
                <select className="custom-select" value={userFormation} onChange={(e) => setUserFormation(e.target.value)} disabled={isFinished}>
                  {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Adjust Attack */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>ADJUST ATTACKING TACTIC</label>
                <select className="custom-select" value={userAttackTactic} onChange={(e) => setUserAttackTactic(e.target.value)} disabled={isFinished}>
                  {ATTACK_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Adjust Defense */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>ADJUST DEFENSIVE TACTIC</label>
                <select className="custom-select" value={userDefenseTactic} onChange={(e) => setUserDefenseTactic(e.target.value)} disabled={isFinished}>
                  {DEFENSE_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Adjust Intensity */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>ADJUST MENTALITY</label>
                <select className="custom-select" value={userIntensity} onChange={(e) => setUserIntensity(e.target.value)} disabled={isFinished}>
                  {INTENSITIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* D3 Momentum Chart */}
          <div className="glass-panel" style={{ height: "300px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontSize: "15px" }}>Live Simulation Momentum Index</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MatchTimeline 
                data={timeline} 
                homeTeam={userTeam.name} 
                awayTeam={aiTeam.name} 
                theme={theme}
              />
            </div>
          </div>

          {/* Post-match AI analysis container */}
          {isFinished && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "14px", border: "1px solid rgba(139, 92, 246, 0.4)", boxShadow: "0 0 15px rgba(139, 92, 246, 0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={18} style={{ color: "#8b5cf6" }} />
                    Gemini Post-Match Tactical Analysis
                  </h3>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    Receive structured tactical insights analyzing your coaching style against the AI opponent.
                  </p>
                </div>
                <button 
                  onClick={handleGetAnalysis} 
                  className="btn-primary" 
                  disabled={loadingAnalysis}
                  style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)", borderColor: "rgba(139, 92, 246, 0.4)" }}
                >
                  {loadingAnalysis ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    "Generate AI Report"
                  )}
                </button>
              </div>

              {analysis && (
                <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #8b5cf6", borderRadius: "0 8px 8px 0", fontSize: "13px", lineHeight: "1.5", color: "#e5e7eb" }}>
                  {analysis}
                </div>
              )}
            </div>
          )}

        </div>
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
