// Constants
const STORAGE_KEY = 'websiteTimeData';
const CHART_COLORS = [
  '#4a6cf7', '#28a745', '#dc3545', '#fd7e14', '#6f42c1',
  '#20c997', '#17a2b8', '#6c757d', '#e83e8c', '#ffc107'
];

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const statusMessage = document.getElementById('status-message');

// Chart instances
let todayChart = null;
let dailyChart = null;
let alltimeChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Set up tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  
  // Set up action buttons
  exportBtn.addEventListener('click', exportData);
  resetBtn.addEventListener('click', resetData);
  
  // Load and display data
  await loadData();
});

// Switch between tabs
function switchTab(tabId) {
  // Update active tab button
  tabButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });
  
  // Update active tab content
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
}

// Load data from storage and update UI
async function loadData() {
  try {
    const data = await getStorageData();
    
    if (!data || !data.domains) {
      showStatus('No data available yet. Start browsing to track website usage.');
      return;
    }
    
    // Update all tabs with data
    updateTodayTab(data);
    updateDailyTab(data);
    updateAlltimeTab(data);
    
    hideStatus();
  } catch (error) {
    showStatus('Error loading data: ' + error.message, true);
  }
}

// Update Today tab with current data
function updateTodayTab(data) {
  const today = new Date().toISOString().split('T')[0];
  const domains = data.domains;
  
  // Calculate today's stats
  let todayTotal = 0;
  let todaySites = 0;
  let topSite = { domain: '-', time: 0 };
  const todaySitesList = [];
  
  for (const domain in domains) {
    const domainData = domains[domain];
    const todayTime = domainData.dailyTime[today] || 0;
    
    if (todayTime > 0) {
      todaySites++;
      todayTotal += todayTime;
      
      todaySitesList.push({
        domain,
        time: todayTime,
        favicon: domainData.favicon
      });
      
      if (todayTime > topSite.time) {
        topSite = { domain, time: todayTime };
      }
    }
  }
  
  // Update summary stats
  document.getElementById('today-total-time').textContent = formatTime(todayTotal);
  document.getElementById('today-sites-count').textContent = todaySites;
  document.getElementById('today-top-site').textContent = topSite.domain !== '-' ? topSite.domain : '-';
  
  // Sort sites by time spent
  todaySitesList.sort((a, b) => b.time - a.time);
  
  // Update sites list
  const siteListElement = document.getElementById('today-sites');
  siteListElement.innerHTML = '';
  
  if (todaySitesList.length === 0) {
    siteListElement.innerHTML = '<div class="empty-message">No sites visited today</div>';
  } else {
    renderSiteList(siteListElement, todaySitesList, todayTotal);
    renderPieChart('today-chart', todaySitesList, 'Today');
  }
}

// Update Daily tab with weekly data
function updateDailyTab(data) {
  const domains = data.domains;
  const dates = getLastNDays(7);
  
  // Calculate daily stats
  let totalTime = 0;
  let totalSites = new Set();
  const dailyTotals = {};
  const weeklyTopSites = {};
  
  // Initialize daily totals
  dates.forEach(date => {
    dailyTotals[date] = 0;
  });
  
  // Calculate totals for each domain and day
  for (const domain in domains) {
    const domainData = domains[domain];
    let domainWeeklyTotal = 0;
    
    dates.forEach(date => {
      const timeOnDate = domainData.dailyTime[date] || 0;
      if (timeOnDate > 0) {
        totalSites.add(domain);
        dailyTotals[date] += timeOnDate;
        domainWeeklyTotal += timeOnDate;
      }
    });
    
    if (domainWeeklyTotal > 0) {
      weeklyTopSites[domain] = {
        domain,
        time: domainWeeklyTotal,
        favicon: domainData.favicon
      };
    }
  }
  
  // Calculate total time for the week
  for (const date in dailyTotals) {
    totalTime += dailyTotals[date];
  }
  
  // Calculate averages
  const activeDays = Object.values(dailyTotals).filter(time => time > 0).length || 1;
  const avgDailyTime = totalTime / activeDays;
  const avgDailySites = totalSites.size / activeDays;
  
  // Find most active day
  let mostActiveDay = { date: '-', time: 0 };
  for (const date in dailyTotals) {
    if (dailyTotals[date] > mostActiveDay.time) {
      mostActiveDay = { date, time: dailyTotals[date] };
    }
  }
  
  // Update summary stats
  document.getElementById('daily-avg-time').textContent = formatTime(avgDailyTime);
  document.getElementById('daily-avg-sites').textContent = avgDailySites.toFixed(1);
  document.getElementById('daily-most-active').textContent = mostActiveDay.date !== '-' ? 
    formatDate(mostActiveDay.date) : '-';
  
  // Update weekly top sites list
  const weeklyTopSitesList = Object.values(weeklyTopSites).sort((a, b) => b.time - a.time);
  const weeklyTopSitesElement = document.getElementById('weekly-top-sites');
  weeklyTopSitesElement.innerHTML = '';
  
  if (weeklyTopSitesList.length === 0) {
    weeklyTopSitesElement.innerHTML = '<div class="empty-message">No sites visited this week</div>';
  } else {
    renderSiteList(weeklyTopSitesElement, weeklyTopSitesList, totalTime);
    renderBarChart('daily-chart', dailyTotals, 'Daily Usage');
  }
}

