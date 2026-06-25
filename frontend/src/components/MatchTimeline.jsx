import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function MatchTimeline({ data, homeTeam, awayTeam, theme }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const drawChart = () => {
      // Set dimensions
      const containerWidth = svgRef.current.parentElement.clientWidth || 800;
      const height = 300;
      const margin = { top: 30, right: 30, bottom: 45, left: 45 };
      const width = containerWidth - margin.left - margin.right;

      // Clear previous SVG contents
      const svgElement = d3.select(svgRef.current);
      svgElement.selectAll("*").remove();

      // Create main SVG group
      const svg = svgElement
        .attr("width", containerWidth)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Define X & Y scales
      const xMax = Math.max(90, d3.max(data, d => d.minute) || 90);
      const xScale = d3.scaleLinear()
        .domain([0, xMax])
        .range([0, width]);

      // Find min and max momentum to balance the Y axis
      const maxMomentum = d3.max(data, d => Math.abs(d.net_momentum)) || 5.0;
      const yScale = d3.scaleLinear()
        .domain([-maxMomentum - 1, maxMomentum + 1])
        .range([height - margin.top - margin.bottom, 0]);

      // Draw Gradients for Shading
      const defs = svgElement.append("defs");

      // Home Gradient (Emerald Green to Transparent)
      const homeGrad = defs.append("linearGradient")
        .attr("id", "home-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
      homeGrad.append("stop").attr("offset", "0%").attr("stop-color", "#10b981").attr("stop-opacity", 0.4);
      homeGrad.append("stop").attr("offset", "100%").attr("stop-color", "#10b981").attr("stop-opacity", 0.0);

      // Away Gradient (Magenta to Transparent)
      const awayGrad = defs.append("linearGradient")
        .attr("id", "away-gradient")
        .attr("x1", "0%").attr("y1", "100%")
        .attr("x2", "0%").attr("y2", "0%");
      awayGrad.append("stop").attr("offset", "0%").attr("stop-color", "#d946ef").attr("stop-opacity", 0.4);
      awayGrad.append("stop").attr("offset", "100%").attr("stop-color", "#d946ef").attr("stop-opacity", 0.0);

      // Glow Filter
      const glowFilter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-20%")
        .attr("y", "-20%")
        .attr("width", "140%")
        .attr("height", "140%");
      glowFilter.append("feGaussianBlur")
        .attr("stdDeviation", "4")
        .attr("result", "blur");
      glowFilter.append("feMerge")
        .html("<feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/>");

      // Draw grid lines
      const makeYGridlines = () => d3.axisLeft(yScale).ticks(5);
      svg.append("g")
        .attr("class", "grid")
        .attr("opacity", theme === "light" ? 0.06 : 0.15)
        .call(makeYGridlines().tickSize(-width).tickFormat(""));

      // Draw axes
      const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d => `${d}'`);
      const yAxis = d3.axisLeft(yScale).ticks(6);

      svg.append("g")
        .attr("transform", `translate(0, ${yScale(0)})`)
        .attr("stroke-opacity", 0.3)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom - yScale(0) + 12})`)
        .style("text-anchor", "middle")
        .style("fill", theme === "light" ? "#475569" : "#9ca3af")
        .style("font-size", "10px");

      svg.append("g")
        .attr("stroke-opacity", 0.3)
        .call(yAxis)
        .selectAll("text")
        .style("fill", theme === "light" ? "#475569" : "#9ca3af")
        .style("font-size", "10px");

      // Draw horizontal midline (0 momentum)
      svg.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", theme === "light" ? "rgba(15, 23, 42, 0.25)" : "rgba(255, 255, 255, 0.25)")
        .attr("stroke-dasharray", "4,4")
        .attr("stroke-width", 1.5);

      // Labels for Home/Away dominance zones
      svg.append("text")
        .attr("x", 10)
        .attr("y", yScale(maxMomentum) + 10)
        .attr("fill", "#10b981")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("opacity", 0.8)
        .text(`▲ ${homeTeam} Dominance`);

      svg.append("text")
        .attr("x", 10)
        .attr("y", yScale(-maxMomentum) - 10)
        .attr("fill", "#d946ef")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("opacity", 0.8)
        .text(`▼ ${awayTeam} Dominance`);

      // Draw Shaded Areas
      // Area for Home (above 0)
      const areaHome = d3.area()
        .x(d => xScale(d.minute))
        .y0(yScale(0))
        .y1(d => yScale(Math.max(0, d.net_momentum)))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "url(#home-gradient)")
        .attr("d", areaHome);

      // Area for Away (below 0)
      const areaAway = d3.area()
        .x(d => xScale(d.minute))
        .y0(yScale(0))
        .y1(d => yScale(Math.min(0, d.net_momentum)))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "url(#away-gradient)")
        .attr("d", areaAway);

      // Draw Momentum Line
      const momentumLine = d3.line()
        .x(d => xScale(d.minute))
        .y(d => yScale(d.net_momentum))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "url(#line-grad)")
        .attr("stroke-width", 3)
        .attr("filter", "url(#glow)")
        .attr("d", momentumLine);

      // Line Gradient (switches color dynamically)
      const lineGrad = defs.append("linearGradient")
        .attr("id", "line-grad")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%")
        .attr("gradientUnits", "userSpaceOnUse");

      // Make gradient points for line color
      data.forEach((d, idx) => {
        const offset = (d.minute / xMax) * 100;
        const color = d.net_momentum >= 0 ? "#10b981" : "#d946ef";
        lineGrad.append("stop")
          .attr("offset", `${offset}%`)
          .attr("stop-color", color);
      });

      // Draw Event Nodes (Goals, Red Cards, Penalty kicks)
      const events = data.filter(d => d.event_marker);

      // Select existing tooltip to prevent duplicates on redraw
      let tooltip = d3.select(".d3-timeline-tooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("class", "d3-timeline-tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("pointer-events", "none")
          .style("z-index", "100");
      }

      tooltip
        .style("background", theme === "light" ? "rgba(255, 255, 255, 0.98)" : "rgba(10, 15, 30, 0.95)")
        .style("border", theme === "light" ? "1px solid rgba(0, 0, 0, 0.15)" : "1px solid rgba(255, 255, 255, 0.15)")
        .style("padding", "8px 12px")
        .style("border-radius", "8px")
        .style("font-size", "12px")
        .style("color", theme === "light" ? "#0f172a" : "#f3f4f6")
        .style("box-shadow", theme === "light" ? "0 4px 15px rgba(0,0,0,0.15)" : "0 4px 15px rgba(0,0,0,0.5)");

      svg.selectAll(".event-node")
        .data(events)
        .enter()
        .append("g")
        .attr("class", "event-node")
        .attr("transform", d => `translate(${xScale(d.minute)}, ${yScale(d.net_momentum)})`)
        .on("mouseover", (event, d) => {
          tooltip.style("visibility", "visible")
            .html(`
              <div style="font-weight:700;color:${d.net_momentum >= 0 ? '#10b981' : '#d946ef'}">${d.event_marker}</div>
              <div style="font-size:11px;color:${theme === 'light' ? '#475569' : '#9ca3af'};margin:2px 0;">Minute ${d.minute}'</div>
              <div style="font-size:12px;">${d.event_description || ''}</div>
              <div style="font-size:11px;color:#3b82f6;margin-top:4px;">Score: ${d.home_score} - ${d.away_score}</div>
            `);
        })
        .on("mousemove", (event) => {
          tooltip.style("top", `${event.pageY - 10}px`)
            .style("left", `${event.pageX + 15}px`);
        })
        .on("mouseout", () => {
          tooltip.style("visibility", "hidden");
        })
        .each(function(d) {
          const node = d3.select(this);
          const isGoal = d.event_marker.includes("Goal");
          const isRed = d.event_description && d.event_description.includes("Red Card");
          
          if (isGoal) {
            // Draw Goal Node: Soccer Ball style ring
            node.append("circle")
              .attr("r", 7)
              .attr("fill", "#fff")
              .attr("stroke", d.net_momentum >= 0 ? "#10b981" : "#d946ef")
              .attr("stroke-width", 2);
            
            node.append("circle")
              .attr("r", 3)
              .attr("fill", "#111827");
          } else if (isRed) {
            // Draw Red Card Node
            node.append("rect")
              .attr("x", -4)
              .attr("y", -6)
              .attr("width", 8)
              .attr("height", 12)
              .attr("rx", 1)
              .attr("fill", "#ef4444")
              .attr("stroke", "#fff")
              .attr("stroke-width", 1);
          } else {
            // Default event node (Yellow Card or Penalty Shot)
            const isYellow = d.event_description && d.event_description.includes("Yellow Card");
            node.append("circle")
              .attr("r", 5)
              .attr("fill", isYellow ? "#eab308" : "#3b82f6")
              .attr("stroke", "#fff")
              .attr("stroke-width", 1);
          }
        });
    };

    drawChart();

    window.addEventListener("resize", drawChart);
    return () => {
      window.removeEventListener("resize", drawChart);
      d3.select(".d3-timeline-tooltip").remove();
    };

  }, [data, homeTeam, awayTeam, theme]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg ref={svgRef} className="d3-chart-svg"></svg>
    </div>
  );
}
