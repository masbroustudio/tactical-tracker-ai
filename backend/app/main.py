from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app.database import SessionLocal, init_db, Match, MatchEvent
from app.schemas import (
    MatchResponse, MatchDetailResponse, EventCreate, EventResponse, 
    MomentumTimelineResponse, SimulationRequest, TacticalInsightResponse,
    TacticalInsightRequest
)
from app.calculator import calculate_momentum_timeline
from app.recommender import generate_tactical_insights

app = FastAPI(title="Tactical Momentum Tracker API")

# Configure CORS for local development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency for DB Session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/matches", response_model=List[MatchResponse])
def get_matches(db: Session = Depends(get_db)):
    """Returns a list of all matches in the system."""
    return db.query(Match).all()

@app.post("/api/matches/sync-worldcup")
def sync_worldcup_matches(db: Session = Depends(get_db)):
    """
    Fetches real-time games from the World Cup 2026 API, normalizes the matches,
    procedurally generates realistic event logs with correct scorers and timings,
    and updates/inserts them into the SQLite database.
    """
    import urllib.request
    import json
    import re
    import random

    url = "https://worldcup26.ir/get/games"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch World Cup API: {str(e)}")

    games = res_data.get("games", [])
    if not games:
        return {"status": "success", "message": "No games found in the response."}

    # Only sync games that have started or are completed, or a subset of major group games
    # to avoid overloading the DB with empty future games.
    synced_count = 0
    for game in games:
        # Extract teams and labels
        home_team = game.get("home_team_name_en") or game.get("home_team_label")
        away_team = game.get("away_team_name_en") or game.get("away_team_label")
        
        # Skip if we don't have proper teams defined yet
        if not home_team or not away_team or home_team == "Winner Group" or away_team == "Winner Group":
            continue

        game_id = game.get("id")
        match_id = f"wc-2026-{game_id}"
        local_date = game.get("local_date", "")
        finished = game.get("finished") == "TRUE"
        time_elapsed = game.get("time_elapsed", "").lower()
        
        # Determine status
        if finished:
            status = "completed"
        elif time_elapsed != "notstarted":
            status = "live"
        else:
            status = "scheduled"

        # Determine scores safely
        try:
            home_score = int(game.get("home_score") or 0)
            away_score = int(game.get("away_score") or 0)
        except ValueError:
            home_score = 0
            away_score = 0

        # Helper to parse scorers and return detailed goals
        def parse_scorers(scorers_str, team_side):
            parsed_goals = []
            if not scorers_str or scorers_str == "null" or scorers_str == "None":
                return parsed_goals
            # Match pattern like: Name 12' or Name 45+2' or Name 12'(p)
            pattern = r"([a-zA-Z0-9\.\s\-'\u00C0-\u017F]+?)\s+(\d+(?:\+\d+)?)\s*'"
            matches = re.findall(pattern, scorers_str)
            for name, min_str in matches:
                is_penalty = "(p)" in name or "Penalty" in name
                is_own_goal = "(OG)" in name or "own goal" in name.lower()
                clean_name = name.replace("(p)", "").replace("Penalty", "").replace("(OG)", "").strip()
                
                # Parse minute
                if "+" in min_str:
                    minute = int(min_str.split("+")[0])
                else:
                    minute = int(min_str)
                
                parsed_goals.append({
                    "minute": min(120, max(1, minute)),
                    "team": team_side,
                    "player": clean_name,
                    "event_type": "Goal",
                    "detail": "Penalty" if is_penalty else ("Own Goal" if is_own_goal else "Goal"),
                    "location_x": 95.0 if team_side == "home" else 5.0,
                    "location_y": 50.0
                })
            return parsed_goals

        # Build events lists
        goals = []
        goals.extend(parse_scorers(game.get("home_scorers"), "home"))
        goals.extend(parse_scorers(game.get("away_scorers"), "away"))

        # Procedurally generate other event flows
        total_duration = 90 if finished else (45 if status == "live" else 0)
        
        # If the match has started/completed, generate dynamic events
        procedural_events = []
        if total_duration > 0:
            procedural_events.extend(goals)
            
            # Seed based on match ID for consistent generation
            rng = random.Random(hash(match_id))
            event_types = ["Shot on Target", "Shot off Target", "Corner", "Foul", "Save", "Turnover"]
            weights = [0.15, 0.20, 0.15, 0.25, 0.10, 0.15]
            
            for m in range(1, total_duration + 1):
                # Avoid stacking events on top of goal minutes
                if any(g["minute"] == m for g in goals):
                    continue
                
                if rng.random() < 0.25: # 25% chance of an event per minute
                    team_side = "home" if rng.random() < 0.52 else "away"
                    ev_type = rng.choices(event_types, weights=weights)[0]
                    player = f"{home_team if team_side == 'home' else away_team} Player"
                    detail = ""
                    
                    loc_x = rng.uniform(20, 80)
                    loc_y = rng.uniform(10, 90)
                    
                    if ev_type == "Shot on Target":
                        loc_x = rng.uniform(72, 95) if team_side == "home" else rng.uniform(5, 28)
                        loc_y = rng.uniform(25, 75)
                        detail = "Saved" if rng.random() < 0.7 else "Blocked"
                        # Generate corresponding save event
                        if detail == "Saved":
                            procedural_events.append({
                                "minute": m,
                                "team": "away" if team_side == "home" else "home",
                                "player": f"{away_team if team_side == 'home' else home_team} Goalkeeper",
                                "event_type": "Save",
                                "detail": "Shot Saved",
                                "location_x": 98.0 if team_side == "away" else 2.0,
                                "location_y": 50.0
                            })
                    elif ev_type == "Shot off Target":
                        loc_x = rng.uniform(70, 92) if team_side == "home" else rng.uniform(8, 30)
                        loc_y = rng.uniform(15, 85)
                        detail = "Header wide" if rng.random() < 0.4 else "Over the bar"
                    elif ev_type == "Corner":
                        loc_x = 99.0 if team_side == "home" else 1.0
                        loc_y = 99.0 if rng.random() < 0.5 else 1.0
                        detail = "In-swinging cross"
                    elif ev_type == "Foul":
                        loc_x = rng.uniform(15, 85)
                        loc_y = rng.uniform(5, 95)
                        if rng.random() < 0.15:
                            detail = "Yellow Card"
                            procedural_events.append({
                                "minute": m,
                                "team": team_side,
                                "player": player,
                                "event_type": "Card",
                                "detail": "Yellow Card",
                                "location_x": loc_x,
                                "location_y": loc_y
                            })
                    
                    procedural_events.append({
                        "minute": m,
                        "team": team_side,
                        "player": player,
                        "event_type": ev_type,
                        "detail": detail,
                        "location_x": round(loc_x, 1),
                        "location_y": round(loc_y, 1)
                    })
            
            procedural_events.sort(key=lambda x: x["minute"])

        # Check if match exists
        existing_match = db.query(Match).filter(Match.id == match_id).first()
        if existing_match:
            existing_match.status = status
            existing_match.home_score = home_score
            existing_match.away_score = away_score
            # Clear old events and re-populate
            db.query(MatchEvent).filter(MatchEvent.match_id == match_id).delete()
        else:
            db_match = Match(
                id=match_id,
                home_team=home_team,
                away_team=away_team,
                tournament="World Cup 2026",
                date=local_date[:10] if local_date else "2026-06-26",
                status=status,
                home_score=home_score,
                away_score=away_score
            )
            db.add(db_match)

        # Ingest events to DB
        for ev in procedural_events:
            db_event = MatchEvent(
                match_id=match_id,
                minute=ev["minute"],
                team=ev["team"],
                player=ev["player"],
                event_type=ev["event_type"],
                detail=ev["detail"],
                location_x=ev["location_x"],
                location_y=ev["location_y"]
            )
            db.add(db_event)
        
        synced_count += 1
    
    db.commit()
    return {"status": "success", "message": f"Successfully synchronized {synced_count} World Cup 2026 matches."}

