// 背景腳本 - 處理擴充功能的全局狀態和生命週期
// 負責管理截圖和資料擷取的協調工作

// 監聽來自彈出視窗的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureAndExtract') {
    captureAndExtractData()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 非同步回應
  }
});

// 截圖並擷取資料的主要功能
async function captureAndExtractData() {
  try {
    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 截取可見區域的截圖
    const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // 向內容腳本發送消息，請求擷取表格資料
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractTableData' });
    
    // 儲存截圖和資料
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `medical-data-${timestamp}`;
    
    // 儲存截圖
    await saveScreenshot(screenshotUrl, filename);
    
    // 儲存表格資料
    if (response && response.tableData) {
      await saveTableData(response.tableData, filename);
    }
    
    return {
      success: true,
      screenshot: screenshotUrl,
      tableData: response ? response.tableData : null
    };
  } catch (error) {
    console.error('擷取資料時發生錯誤:', error);
    return { success: false, error: error.message };
  }
}

// 儲存截圖
async function saveScreenshot(dataUrl, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: `${filename}.png`,
      saveAs: false
    }, downloadId => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(downloadId);
      }
    });
  });
}

// 儲存表格資料
async function saveTableData(tableData, filename) {
  // 轉換為 CSV 格式
  const csvContent = convertToCSV(tableData);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: `${filename}.csv`,
      saveAs: false
    }, downloadId => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(downloadId);
      }
    });
  });
}

// 將表格資料轉換為 CSV 格式
function convertToCSV(tableData) {
  if (!tableData || !tableData.length) return '';
  
  const header = Object.keys(tableData[0]).join(',');
  const rows = tableData.map(row => {
    return Object.values(row)
      .map(value => `"${String(value).replace(/"/g, '""')}"`)
      .join(',');
  });
  
  return [header, ...rows].join('\n');
}
