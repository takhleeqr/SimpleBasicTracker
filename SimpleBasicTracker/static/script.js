// Simple Basic Tracker - JavaScript Functions

// Global functions for HTML onclick handlers
window.addUsernames = function() {
    const usernamesText = document.getElementById('usernames').value;
    if (!usernamesText.trim()) {
        showMessage('Please enter usernames', 'error');
        return;
    }
    
    const usernames = usernamesText.split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);
    
    if (usernames.length === 0) {
        showMessage('No valid usernames found', 'error');
        return;
    }
    
    fetch('/api/usernames', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usernames: usernames })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage(data.message, 'success');
            document.getElementById('usernames').value = '';
            updateUsernameList();
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Failed to add usernames', 'error');
    });
};

window.clearUsernames = function() {
    if (!confirm('Are you sure you want to clear all usernames?')) {
        return;
    }
    
    fetch('/api/usernames/clear', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage(data.message, 'success');
            updateUsernameList();
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Failed to clear usernames', 'error');
    });
};

window.importFromGoogleSheets = function() {
    console.log('Import function called'); // Debug log
    
    const spreadsheetId = document.getElementById('spreadsheet_id').value.trim();
    const sheetName = document.getElementById('sheet_name').value.trim();
    const column = document.getElementById('column').value.trim();
    
    if (!spreadsheetId) {
        showMessage('Please enter a Spreadsheet ID', 'error');
        return;
    }
    
    console.log('Sending import request with:', { spreadsheetId, sheetName, column }); // Debug log
    
    fetch('/api/usernames/import_google_sheets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            spreadsheet_id: spreadsheetId,
            sheet_name: sheetName,
            column: column
        })
    })
    .then(response => {
        console.log('Response received:', response); // Debug log
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data); // Debug log
        if (data.success) {
            showMessage(data.message, 'success');
            updateUsernameList();
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Import error:', error);
        showMessage('Failed to import from Google Sheets: ' + error.message, 'error');
    });
};

window.startAnalysis = function() {
    const button = event.target;
    const originalText = button.textContent;
    
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Starting...';
    
    fetch('/api/start_analysis', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage(data.message, 'success');
            updateAnalysisStatus();
        } else {
            showMessage(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Failed to start analysis', 'error');
    })
    .finally(() => {
        button.disabled = false;
        button.textContent = originalText;
    });
};

// Helper functions
function updateUsernameList() {
    fetch('/api/usernames')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('username-list');
        container.innerHTML = '';
        
        data.usernames.forEach(username => {
            const tag = document.createElement('span');
            tag.className = 'username-tag';
            tag.textContent = username;
            container.appendChild(tag);
        });
    })
    .catch(error => {
        console.error('Error updating username list:', error);
    });
}

function updateAnalysisStatus() {
    fetch('/api/analysis_status')
    .then(response => response.json())
    .then(data => {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
        }
    })
    .catch(error => {
        console.error('Error updating status:', error);
    });
}

function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the container
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', function() {
    // Configuration form
    const configForm = document.getElementById('config-form');
    if (configForm) {
        configForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(configForm);
            
            fetch('/save_config', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(data.message, 'success');
                } else {
                    showMessage(data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving config:', error);
                showMessage('Failed to save configuration', 'error');
            });
        });
    }
    
    // Column mapping form
    const columnsForm = document.getElementById('columns-form');
    if (columnsForm) {
        columnsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(columnsForm);
            
            fetch('/save_columns', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(data.message, 'success');
                } else {
                    showMessage(data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving columns:', error);
                showMessage('Failed to save column mapping', 'error');
            });
        });
    }
    
    // Initial status update
    updateAnalysisStatus();
    
    // Periodic status updates
    setInterval(updateAnalysisStatus, 10000); // Update every 10 seconds
}); 