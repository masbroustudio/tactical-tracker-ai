import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(BASE_DIR), 'tracker.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Match(Base):
    __tablename__ = "matches"

    id = Column(String, primary_key=True, index=True)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    tournament = Column(String, nullable=False)
    date = Column(String, nullable=False)
    status = Column(String, default="scheduled")  # scheduled, live, completed
    home_score = Column(Integer, default=0)
    away_score = Column(Integer, default=0)

    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan")

class MatchEvent(Base):
    __tablename__ = "match_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    match_id = Column(String, ForeignKey("matches.id"), nullable=False)
    minute = Column(Integer, nullable=False)
    second = Column(Integer, default=0)
    team = Column(String, nullable=False)  # 'home' or 'away'
    player = Column(String, nullable=True)
    event_type = Column(String, nullable=False)  # Goal, Shot on Target, Shot off Target, Foul, Card, Corner, Save, Turnover
    detail = Column(String, nullable=True)  # e.g., 'Yellow Card', 'Red Card', etc.
    location_x = Column(Float, nullable=True)  # 0-100 (horizontal pitch coordinate)
    location_y = Column(Float, nullable=True)  # 0-100 (vertical pitch coordinate)
    timestamp = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="events")

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed matches if empty
        if db.query(Match).count() == 0:
            seed_data(db)
    finally:
        db.close()

