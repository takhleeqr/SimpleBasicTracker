// Sidebar navigation
const navDashboard = document.getElementById('nav-dashboard');
const navConfig = document.getElementById('nav-config');
const sectionDashboard = document.getElementById('section-dashboard');
const sectionConfig = document.getElementById('section-config');

navDashboard.addEventListener('click', function() {
    navDashboard.classList.add('active');
    navConfig.classList.remove('active');
    sectionDashboard.style.display = 'block';
    sectionConfig.style.display = 'none';
});
navConfig.addEventListener('click', function() {
    navConfig.classList.add('active');
    navDashboard.classList.remove('active');
    sectionDashboard.style.display = 'none';
    sectionConfig.style.display = 'block';
});

// Username management
window.uploadUsernamesFile = function uploadUsernamesFile() {
    const fileInput = document.getElementById('uploadUsernamesFile');
    if (!fileInput.files.length) {
        alert('Please select a file to upload.');
        return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    fetch('/api/usernames/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            refreshUsernamesListAndProgress();
            fileInput.value = '';
        } else {
            alert(data.message || 'Failed to upload usernames.');
        }
    })
    .catch(() => {
        alert('Failed to upload usernames.');
    });
};

window.addManualUsernames = function addManualUsernames() {
    const textarea = document.getElementById('manualUsernames');
    const lines = textarea.value.split('\n').map(x => x.trim()).filter(x => x);
    if (!lines.length) {
        alert('Please paste at least one username.');
        return;
    }
    fetch('/api/usernames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: lines })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            refreshUsernamesListAndProgress();
            textarea.value = '';
        } else {
            alert('Failed to add usernames.');
        }
    })
    .catch(() => {
        alert('Failed to add usernames.');
    });
};

window.openGoogleSheetsModal = function openGoogleSheetsModal() {
    document.getElementById('googleSheetsModal').style.display = 'block';
};

window.closeGoogleSheetsModal = function closeGoogleSheetsModal() {
    document.getElementById('googleSheetsModal').style.display = 'none';
    document.getElementById('gsheetImportStatus').innerText = '';
};

window.confirmGoogleSheetsImport = function confirmGoogleSheetsImport() {
    const spreadsheetId = document.getElementById('gsheetIdInput').value.trim();
    const sheetRadios = document.getElementsByName('gsheetSheetName');
    let sheetName = 'Sheet1';
    for (let i = 0; i < sheetRadios.length; i++) {
        if (sheetRadios[i].checked) {
            sheetName = sheetRadios[i].value;
            break;
        }
    }
    const column = document.getElementById('gsheetColumnInput').value.trim() || 'I';
    const secondaryColumn = document.getElementById('gsheetSecondaryColumnInput').value.trim();
    document.getElementById('gsheetImportStatus').innerText = 'Importing...';
    fetch('/api/usernames/import_google_sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            spreadsheet_id: spreadsheetId,
            sheet_name: sheetName,
            column: column,
            ...(secondaryColumn ? { secondary_column: secondaryColumn } : {})
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('gsheetImportStatus').innerText = 'Imported ' + data.usernames.length + ' usernames.';
            refreshUsernamesListAndProgress();
            setTimeout(closeGoogleSheetsModal, 1200);
        } else {
            document.getElementById('gsheetImportStatus').innerText = data.message || 'Import failed.';
        }
    })
    .catch(() => {
        document.getElementById('gsheetImportStatus').innerText = 'Import failed.';
    });
};

