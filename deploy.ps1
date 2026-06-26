# PowerShell script to deploy Tactical Momentum Tracker to Google Cloud Run

$ErrorActionPreference = "Stop"

# Configuration
$ServiceName = "tactical-tracker"
$Region = "us-central1"

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Error: gcloud CLI is not installed or not in PATH. Please install Google Cloud SDK."
    exit 1
}

# Fetch active project ID
$ProjectId = gcloud config get-value project 2>$null

if ([string]::IsNullOrEmpty($ProjectId) -or $ProjectId -eq "(unset)") {
    Write-Warning "⚠️ Warning: No default Google Cloud project is configured in gcloud CLI."
    $ProjectId = Read-Host "Please enter your GCP Project ID"
    if ([string]::IsNullOrEmpty($ProjectId)) {
        Write-Error "❌ Error: GCP Project ID is required."
        exit 1
    }
    gcloud config set project $ProjectId
}

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "🚀 DEPLOYING TACTICAL MOMENTUM TRACKER TO GOOGLE CLOUD RUN" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Project ID   : $ProjectId"
Write-Host "Service Name : $ServiceName"
Write-Host "Region       : $Region"
Write-Host "=====================================================================" -ForegroundColor Cyan

# Prompt for GEMINI_API_KEY if not already set in environment
$GeminiKey = $env:GEMINI_API_KEY
if ([string]::IsNullOrEmpty($GeminiKey)) {
    Write-Host "💡 Note: To use the Gemini LLM simulation, you need an API key."
    $GeminiKey = Read-Host -Prompt "Enter your GEMINI_API_KEY (leave empty to skip & use offline fallbacks)"
}

# Step 1: Build the docker image in Google Cloud Build
Write-Host "📦 Step 1: Building container image using Google Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --tag gcr.io/$ProjectId/$ServiceName .

# Step 2: Deploy to Cloud Run
Write-Host "⚡ Step 2: Deploying image to Google Cloud Run..." -ForegroundColor Yellow
if (![string]::IsNullOrEmpty($GeminiKey)) {
    gcloud run deploy $ServiceName `
      --image gcr.io/$ProjectId/$ServiceName `
      --platform managed `
      --region $Region `
      --allow-unauthenticated `
      --set-env-vars GEMINI_API_KEY="$GeminiKey",USE_FIREBASE="true",FIREBASE_PROJECT_ID="$ProjectId"
} else {
    gcloud run deploy $ServiceName `
      --image gcr.io/$ProjectId/$ServiceName `
      --platform managed `
      --region $Region `
      --allow-unauthenticated `
      --set-env-vars USE_FIREBASE="true",FIREBASE_PROJECT_ID="$ProjectId"
}

# Get deployed URL
$ServiceUrl = gcloud run services describe $ServiceName --platform managed --region $Region --format 'value(status.url)'

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "🎉 SUCCESS! Tactical Momentum Tracker is deployed." -ForegroundColor Green
Write-Host "URL: $ServiceUrl" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
