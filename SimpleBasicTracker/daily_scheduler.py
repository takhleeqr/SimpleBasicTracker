#!/usr/bin/env python3
"""
Daily Scheduler for Simple Basic Tracker
Runs basic analysis with Google Sheets integration
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timedelta
import requests
import gspread
from google.oauth2.service_account import Credentials

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('daily_scheduler.log'),
        logging.StreamHandler()
    ]
)

def load_config():
    """Load configuration"""
    config_file = 'config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r') as f:
            return json.load(f)
    return {
        'request_delay_min': 8,
        'request_delay_max': 15,
        'batch_delay': 60,
        'batch_size': 10,
        'enable_google_sheets': True,
        'google_sheets_columns': {
            'post_karma': 14,      # Column N
            'comment_karma': 15,    # Column O
            'created_date': 16,     # Column P
            'account_age_days': 17, # Column Q
            'last_activity': 18     # Column R
        }
    }

def load_usernames():
    """Load usernames with Google Sheets info"""
    usernames_file = 'usernames.json'
    if os.path.exists(usernames_file):
        with open(usernames_file, 'r') as f:
            data = json.load(f)
            return data.get('usernames', []), data.get('spreadsheet_id'), data.get('sheet_name'), data.get('usernames_data', [])
    return [], None, None, []

def setup_google_sheets():
    """Setup Google Sheets connection"""
    try:
        creds = Credentials.from_service_account_file(
            'google-sheets-credentials.json',
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        gc = gspread.authorize(creds)
        return gc
    except Exception as e:
        logging.error(f"Failed to setup Google Sheets: {e}")
        return None

def fetch_reddit_data(username):
    """Fetch basic Reddit data for a username - conservative error detection"""
    try:
        url = f"https://www.reddit.com/user/{username}/about.json"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                user_data = data['data']
                # Only mark as error if is_suspended is True
                if user_data.get('is_suspended', False):
                    return {
                        'username': username,
                        'error': '❌',
                        'is_banned': True
                    }
                # Otherwise, treat as active
                created_utc = user_data.get('created_utc', 0)
                created_date = datetime.fromtimestamp(created_utc).strftime('%Y-%m-%d') if created_utc else 'Unknown'
                account_age_days = (datetime.now() - datetime.fromtimestamp(created_utc)).days if created_utc else 0
                
                # Fetch last activity
                last_activity = fetch_last_activity(username)
                
                return {
                    'username': username,
                    'post_karma': user_data.get('link_karma', 0),
                    'comment_karma': user_data.get('comment_karma', 0),
                    'created_date': created_date,
                    'account_age_days': account_age_days,
                    'last_activity': last_activity,
                    'is_banned': False
                }
            else:
                # No 'data' field in response
                return {
                    'username': username,
                    'error': '❌',
                    'is_banned': True
                }
        elif response.status_code == 404:
            return {
                'username': username,
                'error': '❌',
                'is_banned': True
            }
        else:
            return {
                'username': username,
                'error': '❌',
                'is_banned': False
            }
    except Exception as e:
        logging.error(f"Error fetching data for {username}: {e}")
        return {
            'username': username,
            'error': '❌',
            'is_banned': False
        }

def fetch_last_activity(username):
    """Fetch user's last activity and return days since last post/comment"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        most_recent_time = 0
        
        # Get multiple posts to avoid pinned posts
        url = f"https://www.reddit.com/user/{username}/submitted.json?limit=10"
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'children' in data['data']:
                for post in data['data']['children']:
                    post_data = post['data']
                    # Skip pinned posts
                    if not post_data.get('pinned', False):
                        post_time = post_data.get('created_utc', 0)
                        if post_time > most_recent_time:
                            most_recent_time = post_time
                        # If we found a non-pinned post, we can stop
                        break
        
        # Get multiple comments to find most recent
        url = f"https://www.reddit.com/user/{username}/comments.json?limit=10"
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'children' in data['data']:
                for comment in data['data']['children']:
                    comment_data = comment['data']
                    comment_time = comment_data.get('created_utc', 0)
                    if comment_time > most_recent_time:
                        most_recent_time = comment_time
                    # Check first few comments
                    if len(data['data']['children']) <= 3:
                        break
        
        if most_recent_time > 0:
            days_since = (datetime.now() - datetime.fromtimestamp(most_recent_time)).days
            if days_since == 0:
                return "0 days"
            elif days_since == 1:
                return "1 day"
            else:
                return f"{days_since} days"
        
        return "Unknown"
        
    except Exception as e:
        logging.error(f"Error fetching last activity for {username}: {e}")
        return "Unknown"

