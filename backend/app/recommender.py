import os
import json
import logging
from typing import List, Dict, Any
import google.generativeai as genai
from app.schemas import TacticalInsightResponse

logger = logging.getLogger("tracker")

# Configure Gemini API
API_KEY = os.getenv("GEMINI_API_KEY", "")
if API_KEY:
    genai.configure(api_key=API_KEY)

def generate_tactical_insights(
    match_id: str,
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    current_minute: int,
    events: List[Any],
    recent_momentum: float,
    timeline_summary: str,
    is_simulated_scenario: bool = False
) -> TacticalInsightResponse:
    """
    Calls the Gemini API to analyze the match state and momentum shifts 
    to generate tactical adjustments. Falls back to a deterministic 
    insights generator if the API key is missing or fails.
    """
    
    # Format a summary of the last few key events
    recent_events = sorted(events, key=lambda e: (e.minute, getattr(e, 'second', 0)), reverse=True)[:5]
    events_summary = ", ".join([
        f"Min {e.minute}: {e.event_type} by {home_team if e.team == 'home' else away_team} ({e.player or ''} - {e.detail or ''})"
        for e in recent_events
    ]) if recent_events else "No significant events yet."

    scenario_note = ""
    if is_simulated_scenario:
        scenario_note = "\n    [CRITICAL NOTE: THIS IS A HYPOTHETICAL MATCH SCENARIO FORECAST. The head coach is simulating 'what-if' tactical changes. Direct your recommendations toward predicting how this simulated state changes the tactical flow of the match!]\n"

    prompt = f"""
    You are an elite soccer tactical analyst and performance director. 
    Analyze this match data and provide a detailed tactical recommendation for the head coach.
    {scenario_note}
    Match Context:
    - Match: {home_team} vs {away_team}
    - Score: {home_team} {home_score} - {away_score} {away_team}
    - Current Minute: {current_minute}
    - Recent Events: {events_summary}
    - Recent Net Momentum (Positive favors {home_team}, Negative favors {away_team}): {recent_momentum:.2f}
    - Overall Momentum Trend: {timeline_summary}

    Generate a strategic report strictly in JSON format with the following keys:
    - "recommendation": A detailed paragraph outlining the core tactical adjustment. Explain what spatial adjustments to make, how to counter the opponent's momentum, and what the player instructions should be.
    - "game_state_summary": A concise analysis of the match's flow, momentum inflection points, and who is currently dominating and why.
    - "suggested_substitutions": An array of 2 strings, each showing a substitution in the format: "Player IN for Player OUT (Reason: ...)"
    - "suggested_formation_change": A string stating a recommended formation change and brief tactical rationale.
    
    Respond ONLY with the raw JSON object. Do not include markdown code block formatting (like ```json).
    """

    if API_KEY:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            data = json.loads(response.text.strip())
            return TacticalInsightResponse(
                match_id=match_id,
                recommendation=data.get("recommendation", "Adjust mid-block spacing and control tempo."),
                game_state_summary=data.get("game_state_summary", f"Balanced state in {current_minute}' minute."),
                suggested_substitutions=data.get("suggested_substitutions", ["Sub 1", "Sub 2"]),
                suggested_formation_change=data.get("suggested_formation_change", "No change suggested.")
            )
        except Exception as e:
            logger.error(f"Gemini API request failed: {e}. Falling back to heuristic insights.")
            # Fall through to fallback

    # Heuristic fallback engine based on game state
    return _generate_heuristic_insights(
        match_id, home_team, away_team, home_score, away_score, current_minute, recent_momentum, events, is_simulated_scenario
    )

