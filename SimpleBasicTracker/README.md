# SimpleBasicTracker - Daily Reddit Analysis

This folder contains everything needed to run daily Reddit account analysis on Render.

## 🚀 Quick Deploy to Render

### Step 1: Create GitHub Repository
1. Go to [github.com](https://github.com)
2. Create new repository named `SimpleBasicTracker`
3. Make it **Public**
4. Upload all files from this folder

### Step 2: Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your `SimpleBasicTracker` repository
5. Set these values:
   - **Build Command**: `pip install -r requirements_cloud.txt`
   - **Start Command**: `python daily_scheduler.py`

### Step 3: Add Environment Variables
Add these in Render dashboard:

| Variable | Value |
|----------|-------|
| `SPREADSHEET_ID` | Your Google Sheets ID |
| `SHEET_NAME` | Sheet1 |
| `USERNAME_COLUMN` | I |
| `GOOGLE_SHEETS_CREDENTIALS` | Full JSON from google-sheets-credentials.json |
| `DAILY_SCHEDULE_TIMES` | 06:00,12:00,18:00,00:00 |
| `TIMEZONE` | UTC |

### Step 4: Deploy
Click "Create Web Service" and wait for deployment.

## 📁 Files in This Folder

- `daily_scheduler.py` - Main daily runner
- `basic_tracker.py` - Core analysis logic
- `app.py` - Web panel (optional)
- `requirements_cloud.txt` - Python dependencies
- `config.json` - Configuration
- `usernames.json` - Username data
- `google-sheets-credentials.json` - Google API credentials
- `render_daily.yaml` - Render deployment config
- `DAILY_SCHEDULING_GUIDE.md` - Detailed setup guide
- `CLOUD_DEPLOYMENT_GUIDE.md` - Cloud deployment guide

## 🕐 Daily Schedule

Runs 4 times per day:
- **06:00** - Morning analysis
- **12:00** - Noon analysis
- **18:00** - Evening analysis
- **00:00** - Midnight analysis

## 📊 Monitoring

- **Health Check**: `https://your-app.onrender.com/health`
- **Manual Run**: `https://your-app.onrender.com/run`
- **Schedule Info**: `https://your-app.onrender.com/schedule`

## 🔧 Customization

Change schedule times by setting:
```
DAILY_SCHEDULE_TIMES=08:00,14:00,20:00
```

## 📋 Requirements

- Google Sheets with usernames in Column I
- Google Sheets API credentials
- Render account (free tier available)

Your tracker will run automatically every day, pick up fresh usernames from your Google Sheets, and update the results! 