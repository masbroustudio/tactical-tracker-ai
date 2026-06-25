from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# --- Database Seeding and Base Models ---
class EventBase(BaseModel):
    minute: int = Field(..., ge=0, le=120)
    second: Optional[int] = 0
    team: str = Field(..., description="'home' or 'away'")
    player: Optional[str] = None
    event_type: str = Field(..., description="Goal, Shot on Target, Shot off Target, Foul, Card, Corner, Save, Turnover")
    detail: Optional[str] = None
    location_x: Optional[float] = Field(None, ge=0.0, le=100.0)
    location_y: Optional[float] = Field(None, ge=0.0, le=100.0)

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    match_id: str
    timestamp: datetime

    class Config:
        from_attributes = True

class MatchBase(BaseModel):
    id: str
    home_team: str
    away_team: str
    tournament: str
    date: str
    status: str
    home_score: int
    away_score: int

class MatchResponse(MatchBase):
    class Config:
        from_attributes = True

class MatchDetailResponse(MatchResponse):
    events: List[EventResponse]

# --- Momentum Calculations ---
class MomentumPoint(BaseModel):
    minute: int
    home_score: float
    away_score: float
    net_momentum: float  # Positive favors home, negative favors away
    event_marker: Optional[str] = None  # Key events like Goals, Red Cards to highlight
    event_description: Optional[str] = None

class MomentumTimelineResponse(BaseModel):
    match_id: str
    home_team: str
    away_team: str
    timeline: List[MomentumPoint]
    current_home_probability: float  # Win probability (0 to 1)
    current_away_probability: float  # Win probability (0 to 1)
    current_draw_probability: float  # Win probability (0 to 1)

# --- Scenario Simulation ---
class SimulationRequest(BaseModel):
    match_id: str
    hypothetical_events: List[EventBase]

# --- LLM Recommendation ---
class TacticalInsightRequest(BaseModel):
    match_id: str
    hypothetical_events: Optional[List[EventBase]] = None

class TacticalInsightResponse(BaseModel):
    match_id: str
    recommendation: str
    game_state_summary: str
    suggested_substitutions: List[str]
    suggested_formation_change: str