@app.get("/api/matches/{match_id}", response_model=MatchDetailResponse)
def get_match_detail(match_id: str, db: Session = Depends(get_db)):
    """Returns detailed match information, including all event streams."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match

@app.post("/api/matches/{match_id}/events", response_model=EventResponse)
def ingest_event(match_id: str, event_in: EventCreate, db: Session = Depends(get_db)):
    """
    Simulates Event Ingestion. Receives event JSON, normalizes it, 
    persists it in the DB, and triggers momentum updates.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    db_event = MatchEvent(
        match_id=match_id,
        minute=event_in.minute,
        second=event_in.second,
        team=event_in.team,
        player=event_in.player,
        event_type=event_in.event_type,
        detail=event_in.detail,
        location_x=event_in.location_x,
        location_y=event_in.location_y
    )
    db.add(db_event)
    
    # Update live score if the event is a goal
    if event_in.event_type == "Goal":
        if event_in.team == "home":
            match.home_score += 1
        else:
            match.away_score += 1
            
    db.commit()
    db.refresh(db_event)
    return db_event

@app.get("/api/matches/{match_id}/momentum", response_model=MomentumTimelineResponse)
def get_momentum(match_id: str, db: Session = Depends(get_db)):
    """Calculates and returns the rolling momentum timeline and victory probabilities."""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    timeline, probs = calculate_momentum_timeline(
        events=match.events,
        home_team=match.home_team,
        away_team=match.away_team,
        status=match.status
    )
    
    return MomentumTimelineResponse(
        match_id=match.id,
        home_team=match.home_team,
        away_team=match.away_team,
        timeline=timeline,
        current_home_probability=probs["home"],
        current_away_probability=probs["away"],
        current_draw_probability=probs["draw"]
    )

