#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# =====================================================================
# CONFIGURATION
# =====================================================================
SERVICE_NAME="tactical-tracker"
REGION="us-central1"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed or not in PATH."
    echo "Please download the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Fetch active project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo "⚠️ Warning: No default Google Cloud project is configured in gcloud CLI."
    read -p "Please enter your GCP Project ID: " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        echo "❌ Error: GCP Project ID is required."
        exit 1
    fi
    gcloud config set project $PROJECT_ID
fi

echo "====================================================================="
echo "🚀 DEPLOYING TACTICAL MOMENTUM TRACKER TO GOOGLE CLOUD RUN"
echo "====================================================================="
echo "Project ID   : $PROJECT_ID"
echo "Service Name : $SERVICE_NAME"
echo "Region       : $REGION"
echo "====================================================================="

# Prompt for GEMINI_API_KEY if not already set in environment
if [ -z "$GEMINI_API_KEY" ]; then
    echo "💡 Note: To use the Gemini LLM simulation, you need an API key."
    read -sp "Enter your GEMINI_API_KEY (leave empty to skip & use offline fallbacks): " GEMINI_API_KEY
    echo ""
fi

# Step 1: Build the docker image in Google Cloud Build
echo "📦 Step 1: Building container image using Google Cloud Build..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

# Step 2: Deploy to Cloud Run
echo "⚡ Step 2: Deploying image to Google Cloud Run..."
if [ -n "$GEMINI_API_KEY" ]; then
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --set-env-vars GEMINI_API_KEY="$GEMINI_API_KEY",USE_FIREBASE="true",FIREBASE_PROJECT_ID="$PROJECT_ID"
else
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --set-env-vars USE_FIREBASE="true",FIREBASE_PROJECT_ID="$PROJECT_ID"
fi

# Get deployed URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo "====================================================================="
echo "🎉 SUCCESS! Tactical Momentum Tracker is deployed."
echo "URL: $SERVICE_URL"
echo "====================================================================="