def seed_data(db):
    # Seed Match 1: El Clásico (Real Madrid vs Barcelona)
    m1 = Match(
        id="el-clasico-2026",
        home_team="Real Madrid",
        away_team="Barcelona",
        tournament="La Liga",
        date="2026-06-25",
        status="completed",
        home_score=3,
        away_score=2
    )
    db.add(m1)

    # Seed Match 2: UCL Drama (Manchester City vs PSG)
    m2 = Match(
        id="mci-psg-2026",
        home_team="Manchester City",
        away_team="Paris Saint-Germain",
        tournament="Champions League",
        date="2026-06-26",
        status="live",
        home_score=1,
        away_score=1
    )
    db.add(m2)
    db.commit()

    # Seed events for El Clásico (A dramatic comeback for Real Madrid)
    # Barça starts strong, scores twice, Madrid receives a red card? Or Madrid makes a late comeback
    # Let's seed events minute by minute
    events_m1 = [
        # Minute 1-15: Barcelona dominance
        (3, "away", "Lamine Yamal", "Shot on Target", "Saved by Courtois", 72.0, 48.0),
        (5, "away", "Raphinha", "Corner", "Cleared", 99.0, 95.0),
        (7, "away", "Robert Lewandowski", "Goal", "Header from Corner", 95.0, 50.0), # Barca 1 - 0 Madrid
        (10, "home", "Jude Bellingham", "Foul", "Tactical foul", 45.0, 30.0),
        (12, "away", "Pedri", "Shot off Target", "Long range shot", 70.0, 60.0),
        (15, "home", "Vinicius Jr", "Turnover", "Dispossessed by Kounde", 30.0, 20.0),
        
        # Minute 16-30: Barcelona scores again
        (18, "away", "Robert Lewandowski", "Shot on Target", "Easy catch", 85.0, 52.0),
        (22, "away", "Lamine Yamal", "Goal", "Solo run and finish", 88.0, 38.0), # Barca 2 - 0 Madrid
        (25, "home", "Federico Valverde", "Shot on Target", "Saved by Ter Stegen", 78.0, 45.0),
        (26, "home", "Vinicius Jr", "Corner", "Fisted away", 0.0, 95.0),
        (29, "home", "Aurelien Tchouameni", "Foul", "Yellow Card", 50.0, 50.0),

        # Minute 31-45: Madrid starts fighting back
        (33, "home", "Rodrygo", "Shot on Target", "Blocked", 80.0, 55.0),
        (35, "home", "Vinicius Jr", "Goal", "Penalty kick", 88.0, 50.0), # Barca 2 - 1 Madrid
        (38, "away", "Frenkie de Jong", "Foul", "Trip on Bellingham", 40.0, 60.0),
        (42, "home", "Jude Bellingham", "Shot off Target", "Header wide", 92.0, 48.0),
        (45, "away", "Robert Lewandowski", "Turnover", "Intercepted by Militao", 60.0, 40.0),

        # Minute 46-60: High intensity, balanced
        (48, "home", "Federico Valverde", "Shot on Target", "Powerful strike, saved", 75.0, 55.0),
        (50, "home", "Rodrygo", "Corner", "Overthrown", 0.0, 0.0),
        (53, "away", "Pedri", "Turnover", "Intercepted", 45.0, 45.0),
        (55, "home", "Vinicius Jr", "Shot on Target", "Defended well", 85.0, 30.0),
        (58, "away", "Raphinha", "Foul", "Yellow Card for stopping counter", 35.0, 25.0),

        # Minute 61-75: Real Madrid momentum peak
        (62, "home", "Vinicius Jr", "Shot on Target", "Saved to corner", 89.0, 42.0),
        (63, "home", "Luka Modric", "Corner", "In-swinging", 0.0, 5.0),
        (65, "home", "Rodrygo", "Goal", "Tap-in from rebound", 96.0, 52.0), # Barca 2 - 2 Madrid
        (68, "away", "Robert Lewandowski", "Foul", "Frustration foul", 65.0, 70.0),
        (70, "away", "Lamine Yamal", "Turnover", "Lost ball", 75.0, 20.0),
        (74, "home", "Jude Bellingham", "Shot on Target", "Slick header, tipped over", 91.0, 51.0),

        # Minute 76-90: Madrid complete the comeback
        (78, "away", "Ronald Araujo", "Foul", "Red Card for last-man tackle", 82.0, 45.0), # Barca down to 10 men
        (80, "home", "Luka Modric", "Shot on Target", "Free kick, saved", 80.0, 50.0),
        (82, "home", "Vinicius Jr", "Shot off Target", "Shot goes wide left", 87.0, 35.0),
        (85, "away", "Ferran Torres", "Turnover", "Tactical clearance", 30.0, 80.0),
        (89, "home", "Jude Bellingham", "Goal", "Late winner, low shot in corner", 92.0, 47.0), # Barca 2 - 3 Madrid
        (90, "away", "Gavi", "Foul", "Yellow Card", 55.0, 55.0),
    ]

    for ev in events_m1:
        e = MatchEvent(
            match_id="el-clasico-2026",
            minute=ev[0],
            team=ev[1],
            player=ev[2],
            event_type=ev[3],
            detail=ev[4],
            location_x=ev[5],
            location_y=ev[6]
        )
        db.add(e)

    # Seed events for MCI vs PSG (Ongoing Live Match)
    events_m2 = [
        (4, "home", "Erling Haaland", "Shot on Target", "Saved", 85.0, 50.0),
        (8, "away", "Ousmane Dembele", "Shot off Target", "Wide right", 78.0, 30.0),
        (12, "away", "Bradley Barcola", "Goal", "Curled into top corner", 86.0, 40.0), # PSG 1 - 0 MCI
        (15, "home", "Kevin De Bruyne", "Corner", "Cleared by Marquinhos", 0.0, 95.0),
        (20, "home", "Phil Foden", "Shot on Target", "Saved by Donnarumma", 82.0, 48.0),
        (25, "away", "Vitinha", "Foul", "Yellow Card", 50.0, 40.0),
        (30, "home", "Bernardo Silva", "Turnover", "Dispossessed", 40.0, 30.0),
        (35, "home", "Erling Haaland", "Goal", "Header from De Bruyne cross", 93.0, 50.0), # PSG 1 - 1 MCI
        (40, "away", "Ousmane Dembele", "Turnover", "Intercepted", 70.0, 20.0),
        (45, "home", "Kevin De Bruyne", "Shot on Target", "Saved", 88.0, 55.0),
    ]

    for ev in events_m2:
        e = MatchEvent(
            match_id="mci-psg-2026",
            minute=ev[0],
            team=ev[1],
            player=ev[2],
            event_type=ev[3],
            detail=ev[4],
            location_x=ev[5],
            location_y=ev[6]
        )
        db.add(e)

    db.commit()
