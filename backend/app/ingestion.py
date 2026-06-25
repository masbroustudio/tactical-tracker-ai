import requests
import re
import random
import logging
from sqlalchemy.orm import Session
from app.database import Match, MatchEvent
from datetime import datetime

logger = logging.getLogger("tracker")

WORLDCUP_API_URL = "https://worldcup26.ir/get/games"

def parse_scorers(scorers_str: str):
    """
    Parses a scorer string like '{"Rubén Vargas 46\'","Jvhan Mnzambi 57\'"}'
    and returns a list of tuples: (player_name, minute)
    """
    if not scorers_str or scorers_str == "null" or scorers_str == "None":
        return []
    
    # Strip outer braces and quotes
    cleaned = scorers_str.strip('{}').replace('\\"', '"').replace("'", "")
    
    # Extract name and minute (e.g. "Rubén Vargas 46")
    pattern = r'([^",]+)\s+(\d+)\'?'
    matches = re.findall(pattern, cleaned)
    
    return [(player.strip(), int(minute)) for player, minute in matches]

def synthesize_secondary_events(match_id: str, goals: list, home_team: str, away_team: str):
    """
    Generates a realistic stream of tactical events (shots, saves, fouls, turnovers) 
    around the goals to build a continuous momentum curve and territory heatmap.
    """
    events = []
    
    # Add real goals
    for team, player, minute in goals:
        events.append(MatchEvent(
            match_id=match_id,
            minute=minute,
            second=0,
            team=team,
            player=player,
            event_type="Goal",
            detail="Goal scored",
            location_x=95.0 if team == "home" else 5.0,
            location_y=50.0 + random.uniform(-5, 5)
        ))
        
    # Generate around 30-40 random filler events distributed across 90 minutes
    num_fillers = random.randint(30, 45)
    event_types = ["Shot on Target", "Shot off Target", "Corner", "Foul", "Save", "Turnover"]
    
    for _ in range(num_fillers):
        minute = random.randint(1, 90)
        team = random.choice(["home", "away"])
        ev_type = random.choice(event_types)
        
        # Determine coordinates based on event type and team
        if team == "home":
            # Home attacking moves towards X=100
            loc_x = random.uniform(40, 98) if ev_type in ["Shot on Target", "Shot off Target", "Corner", "Save"] else random.uniform(10, 80)
        else:
            # Away attacking moves towards X=0
            loc_x = random.uniform(2, 60) if ev_type in ["Shot on Target", "Shot off Target", "Corner", "Save"] else random.uniform(20, 90)
            
        loc_y = random.uniform(5, 95)
        
        # Add detailed cards/fouls occasionally
        detail = None
        player = f"{home_team if team == 'home' else away_team} Player"
        if ev_type == "Foul":
            if random.random() < 0.15:
                ev_type = "Card"
                detail = "Yellow Card"
            elif random.random() < 0.02:
                ev_type = "Card"
                detail = "Red Card"
                
        events.append(MatchEvent(
            match_id=match_id,
            minute=minute,
            second=random.randint(0, 59),
            team=team,
            player=player,
            event_type=ev_type,
            detail=detail,
            location_x=round(loc_x, 1),
            location_y=round(loc_y, 1)
        ))
        
    # Sort events by minute and second
    events.sort(key=lambda e: (e.minute, e.second))
    return events

def sync_worldcup_matches(db: Session) -> int:
    """
    Fetches games from the free World Cup 2026 API, updates/inserts them 
    into the database, and synthesizes events. Returns count of synced games.
    """
    try:
        response = requests.get(WORLDCUP_API_URL, timeout=10)
        if response.status_code != 200:
            logger.error(f"Failed to fetch games from WorldCup API. Status: {response.status_code}")
            return 0
            
        games = response.json()
        synced_count = 0
        
        for game in games:
            # Sync only games that have finished or are live
            # (i.e. have been played or have score updates)
            status = "completed" if game.get("finished", "FALSE") == "TRUE" else "live"
            
            # If the game is "notstarted", skip it for our analytics dashboard sync
            if game.get("time_elapsed") == "notstarted":
                continue
                
            match_id = f"wc2026-{game.get('id')}"
            home_team = game.get("home_team_name_en")
            away_team = game.get("away_team_name_en")
            
            home_score = int(game.get("home_score", 0))
            away_score = int(game.get("away_score", 0))
            
            # Check if match already exists
            existing_match = db.query(Match).filter(Match.id == match_id).first()
            
            if existing_match:
                # Update scores and status
                existing_match.home_score = home_score
                existing_match.away_score = away_score
                existing_match.status = status
                db.commit()
                continue
                
            # Parse goals & scorers
            goals = []
            home_goals = parse_scorers(game.get("home_scorers", ""))
            for scorer, minute in home_goals:
                goals.append(("home", scorer, minute))
                
            away_goals = parse_scorers(game.get("away_scorers", ""))
            for scorer, minute in away_goals:
                goals.append(("away", scorer, minute))
                
            # Create new Match
            new_match = Match(
                id=match_id,
                home_team=home_team,
                away_team=away_team,
                tournament="World Cup 2026",
                date=game.get("local_date", datetime.utcnow().strftime("%m/%d/%Y %H:%M")),
                status=status,
                home_score=home_score,
                away_score=away_score
            )
            db.add(new_match)
            db.commit()
            
            # Synthesize event chain including real goals
            events = synthesize_secondary_events(match_id, goals, home_team, away_team)
            for ev in events:
                db.add(ev)
                
            db.commit()
            synced_count += 1
            
        return synced_count
        
    except Exception as e:
        logger.error(f"Error syncing World Cup matches: {e}")
        return 0
