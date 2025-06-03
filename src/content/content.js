// 內容腳本 - 與網頁互動，負責資料擷取
// 這個腳本會被注入到網頁中，用於擷取表格資料

// 監聽來自背景腳本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractTableData') {
    const tableData = extractTableData();
    sendResponse({ tableData });
  }
  return true; // 非同步回應
});

// 擷取表格資料的主要功能
function extractTableData() {
  try {
    // 尋找頁面中的所有表格
    const tables = document.querySelectorAll('table');
    if (!tables || tables.length === 0) {
      console.warn('頁面中未找到表格');
      return null;
    }
    
    // 預設使用第一個表格，未來可以讓用戶選擇
    const targetTable = tables[0];
    
    // 獲取表頭
    const headers = [];
    const headerRow = targetTable.querySelector('tr');
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll('th');
      if (headerCells && headerCells.length > 0) {
        headerCells.forEach(cell => {
          headers.push(cell.textContent.trim());
        });
      } else {
        // 如果沒有 th 元素，嘗試使用第一行的 td 元素作為表頭
        const firstRowCells = headerRow.querySelectorAll('td');
        firstRowCells.forEach(cell => {
          headers.push(cell.textContent.trim());
        });
      }
    }
    
    // 獲取表格資料
    const rows = targetTable.querySelectorAll('tr');
    const data = [];
    
    // 從第二行開始處理資料行（跳過表頭）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) continue;
      
      const rowData = {};
      cells.forEach((cell, index) => {
        // 使用表頭作為鍵名，如果表頭不存在則使用索引
        const key = headers[index] || `column${index}`;
        rowData[key] = cell.textContent.trim();
      });
      
      data.push(rowData);
    }
    
    return data;
  } catch (error) {
    console.error('擷取表格資料時發生錯誤:', error);
    return null;
  }
}

// 針對醫療資訊系統的特殊處理
function extractMedicalTableData() {
  // 這個函數可以包含針對特定醫療系統表格的處理邏輯
  // 例如處理合併儲存格、特殊格式等
  
  // 目前先使用通用表格擷取邏輯
  return extractTableData();
}

// 初始化
function initialize() {
  console.log('醫療資料一鍵擷取工具已啟動');
  
  // 在頁面載入完成後執行初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afterLoaded);
  } else {
    afterLoaded();
  }
  
  function afterLoaded() {
    // 檢測頁面是否為醫療資訊系統
    const isMedicalSystem = detectMedicalSystem();
    if (isMedicalSystem) {
      console.log('檢測到醫療資訊系統');
      // 可以在這裡添加特定於醫療系統的初始化邏輯
    }
  }
}

// 檢測頁面是否為醫療資訊系統
function detectMedicalSystem() {
  // 簡單檢測頁面標題或URL是否包含醫療相關關鍵字
  const pageTitle = document.title.toLowerCase();
  const url = window.location.href.toLowerCase();
  
  const medicalKeywords = [
    '醫療', '健保', 'medicloud', '病歷', '藥品', '診所', '醫院', '門診'
  ];
  
  return medicalKeywords.some(keyword => 
    pageTitle.includes(keyword) || url.includes(keyword)
  );
}

// 執行初始化
initialize();
