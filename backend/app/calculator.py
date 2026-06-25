import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from app.schemas import EventBase, MomentumPoint

EVENT_WEIGHTS = {
    "Goal": 5.0,
    "Shot on Target": 1.5,
    "Shot off Target": 0.8,
    "Corner": 0.6,
    "Foul": -1.0,
    "Card": -2.0,  # Standard card, check details for Red vs Yellow
    "Save": 1.0,
    "Turnover": -1.2
}

def get_event_weight(event_type: str, detail: str, team: str) -> float:
    """
    Returns positive weight for Home team actions, negative weight for Away team actions.
    """
    base_weight = EVENT_WEIGHTS.get(event_type, 0.0)
    
    # Specific adjustment for Red Cards
    if event_type == "Card" and detail and "Red" in detail:
        base_weight = -5.0
    elif event_type == "Foul" and detail and "Yellow" in detail:
        base_weight = -2.0
        
    # If the action is by the away team, invert the impact on Home's net momentum
    # (e.g., away team goals subtract from home momentum, away team fouls add to home momentum)
    direction = 1.0 if team == "home" else -1.0
    
    return base_weight * direction

def calculate_momentum_timeline(
    events: List[Any], 
    home_team: str, 
    away_team: str, 
    status: str
) -> Tuple[List[MomentumPoint], Dict[str, float]]:
    """
    Calculates minute-by-minute momentum and returns a list of MomentumPoints 
    along with the final win/draw/loss probabilities.
    """
    # Determine the length of the timeline (always default to standard 90 minutes)
    max_event_minute = max([e.minute for e in events]) if events else 0
    match_duration = max(90, max_event_minute)

    # Initialize raw data structures
    minutes = list(range(0, match_duration + 1))
    raw_scores = {m: 0.0 for m in minutes}
    
    # Track score and key events at each minute
    home_score_tracker = {m: 0 for m in minutes}
    away_score_tracker = {m: 0 for m in minutes}
    event_markers = {m: None for m in minutes}
    event_details = {m: None for m in minutes}
    
    current_home_score = 0
    current_away_score = 0

    # Sort events by minute and second
    sorted_events = sorted(events, key=lambda e: (e.minute, getattr(e, 'second', 0)))

    for ev in sorted_events:
        m = ev.minute
        if m not in raw_scores:
            continue
            
        # Update score
        if ev.event_type == "Goal":
            if ev.team == "home":
                current_home_score += 1
            else:
                current_away_score += 1
        
        # Add weights
        weight = get_event_weight(ev.event_type, ev.detail or "", ev.team)
        raw_scores[m] += weight
        
        # Store markers for visual highlights on the timeline (Goals, Red Cards, Penalties)
        is_highlight = (
            ev.event_type == "Goal" or 
            (ev.event_type == "Card" and ev.detail and "Red" in ev.detail) or
            (ev.event_type == "Shot on Target" and ev.detail and "Penalty" in ev.detail)
        )
        if is_highlight:
            team_name = home_team if ev.team == "home" else away_team
            event_markers[m] = f"{ev.event_type} - {team_name}"
            event_details[m] = f"{ev.player or 'Player'}: {ev.detail or ev.event_type}"

    # Smooth the raw momentum using a pandas EWM (Exponential Weighted Moving Average)
    raw_series = pd.Series([raw_scores[m] for m in minutes])
    # Span of 8 minutes provides nice responsive smoothing
    smoothed_series = raw_series.ewm(span=8, min_periods=1).mean()
    
    # Track running scores for each minute
    running_home_score = 0
    running_away_score = 0
    for m in minutes:
        for ev in sorted_events:
            if ev.minute == m and ev.event_type == "Goal":
                if ev.team == "home":
                    running_home_score += 1
                else:
                    running_away_score += 1
        home_score_tracker[m] = running_home_score
        away_score_tracker[m] = running_away_score

    # Construct the timeline points
    timeline = []
    for m in minutes:
        timeline.append(
            MomentumPoint(
                minute=m,
                home_score=home_score_tracker[m],
                away_score=away_score_tracker[m],
                net_momentum=float(smoothed_series[m]),
                event_marker=event_markers[m],
                event_description=event_details[m]
            )
        )
        
    # Calculate current live probabilities
    probabilities = calculate_win_probabilities(
        home_score=current_home_score,
        away_score=current_away_score,
        current_minute=match_duration,
        recent_momentum=float(smoothed_series.iloc[-1]) if not smoothed_series.empty else 0.0
    )
    
    return timeline, probabilities

def calculate_win_probabilities(
    home_score: int,
    away_score: int,
    current_minute: int,
    recent_momentum: float
) -> Dict[str, float]:
    """
    Computes real-time win probability heuristics using match state (score, time) 
    and momentum adjustment.
    """
    score_diff = home_score - away_score
    time_remaining = max(0, 90 - current_minute)
    
    # Base logits (tied match has equal likelihoods, with a slight home advantage)
    home_logit = 0.2
    away_logit = 0.0
    draw_logit = 0.4
    
    # Adjust for current score difference
    # Larger score difference with less time remaining makes comebacks exponentially harder
    if score_diff > 0:
        home_logit += score_diff * 2.0 * (90 / max(1, time_remaining))**0.2
        draw_logit -= score_diff * 0.5
        away_logit -= score_diff * 1.5
    elif score_diff < 0:
        away_logit += abs(score_diff) * 2.0 * (90 / max(1, time_remaining))**0.2
        draw_logit -= abs(score_diff) * 0.5
        home_logit -= abs(score_diff) * 1.5
        
    # Influence of momentum
    # Positive momentum shifts home probability up, negative shifts away probability up
    momentum_effect = recent_momentum * 0.15
    home_logit += momentum_effect
    away_logit -= momentum_effect
    
    # Draw adjustment: as time runs out, if score is tied, draw probability goes to 1
    if score_diff == 0:
        draw_logit += (90 - time_remaining) * 0.05
        
    # Softmax conversion
    logits = np.array([home_logit, draw_logit, away_logit])
    # Prevent overflow
    logits = np.clip(logits, -20, 20)
    exp_logits = np.exp(logits)
    probs = exp_logits / np.sum(exp_logits)
    
    # Ensure they sum to exactly 1.0
    return {
        "home": float(probs[0]),
        "draw": float(probs[1]),
        "away": float(probs[2])
    }
