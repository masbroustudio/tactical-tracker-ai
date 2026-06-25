import React, { useState, useEffect } from "react";
import { MessageSquare, Send, Award, BarChart2 } from "lucide-react";

export default function FanEngagement({ timeline, homeTeam, awayTeam }) {
  const [pollVotes, setPollVotes] = useState({ home: 45, away: 30, draw: 25 });
  const [hasVoted, setHasVoted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  
  // Calculate total votes for percentage
  const totalVotes = pollVotes.home + pollVotes.away + pollVotes.draw;
  const homePct = Math.round((pollVotes.home / totalVotes) * 100);
  const awayPct = Math.round((pollVotes.away / totalVotes) * 100);
  const drawPct = 100 - homePct - awayPct;

  // Generate automated bot alerts based on momentum timeline shifts
  useEffect(() => {
    if (!timeline || timeline.length === 0) return;

    const alerts = [];
    let lastMomentum = 0;
    
    // Add initial welcome
    alerts.push({
      id: "init",
      timestamp: "00:01",
      sender: "Tactical Momentum Bot",
      text: `⚽ Match channel opened for ${homeTeam} vs ${awayTeam}. Ingesting real-time analytical feed!`,
      isBot: true
    });

    timeline.forEach((point) => {
      const current = point.net_momentum;
      const diff = current - lastMomentum;
      
      // Goal Alert
      if (point.event_marker && point.event_marker.includes("Goal")) {
        alerts.push({
          id: `goal-${point.minute}`,
          timestamp: `${point.minute}:00`,
          sender: "Tactical Momentum Bot",
          text: `🚨 GOAL ALERT! ${point.event_marker}. New score: ${point.home_score} - ${point.away_score}. Momentum is currently sitting at ${current.toFixed(2)}.`,
          isBot: true,
          type: "goal"
        });
      }
      
      // Red Card Alert
      if (point.event_marker && point.event_marker.includes("Card") && point.event_description.includes("Red")) {
        alerts.push({
          id: `red-${point.minute}`,
          timestamp: `${point.minute}:00`,
          sender: "Tactical Momentum Bot",
          text: `🟥 RED CARD ISSUED! Match context altered. ${point.event_description}. Expect a severe momentum swing!`,
          isBot: true,
          type: "card"
        });
      }

      // Large Momentum Swing (> 2.5 shift in 1 minute)
      if (Math.abs(diff) > 2.5 && !point.event_marker) {
        const teamDominating = current > 0 ? homeTeam : awayTeam;
        alerts.push({
          id: `swing-${point.minute}`,
          timestamp: `${point.minute}:00`,
          sender: "Tactical Momentum Bot",
          text: `⚡ MOMENTUM SWING! ${teamDominating} has taken control of the pitch with high-intensity passing. Net momentum score: ${current.toFixed(2)}.`,
          isBot: true,
          type: "swing"
        });
      }

      lastMomentum = current;
    });

    // Take the latest 5 alerts to show in feed
    setChatMessages(alerts.slice(-5));
  }, [timeline, homeTeam, awayTeam]);

  const handleVote = (option) => {
    if (hasVoted) return;
    setPollVotes(prev => ({
      ...prev,
      [option]: prev[option] + 1
    }));
    setHasVoted(true);
  };

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h3 style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <MessageSquare size={16} className="logo-color" style={{ color: "var(--color-draw)" }} />
          Fan Engagement & Discord Alerts
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          Simulated live channel push triggered by momentum inflection points
        </p>
      </div>

      {/* Simulated Discord Embed */}
      <div style={{
        background: "#1e1f22", // discord dark theme bg
        borderRadius: "10px",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontSize: "13px"
      }}>
        {/* Discord Header */}
        <div style={{
          background: "#2b2d31",
          padding: "8px 12px",
          fontWeight: "600",
          color: "#dbdee1",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <span style={{ color: "#80848e" }}>#</span>
          tactical-momentum-alerts
        </div>

        {/* Message Feed */}
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "180px", overflowY: "auto" }}>
          {chatMessages.map((msg, idx) => (
            <div key={msg.id || idx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: "700", color: "#f2f3f5" }}>{msg.sender}</span>
                <span style={{
                  fontSize: "9px",
                  background: "#5865f2",
                  color: "#fff",
                  padding: "1px 4px",
                  borderRadius: "3px",
                  fontWeight: "bold"
                }}>BOT</span>
                <span style={{ fontSize: "10px", color: "#949ba4" }}>{msg.timestamp}</span>
              </div>
              <div style={{
                color: "#dbdee1",
                padding: "6px",
                borderRadius: "4px",
                background: msg.type === "goal" ? "rgba(16, 185, 129, 0.08)" : 
                            msg.type === "card" ? "rgba(239, 68, 68, 0.08)" : 
                            msg.type === "swing" ? "rgba(59, 130, 246, 0.08)" : "transparent",
                borderLeft: msg.type ? `2px solid ${
                  msg.type === "goal" ? "var(--color-home)" : 
                  msg.type === "card" ? "#ef4444" : "var(--color-draw)"
                }` : "none"
              }}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fan Engagement Poll */}
      <div style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600" }}>
          <BarChart2 size={14} style={{ color: "var(--color-draw)" }} />
          <span>Live Prediction Poll: Who will score next?</span>
        </div>

        {hasVoted ? (
          // Poll Results (Bar graph style)
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Home Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>{homeTeam}</span>
                <span style={{ fontWeight: "700" }}>{homePct}% ({pollVotes.home} votes)</span>
              </div>
              <div style={{ height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${homePct}%`, background: "var(--color-home)" }}></div>
              </div>
            </div>

            {/* Away Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>{awayTeam}</span>
                <span style={{ fontWeight: "700" }}>{awayPct}% ({pollVotes.away} votes)</span>
              </div>
              <div style={{ height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${awayPct}%`, background: "var(--color-away)" }}></div>
              </div>
            </div>

            {/* Draw Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>No More Goals</span>
                <span style={{ fontWeight: "700" }}>{drawPct}% ({pollVotes.draw} votes)</span>
              </div>
              <div style={{ height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${drawPct}%`, background: "var(--color-draw)" }}></div>
              </div>
            </div>
            
            <p style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center", marginTop: "4px" }}>
              Thank you for voting! Predictions update live.
            </p>
          </div>
        ) : (
          // Voting Options
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <button
              onClick={() => handleVote("home")}
              className="btn-secondary"
              style={{ padding: "8px", fontSize: "11px", borderRadius: "6px" }}
            >
              {homeTeam}
            </button>
            <button
              onClick={() => handleVote("away")}
              className="btn-secondary"
              style={{ padding: "8px", fontSize: "11px", borderRadius: "6px" }}
            >
              {awayTeam}
            </button>
            <button
              onClick={() => handleVote("draw")}
              className="btn-secondary"
              style={{ padding: "8px", fontSize: "11px", borderRadius: "6px" }}
            >
              No More Goals
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
