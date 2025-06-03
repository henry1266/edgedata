// 背景腳本 - 處理擴充功能的全局狀態和生命週期
// 負責管理截圖和資料擷取的協調工作

// 格式化錯誤訊息的輔助函數
function formatErrorMessage(error) {
  if (!error) return '未知錯誤';
  
  // 如果是字符串，直接返回
  if (typeof error === 'string') return error;
  
  // 如果是Error對象，返回message屬性
  if (error instanceof Error) return error.message;
  
  // 如果是chrome.runtime.lastError對象
  if (error.message) return error.message;
  
  // 如果是其他對象，嘗試JSON序列化
  try {
    return JSON.stringify(error);
  } catch (e) {
    return '錯誤對象無法序列化';
  }
}

// 監聽來自彈出視窗的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureAndExtract') {
    captureAndExtractData()
      .then(result => sendResponse(result))
      .catch(error => {
        const errorMessage = formatErrorMessage(error);
        console.error('擷取資料時發生錯誤:', errorMessage);
        sendResponse({ 
          success: false,
          error: errorMessage,
          message: `錯誤: ${errorMessage}`
        });
      });
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
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractTableData' }, (result) => {
          if (chrome.runtime.lastError) {
            const errorMessage = formatErrorMessage(chrome.runtime.lastError);
            console.error('發送消息時發生錯誤:', errorMessage);
            // 嘗試注入內容腳本
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            }).then(() => {
              // 腳本注入後再次嘗試發送消息
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'extractTableData' }, (retryResult) => {
                  if (chrome.runtime.lastError) {
                    const retryErrorMessage = formatErrorMessage(chrome.runtime.lastError);
                    reject(new Error(`內容腳本通信失敗: ${retryErrorMessage}`));
                  } else {
                    resolve(retryResult);
                  }
                });
              }, 500); // 給予腳本載入的時間
            }).catch(err => {
              const injectErrorMessage = formatErrorMessage(err);
              reject(new Error(`腳本注入失敗: ${injectErrorMessage}`));
            });
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      console.error('與內容腳本通信失敗:', errorMessage);
      throw new Error(`無法與頁面通信: ${errorMessage}`);
    }
    
    // 檢查回應格式
    if (!response) {
      throw new Error('未收到內容腳本的回應');
    }
    
    // 處理新的回應格式
    const success = response.success !== undefined ? response.success : (response.tableData !== null);
    const tableData = response.tableData;
    const personalInfo = response.personalInfo;
    const message = response.message || (success ? '資料擷取成功' : '未找到表格資料');
    
    console.log('資料擷取結果:', message);
    if (personalInfo) {
      console.log('個人資料擷取成功:', personalInfo);
    }
    
    // 儲存截圖和資料
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // 從個人資料中提取姓名，如果沒有則使用預設值
    const name = personalInfo && personalInfo.name ? personalInfo.name : '醫療資料';
    
    // 新的資料夾命名格式：yyyy-mm-dd_hh-mm-ss_{name}（使用破折號確保檔案系統相容性）
    const folderName = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${name}`;
    
    // 檔案名稱保持原有格式以確保相容性
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `medical-data-${timestamp}`;
    
    // 儲存截圖
    await saveScreenshot(screenshotUrl, filename, folderName);
    
    // 儲存表格資料（如果有的話）
    if (success && tableData && tableData.length > 0) {
      await saveTableData(tableData, filename, folderName);
      console.log(`成功儲存 ${tableData.length} 筆資料到 ${folderName}/${filename}.csv`);
    } else {
      console.log('沒有表格資料需要儲存');
    }
    
    // 創建個人資料文件（如果有個人資料的話）
    if (personalInfo) {
      await createPersonalInfoFile(personalInfo, folderName);
    }
    
    return {
      success: success,
      screenshot: screenshotUrl,
      tableData: tableData,
      message: message
    };
  } catch (error) {
    const errorMessage = formatErrorMessage(error);
    console.error('擷取資料時發生錯誤:', errorMessage);
    return { 
      success: false, 
      error: errorMessage,
      message: `錯誤: ${errorMessage}`
    };
  }
}

// 儲存截圖
async function saveScreenshot(dataUrl, filename, folderName) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: `${folderName}/${filename}.png`,
      saveAs: false
    }, downloadId => {
      if (chrome.runtime.lastError) {
        const errorMessage = formatErrorMessage(chrome.runtime.lastError);
        reject(new Error(`截圖儲存失敗: ${errorMessage}`));
      } else {
        resolve(downloadId);
      }
    });
  });
}

// 儲存表格資料
async function saveTableData(tableData, filename, folderName) {
  // 轉換為 CSV 格式
  const csvContent = convertToCSV(tableData);
  
  // 使用 data URL 而非 Blob URL，以提高瀏覽器相容性
  // 將 CSV 內容轉換為 Base64 編碼
  const base64 = btoa(unescape(encodeURIComponent(csvContent)));
  const dataUrl = `data:text/csv;base64,${base64}`;
  
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: `${folderName}/${filename}.csv`,
      saveAs: false
    }, downloadId => {
      if (chrome.runtime.lastError) {
        const errorMessage = formatErrorMessage(chrome.runtime.lastError);
        reject(new Error(`CSV檔案儲存失敗: ${errorMessage}`));
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
      .map(value => {
        // 改良斷句處理
        let processedValue = String(value)
          .replace(/\n/g, ' | ')    // 換行符替換為分隔符
          .replace(/\r/g, '')       // 移除回車符
          .replace(/\s+/g, ' ')     // 多個空白字符替換為單個空格
          .trim();                  // 移除首尾空白
        
        // 處理雙引號轉義
        return `"${processedValue.replace(/"/g, '""')}"`;
      })
      .join(',');
  });
  
  return [header, ...rows].join('\n');
}


// 創建個人資料JSON文件
async function createPersonalInfoFile(personalInfo, folderName) {
  try {
    if (!personalInfo) {
      console.log('沒有個人資料需要儲存');
      return null;
    }

    // 將個人資料轉換為JSON格式
    const personalInfoJson = JSON.stringify(personalInfo, null, 2);
    const personalInfoBase64 = btoa(unescape(encodeURIComponent(personalInfoJson)));
    const personalInfoDataUrl = `data:application/json;charset=utf-8;base64,${personalInfoBase64}`;
    
    // 儲存個人資料JSON文件
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: personalInfoDataUrl,
        filename: `${folderName}/personal-info.json`,
        saveAs: false
      }, downloadId => {
        if (chrome.runtime.lastError) {
          const errorMessage = formatErrorMessage(chrome.runtime.lastError);
          console.warn('無法創建個人資料JSON檔案:', errorMessage);
          resolve(null);
        } else {
          console.log('成功創建個人資料JSON檔案');
          resolve(downloadId);
        }
      });
    });
  } catch (error) {
    console.warn('創建個人資料文件時發生錯誤:', error);
    return null;
  }
}

