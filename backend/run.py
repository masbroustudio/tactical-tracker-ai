import uvicorn
import sys
import os

# Ensure the root backend folder is on the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting Tactical Momentum Tracker Backend...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