@app.post("/api/matches/{match_id}/simulate", response_model=MomentumTimelineResponse)
def simulate_scenario(match_id: str, req: SimulationRequest, db: Session = Depends(get_db)):
    """
    Scenario Simulator: Accepts a list of hypothetical future events, 
    combines them with existing match events, and recalculates the momentum timeline.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Combine original events + hypothetical ones
    combined_events = list(match.events)
    
    for i, h_event in enumerate(req.hypothetical_events):
        # Create a mock database object representation (not committed to DB)
        mock_ev = MatchEvent(
            match_id=match_id,
            minute=h_event.minute,
            second=h_event.second,
            team=h_event.team,
            player=h_event.player,
            event_type=h_event.event_type,
            detail=h_event.detail or "Hypothetical Event",
            location_x=h_event.location_x,
            location_y=h_event.location_y
        )
        combined_events.append(mock_ev)
        
    # Recalculate based on combined list
    timeline, probs = calculate_momentum_timeline(
        events=combined_events,
        home_team=match.home_team,
        away_team=match.away_team,
        status=match.status
    )
    
    # Update simulated scores based on combined goals
    simulated_home_score = match.home_score
    simulated_away_score = match.away_score
    
    for h_event in req.hypothetical_events:
        if h_event.event_type == "Goal":
            if h_event.team == "home":
                simulated_home_score += 1
            else:
                simulated_away_score += 1
                
    # Update timeline points to reflect simulated scores at future points
    # Wait, calculator already accumulates goals based on events in combined_events,
    # which is exactly what we want!
    
    # Re-evaluate victory probability for the end state of simulation
    probs = calculate_momentum_timeline(
        events=combined_events,
        home_team=match.home_team,
        away_team=match.away_team,
        status=match.status
    )[1]
    
    return MomentumTimelineResponse(
        match_id=match.id,
        home_team=match.home_team,
        away_team=match.away_team,
        timeline=timeline,
        current_home_probability=probs["home"],
        current_away_probability=probs["away"],
        current_draw_probability=probs["draw"]
    )

@app.post("/api/matches/{match_id}/auto-simulate")
def auto_simulate_match(match_id: str, db: Session = Depends(get_db)):
    """
    Auto-Simulation: Generates 3-5 realistic future events using Gemini
    based on the current match state (or fallback procedural generation).
    Does NOT save them to the database, but returns them so the frontend
    can load them in the simulator queue.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Get current score and events
    home_score = match.home_score
    away_score = match.away_score
    
    # Current minute is the max minute of events, or 0 if none
    current_minute = max([e.minute for e in match.events]) if match.events else 0
    
    from app.recommender import generate_auto_simulation_events
    
    # Generate future events using Gemini or fallback
    sim_data = generate_auto_simulation_events(
        match_id=match.id,
        home_team=match.home_team,
        away_team=match.away_team,
        home_score=home_score,
        away_score=away_score,
        current_minute=current_minute,
        events=match.events
    )
    
    return {
        "status": "success", 
        "events": sim_data.get("events", []),
        "heat_points": sim_data.get("heat_points", [])
    }