def update_google_sheets(gc, spreadsheet_id, sheet_name, username_data, results, config):
    """Update Google Sheets with results - matching Google Apps Script behavior"""
    try:
        logging.info(f"Starting Google Sheets update for {len(results)} results")
        logging.info(f"Spreadsheet ID: {spreadsheet_id}")
        logging.info(f"Sheet name: {sheet_name}")
        logging.info(f"Username data count: {len(username_data)}")
        
        sh = gc.open_by_key(spreadsheet_id)
        ws = sh.worksheet(sheet_name)
        
        # Column mapping based on your Apps Script
        # Column N = 14, O = 15, P = 16, Q = 17, R = 18
        columns = {
            'post_karma': 14,      # Column N
            'comment_karma': 15,    # Column O  
            'created_date': 16,     # Column P
            'account_age_days': 17, # Column Q
            'last_activity': 18     # Column R
        }
        
        logging.info(f"Column mapping: {columns}")
        
        updated_count = 0
        error_count = 0
        
        for result in results:
            username = result['username']
            
            # Find the row for this username
            row_num = None
            for data in username_data:
                if data['username'] == username:
                    row_num = data['row']
                    break
            
            if not row_num:
                logging.warning(f"No row mapping found for {username}")
                error_count += 1
                continue
            
            logging.info(f"Processing {username} at row {row_num}")
            
            # Check if account is banned/suspended/error
            is_error = result.get('is_banned', False) or 'error' in result
            
            if is_error:
                # Write "❌" to all columns for banned/error accounts (matching your Apps Script)
                error_value = "❌"
                for col_name, col_num in columns.items():
                    try:
                        ws.update_cell(row_num, col_num, error_value)
                        logging.info(f"Updated {username} row {row_num} col {col_num} with error symbol")
                    except Exception as e:
                        logging.error(f"Failed to update {username} error in col {col_num}: {e}")
                        error_count += 1
            else:
                # Write actual data
                try:
                    ws.update_cell(row_num, columns['post_karma'], result.get('post_karma', 0))
                    ws.update_cell(row_num, columns['comment_karma'], result.get('comment_karma', 0))
                    ws.update_cell(row_num, columns['created_date'], result.get('created_date', 'Unknown'))
                    ws.update_cell(row_num, columns['account_age_days'], result.get('account_age_days', 0))
                    ws.update_cell(row_num, columns['last_activity'], result.get('last_activity', 'Unknown'))
                    logging.info(f"Updated {username} row {row_num} with data: karma={result.get('post_karma', 0)},{result.get('comment_karma', 0)}, age={result.get('account_age_days', 0)}")
                    updated_count += 1
                except Exception as e:
                    logging.error(f"Failed to update {username} data: {e}")
                    error_count += 1
            
            # Small delay between updates
            time.sleep(1)
        
        logging.info(f"Google Sheets update complete: {updated_count} successful, {error_count} errors")
            
    except Exception as e:
        logging.error(f"Failed to update Google Sheets: {e}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")

def run_daily_analysis():
    """Run the daily analysis"""
    logging.info("Starting daily analysis")
    
    # Load configuration and usernames
    config = load_config()
    usernames, spreadsheet_id, sheet_name, username_data = load_usernames()
    
    if not usernames:
        logging.warning("No usernames found")
        return
    
    logging.info(f"Loaded {len(usernames)} usernames")
    
    # Setup Google Sheets if enabled
    gc = None
    if config.get('enable_google_sheets', True) and spreadsheet_id:
        gc = setup_google_sheets()
        if not gc:
            logging.error("Failed to setup Google Sheets, continuing without write-back")
    
    # Process usernames in batches
    batch_size = config.get('batch_size', 10)
    request_delay_min = config.get('request_delay_min', 8)
    request_delay_max = config.get('request_delay_max', 15)
    batch_delay = config.get('batch_delay', 60)
    
    results = []
    
    for i in range(0, len(usernames), batch_size):
        batch = usernames[i:i + batch_size]
        logging.info(f"Processing batch {i//batch_size + 1}/{(len(usernames) + batch_size - 1)//batch_size}: {len(batch)} usernames")
        
        batch_results = []
        for username in batch:
            logging.info(f"Fetching data for {username}")
            result = fetch_reddit_data(username)
            batch_results.append(result)
            
            # Write back to Google Sheets immediately after each account
            if gc and spreadsheet_id and sheet_name:
                logging.info(f"Writing {username} to Google Sheets immediately")
                update_google_sheets(gc, spreadsheet_id, sheet_name, username_data, [result], config)
            
            # Random delay between requests
            delay = time.time() % (request_delay_max - request_delay_min) + request_delay_min
            time.sleep(delay)
        
        results.extend(batch_results)
        
        # Batch delay (except for last batch)
        if i + batch_size < len(usernames):
            logging.info(f"Batch complete, waiting {batch_delay} seconds")
            time.sleep(batch_delay)
    
    # Log summary
    successful = len([r for r in results if not r.get('is_banned', False) and 'error' not in r])
    banned = len([r for r in results if r.get('is_banned', False)])
    errors = len([r for r in results if 'error' in r and not r.get('is_banned', False)])
    
    logging.info(f"Analysis complete: {successful} successful, {banned} banned, {errors} errors")

if __name__ == "__main__":
    run_daily_analysis() 