def _generate_heuristic_insights(
    match_id: str,
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    current_minute: int,
    recent_momentum: float,
    events: List[Any],
    is_simulated_scenario: bool = False
) -> TacticalInsightResponse:
    """
    Deterministic rule-based tactical engine serving as high-fidelity mock fallback.
    """
    score_diff = home_score - away_score
    red_card_teams = [e.team for e in events if e.event_type == "Card" and e.detail and "Red" in e.detail]
    
    # Scenario 1: Red card scenario
    if red_card_teams:
        rc_team = red_card_teams[0]
        rc_team_name = home_team if rc_team == "home" else away_team
        opp_team_name = away_team if rc_team == "home" else home_team
        
        if rc_team == "home":
            rec = f"Following the red card for {home_team}, the priority must shift to defensive consolidation. Instruct the midfield to drop into a compact low-block, denying space in the central channels. Transition to a single-striker system to maintain a outlet for clearances while overloading the defensive third."
            summary = f"{home_team} is operating with 10 players, forcing a highly defensive stance. {away_team} is exploiting the half-spaces and shifting ball possession side-to-side."
            subs = [
                f"Defensive Midfielder in for Attacking Midfielder (Reason: Restore central structural density after red card)",
                f"Fullback in for Striker (Reason: Lock down wide zones and shift to a back-five dynamic)"
            ]
            formation = "Transition from 4-3-3 to 4-4-1 low-block"
        else:
            rec = f"With {away_team} down to 10 players, {home_team} must increase vertical circulation and deploy overlapping fullbacks. Overload the wide areas to drag their remaining compact midfield unit out of position, opening up pockets for cutbacks and low crosses."
            summary = f"{home_team} has a numerical advantage and is suffocating {away_team} in their own defensive third, creating high sustained offensive pressure."
            subs = [
                f"Winger in for Defensive Midfielder (Reason: Provide maximum width and 1v1 isolation capabilities)",
                f"Second Striker in for Center Back (Reason: Flood the penalty box for crosses)"
            ]
            formation = "Transition from 4-2-3-1 to 3-4-3 overload"

    # Scenario 2: Chasing a comeback (Home team losing late)
    elif score_diff < 0 and current_minute > 70:
        rec = f"{home_team} is chasing the match and must bypass the build-up phase. Shift to a direct attacking layout. Instruct the center backs to hit vertical direct passes into the channels. Deploy a high counter-press immediately upon possession loss to lock {away_team} in their half."
        summary = f"{away_team} is protecting their lead with a low block. {home_team} is applying high-risk pressure, exposing themselves to quick counter-attacks."
        subs = [
            f"Target Man Striker in for Defensive Midfielder (Reason: Presence in the penalty box for direct balls)",
            f"Creative Playmaker in for Fullback (Reason: Increase final-third delivery quality and line-breaking passes)"
        ]
        formation = "Transition from 4-3-3 to 3-4-3 / 3-5-2 Direct"

    # Scenario 3: Protecting a lead (Home team winning late)
    elif score_diff > 0 and current_minute > 75:
        rec = f"To protect the lead, {home_team} must slow down the game and control the tempo. Prioritize retaining possession in low-risk zones. The wingers must track back diligently to support fullbacks against overlaps, and the midfield must minimize vertical gaps."
        summary = f"{home_team} is successfully absorbing pressure and utilizing tactical fouls to interrupt {away_team}'s momentum. {away_team} is committing numbers forward."
        subs = [
            f"Defensive Midfielder in for Creative Midfielder (Reason: Double-pivot screening for the back line)",
            f"Defensive Fullback in for Attacking Winger (Reason: Neutralize opposing wide wingers)"
        ]
        formation = "Transition from 4-3-3 to 4-5-1 mid-block"

    # Scenario 4: High Home Momentum (Home team dominating but maybe tied or close)
    elif recent_momentum > 2.0:
        rec = f"{home_team} is in a high-momentum phase, creating multiple shots. Capitalize on this by instructions to pull triggers early. The central midfielders should make late runs into the box to latch onto loose balls, while keeping a high defensive line to sustain the press."
        summary = f"{home_team} is currently dominating central transitions, generating high turnover recoveries. {away_team} is showing fatigue and structural disorganization."
        subs = [
            f"Fresh Attacking Winger in for Fatigued Winger (Reason: Exploit the tired opposing fullbacks)",
            f"Box-to-Box Midfielder in for Holding Midfielder (Reason: Support high-intensity pressing runs)"
        ]
        formation = "Maintain 4-3-3 with Aggressive Overlapping Fullbacks"

    # Scenario 5: High Away Momentum
    elif recent_momentum < -2.0:
        rec = f"{away_team} has seized control of the midfield. {home_team} needs to drop the defensive line by 10 yards to prevent balls over the top. The double pivot must focus on shadowing the creative playmakers, forcing {away_team} to play wide crosses rather than central line-breaking passes."
        summary = f"{away_team} is enjoying high possession sequences and high passing accuracy. {home_team} is struggling to retain possession and is retreating."
        subs = [
            f"Holding Midfielder in for Attacking Midfielder (Reason: Create a mid-block screen and disrupt passing lanes)",
            f"Fast Counter-Attacking Winger in for Target Man (Reason: Exploit space behind their high line on breakaways)"
        ]
        formation = "Transition from 4-3-3 to 4-2-3-1 Compact"

    # Default Balanced Scenario
    else:
        rec = f"The match is currently balanced. Maintain standard structural spacing. Focus on switching play quickly through the pivot to exploit the weak side of {away_team}'s block. Fullbacks should join attacks selectively."
        summary = "Both teams are contesting possession heavily in the middle third. Neither team has established sustained dominance."
        subs = [
            f"Fresh Central Midfielder in for Fatigued Midfielder (Reason: Maintain physical intensity in the engine room)",
            f"Fresh Forward in for Starting Forward (Reason: Renew pressing energy up front)"
        ]
        formation = "Maintain starting 4-3-3 / 4-2-3-1"

    if is_simulated_scenario:
        rec = f"[AI Scenario Forecast] {rec}"
        summary = f"[Projected Game State] {summary}"
        formation = f"[Projected Formation Change] {formation}"

    return TacticalInsightResponse(
        match_id=match_id,
        recommendation=rec,
        game_state_summary=summary,
        suggested_substitutions=subs,
        suggested_formation_change=formation
    )

