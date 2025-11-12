// Dashboard JavaScript for Claude Code Usage Tracker

let toolsChart = null;
let timelineChart = null;

// Helper function to format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

// Fetch and display overview stats
async function loadOverview() {
    try {
        const response = await fetch('/api/stats/overview');
        const data = await response.json();

        document.getElementById('total-tools').textContent = data.total_tools;
        document.getElementById('total-edits').textContent = data.total_edits;
        document.getElementById('total-messages').textContent = data.total_messages;

        // Update token usage
        if (data.tokens) {
            document.getElementById('input-tokens').textContent = formatNumber(data.tokens.input_tokens);
            document.getElementById('output-tokens').textContent = formatNumber(data.tokens.output_tokens);
            document.getElementById('total-tokens').textContent = formatNumber(data.tokens.total_tokens);
        }
    } catch (error) {
        console.error('Error loading overview:', error);
    }
}

// Fetch and display tool usage chart
async function loadToolsChart() {
    try {
        const response = await fetch('/api/stats/tools');
        const data = await response.json();

        const ctx = document.getElementById('toolsChart').getContext('2d');

        if (toolsChart) {
            toolsChart.destroy();
        }

        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#4facfe',
            '#43e97b', '#fa709a', '#fee140', '#30cfd0'
        ];

        toolsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.name),
                datasets: [{
                    data: data.map(item => item.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading tools chart:', error);
    }
}

// Fetch and display timeline chart
async function loadTimelineChart() {
    try {
        const response = await fetch('/api/stats/timeline');
        const data = await response.json();

        const ctx = document.getElementById('timelineChart').getContext('2d');

        if (timelineChart) {
            timelineChart.destroy();
        }

        timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.date).reverse(),
                datasets: [{
                    label: 'Tool Usage',
                    data: data.map(item => item.count).reverse(),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading timeline chart:', error);
    }
}

// Fetch and display most edited files
async function loadFileStats() {
    try {
        const response = await fetch('/api/stats/files');
        const data = await response.json();

        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '';

        if (data.length === 0) {
            filesList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No file edits recorded yet</p>';
            return;
        }

        data.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            const filePath = document.createElement('div');
            filePath.className = 'file-path';
            filePath.textContent = file.path;

            const fileStats = document.createElement('div');
            fileStats.className = 'file-stats';
            fileStats.innerHTML = `
                <span><strong>${file.edits}</strong> edits</span>
                <span><strong>${file.lines || 0}</strong> lines changed</span>
            `;

            fileItem.appendChild(filePath);
            fileItem.appendChild(fileStats);
            filesList.appendChild(fileItem);
        });
    } catch (error) {
        console.error('Error loading file stats:', error);
    }
}

// Fetch and display sessions
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();

        const sessionsList = document.getElementById('sessions-list');
        sessionsList.innerHTML = '';

        if (data.length === 0) {
            sessionsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No sessions found</p>';
            return;
        }

        data.forEach(session => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'session-card';

            const sessionHeader = document.createElement('div');
            sessionHeader.className = 'session-header';

            const sessionId = document.createElement('div');
            sessionId.className = 'session-id';
            sessionId.textContent = session.session_id;

            const sessionDate = document.createElement('div');
            sessionDate.className = 'session-date';
            const date = new Date(session.last_timestamp);
            sessionDate.textContent = date.toLocaleString();

            sessionHeader.appendChild(sessionId);
            sessionHeader.appendChild(sessionDate);

            const sessionProject = document.createElement('div');
            sessionProject.className = 'session-project';
            sessionProject.textContent = session.project || 'Unknown project';

            const sessionStats = document.createElement('div');
            sessionStats.className = 'session-stats';
            sessionStats.innerHTML = `
                <div class="session-stat">
                    <span>💬 <strong>${session.message_count}</strong> messages</span>
                </div>
                <div class="session-stat">
                    <span>🔧 <strong>${session.tool_count}</strong> tools</span>
                </div>
                <div class="session-stat">
                    <span>📄 <strong>${session.file_count}</strong> files</span>
                </div>
            `;

            sessionCard.appendChild(sessionHeader);
            sessionCard.appendChild(sessionProject);
            sessionCard.appendChild(sessionStats);

            // Click to view details (future enhancement)
            sessionCard.addEventListener('click', () => {
                console.log('Session clicked:', session.session_id);
                // Could expand to show more details
            });

            sessionsList.appendChild(sessionCard);
        });
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

// Initialize dashboard
async function initDashboard() {
    await loadOverview();
    await loadToolsChart();
    await loadTimelineChart();
    await loadFileStats();
    await loadSessions();

    // Refresh data every 30 seconds
    setInterval(() => {
        loadOverview();
        loadToolsChart();
        loadTimelineChart();
        loadFileStats();
        loadSessions();
    }, 30000);
}

// Load dashboard when page is ready
document.addEventListener('DOMContentLoaded', initDashboard);
