import React, { useEffect, useState } from "react";
import { Sparkles, Activity, Map, Play, ShieldAlert, Award, FileText, Sun, Moon, ArrowRight, TrendingUp, LogOut } from "lucide-react";
import { useFirebase } from "../firebase";

export default function LandingPage({ onEnterDashboard, theme, toggleTheme, user, onLogout }) {
  const [passingStep, setPassingStep] = useState(0);

  // Animate a simple soccer passing build-up on the landing page pitch
  useEffect(() => {
    const timer = setInterval(() => {
      setPassingStep((prev) => (prev + 1) % 5);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const getPassingCoord = () => {
    // Coordinate list for passing animation: [X, Y, description, momentum]
    const coordinates = [
      { x: 30, y: 50, label: "Midfielder initiates build-up", val: "+0.5" },
      { x: 55, y: 25, label: "Winger takes down-line pass", val: "+1.2" },
      { x: 78, y: 35, label: "Cross sent into attacking third", val: "+2.0" },
      { x: 92, y: 48, label: "Striker fires a shot on target!", val: "+3.5" },
      { x: 96, y: 50, label: "GOAL! High momentum spike!", val: "+5.0" }
    ];
    return coordinates[passingStep];
  };

  const activeCoord = getPassingCoord();

  return (
    <div className={`landing-wrapper ${theme}-theme`}>
      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="logo-container">
          <div className="logo-icon">T</div>
          <div className="logo-text">
            <h1 style={{ fontSize: "20px" }}>Tactical Momentum Tracker</h1>
            <p>World Cup 2026 Analytics Edition</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Light/Dark Toggle */}
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            title="Toggle Light/Dark Theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {useFirebase ? (
            user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{user.email}</span>
                <button onClick={onLogout} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}>
                  <LogOut size={14} /> Log Out
                </button>
              </div>
            ) : (
              <button onClick={onEnterDashboard} className="landing-cta-btn" style={{ padding: "8px 16px", fontSize: "13px", margin: 0 }}>
                Sign In
              </button>
            )
          ) : (
            <button onClick={onEnterDashboard} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }}>
              Direct Access
            </button>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="landing-hero">
        <div className="hero-content">
          <div className="badge-wc">
            <Award size={14} /> FIFA WORLD CUP 2026
          </div>
          <h1>
            Quantifying the <span className="highlight-text">Momentum Shifts</span> of Every Match
          </h1>
          <p>
            Experience sports analytics at the next level. Harness rolling Exponential Moving Averages (EMA) to track sustained pitch pressure and receive real-time tactical suggestions powered by Google Gemini AI.
          </p>

          <div style={{ marginTop: "32px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <button onClick={onEnterDashboard} className="landing-cta-btn">
              Launch Dashboard <ArrowRight size={18} />
            </button>
            <a href="#features" className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "10px", fontSize: "15px" }}>
              Explore Features
            </a>
          </div>
        </div>

        {/* INTERACTIVE MOCKUP FIELD */}
        <div className="hero-visualization">
          <div className="glass-panel pitch-mockup-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span className="live-dot"></span>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>Dynamic Flow Mockup</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Active: <span style={{ color: "var(--color-home)", fontWeight: "600" }}>{activeCoord.label}</span>
              </div>
            </div>

            {/* Simulated Pitch */}
            <div className="pitch-svg-container" style={{ position: "relative", width: "100%", aspectRatio: "1.6", background: "#090d22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", overflow: "hidden" }}>
              {/* Field Lines */}
              <div className="pitch-line center-line" style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.15)" }}></div>
              <div className="pitch-line center-circle" style={{ position: "absolute", left: "50%", top: "50%", width: "20%", height: "30%", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "50%", transform: "translate(-50%, -50%)" }}></div>
              <div className="pitch-line penalty-area" style={{ position: "absolute", right: 0, top: "20%", bottom: "20%", width: "16%", border: "1px solid rgba(255,255,255,0.15)", borderRight: "none" }}></div>
              <div className="pitch-line penalty-area-left" style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: "16%", border: "1px solid rgba(255,255,255,0.15)", borderLeft: "none" }}></div>

              {/* D3-like Simulated Animation */}
              <svg style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                {/* Historical Passes */}
                {passingStep > 0 && Array.from({ length: passingStep }).map((_, idx) => {
                  const coords = [
                    { x: 30, y: 50 },
                    { x: 55, y: 25 },
                    { x: 78, y: 35 },
                    { x: 92, y: 48 },
                    { x: 96, y: 50 }
                  ];
                  return (
                    <line 
                      key={idx}
                      x1={`${coords[idx].x}%`} y1={`${coords[idx].y}%`}
                      x2={`${coords[idx+1].x}%`} y2={`${coords[idx+1].y}%`}
                      stroke="var(--color-home)"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      opacity="0.4"
                    />
                  );
                })}

                {/* Pulsing Highlight Blob */}
                <circle 
                  cx={`${activeCoord.x}%`} 
                  cy={`${activeCoord.y}%`} 
                  r="24" 
                  fill="url(#active-pulse-gradient)" 
                  style={{ mixBlendMode: "screen" }}
                />

                {/* Event Dot */}
                <circle 
                  cx={`${activeCoord.x}%`} 
                  cy={`${activeCoord.y}%`} 
                  r="8" 
                  fill="#10b981" 
                  stroke="#fff" 
                  strokeWidth="2"
                  style={{ transition: "all 0.5s ease" }}
                />

                <defs>
                  <radialGradient id="active-pulse-gradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>

              {/* Floating Indicator */}
              <div 
                className="floating-momentum-badge"
                style={{ 
                  position: "absolute", 
                  left: `${activeCoord.x}%`, 
                  top: `${activeCoord.y - 12}%`,
                  transform: "translate(-50%, -50%)",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "4px 8px",
                  borderRadius: "20px",
                  boxShadow: "0 4px 10px rgba(16,185,129,0.3)",
                  transition: "all 0.5s ease",
                  pointerEvents: "none"
                }}
              >
                Momentum: {activeCoord.val}
              </div>
            </div>

            {/* Momentum Scale Mockup */}
            <div style={{ marginTop: "16px", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px", color: "var(--text-secondary)" }}>
                <span>Match Momentum Graph</span>
                <span style={{ color: "var(--color-home)", fontWeight: "600" }}>Spike: +{passingStep * 1.2}</span>
              </div>
              <div style={{ height: "40px", display: "flex", gap: "3px", alignItems: "flex-end" }}>
                {Array.from({ length: 40 }).map((_, idx) => {
                  const height = idx < 20 
                    ? 5 + (idx * 0.5) 
                    : idx <= 20 + passingStep * 4 
                      ? 15 + ((idx - 20) * 1.5) 
                      : 8 + Math.cos(idx) * 4;
                  const isSpike = idx > 20 && idx <= 20 + passingStep * 4;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        flex: 1, 
                        height: `${height}%`, 
                        background: isSpike ? "var(--color-home)" : "rgba(255,255,255,0.15)",
                        borderRadius: "2px",
                        transition: "all 0.4s ease"
                      }}
                    ></div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES GRID SECTION */}
      <section id="features" className="landing-features">
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{ fontSize: "32px", marginBottom: "12px" }}>Engineered for Deep Tactical Insights</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
            A comprehensive, high-fidelity sports analytics monorepo designed to track sustained match control.
          </p>
        </div>

        <div className="features-grid">
          {/* Card 1 */}
          <div className="glass-panel feature-card-item">
            <div className="feature-icon-box" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--color-draw)" }}>
              <Activity size={24} />
            </div>
            <h3>Real-Time Momentum Indexes</h3>
            <p>
              Computes a continuous rolling index of match control by weighing live events (shots, saves, red cards) using Exponential Weighted Moving Averages.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel feature-card-item">
            <div className="feature-icon-box" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--color-home)" }}>
              <Map size={24} />
            </div>
            <h3>Dynamic Zone Dominance</h3>
            <p>
              Translates X/Y event coordinate vectors into visual heat maps. Automatically computes attacking third penetration percentages for coaches.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel feature-card-item">
            <div className="feature-icon-box" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
              <Sparkles size={24} />
            </div>
            <h3>Gemini AI Coaching Insights</h3>
            <p>
              Provides strategic feedback, formation shifts, and substitution ideas based on contextual match momentum inflection spikes.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel feature-card-item">
            <div className="feature-icon-box" style={{ background: "rgba(217, 70, 239, 0.15)", color: "var(--color-away)" }}>
              <TrendingUp size={24} />
            </div>
            <h3>Interactive Scenario Sandbox</h3>
            <p>
              Queue hypothetical future events—like a home team goal or red card—and instantly review updated victory probability metrics.
            </p>
          </div>
        </div>
      </section>

      {/* TECH STACK FOOTER */}
      <footer className="landing-footer">
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "40px", width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>POWERING WORLD CUP 2026 ANALYTICS WITH DYNAMIC AI</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap", opacity: 0.6 }}>
            <span className="tech-badge">React</span>
            <span className="tech-badge">FastAPI</span>
            <span className="tech-badge">D3.js</span>
            <span className="tech-badge">Google Cloud</span>
            <span className="tech-badge">Gemini API</span>
            <span className="tech-badge">SQLite</span>
          </div>
          <p style={{ marginTop: "40px", fontSize: "11px", color: "var(--text-muted)" }}>
            &copy; 2026 Tactical Momentum Tracker. Open source sports analytics playground.
          </p>
        </div>
      </footer>
    </div>
  );
}