def generate_auto_simulation_events(
    match_id: str,
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    current_minute: int,
    events: List[Any]
) -> Dict[str, Any]:
    """
    Calls Gemini API to simulate 3-5 realistic future events based on the current match state,
    as well as 15-25 possession heat points for tactical density.
    Falls back to a procedural generator if API key is missing or fails.
    """
    # Sort and format recent events
    recent_events = sorted(events, key=lambda e: (e.minute, getattr(e, 'second', 0)), reverse=True)[:5]
    events_summary = ", ".join([
        f"Min {e.minute}: {e.event_type} by {home_team if e.team == 'home' else away_team} ({e.player or ''} - {e.detail or ''})"
        for e in recent_events
    ]) if recent_events else "No significant events yet."
    
    max_target_minute = 120 if current_minute >= 85 else 90
    min_future_min = current_minute + 1
    if min_future_min >= max_target_minute:
        max_target_minute = min_future_min + 15

    prompt = f"""
    You are an elite soccer tactical analyst and match simulator.
    Predict the future flow of the match starting from the current state until the {max_target_minute}th minute.
    
    Current Match State:
    - Match: {home_team} vs {away_team}
    - Current Score: {home_team} {home_score} - {away_score} {away_team}
    - Current Minute: {current_minute}
    - Existing Events Summary: {events_summary}
    
    Generate two outputs:
    1. A realistic sequence of 3 to 5 future key match events (Goal, Shot, Foul, Save, Turnover, Card) occurring from minute {min_future_min} to {max_target_minute}.
    2. A dense array of 15 to 25 tactical "possession/activity points" representing the passing sequences, defensive blocks, and attacking territory control of BOTH teams during this phase. This will be used to construct a spatial density heatmap.
    
    Format the response strictly as a JSON object with the keys:
    - "events": A JSON array of key events, where each event has:
      - "minute": integer (must be between {min_future_min} and {max_target_minute})
      - "second": integer (0-59)
      - "team": string ("home" or "away")
      - "player": string
      - "event_type": string ("Goal", "Shot on Target", "Shot off Target", "Foul", "Card", "Corner", "Save", "Turnover")
      - "detail": string
      - "location_x": float (0.0 to 100.0)
      - "location_y": float (0.0 to 100.0)
    - "heat_points": A JSON array of possession/activity points, where each point has:
      - "minute": integer (between {min_future_min} and {max_target_minute})
      - "team": string ("home" or "away")
      - "location_x": float (0.0 to 100.0)
      - "location_y": float (0.0 to 100.0)
      - "intensity": float (0.5 to 1.5, representing density of play)
      
    For coordinates:
    - Home team attacks left to right (goal at x=95-100, defending at x=0-15)
    - Away team attacks right to left (goal at x=0-5, defending at x=85-100)
    - Generate coordinates reflecting the actual flow: e.g. if Home is dominating or chasing, their heat_points should cluster in the Away half (x > 50). If a team is defending, cluster in their own defensive third.
    
    Respond ONLY with the raw JSON object. Do not include markdown code block formatting (like ```json).
    """

    if API_KEY:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text.strip())
            
            raw_events = data.get("events", [])
            raw_heat = data.get("heat_points", [])
            
            validated_events = []
            if isinstance(raw_events, list):
                for item in raw_events:
                    if not isinstance(item, dict):
                        continue
                    minute = int(item.get("minute", min_future_min))
                    second = int(item.get("second", 0))
                    team = str(item.get("team", "home")).lower()
                    if team not in ["home", "away"]:
                        team = "home"
                    player = str(item.get("player", ""))
                    event_type = str(item.get("event_type", "Shot off Target"))
                    detail = str(item.get("detail", ""))
                    loc_x = float(item.get("location_x", 50.0))
                    loc_y = float(item.get("location_y", 50.0))
                    
                    validated_events.append({
                        "minute": minute,
                        "second": second,
                        "team": team,
                        "player": player,
                        "event_type": event_type,
                        "detail": detail,
                        "location_x": loc_x,
                        "location_y": loc_y
                    })
                    
            validated_heat = []
            if isinstance(raw_heat, list):
                for item in raw_heat:
                    if not isinstance(item, dict):
                        continue
                    minute = int(item.get("minute", min_future_min))
                    team = str(item.get("team", "home")).lower()
                    if team not in ["home", "away"]:
                        team = "home"
                    loc_x = float(item.get("location_x", 50.0))
                    loc_y = float(item.get("location_y", 50.0))
                    intensity = float(item.get("intensity", 1.0))
                    
                    validated_heat.append({
                        "minute": minute,
                        "team": team,
                        "location_x": loc_x,
                        "location_y": loc_y,
                        "intensity": intensity
                    })
                    
            return {
                "events": sorted(validated_events, key=lambda e: (e["minute"], e["second"])),
                "heat_points": sorted(validated_heat, key=lambda h: h["minute"])
            }
        except Exception as e:
            logger.error(f"Gemini API event simulation failed: {e}. Falling back to procedural events.")

    # Heuristic/Procedural Fallback
    return _generate_procedural_simulation_events(
        home_team, away_team, home_score, away_score, current_minute, max_target_minute
    )