@app.get("/api/matches/{match_id}/insights", response_model=TacticalInsightResponse)
def get_insights(match_id: str, db: Session = Depends(get_db)):
    """
    Fetches real-time tactical insights for the match. 
    Uses Gemini API to digest momentum trends, shifting indices, and match events.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Get momentum data to summarize
    timeline, probs = calculate_momentum_timeline(
        events=match.events,
        home_team=match.home_team,
        away_team=match.away_team,
        status=match.status
    )
    
    # Create a text summary of the momentum timeline for LLM context
    # Highlighting average momentum, swings, and late shifts
    last_10 = timeline[-10:] if len(timeline) >= 10 else timeline
    avg_momentum_last_10 = sum([p.net_momentum for p in last_10]) / len(last_10) if last_10 else 0.0
    
    timeline_summary = f"Match average net momentum: {sum([p.net_momentum for p in timeline])/len(timeline):.2f}. "
    timeline_summary += f"Recent 10 minutes average net momentum: {avg_momentum_last_10:.2f}. "
    
    swings = [p for p in timeline if p.event_marker]
    if swings:
        timeline_summary += "Key timeline inflection points: " + "; ".join([
            f"Min {p.minute} ({p.event_marker}): Net Momentum {p.net_momentum:.2f}"
            for p in swings
        ])
    else:
        timeline_summary += "No key inflection points marked on the timeline."

    insights = generate_tactical_insights(
        match_id=match.id,
        home_team=match.home_team,
        away_team=match.away_team,
        home_score=match.home_score,
        away_score=match.away_score,
        current_minute=max([e.minute for e in match.events]) if match.events else 0,
        events=match.events,
        recent_momentum=avg_momentum_last_10,
        timeline_summary=timeline_summary
    )
    
    return insights

@app.post("/api/matches/{match_id}/insights", response_model=TacticalInsightResponse)
def get_insights_post(match_id: str, req: TacticalInsightRequest, db: Session = Depends(get_db)):
    """
    POST variant of insights which supports analyzing hypothetical event chains
    generated from the Match Scenario Simulator.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Combine original events + hypothetical ones
    combined_events = list(match.events)
    
    if req.hypothetical_events:
        for h_event in req.hypothetical_events:
            mock_ev = MatchEvent(
                match_id=match_id,
                minute=h_event.minute,
                second=h_event.second,
                team=h_event.team,
                player=h_event.player,
                event_type=h_event.event_type,
                detail=h_event.detail or "Hypothetical Event",
                location_x=h_event.location_x,
                location_y=h_event.location_y
            )
            combined_events.append(mock_ev)
            
    # Calculate momentum based on combined list
    timeline, probs = calculate_momentum_timeline(
        events=combined_events,
        home_team=match.home_team,
        away_team=match.away_team,
        status=match.status
    )
    
    # Generate summary for the prompt
    last_10 = timeline[-10:] if len(timeline) >= 10 else timeline
    avg_momentum_last_10 = sum([p.net_momentum for p in last_10]) / len(last_10) if last_10 else 0.0
    
    timeline_summary = f"Match average net momentum: {sum([p.net_momentum for p in timeline])/len(timeline):.2f}. "
    timeline_summary += f"Recent 10 minutes average net momentum: {avg_momentum_last_10:.2f}. "
    
    swings = [p for p in timeline if p.event_marker]
    if swings:
        timeline_summary += "Key timeline inflection points: " + "; ".join([
            f"Min {p.minute} ({p.event_marker}): Net Momentum {p.net_momentum:.2f}"
            for p in swings
        ])
    else:
        timeline_summary += "No key inflection points marked on the timeline."

    # Update simulated scores for the prompt
    simulated_home_score = match.home_score
    simulated_away_score = match.away_score
    if req.hypothetical_events:
        for h_event in req.hypothetical_events:
            if h_event.event_type == "Goal":
                if h_event.team == "home":
                    simulated_home_score += 1
                else:
                    simulated_away_score += 1

    # Call Gemini or fallback
    is_scenario = len(req.hypothetical_events or []) > 0
    insights = generate_tactical_insights(
        match_id=match.id,
        home_team=match.home_team,
        away_team=match.away_team,
        home_score=simulated_home_score,
        away_score=simulated_away_score,
        current_minute=max([e.minute for e in combined_events]) if combined_events else 0,
        events=combined_events,
        recent_momentum=avg_momentum_last_10,
        timeline_summary=timeline_summary,
        is_simulated_scenario=is_scenario
    )
    
    return insights


