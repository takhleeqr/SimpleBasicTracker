#!/usr/bin/env python3
"""
SimpleBasicTracker Web Panel
Original working version with full functionality
"""

from flask import Flask, render_template, request, jsonify
import os
import json
import subprocess

app = Flask(__name__)
app.secret_key = 'reddit_tracker_secret_key_2024'

USERNAMES_FILE = 'usernames.json'
CONFIG_FILE = 'config.json'

def load_config():
    """Load configuration"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
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

def save_config(config):
    """Save configuration"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def load_usernames():
    """Load usernames"""
    if os.path.exists(USERNAMES_FILE):
        with open(USERNAMES_FILE, 'r') as f:
            data = json.load(f)
            return data.get('usernames', [])
    return []

def save_usernames(usernames, spreadsheet_id=None, sheet_name=None, username_data=None):
    """Save usernames with Google Sheets info"""
    data = {
        'usernames': usernames,
        'spreadsheet_id': spreadsheet_id,
        'sheet_name': sheet_name
    }
    
    # Add username_data if provided (for row mapping)
    if username_data:
        data['usernames_data'] = username_data
    
    with open(USERNAMES_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    """Main dashboard"""
    config = load_config()
    usernames = load_usernames()
    return render_template('index.html', config=config, usernames=usernames)

@app.route('/api/usernames', methods=['GET'])
def get_usernames():
    """Get usernames"""
    usernames = load_usernames()
    return jsonify({'usernames': usernames})

@app.route('/api/usernames', methods=['POST'])
def add_usernames():
    """Add usernames"""
    data = request.get_json()
    usernames = data.get('usernames', [])
    
    if usernames:
        save_usernames(usernames, username_data=[])
        return jsonify({'success': True, 'message': f'Added {len(usernames)} usernames'})
    
    return jsonify({'success': False, 'message': 'No usernames provided'})

@app.route('/api/usernames/clear', methods=['POST'])
def clear_usernames():
    """Clear all usernames"""
    save_usernames([], username_data=[])
    return jsonify({'success': True, 'message': 'All usernames cleared'})

@app.route('/api/usernames/import_google_sheets', methods=['POST'])
def import_google_sheets():
    """Import usernames from Google Sheets"""
    data = request.get_json()
    spreadsheet_id = data.get('spreadsheet_id')
    sheet_name = data.get('sheet_name', 'Sheet1')
    column = data.get('column', 'I')
    
    try:
        import gspread
        from google.oauth2.service_account import Credentials
        
        creds = Credentials.from_service_account_file(
            'google-sheets-credentials.json',
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        gc = gspread.authorize(creds)
        
        sh = gc.open_by_key(spreadsheet_id)
        ws = sh.worksheet(sheet_name)
        
        # Get column values
        col_idx = ord(column.upper()) - ord('A') + 1
        values = ws.col_values(col_idx)
        
        # Extract usernames (skip header)
        usernames = []
        username_data = []
        
        for i, value in enumerate(values[1:], start=2):  # Start from row 2
            if value and str(value).strip():
                username = str(value).strip()
                usernames.append(username)
                username_data.append({
                    'username': username,
                    'row': i
                })
        
        if usernames:
            save_usernames(usernames, spreadsheet_id, sheet_name, username_data)
            return jsonify({
                'success': True,
                'message': f'Imported {len(usernames)} usernames',
                'usernames': usernames
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No usernames found in the specified column'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Import failed: {str(e)}'
        })

@app.route('/api/start_analysis', methods=['POST'])
def start_analysis():
    """Start basic analysis"""
    try:
        import subprocess
        subprocess.Popen(['python', 'daily_scheduler.py'])
        return jsonify({'success': True, 'message': 'Analysis started'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to start analysis: {e}'})

@app.route('/api/analysis_status')
def analysis_status():
    """Get analysis status"""
    log_file = 'daily_scheduler.log'
    status = 'idle'
    
    if os.path.exists(log_file):
        with open(log_file, 'r') as f:
            lines = f.readlines()
            if lines:
                last_line = lines[-1]
                if 'Analysis complete' in last_line:
                    status = 'complete'
                elif 'Starting daily analysis' in last_line:
                    status = 'running'
    
    return jsonify({'status': status})

@app.route('/config')
def config_page():
    """Configuration page"""
    config = load_config()
    return render_template('config.html', config=config)

@app.route('/save_config', methods=['POST'])
def save_config_form():
    """Save configuration"""
    try:
        form_data = request.form
        config = load_config()
        
        config.update({
            'request_delay_min': int(form_data.get('request_delay_min', 8)),
            'request_delay_max': int(form_data.get('request_delay_max', 15)),
            'batch_delay': int(form_data.get('batch_delay', 60)),
            'batch_size': int(form_data.get('batch_size', 10)),
            'enable_google_sheets': 'enable_google_sheets' in form_data
        })
        
        save_config(config)
        return jsonify({'success': True, 'message': 'Configuration saved'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error saving config: {e}'})

@app.route('/save_columns', methods=['POST'])
def save_columns_form():
    """Save column mapping configuration"""
    try:
        form_data = request.form
        config = load_config()
        
        # Initialize google_sheets_columns if it doesn't exist
        if 'google_sheets_columns' not in config:
            config['google_sheets_columns'] = {}
        
        # Update column mappings
        config['google_sheets_columns'].update({
            'post_karma': int(form_data.get('post_karma', 14)),
            'comment_karma': int(form_data.get('comment_karma', 15)),
            'created_date': int(form_data.get('created_date', 16)),
            'account_age_days': int(form_data.get('account_age_days', 17)),
            'last_activity': int(form_data.get('last_activity', 18))
        })
        
        save_config(config)
        return jsonify({'success': True, 'message': 'Column mapping saved'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error saving column mapping: {e}'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) 