def _generate_procedural_simulation_events(
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
    current_minute: int,
    max_target_minute: int
) -> Dict[str, Any]:
    """
    Generates realistic tactical events and heat points procedurally as a high-fidelity fallback.
    """
    import random
    
    events_count = random.randint(3, 5)
    sim_events = []
    
    available_minutes = list(range(current_minute + 1, max_target_minute + 1))
    if len(available_minutes) < events_count:
        selected_minutes = [current_minute + i + 1 for i in range(events_count)]
    else:
        selected_minutes = sorted(random.sample(available_minutes, events_count))
        
    event_types = ["Shot on Target", "Shot off Target", "Corner", "Foul", "Save", "Turnover", "Goal", "Card"]
    score_diff = home_score - away_score
    
    for i, m in enumerate(selected_minutes):
        home_prob = 0.5
        if score_diff < 0:
            home_prob = 0.65
        elif score_diff > 0:
            home_prob = 0.35
            
        team_side = "home" if random.random() < home_prob else "away"
        
        if i == len(selected_minutes) - 1 and random.random() < 0.4:
            ev_type = "Goal" if random.random() < 0.6 else "Card"
        else:
            ev_type = random.choices(
                event_types, 
                weights=[0.15, 0.20, 0.15, 0.15, 0.15, 0.10, 0.05, 0.05]
            )[0]
            
        player_role = random.choice(["Striker", "Midfielder", "Winger", "Defender", "Captain"])
        team_name = home_team if team_side == "home" else away_team
        player = f"{team_name} {player_role}"
        
        detail = ""
        loc_x = random.uniform(20, 80)
        loc_y = random.uniform(10, 90)
        
        if ev_type == "Goal":
            loc_x = 95.0 if team_side == "home" else 5.0
            loc_y = 50.0
            detail = random.choice(["Penalty", "Header from corner", "Stunning volley", "Tap-in"])
        elif ev_type == "Shot on Target":
            loc_x = random.uniform(75, 94) if team_side == "home" else random.uniform(6, 25)
            loc_y = random.uniform(30, 70)
            detail = "Saved by GK"
        elif ev_type == "Shot off Target":
            loc_x = random.uniform(70, 92) if team_side == "home" else random.uniform(8, 30)
            loc_y = random.uniform(15, 85)
            detail = "Over the bar"
        elif ev_type == "Corner":
            loc_x = 99.0 if team_side == "home" else 1.0
            loc_y = 99.0 if random.random() < 0.5 else 1.0
            detail = "Corner kick"
        elif ev_type == "Card":
            detail = random.choice(["Yellow Card", "Red Card (Second Yellow)", "Straight Red Card"])
            
        sim_events.append({
            "minute": m,
            "second": random.randint(0, 59),
            "team": team_side,
            "player": player,
            "event_type": ev_type,
            "detail": detail,
            "location_x": round(loc_x, 1),
            "location_y": round(loc_y, 1)
        })
        
    # Generate 15-25 high-density heat points reflecting territory control
    sim_heat = []
    hp_count = random.randint(15, 25)
    for _ in range(hp_count):
        m = random.randint(current_minute + 1, max_target_minute)
        home_prob = 0.5
        if score_diff < 0:
            home_prob = 0.65
        elif score_diff > 0:
            home_prob = 0.35
            
        team_side = "home" if random.random() < home_prob else "away"
        
        if team_side == "home":
            if score_diff < 0:
                loc_x = random.uniform(55, 90)
            elif score_diff > 0:
                loc_x = random.uniform(30, 60)
            else:
                loc_x = random.uniform(45, 75)
        else:
            if score_diff > 0:
                loc_x = random.uniform(10, 45)
            elif score_diff < 0:
                loc_x = random.uniform(40, 70)
            else:
                loc_x = random.uniform(25, 55)
                
        loc_y = random.uniform(10, 90)
        intensity = random.uniform(0.6, 1.4)
        
        sim_heat.append({
            "minute": m,
            "team": team_side,
            "location_x": round(loc_x, 1),
            "location_y": round(loc_y, 1),
            "intensity": round(intensity, 2)
        })
        
    return {
        "events": sorted(sim_events, key=lambda x: (x["minute"], x["second"])),
        "heat_points": sorted(sim_heat, key=lambda h: h["minute"])
    }
