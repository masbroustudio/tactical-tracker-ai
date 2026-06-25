import React, { useState } from "react";
import { Play, RotateCcw, Plus, Trash2, Sparkles } from "lucide-react";

export default function ScenarioSimulator({ matchId, onSimulate, onReset, homeTeam, awayTeam }) {
  const [hypotheticalEvents, setHypotheticalEvents] = useState([]);

  
  // Form States
  const [minute, setMinute] = useState(60);
  const [team, setTeam] = useState("home");
  const [eventType, setEventType] = useState("Goal");
  const [detail, setDetail] = useState("");
  const [player, setPlayer] = useState("");
  const [locX, setLocX] = useState(85);
  const [locY, setLocY] = useState(50);

  // Auto-adjust default X coordinate based on team/event
  const handleEventChange = (e) => {
    const val = e.target.value;
    setEventType(val);
    if (val === "Goal") {
      setLocX(team === "home" ? 95 : 5);
      setLocY(50);
    } else if (val === "Corner") {
      setLocX(team === "home" ? 99 : 1);
      setLocY(98);
    }
  };

  const handleTeamChange = (e) => {
    const val = e.target.value;
    setTeam(val);
    if (eventType === "Goal") {
      setLocX(val === "home" ? 95 : 5);
    }
  };

  const addEvent = () => {
    const newEvent = {
      minute: parseInt(minute),
      second: 0,
      team,
      player: player.trim() || (team === "home" ? `${homeTeam} Player` : `${awayTeam} Player`),
      event_type: eventType,
      detail: detail.trim() || eventType,
      location_x: parseFloat(locX),
      location_y: parseFloat(locY)
    };

    const updated = [...hypotheticalEvents, newEvent].sort((a, b) => a.minute - b.minute);
    setHypotheticalEvents(updated);
    
    // Clear/Reset partial inputs
    setPlayer("");
    setDetail("");
  };

  const removeEvent = (index) => {
    const updated = hypotheticalEvents.filter((_, idx) => idx !== index);
    setHypotheticalEvents(updated);
  };

  const triggerSimulation = () => {
    onSimulate(hypotheticalEvents);
  };

  const triggerReset = () => {
    setHypotheticalEvents([]);
    onReset();
  };



  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h3 style={{ fontSize: "16px" }}>Match Scenario Simulator</h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          Simulate historical changes or project future events to recalculate momentum
        </p>
      </div>

      {/* Simulator Inputs Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
        
        {/* Minute */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>MINUTE</label>
          <input
            type="number"
            min="0"
            max="120"
            className="custom-input"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          />
        </div>

        {/* Team */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>TEAM</label>
          <select className="custom-select" value={team} onChange={handleTeamChange} style={{ padding: "9px 12px" }}>
            <option value="home">{homeTeam} (Home)</option>
            <option value="away">{awayTeam} (Away)</option>
          </select>
        </div>

        {/* Event Type */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>EVENT TYPE</label>
          <select className="custom-select" value={eventType} onChange={handleEventChange} style={{ padding: "9px 12px" }}>
            <option value="Goal">Goal (+5.0)</option>
            <option value="Shot on Target">Shot on Target (+1.5)</option>
            <option value="Shot off Target">Shot off Target (+0.8)</option>
            <option value="Corner">Corner Kick (+0.6)</option>
            <option value="Foul">Foul (-1.0)</option>
            <option value="Card">Card / Disciplinary</option>
            <option value="Save">Goalkeeper Save (+1.0)</option>
            <option value="Turnover">Turnover / Possession Loss (-1.2)</option>
          </select>
        </div>

        {/* Event Detail (e.g. Red Card, Penalty) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>EVENT DETAIL (OPTIONAL)</label>
          <input
            type="text"
            className="custom-input"
            placeholder="e.g. Red Card, Penalty, Header"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>

        {/* Player Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: "span 2" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>PLAYER INVOLVED</label>
          <input
            type="text"
            className="custom-input"
            placeholder="e.g. Lionel Messi"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
          />
        </div>

        {/* Coordinates */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>PITCH X (0-100)</label>
          <input
            type="range"
            min="0"
            max="100"
            style={{ accentColor: "var(--color-draw)", margin: "8px 0" }}
            value={locX}
            onChange={(e) => setLocX(e.target.value)}
          />
          <span style={{ fontSize: "10px", color: "var(--text-secondary)", textAlign: "center" }}>{locX}% (Goal/Corner line)</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>PITCH Y (0-100)</label>
          <input
            type="range"
            min="0"
            max="100"
            style={{ accentColor: "var(--color-draw)", margin: "8px 0" }}
            value={locY}
            onChange={(e) => setLocY(e.target.value)}
          />
          <span style={{ fontSize: "10px", color: "var(--text-secondary)", textAlign: "center" }}>{locY}% (Vertical pitch width)</span>
        </div>

        {/* Add Event Button */}
        <button
          onClick={addEvent}
          className="btn-secondary"
          style={{ gridColumn: "span 2", marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", justifyContent: "center" }}
        >
          <Plus size={14} /> Add Event to Scenario
        </button>
      </div>

      {/* Simulated Events Queue */}
      {hypotheticalEvents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h4 style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Hypothetical Event Chain</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
            {hypotheticalEvents.map((evt, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: evt.team === "home" ? "rgba(16,185,129,0.06)" : "rgba(217,70,239,0.06)",
                  borderRadius: "6px",
                  borderLeft: `3px solid ${evt.team === "home" ? "var(--color-home)" : "var(--color-away)"}`,
                  fontSize: "12px"
                }}
              >
                <div>
                  <span style={{ fontWeight: "700", marginRight: "6px" }}>{evt.minute}'</span>
                  <span style={{ color: evt.team === "home" ? "var(--color-home)" : "var(--color-away)", fontWeight: "600", marginRight: "6px" }}>
                    {evt.team === "home" ? "HOME" : "AWAY"}
                  </span>
                  <span>{evt.event_type} ({evt.player})</span>
                </div>
                <button
                  onClick={() => removeEvent(idx)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.target.style.color = "#ef4444"}
                  onMouseLeave={(e) => e.target.style.color = "var(--text-muted)"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={triggerSimulation}
          className="btn-primary"
          disabled={hypotheticalEvents.length === 0}
          style={{
            flex: 1,
            display: "flex",
            gap: "8px",
            alignItems: "center",
            justifyContent: "center",
            opacity: hypotheticalEvents.length === 0 ? 0.5 : 1,
            cursor: hypotheticalEvents.length === 0 ? "not-allowed" : "pointer"
          }}
        >
          <Play size={14} /> Calculate Scenario
        </button>
        <button
          onClick={triggerReset}
          className="btn-secondary"
          style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center" }}
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}