window.removeUsername = function removeUsername(username) {
    fetch('/api/usernames/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(() => refreshUsernamesListAndProgress())
    .catch(() => alert('Failed to remove username.'));
};

window.clearUsernames = function clearUsernames() {
    fetch('/api/usernames/clear', { method: 'POST' })
        .then(() => refreshUsernamesListAndProgress())
        .catch(() => alert('Failed to clear usernames.'));
};

// Fetch and display the current usernames
function refreshUsernamesList() {
    fetch('/api/usernames')
        .then(res => res.json())
        .then(data => {
            const listSection = document.getElementById('usernames-list-section');
            if (!listSection) return;
            let html = '';
            if (data.usernames && data.usernames.length) {
                html += '<ul class="usernames-list">';
                data.usernames.forEach(entry => {
                    // Support both string and object
                    let username = typeof entry === 'string' ? entry : entry.username;
                    html += `<li>${username} <button class="remove-btn" onclick="removeUsername('${username}')">Remove</button></li>`;
                });
                html += '</ul>';
                html += '<button class="button button-secondary" onclick="clearUsernames()">Clear All</button>';
            } else {
                html = '<div class="empty-list">No usernames added yet.</div>';
            }
            listSection.innerHTML = '<h4>Current Usernames</h4>' + html;
        })
        .catch(() => {
            const listSection = document.getElementById('usernames-list-section');
            if (listSection) listSection.innerHTML = '<div class="empty-list">Failed to load usernames.</div>';
        });
}

// Call refreshUsernamesList on page load
document.addEventListener('DOMContentLoaded', function() {
    refreshUsernamesList();
    showInitialProgress();
    loadFetchSettings(); // Load current fetch settings
    
    // Attach Start button event listener after DOM is ready
    const startBtn = document.getElementById('start-analysis-btn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            startBtn.disabled = true;
            statusMsg.innerText = 'Starting analysis...';
            fetch('/api/start_analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysis_type: analysisType })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        statusMsg.innerText = 'Analysis started. Check progress below.';
                        // Record start time
                        localStorage.setItem('lastAnalysisRun', new Date().toISOString());
                        updateStats();
                        pollAnalysisStatus();
                    } else {
                        statusMsg.innerText = data.message || 'Failed to start analysis.';
                        // Show error in progress area
                        showAnalysisProgress('error', [data.message || 'Failed to start analysis.'], 0, 0, 0, null, []);
                    }
                    setTimeout(() => { startBtn.disabled = false; }, 3000);
                })
                .catch(() => {
                    statusMsg.innerText = 'Failed to start analysis.';
                    showAnalysisProgress('error', ['Failed to start analysis.'], 0, 0, 0, null, []);
                    setTimeout(() => { startBtn.disabled = false; }, 3000);
                });
        });
    }
});

// Load and display current fetch settings
function loadFetchSettings() {
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.config) {
                const dataFetching = data.config.data_fetching || {};
                const fetchMethod = dataFetching.fetch_method || 'posts';
                const postsPerUser = dataFetching.posts_per_user || 100;
                const daysBack = dataFetching.days_back || 30;
                const sinceDate = dataFetching.since_date || 'Not set';
                
                // Update the display
                document.getElementById('fetch-method').textContent = fetchMethod.charAt(0).toUpperCase() + fetchMethod.slice(1);
                document.getElementById('posts-per-user').textContent = postsPerUser;
                document.getElementById('days-back').textContent = daysBack;
                document.getElementById('since-date').textContent = sinceDate === 'Not set' ? 'Not set' : sinceDate;
            }
        })
        .catch(() => {
            // Set default values if config loading fails
            document.getElementById('fetch-method').textContent = 'Posts';
            document.getElementById('posts-per-user').textContent = '100';
            document.getElementById('days-back').textContent = '30';
            document.getElementById('since-date').textContent = 'Not set';
        });
}

// Analysis type selector
let analysisType = 'basic';
document.querySelectorAll('input[name="analysis-type"]').forEach(radio => {
    radio.addEventListener('change', function() {
        analysisType = this.value;
    });
});

// Run controls
const startBtn = document.getElementById('start-analysis-btn');
const stopBtn = document.getElementById('stop-analysis-btn');
const progressBar = document.getElementById('progress-bar');
const statusMsg = document.getElementById('status-message');
const resultsList = document.getElementById('results-list');

let analysisPolling = null;

