// Constants
const IDLE_TIMEOUT = 60; // seconds
const STORAGE_KEY = 'websiteTimeData';
const UPDATE_INTERVAL = 1000; // Update every second

// State variables
let currentTab = null;
let startTime = null;
let isTracking = false;
let isWindowActive = true;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  // Set up idle detection
  chrome.idle.setDetectionInterval(IDLE_TIMEOUT);
  
  // Initialize storage if needed
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (!result[STORAGE_KEY]) {
      chrome.storage.local.set({
        [STORAGE_KEY]: {
          domains: {},
          startDate: new Date().toISOString().split('T')[0]
        }
      });
    }
  });
});

// Track tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateTimeForPreviousTab();
  await updateCurrentTab(activeInfo.tabId);
});

// Track URL changes within the same tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === currentTab?.id) {
    await updateTimeForPreviousTab();
    await updateCurrentTab(tabId);
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  isWindowActive = windowId !== chrome.windows.WINDOW_ID_NONE;
  
  if (isWindowActive) {
    // Chrome window gained focus
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await updateTimeForPreviousTab();
      await updateCurrentTab(tabs[0].id);
    }
  } else {
    // Chrome window lost focus
    await updateTimeForPreviousTab();
    currentTab = null;
    isTracking = false;
  }
});

// Track idle state changes
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'active' && isWindowActive) {
    // User became active
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await updateCurrentTab(tabs[0].id);
    }
  } else {
    // User became idle or locked
    await updateTimeForPreviousTab();
    isTracking = false;
  }
});

// Update current tab information
async function updateCurrentTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('http')) {
      isTracking = false;
      currentTab = null;
      return;
    }
    
    currentTab = {
      id: tab.id,
      url: tab.url,
      domain: extractDomain(tab.url)
    };
    
    startTime = Date.now();
    isTracking = true;
  } catch (error) {
    console.error('Error updating current tab:', error);
    isTracking = false;
    currentTab = null;
  }
}

// Update time for the previous tab before switching
async function updateTimeForPreviousTab() {
  if (!isTracking || !currentTab || !startTime) return;
  
  const now = Date.now();
  const timeSpent = now - startTime;
  
  if (timeSpent < 1000) return; // Don't record if less than 1 second
  
  try {
    const data = await getStorageData();
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize domain data if it doesn't exist
    if (!data.domains[currentTab.domain]) {
      data.domains[currentTab.domain] = {
        totalTime: 0,
        dailyTime: {},
        favicon: await getFavicon(currentTab.url)
      };
    }
    
    // Initialize today's data if it doesn't exist
    if (!data.domains[currentTab.domain].dailyTime[today]) {
      data.domains[currentTab.domain].dailyTime[today] = 0;
    }
    
    // Update times
    data.domains[currentTab.domain].totalTime += timeSpent;
    data.domains[currentTab.domain].dailyTime[today] += timeSpent;
    
    // Save updated data
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } catch (error) {
    console.error('Error updating time for previous tab:', error);
  }
  
  startTime = null;
}

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (error) {
    return 'unknown';
  }
}

// Helper function to get favicon
async function getFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
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

// Set up periodic updates to ensure we capture time even when tabs don't change
setInterval(async () => {
  if (isTracking && isWindowActive) {
    await updateTimeForPreviousTab();
    startTime = Date.now();
  }
}, UPDATE_INTERVAL); 