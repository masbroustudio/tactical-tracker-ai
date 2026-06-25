import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { Sparkles } from "lucide-react";

export default function DominanceHeatmap({ events, heatPoints, homeTeam, awayTeam, hoveredEventId, onAutoSimulate, isSimulating, theme }) {
  const [timeFilter, setTimeFilter] = useState("all"); // all, 0-30, 30-60, 60-90
  const pitchRef = useRef();

  // Filter events based on selected time window
  const filteredEvents = events.filter(e => {
    if (!e.location_x || !e.location_y) return false;
    if (timeFilter === "all") return true;
    const [start, end] = timeFilter.split("-").map(Number);
    return e.minute >= start && e.minute <= end;
  });

  // Generate a dense set of heat points from events
  const heatPointsList = React.useMemo(() => {
    let list = [];
    
    // Simple seedable PRNG to make coordinates stable and deterministic
    const seedRandom = (seed) => {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
      }
      return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
      };
    };

    events.forEach(e => {
      if (!e.location_x || !e.location_y) return;
      
      // Add the event itself as a high intensity point
      list.push({
        team: e.team,
        location_x: e.location_x,
        location_y: e.location_y,
        intensity: e.event_type === "Goal" ? 1.8 : 1.2,
        minute: e.minute
      });
      
      // Seeded-procedural generation of build-up points leading to this event
      const rng = seedRandom(`${e.id || 'evt'}-${e.minute}`);
      const isHome = e.team === "home";
      
      if (e.event_type === "Goal" || e.event_type === "Shot on Target" || e.event_type === "Shot off Target") {
        // Step 1: Assist zone (final third)
        const assistX = e.location_x - (isHome ? rng() * 15 + 5 : -(rng() * 15 + 5));
        const assistY = e.location_y + (rng() * 30 - 15);
        list.push({
          team: e.team,
          location_x: Math.max(0, Math.min(100, assistX)),
          location_y: Math.max(0, Math.min(100, assistY)),
          intensity: 0.9,
          minute: e.minute - 1
        });
        
        // Step 2: Midfield build-up
        const midX = assistX - (isHome ? rng() * 20 + 10 : -(rng() * 20 + 10));
        const midY = assistY + (rng() * 40 - 20);
        list.push({
          team: e.team,
          location_x: Math.max(0, Math.min(100, midX)),
          location_y: Math.max(0, Math.min(100, midY)),
          intensity: 0.7,
          minute: e.minute - 2
        });
      } else if (e.event_type === "Corner") {
        const buildX = isHome ? 80 + rng() * 10 : 10 + rng() * 10;
        const buildY = rng() * 40 + 30;
        list.push({
          team: e.team,
          location_x: buildX,
          location_y: buildY,
          intensity: 0.6,
          minute: e.minute - 1
        });
      } else if (e.event_type === "Save") {
        const defX = isHome ? 5 + rng() * 10 : 85 + rng() * 10;
        const defY = rng() * 30 + 35;
        list.push({
          team: e.team,
          location_x: defX,
          location_y: defY,
          intensity: 0.8,
          minute: e.minute
        });
      }
    });

    // 2. Append additional AI heat points if provided
    if (heatPoints && heatPoints.length > 0) {
      heatPoints.forEach(hp => {
        list.push({
          team: hp.team,
          location_x: hp.location_x,
          location_y: hp.location_y,
          intensity: hp.intensity || 1.0,
          minute: hp.minute
        });
      });
    }

    return list;
  }, [events, heatPoints]);

  const filteredHeatPoints = heatPointsList.filter(hp => {
    if (timeFilter === "all") return true;
    const [start, end] = timeFilter.split("-").map(Number);
    return hp.minute >= start && hp.minute <= end;
  });


  useEffect(() => {
    const drawPitch = () => {
      const containerWidth = pitchRef.current.parentElement.clientWidth || 600;
      const height = containerWidth * 0.65; // standard field aspect ratio
      const padding = 20;

      const svgElement = d3.select(pitchRef.current);
      svgElement.selectAll("*").remove();

      const svg = svgElement
        .attr("width", containerWidth)
        .attr("height", height);

      // Coordinate converters
      // x goes 0-100, y goes 0-100
      const xScale = d3.scaleLinear().domain([0, 100]).range([padding, containerWidth - padding]);
      const yScale = d3.scaleLinear().domain([0, 100]).range([padding, height - padding]);

      // Draw field background
      svg.append("rect")
        .attr("x", padding)
        .attr("y", padding)
        .attr("width", containerWidth - padding * 2)
        .attr("height", height - padding * 2)
        .attr("fill", theme === "light" ? "#f1f5f9" : "#090d22")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2)
        .attr("rx", 6);

      // Midline
      svg.append("line")
        .attr("x1", containerWidth / 2)
        .attr("x2", containerWidth / 2)
        .attr("y1", padding)
        .attr("y2", height - padding)
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Center Circle
      svg.append("circle")
        .attr("cx", containerWidth / 2)
        .attr("cy", height / 2)
        .attr("r", (containerWidth - padding * 2) * 0.1)
        .attr("fill", "none")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Center Dot
      svg.append("circle")
        .attr("cx", containerWidth / 2)
        .attr("cy", height / 2)
        .attr("r", 3)
        .attr("fill", theme === "light" ? "rgba(15, 23, 42, 0.3)" : "rgba(255, 255, 255, 0.4)");

      // Left Penalty Box
      svg.append("rect")
        .attr("x", padding)
        .attr("y", yScale(20))
        .attr("width", xScale(16.5) - padding)
        .attr("height", yScale(80) - yScale(20))
        .attr("fill", "none")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Left Goal Area
      svg.append("rect")
        .attr("x", padding)
        .attr("y", yScale(36))
        .attr("width", xScale(5.5) - padding)
        .attr("height", yScale(64) - yScale(36))
        .attr("fill", "none")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Right Penalty Box
      svg.append("rect")
        .attr("x", xScale(83.5))
        .attr("y", yScale(20))
        .attr("width", xScale(100) - xScale(83.5))
        .attr("height", yScale(80) - yScale(20))
        .attr("fill", "none")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Right Goal Area
      svg.append("rect")
        .attr("x", xScale(94.5))
        .attr("y", yScale(36))
        .attr("width", xScale(100) - xScale(94.5))
        .attr("height", yScale(64) - yScale(36))
        .attr("fill", "none")
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", 2);

      // Select existing tooltip to prevent duplicates on redraw
      let tooltip = d3.select(".d3-heatmap-tooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("class", "d3-heatmap-tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("pointer-events", "none")
          .style("z-index", "101");
      }

      tooltip
        .style("background", theme === "light" ? "rgba(255, 255, 255, 0.98)" : "rgba(7, 10, 24, 0.95)")
        .style("border", theme === "light" ? "1px solid rgba(0, 0, 0, 0.15)" : "1px solid rgba(255, 255, 255, 0.15)")
        .style("padding", "6px 10px")
        .style("border-radius", "6px")
        .style("font-size", "11px")
        .style("color", theme === "light" ? "#0f172a" : "#fff")
        .style("box-shadow", theme === "light" ? "0 4px 10px rgba(0,0,0,0.15)" : "0 4px 10px rgba(0,0,0,0.4)");

      // Define gradients for organic heat blur rendering
      const defs = svg.append("defs");

      // Home team heat gradient (green)
      const homeRadial = defs.append("radialGradient")
        .attr("id", "home-heat")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");
      homeRadial.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#10b981")
        .attr("stop-opacity", 0.45);
      homeRadial.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#10b981")
        .attr("stop-opacity", 0.15);
      homeRadial.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#10b981")
        .attr("stop-opacity", 0);

      // Away team heat gradient (magenta)
      const awayRadial = defs.append("radialGradient")
        .attr("id", "away-heat")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");
      awayRadial.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#d946ef")
        .attr("stop-opacity", 0.45);
      awayRadial.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#d946ef")
        .attr("stop-opacity", 0.15);
      awayRadial.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#d946ef")
        .attr("stop-opacity", 0);

      // Draw blurred heat blobs in background
      const blobs = svg.selectAll(".heat-blob")
        .data(filteredHeatPoints, (d, i) => `${d.team}-${d.location_x}-${d.location_y}-${i}`);

      blobs.exit()
        .transition()
        .duration(300)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

      const enterBlobs = blobs.enter()
        .append("circle")
        .attr("class", "heat-blob")
        .attr("cx", d => xScale(d.location_x))
        .attr("cy", d => yScale(d.location_y))
        .attr("fill", d => d.team === "home" ? "url(#home-heat)" : "url(#away-heat)")
        .style("mix-blend-mode", "screen")
        .attr("r", 0)
        .style("opacity", 0);

      enterBlobs.merge(blobs)
        .transition()
        .duration(400)
        .attr("cx", d => xScale(d.location_x))
        .attr("cy", d => yScale(d.location_y))
        .attr("r", d => 45 * (d.intensity || 1.0))
        .style("opacity", 1);

      // Plot Events as pulsing circles on top
      const dots = svg.selectAll(".event-dot")
        .data(filteredEvents, d => d.id);

      dots.exit().remove();

      const enterDots = dots.enter()
        .append("circle")
        .attr("class", "event-dot")
        .attr("cx", d => xScale(d.location_x))
        .attr("cy", d => yScale(d.location_y))
        .attr("r", d => d.event_type === "Goal" ? 9 : 6)
        .attr("fill", d => d.team === "home" ? "#10b981" : "#d946ef")
        .attr("opacity", 0.75)
        .attr("stroke", "#fff")
        .attr("stroke-width", d => d.event_type === "Goal" ? 2 : 1)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
          d3.select(event.currentTarget)
            .attr("opacity", 1.0)
            .attr("r", d.event_type === "Goal" ? 12 : 8);
            
          tooltip.style("visibility", "visible")
            .html(`
              <div style="font-weight:700;color:${d.team === 'home' ? '#10b981' : '#d946ef'}">${d.team === 'home' ? homeTeam : awayTeam}</div>
              <div style="font-weight:600;margin:2px 0;">${d.event_type} (${d.minute}')</div>
              <div>Player: ${d.player || 'Unknown'}</div>
              <div style="color:${theme === 'light' ? '#475569' : '#6b7280'};font-size:10px;">Pos: X:${Math.round(d.location_x)} Y:${Math.round(d.location_y)}</div>
            `);
        })
        .on("mousemove", (event) => {
          tooltip.style("top", `${event.pageY - 10}px`)
            .style("left", `${event.pageX + 15}px`);
        })
        .on("mouseout", (event, d) => {
          d3.select(event.currentTarget)
            .attr("opacity", 0.75)
            .attr("r", d.event_type === "Goal" ? 9 : 6);
          tooltip.style("visibility", "hidden");
        });

      const allDots = enterDots.merge(dots);

      // Handle external hover highlights
      allDots.transition()
        .duration(200)
        .attr("r", d => {
          if (d.id === hoveredEventId) {
            return d.event_type === "Goal" ? 16 : 12;
          }
          return d.event_type === "Goal" ? 9 : 6;
        })
        .attr("opacity", d => d.id === hoveredEventId ? 1.0 : 0.75)
        .attr("stroke-width", d => d.id === hoveredEventId ? 3 : (d.event_type === "Goal" ? 2 : 1));
    };

    drawPitch();

    window.addEventListener("resize", drawPitch);
    return () => {
      window.removeEventListener("resize", drawPitch);
      d3.select(".d3-heatmap-tooltip").remove();
    };
  }, [filteredEvents, filteredHeatPoints, homeTeam, awayTeam, timeFilter, hoveredEventId, theme]);

  // Calculations for zone dominance (e.g. events counts in left/mid/right fields)
  const homeEvents = filteredEvents.filter(e => e.team === "home");
  const awayEvents = filteredEvents.filter(e => e.team === "away");
  
  // Attacking third counts (Home third: X > 66.6, Away third: X < 33.3)
  const homeAttacks = homeEvents.filter(e => e.location_x > 66.6).length;
  const awayAttacks = awayEvents.filter(e => e.location_x < 33.3).length;
  const totalAttacks = homeAttacks + awayAttacks;
  
  const homeAttackPct = totalAttacks > 0 ? Math.round((homeAttacks / totalAttacks) * 100) : 50;
  const awayAttackPct = 100 - homeAttackPct;

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ fontSize: "16px" }}>Tactical Dominance Heatmap</h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Mapping spatial events and field density</p>
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Time filters */}
          <div style={{ display: "flex", gap: "4px" }}>
            {["all", "0-30", "30-60", "60-90"].map(filter => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className="btn-secondary"
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  borderRadius: "6px",
                  background: timeFilter === filter ? "var(--color-draw)" : "",
                  borderColor: timeFilter === filter ? "var(--color-draw)" : "",
                  color: timeFilter === filter ? "#fff" : ""
                }}
              >
                {filter === "all" ? "Full Match" : `${filter}'`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg ref={pitchRef} style={{ width: "100%", display: "block" }}></svg>
      </div>

      {/* Territory Control Stat Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600" }}>
          <span style={{ color: "var(--color-home)" }}>{homeTeam} Attacking Penetration</span>
          <span style={{ color: "var(--color-away)" }}>{awayTeam} Attacking Penetration</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.05)" }}>
          <div style={{ width: `${homeAttackPct}%`, backgroundColor: "var(--color-home)", transition: "width 0.4s" }}></div>
          <div style={{ width: `${awayAttackPct}%`, backgroundColor: "var(--color-away)", transition: "width 0.4s" }}></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
          <span>{homeAttackPct}% in Final Third</span>
          <span>{awayAttackPct}% in Final Third</span>
        </div>
      </div>
    </div>
  );
}