function showAnalysisProgress(status, logs, total, processed, pending, eta, failedAccounts) {
    let html = '';
    
    // Enhanced status with icons and better styling
    const statusClass = status === 'running' ? 'status-running' : 
                       status === 'error' ? 'status-error' : 
                       status === 'complete' ? 'status-complete' : '';
    
    html += `<div class="progress-status ${statusClass}">Status: <b>${status || 'idle'}</b></div>`;
    
    // Find currently processing username from latest Fetching log
    let currentUser = null;
    if (logs && logs.length) {
        for (let i = logs.length - 1; i >= 0; i--) {
            const m = logs[i].match(/Fetching (\d+)[\/](\d+): (.+)/);
            if (m) {
                currentUser = m[3];
                break;
            }
        }
    }
    
    if (currentUser) {
        html += `<div class="current-user">Currently Processing: <b>${currentUser}</b></div>`;
    }
    
    // Enhanced progress details with better layout
    html += '<div class="progress-details">';
    html += `<span>Total Accounts<br><b>${total !== null && total !== undefined ? total : '0'}</b></span>`;
    html += `<span>Processed<br><b>${processed !== null && processed !== undefined ? processed : '0'}</b></span>`;
    html += `<span>Pending<br><b>${pending !== null && pending !== undefined ? pending : '0'}</b></span>`;
    html += `<span>Time Remaining<br><b>${eta !== null && eta !== undefined ? formatTime(eta) : '—'}</b></span>`;
    html += '</div>';
    
    // Enhanced progress bar with smooth animation and log display
    if (total && processed !== null && processed !== undefined) {
        let percent = Math.round((processed / total) * 100);
        // Add a small delay to ensure smooth animation
        setTimeout(() => {
            const progressBar = document.querySelector('.progress-bar-inner');
            if (progressBar) {
                progressBar.style.width = percent + '%';
            }
        }, 100);
        
        // Progress bar with log overlay
        html += `<div class="progress-bar-outer">`;
        html += `<div class="progress-bar-inner" style="width:0%"></div>`;
        
        // Show current log entry in progress bar
        if (logs && logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            if (latestLog && latestLog.trim()) {
                html += `<div class="progress-log-overlay">${escapeHtml(latestLog.trim())}</div>`;
            }
        }
        
        html += `</div>`;
    } else {
        html += `<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:0%"></div></div>`;
    }
    
    // Failed accounts area with better styling
    if (failedAccounts && failedAccounts.length > 0) {
        html += `<div class="failed-accounts-area">Failed Accounts: <span class='failed-list'>${failedAccounts.map(u => `<span>${u}</span>`).join('')}</span></div>`;
    }
    
    // Enhanced log entries area with live updates
    html += '<div class="log-entries-area">';
    html += '<div class="log-entries-header">Live Progress Log</div>';
    html += '<div class="log-entries">';
    if (logs && logs.length) {
        // Show only the last 15 log entries for better performance
        const recentLogs = logs.slice(-15);
        html += recentLogs.map((l, index) => {
            const isLatest = index === recentLogs.length - 1;
            const logClass = isLatest ? 'log-entry-latest' : 'log-entry';
            return `<div class="${logClass}">${escapeHtml(l)}</div>`;
        }).join('');
    }
    html += '</div></div>';
    
    document.getElementById('progress-area').innerHTML = html;
}

function pollAnalysisStatus() {
    fetch('/api/analysis_status')
        .then(res => res.json())
        .then(data => {
            showAnalysisProgress(
                data.status,
                data.logs,
                data.total_accounts,
                data.processed_accounts,
                data.pending_accounts,
                data.estimated_time_remaining,
                data.failed_accounts
            );
            
            if (data.status === 'running') {
                if (!analysisPolling) {
                    // More frequent polling for better progress updates
                    analysisPolling = setInterval(pollAnalysisStatus, 1500);
                }
                startBtn.disabled = true;
                startBtn.textContent = 'Analysis Running...';
            } else {
                if (analysisPolling) {
                    clearInterval(analysisPolling);
                    analysisPolling = null;
                }
                startBtn.disabled = false;
                startBtn.textContent = 'Start Analysis';
                
                // Show completion message
                if (data.status === 'complete' || data.status === 'finished') {
                    statusMsg.innerText = 'Analysis completed successfully!';
                    statusMsg.style.color = '#22c55e';
                }
            }
        })
        .catch((error) => {
            console.error('Polling error:', error);
            statusMsg.innerText = 'Failed to fetch analysis status.';
            statusMsg.style.color = '#ef4444';
            startBtn.disabled = false;
            startBtn.textContent = 'Start Analysis';
        });
}

function openGoogleSheetsModal() {
    document.getElementById('googleSheetsModal').style.display = 'block';
    fetchSheetNames();
}

