import os
import logging
from dotenv import load_dotenv

# Load env file if exists
load_dotenv()

logger = logging.getLogger("tracker")

USE_FIREBASE = os.getenv("USE_FIREBASE", "false").lower() == "true"
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
SERVICE_ACCOUNT_KEY_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "app/serviceAccountKey.json")

db_client = None
firebase_app = None

if USE_FIREBASE:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Check if credential file exists
        if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized with service account certificate.")
        elif FIREBASE_PROJECT_ID:
            # Fallback to application default credentials or project ID for cloud environments
            firebase_app = firebase_admin.initialize_app(options={
                'projectId': FIREBASE_PROJECT_ID,
            })
            logger.info(f"Firebase Admin initialized using Project ID: {FIREBASE_PROJECT_ID}")
        else:
            logger.warning("Firebase is enabled but neither Service Account Key nor Project ID is set. Firebase integration disabled.")
            USE_FIREBASE = False
            
        if firebase_app:
            db_client = firestore.client()
            
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin SDK: {e}. Firebase integration disabled.")
        USE_FIREBASE = False


def publish_match_to_firebase(match_id: str, db_session):
    """
    Serializes a match, its events, and its calculated momentum, 
    then writes/updates it in Firestore.
    """
    if not USE_FIREBASE or db_client is None:
        return
        
    try:
        from app.database import Match
        from app.calculator import calculate_momentum_timeline
        
        match = db_session.query(Match).filter(Match.id == match_id).first()
        if not match:
            logger.warning(f"Could not find match {match_id} to sync to Firebase.")
            return

        # Format events
        events_list = []
        for e in match.events:
            events_list.append({
                "id": e.id,
                "minute": e.minute,
                "second": e.second,
                "team": e.team,
                "player": e.player,
                "event_type": e.event_type,
                "detail": e.detail,
                "location_x": e.location_x,
                "location_y": e.location_y,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            })

        # Calculate momentum
        timeline, probs = calculate_momentum_timeline(
            events=match.events,
            home_team=match.home_team,
            away_team=match.away_team,
            status=match.status
        )
        
        timeline_list = []
        for p in timeline:
            timeline_list.append({
                "minute": p.minute,
                "net_momentum": p.net_momentum,
                "event_marker": p.event_marker
            })

        # Assemble full document payload
        doc_data = {
            "id": match.id,
            "home_team": match.home_team,
            "away_team": match.away_team,
            "tournament": match.tournament,
            "date": match.date,
            "status": match.status,
            "home_score": match.home_score,
            "away_score": match.away_score,
            "events": events_list,
            "momentum": {
                "current_home_probability": probs["home"],
                "current_away_probability": probs["away"],
                "current_draw_probability": probs["draw"],
                "timeline": timeline_list
            },
            "last_updated": firestore.SERVER_TIMESTAMP
        }

        # Write to Firestore
        db_client.collection("matches").document(match.id).set(doc_data)
        logger.info(f"Successfully published match {match.id} data to Firestore.")
        
    except Exception as e:
        logger.error(f"Error publishing match {match_id} to Firebase: {e}")