// Update All-time tab with complete data
function updateAlltimeTab(data) {
  const domains = data.domains;
  
  // Calculate all-time stats
  let totalTime = 0;
  const allTimeSites = [];
  
  for (const domain in domains) {
    const domainData = domains[domain];
    totalTime += domainData.totalTime;
    
    allTimeSites.push({
      domain,
      time: domainData.totalTime,
      favicon: domainData.favicon
    });
  }
  
  // Update summary stats
  document.getElementById('alltime-total-time').textContent = formatTime(totalTime);
  document.getElementById('alltime-sites-count').textContent = Object.keys(domains).length;
  document.getElementById('tracking-since').textContent = formatDate(data.startDate);
  
  // Sort sites by time spent
  allTimeSites.sort((a, b) => b.time - a.time);
  
  // Update all-time top sites list
  const allTimeTopSitesElement = document.getElementById('alltime-top-sites');
  allTimeTopSitesElement.innerHTML = '';
  
  if (allTimeSites.length === 0) {
    allTimeTopSitesElement.innerHTML = '<div class="empty-message">No sites visited yet</div>';
  } else {
    renderSiteList(allTimeTopSitesElement, allTimeSites, totalTime);
    renderPieChart('alltime-chart', allTimeSites.slice(0, 5), 'All Time');
  }
}

// Render site list with time bars
function renderSiteList(container, sites, totalTime) {
  // Take top 10 sites for display
  const topSites = sites.slice(0, 10);
  
  topSites.forEach(site => {
    const percentage = (site.time / totalTime) * 100;
    
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    siteItem.innerHTML = `
      <img class="site-favicon" src="${site.favicon || 'icons/globe.png'}" alt="">
      <div class="site-info">
        <div class="site-domain">${site.domain}</div>
        <div class="site-time">${formatTime(site.time)}</div>
        <div class="site-bar">
          <div class="site-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    
    container.appendChild(siteItem);
  });
}

// Render pie chart for today and all-time tabs
function renderPieChart(canvasId, sites, label) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  
  // Take top 5 sites for the chart
  const topSites = sites.slice(0, 5);
  
  // Calculate "Other" category if needed
  let otherTime = 0;
  if (sites.length > 5) {
    for (let i = 5; i < sites.length; i++) {
      otherTime += sites[i].time;
    }
  }
  
  const labels = topSites.map(site => site.domain);
  const data = topSites.map(site => site.time);
  
  if (otherTime > 0) {
    labels.push('Other');
    data.push(otherTime);
  }
  
  // Destroy existing chart if it exists
  if (canvasId === 'today-chart' && todayChart) {
    todayChart.destroy();
  } else if (canvasId === 'alltime-chart' && alltimeChart) {
    alltimeChart.destroy();
  }
  
  // Create new chart
  const newChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: {
              size: 10
            }
          }
        },
        title: {
          display: true,
          text: label,
          font: {
            size: 14
          }
        }
      }
    }
  });
  
  // Store chart reference
  if (canvasId === 'today-chart') {
    todayChart = newChart;
  } else if (canvasId === 'alltime-chart') {
    alltimeChart = newChart;
  }
}

// Render bar chart for daily tab
function renderBarChart(canvasId, dailyData, label) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  
  // Format dates for display
  const labels = Object.keys(dailyData).map(date => formatDate(date, true));
  const data = Object.values(dailyData);
  
  // Convert milliseconds to minutes for better visualization
  const dataInMinutes = data.map(time => time / (1000 * 60));
  
  // Destroy existing chart if it exists
  if (dailyChart) {
    dailyChart.destroy();
  }
  
  // Create new chart
  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes',
        data: dataInMinutes,
        backgroundColor: CHART_COLORS[0],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: label,
          font: {
            size: 14
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      }
    }
  });
}

// Export data to CSV
async function exportData() {
  try {
    const data = await getStorageData();
    
    if (!data || !data.domains || Object.keys(data.domains).length === 0) {
      showStatus('No data available to export', true);
      return;
    }
    
    // Create CSV content
    let csvContent = 'Domain,Total Time (ms),Total Time (formatted)\n';
    
    for (const domain in data.domains) {
      const totalTime = data.domains[domain].totalTime;
      csvContent += `${domain},${totalTime},${formatTime(totalTime)}\n`;
    }
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `website_time_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Data exported successfully!');
    setTimeout(hideStatus, 3000);
  } catch (error) {
    showStatus('Error exporting data: ' + error.message, true);
  }
}

// Reset all tracking data
async function resetData() {
  if (confirm('Are you sure you want to reset all tracking data? This cannot be undone.')) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          domains: {},
          startDate: new Date().toISOString().split('T')[0]
        }
      });
      
      // Reload data and update UI
      await loadData();
      
      showStatus('All tracking data has been reset');
      setTimeout(hideStatus, 3000);
    } catch (error) {
      showStatus('Error resetting data: ' + error.message, true);
    }
  }
}

// Helper function to get storage data
async function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || { domains: {}, startDate: new Date().toISOString().split('T')[0] });
    });
  });
}

// Helper function to format time
function formatTime(milliseconds) {
  if (milliseconds < 1000) return '0s';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to format date
function formatDate(dateString, short = false) {
  const date = new Date(dateString);
  
  if (short) {
    // Short format: "Mon 15"
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  } else {
    // Full format: "May 15, 2023"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Helper function to get last N days (including today)
function getLastNDays(n) {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.unshift(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

// Helper function to show status message
function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
}

// Helper function to hide status message
function hideStatus() {
  statusMessage.textContent = '';
} 