// Add this function to fetch sheet names from the backend
function fetchSheetNames() {
    const spreadsheetId = document.getElementById('gsheetIdInput').value.trim();
    if (!spreadsheetId) return;
    fetch(`/api/usernames/get_sheet_names?spreadsheet_id=${encodeURIComponent(spreadsheetId)}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('gsheetSheetNames');
            if (data.success && Array.isArray(data.sheets)) {
                container.innerHTML = data.sheets.map((name, i) =>
                    `<label><input type="radio" name="gsheetSheetName" value="${name}"${i === 0 ? ' checked' : ''}> ${name}</label>`
                ).join(' ');
            } else {
                container.innerHTML = '<label><input type="radio" name="gsheetSheetName" value="Sheet1" checked> Sheet1</label>';
            }
        })
        .catch(() => {
            document.getElementById('gsheetSheetNames').innerHTML = '<label><input type="radio" name="gsheetSheetName" value="Sheet1" checked> Sheet1</label>';
        });
}

// Attach event listener to Spreadsheet ID input
const gsheetIdInput = document.getElementById('gsheetIdInput');
gsheetIdInput.addEventListener('change', fetchSheetNames);
gsheetIdInput.addEventListener('blur', fetchSheetNames);

document.addEventListener('DOMContentLoaded', function() {
    fetchSheetNames(); // Fetch on page load
});

// On page load, show progress with total usernames if available
function showInitialProgress() {
    fetch('/api/usernames')
        .then(res => res.json())
        .then(data => {
            const total = data.usernames ? data.usernames.length : 0;
            showAnalysisProgress('idle', [], total, 0, total, null, []);
        });
}
document.addEventListener('DOMContentLoaded', showInitialProgress);

// After adding/removing usernames, update progress area
function refreshUsernamesListAndProgress() {
    refreshUsernamesList();
    showInitialProgress();
    updateStats();
}

// Update dashboard stats
function updateStats() {
    fetch('/api/usernames')
        .then(res => res.json())
        .then(data => {
            const totalAccounts = data.usernames ? data.usernames.length : 0;
            document.getElementById('total-accounts').textContent = totalAccounts;
            
            // Update last run time
            const lastRun = localStorage.getItem('lastAnalysisRun');
            if (lastRun) {
                const date = new Date(lastRun);
                document.getElementById('last-run').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            } else {
                document.getElementById('last-run').textContent = 'Never';
            }
        })
        .catch(() => {
            document.getElementById('total-accounts').textContent = '0';
        });
}

// Update stats on page load
document.addEventListener('DOMContentLoaded', function() {
    updateStats();
});

// Config page logic
function loadConfig() {
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.config) {
                // Populate all config fields
                for (const key in data.config) {
                    if (typeof data.config[key] === 'object') {
                        for (const subkey in data.config[key]) {
                            const el = document.querySelector(`[name="${subkey}"]`);
                            if (el) {
                                if (el.type === 'checkbox') {
                                    el.checked = !!data.config[key][subkey];
                                } else {
                                    el.value = data.config[key][subkey];
                                }
                            }
                        }
                    } else {
                        const el = document.querySelector(`[name="${key}"]`);
                        if (el) {
                            el.value = data.config[key];
                        }
                    }
                }
            }
        });
}

// Reset config to defaults
function resetConfig() {
    if (confirm('Are you sure you want to reset all configuration to defaults?')) {
        const defaultConfig = {
            rate_limiting: {
                request_delay: 8,
                max_requests_per_minute: 10
            },
            data_fetching: {
                fetch_submissions: true,
                fetch_comments: false
            },
            dummy_accounts: {
                enable_dummy_accounts: true,
                num_dummy_accounts: 10,
                custom_dummy_usernames: ""
            },
            output_options: {
                export_excel: true,
                export_csv: true,
                export_gsheets: false
            }
        };
        
        // Populate form with defaults
        for (const key in defaultConfig) {
            if (typeof defaultConfig[key] === 'object') {
                for (const subkey in defaultConfig[key]) {
                    const el = document.querySelector(`[name="${subkey}"]`);
                    if (el) {
                        if (el.type === 'checkbox') {
                            el.checked = !!defaultConfig[key][subkey];
                        } else {
                            el.value = defaultConfig[key][subkey];
                        }
                    }
                }
            }
        }
        
        // Save the default config
        saveConfig();
    }
}

function saveConfig() {
    // Gather all config fields
    const form = document.getElementById('configForm');
    const formData = new FormData(form);
    const config = {
        rate_limiting: {},
        data_fetching: {},
        dummy_accounts: {},
        output_options: {}
    };
    for (const [key, value] of formData.entries()) {
        if (key in config.rate_limiting || key in config.data_fetching || key in config.dummy_accounts || key in config.output_options) {
            // Already set
            continue;
        }
        // Guess section by name
        if (document.querySelector(`[name="${key}"]`).closest('#rateLimiting')) {
            config.rate_limiting[key] = isNaN(value) ? value : Number(value);
        } else if (document.querySelector(`[name="${key}"]`).closest('#dataFetching')) {
            config.data_fetching[key] = isNaN(value) ? value : Number(value);
        } else if (document.querySelector(`[name="${key}"]`).closest('#dummyAccounts')) {
            config.dummy_accounts[key] = isNaN(value) ? value : Number(value);
        } else {
            config.output_options[key] = isNaN(value) ? value : Number(value);
        }
    }
    // Handle checkboxes
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const section = cb.closest('.section-content').id;
        if (section === 'rateLimiting') config.rate_limiting[cb.name] = cb.checked;
        else if (section === 'dataFetching') config.data_fetching[cb.name] = cb.checked;
        else if (section === 'dummyAccounts') config.dummy_accounts[cb.name] = cb.checked;
        else config.output_options[cb.name] = cb.checked;
    });
    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Configuration saved!');
        } else {
            alert('Failed to save configuration.');
        }
    });
}

// Attach config page events
if (document.getElementById('configForm')) {
    document.getElementById('saveConfigBtn').addEventListener('click', function(e) {
        e.preventDefault();
        saveConfig();
    });
    document.addEventListener('DOMContentLoaded', loadConfig);
} 