@app.get("/api/worldcup/groups")
def get_worldcup_groups():
    import urllib.request
    import json
    
    groups_url = "https://worldcup26.ir/get/groups"
    teams_url = "https://worldcup26.ir/get/teams"
    
    try:
        # Fetch Groups
        req_groups = urllib.request.Request(
            groups_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req_groups, timeout=10) as response:
            groups_data = json.loads(response.read().decode('utf-8'))
            
        # Fetch Teams
        req_teams = urllib.request.Request(
            teams_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req_teams, timeout=10) as response:
            teams_data = json.loads(response.read().decode('utf-8'))
            
        # Create map of team_id -> team metadata
        teams_map = {}
        for team in teams_data.get("teams", []):
            teams_map[str(team.get("id"))] = {
                "name": team.get("name_en"),
                "flag": team.get("flag"),
                "fifa_code": team.get("fifa_code")
            }
            
            
        # Resolve team metadata in the group response
        resolved_groups = []
        for grp in groups_data.get("groups", []):
            resolved_teams = []
            for team_stat in grp.get("teams", []):
                t_id = str(team_stat.get("team_id"))
                meta = teams_map.get(t_id, {"name": f"Team {t_id}", "flag": "", "fifa_code": ""})
                
                resolved_teams.append({
                    "team_id": t_id,
                    "name": meta["name"],
                    "flag": meta["flag"],
                    "fifa_code": meta["fifa_code"],
                    "mp": team_stat.get("mp", "0"),
                    "w": team_stat.get("w", "0"),
                    "d": team_stat.get("d", "0"),
                    "l": team_stat.get("l", "0"),
                    "gf": team_stat.get("gf", "0"),
                    "ga": team_stat.get("ga", "0"),
                    "gd": team_stat.get("gd", "0"),
                    "pts": team_stat.get("pts", "0")
                })
                
            resolved_groups.append({
                "name": grp.get("name"),
                "teams": resolved_teams
            })
            
        return {"status": "success", "groups": resolved_groups}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resolved groups data: {str(e)}")

