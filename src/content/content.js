// 內容腳本 - 與網頁互動，負責資料擷取
// 這個腳本會被注入到網頁中，用於擷取表格資料

// 監聽來自背景腳本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractTableData') {
    console.log('收到擷取表格資料的請求');
    
    // 根據頁面類型選擇適當的擷取方法
    let tableData;
    if (detectMedicalSystem()) {
      console.log('使用醫療系統專用擷取邏輯');
      tableData = extractMedicalTableData();
    } else {
      console.log('使用通用表格擷取邏輯');
      tableData = extractTableData();
    }
    
    // 擷取個人基本資料
    console.log('開始擷取個人基本資料');
    const personalInfo = getPersonalInfo();
    
    console.log('擷取結果:', tableData ? `成功擷取 ${tableData.length} 筆表格資料` : '表格擷取失敗');
    console.log('個人資料擷取結果:', personalInfo ? '成功擷取個人資料' : '未找到個人資料');
    
    sendResponse({ 
      success: tableData !== null,
      tableData: tableData,
      personalInfo: personalInfo,
      message: tableData ? `成功擷取 ${tableData.length} 筆資料` : '未找到表格資料'
    });
  }
  return true; // 非同步回應
});

// 擷取表格資料的主要功能
function extractTableData() {
  try {
    console.log('開始擷取表格資料...');
    
    // 優先嘗試擷取 DataTables 結構
    let result = extractDataTablesData();
    if (result && result.length > 0) {
      console.log('成功擷取 DataTables 資料，共', result.length, '筆記錄');
      return result;
    }
    
    // 如果 DataTables 擷取失敗，回退到通用表格擷取
    console.log('DataTables 擷取失敗，嘗試通用表格擷取...');
    result = extractGenericTableData();
    if (result && result.length > 0) {
      console.log('成功擷取通用表格資料，共', result.length, '筆記錄');
      return result;
    }
    
    console.warn('未能擷取到任何表格資料');
    return null;
  } catch (error) {
    console.error('擷取表格資料時發生錯誤:', error);
    return null;
  }
}

// 擷取 DataTables 結構的資料
function extractDataTablesData() {
  try {
    // 尋找 DataTables 容器
    const dataTablesWrapper = document.querySelector('.dataTables_wrapper');
    if (!dataTablesWrapper) {
      console.log('未找到 DataTables 結構');
      return null;
    }
    
    console.log('找到 DataTables 結構，開始擷取...');
    
    // 獲取表頭 - 從 dataTables_scrollHead 區域
    const headers = [];
    const scrollHead = dataTablesWrapper.querySelector('.dataTables_scrollHead');
    if (scrollHead) {
      const headerCells = scrollHead.querySelectorAll('th');
      headerCells.forEach(cell => {
        // 清理表頭文字，移除排序相關的屬性文字
        let headerText = cell.textContent.trim();
        // 移除 "activate to sort column ascending" 等文字
        headerText = headerText.replace(/:\s*activate to sort.*$/i, '');
        headers.push(headerText);
      });
      console.log('擷取到表頭:', headers);
    }
    
    // 如果沒有找到 scrollHead，嘗試從主表格獲取表頭
    if (headers.length === 0) {
      const mainTable = dataTablesWrapper.querySelector('table');
      if (mainTable) {
        const headerCells = mainTable.querySelectorAll('thead th');
        headerCells.forEach(cell => {
          let headerText = cell.textContent.trim();
          headerText = headerText.replace(/:\s*activate to sort.*$/i, '');
          headers.push(headerText);
        });
        console.log('從主表格擷取到表頭:', headers);
      }
    }
    
    // 獲取資料 - 從 dataTables_scrollBody 區域或主表格的 tbody
    const data = [];
    let dataRows = [];
    
    // 優先從 scrollBody 獲取資料
    const scrollBody = dataTablesWrapper.querySelector('.dataTables_scrollBody');
    if (scrollBody) {
      const tbody = scrollBody.querySelector('tbody');
      if (tbody) {
        dataRows = tbody.querySelectorAll('tr');
        console.log('從 scrollBody 找到', dataRows.length, '行資料');
      }
    }
    
    // 如果沒有找到 scrollBody，從主表格獲取
    if (dataRows.length === 0) {
      const mainTable = dataTablesWrapper.querySelector('table tbody');
      if (mainTable) {
        dataRows = mainTable.querySelectorAll('tr');
        console.log('從主表格找到', dataRows.length, '行資料');
      }
    }
    
    // 處理每一行資料
    dataRows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;
      
      const rowData = {};
      cells.forEach((cell, cellIndex) => {
        // 使用表頭作為鍵名，如果表頭不存在則使用索引
        const key = headers[cellIndex] || `column${cellIndex}`;
        
        // 處理包含 <br> 標籤的多行內容
        let cellContent = '';
        if (cell.innerHTML.includes('<br>')) {
          // 將 <br> 替換為換行符，保持多行結構
          cellContent = cell.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '') // 移除其他HTML標籤
            .trim();
        } else {
          cellContent = cell.textContent.trim();
        }
        
        rowData[key] = cellContent;
      });
      
      data.push(rowData);
    });
    
    return data;
  } catch (error) {
    console.error('擷取 DataTables 資料時發生錯誤:', error);
    return null;
  }
}

// 通用表格資料擷取（原有邏輯的改進版）
function extractGenericTableData() {
  try {
    // 尋找頁面中的所有表格
    const tables = document.querySelectorAll('table');
    if (!tables || tables.length === 0) {
      console.warn('頁面中未找到表格');
      return null;
    }
    
    // 尋找最可能包含資料的表格（排除明顯的裝飾性表格）
    let targetTable = null;
    for (let table of tables) {
      const rows = table.querySelectorAll('tr');
      const dataCells = table.querySelectorAll('td');
      
      // 如果表格有足夠的行和資料儲存格，認為是資料表格
      if (rows.length > 1 && dataCells.length > 0) {
        targetTable = table;
        break;
      }
    }
    
    if (!targetTable) {
      console.warn('未找到合適的資料表格');
      return null;
    }
    
    console.log('使用通用方法處理表格，表格有', targetTable.querySelectorAll('tr').length, '行');
    
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
        
        // 處理包含 <br> 標籤的多行內容
        let cellContent = '';
        if (cell.innerHTML.includes('<br>')) {
          cellContent = cell.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .trim();
        } else {
          cellContent = cell.textContent.trim();
        }
        
        rowData[key] = cellContent;
      });
      
      data.push(rowData);
    }
    
    return data;
  } catch (error) {
    console.error('通用表格擷取時發生錯誤:', error);
    return null;
  }
}

// 針對醫療資訊系統的特殊處理
function extractMedicalTableData() {
  try {
    console.log('使用醫療系統專用擷取邏輯...');
    
    // 針對健保醫療資訊雲端查詢系統的特殊處理
    if (detectNHIMediCloudSystem()) {
      console.log('檢測到健保醫療資訊雲端查詢系統');
      return extractNHIMediCloudData();
    }
    
    // 其他醫療系統可以在這裡添加特殊處理
    
    // 如果沒有特殊處理，使用通用邏輯
    return extractTableData();
  } catch (error) {
    console.error('醫療系統資料擷取時發生錯誤:', error);
    return extractTableData(); // 回退到通用邏輯
  }
}

// 檢測是否為健保醫療資訊雲端查詢系統
function detectNHIMediCloudSystem() {
  const pageTitle = document.title;
  const url = window.location.href;
  
  // 檢查頁面標題
  if (pageTitle.includes('健保醫療資訊雲端查詢系統') || pageTitle.includes('NHI MediCloud System')) {
    return true;
  }
  
  // 檢查頁面內容
  const logoElement = document.querySelector('.logo a');
  if (logoElement && logoElement.textContent.includes('健保醫療資訊雲端查詢系統')) {
    return true;
  }
  
  // 檢查是否有特定的功能標籤
  const functionTabs = document.querySelectorAll('.function-tab a');
  const tabTexts = Array.from(functionTabs).map(tab => tab.textContent);
  const medicalTabs = ['西醫用藥', '中醫醫療', '牙科處置紀錄', '過敏紀錄', '檢查與檢驗'];
  
  return medicalTabs.some(tab => tabTexts.some(text => text.includes(tab)));
}

// 專門處理健保醫療資訊雲端查詢系統的資料擷取
function extractNHIMediCloudData() {
  try {
    // 首先嘗試 DataTables 結構
    let result = extractDataTablesData();
    if (result && result.length > 0) {
      // 對健保系統的資料進行後處理
      return postProcessNHIData(result);
    }
    
    // 如果 DataTables 失敗，嘗試其他方法
    return extractGenericTableData();
  } catch (error) {
    console.error('健保系統資料擷取失敗:', error);
    return null;
  }
}

// 對健保系統資料進行後處理
function postProcessNHIData(data) {
  if (!data || !Array.isArray(data)) return data;
  
  return data.map(row => {
    const processedRow = { ...row };
    
    // 處理日期格式（民國年轉西元年）
    Object.keys(processedRow).forEach(key => {
      if (key.includes('日期') && processedRow[key]) {
        processedRow[key] = convertROCDateToAD(processedRow[key]);
      }
    });
    
    // 處理來源欄位的多行資料
    if (processedRow['來源']) {
      const sourceLines = processedRow['來源'].split('\n');
      if (sourceLines.length >= 3) {
        processedRow['醫院名稱'] = sourceLines[0];
        processedRow['門診類型'] = sourceLines[1];
        processedRow['機構代碼'] = sourceLines[2];
      }
    }
    
    return processedRow;
  });
}

// 轉換民國年日期為西元年
function convertROCDateToAD(rocDate) {
  if (!rocDate || typeof rocDate !== 'string') return rocDate;
  
  // 匹配民國年格式：114/05/31
  const rocPattern = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/;
  const match = rocDate.match(rocPattern);
  
  if (match) {
    const rocYear = parseInt(match[1]);
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const adYear = rocYear + 1911;
    
    return `${adYear}/${month}/${day}`;
  }
  
  return rocDate; // 如果不符合格式，返回原始值
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

// 擷取個人基本資料
function extractPersonalInfo() {
  try {
    console.log('開始擷取個人基本資料...');
    
    const personalInfo = {};
    
    // 擷取身分證號
    const idElement = document.querySelector('.idno');
    if (idElement) {
      const idText = idElement.textContent.trim();
      // 移除前綴文字，提取實際身分證號
      const idMatch = idText.match(/[A-Z]\d{2}\*{3}\d{3}|[A-Z]\d{9}/);
      if (idMatch) {
        personalInfo.idNumber = idMatch[0];
        console.log('找到身分證號:', personalInfo.idNumber);
      } else {
        // 如果沒有匹配到標準格式，保留原始文字（去除前綴）
        personalInfo.idNumber = idText.replace(/^身分證號[：:]\s*/, '');
      }
    }
    
    // 擷取姓名
    const nameElement = document.querySelector('.name');
    if (nameElement) {
      personalInfo.name = nameElement.textContent.trim();
      console.log('找到姓名:', personalInfo.name);
    }
    
    // 擷取出生日期
    const birthElement = document.querySelector('.birth');
    if (birthElement) {
      const birthText = birthElement.textContent.trim();
      personalInfo.birthDate = birthText;
      
      // 嘗試轉換民國年為西元年
      const rocMatch = birthText.match(/民\s*(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
      if (rocMatch) {
        const rocYear = parseInt(rocMatch[1]);
        const month = rocMatch[2].padStart(2, '0');
        const day = rocMatch[3].padStart(2, '0');
        const adYear = rocYear + 1911;
        personalInfo.birthDateAD = `${adYear}/${month}/${day}`;
        console.log('找到出生日期:', personalInfo.birthDate, '(西元年:', personalInfo.birthDateAD + ')');
      } else {
        console.log('找到出生日期:', personalInfo.birthDate);
      }
    }
    
    // 擷取性別
    const genderElement = document.querySelector('.sex');
    if (genderElement) {
      personalInfo.gender = genderElement.textContent.trim();
      console.log('找到性別:', personalInfo.gender);
    }
    
    // 添加擷取時間和來源
    personalInfo.extractedAt = new Date().toISOString();
    personalInfo.source = document.title || window.location.href;
    
    // 檢查是否有找到任何個人資料
    const hasData = Object.keys(personalInfo).some(key => 
      key !== 'extractedAt' && key !== 'source' && personalInfo[key]
    );
    
    if (hasData) {
      console.log('成功擷取個人資料:', personalInfo);
      return personalInfo;
    } else {
      console.log('未找到個人資料');
      return null;
    }
  } catch (error) {
    console.error('擷取個人資料時發生錯誤:', error);
    return null;
  }
}

// 使用通用方法擷取個人資料（備用方案）
function extractPersonalInfoGeneric() {
  try {
    console.log('使用通用方法擷取個人資料...');
    
    const personalInfo = {};
    const pageText = document.body.textContent;
    
    // 使用正則表達式尋找身分證號
    const idPattern = /身分證號[：:]\s*([A-Z]\d{2}\*{3}\d{3}|[A-Z]\d{9})/;
    const idMatch = pageText.match(idPattern);
    if (idMatch) {
      personalInfo.idNumber = idMatch[1];
      console.log('通用方法找到身分證號:', personalInfo.idNumber);
    }
    
    // 使用正則表達式尋找民國年出生日期
    const birthPattern = /民\s*(\d{2,3})\/(\d{1,2})\/(\d{1,2})/;
    const birthMatch = pageText.match(birthPattern);
    if (birthMatch) {
      personalInfo.birthDate = `民 ${birthMatch[1]}/${birthMatch[2]}/${birthMatch[3]}`;
      const rocYear = parseInt(birthMatch[1]);
      const month = birthMatch[2].padStart(2, '0');
      const day = birthMatch[3].padStart(2, '0');
      const adYear = rocYear + 1911;
      personalInfo.birthDateAD = `${adYear}/${month}/${day}`;
      console.log('通用方法找到出生日期:', personalInfo.birthDate);
    }
    
    // 添加擷取時間和來源
    personalInfo.extractedAt = new Date().toISOString();
    personalInfo.source = document.title || window.location.href;
    
    // 檢查是否有找到任何個人資料
    const hasData = Object.keys(personalInfo).some(key => 
      key !== 'extractedAt' && key !== 'source' && personalInfo[key]
    );
    
    return hasData ? personalInfo : null;
  } catch (error) {
    console.error('通用個人資料擷取時發生錯誤:', error);
    return null;
  }
}

// 主要個人資料擷取函數
function getPersonalInfo() {
  // 優先使用特定選擇器方法
  let personalInfo = extractPersonalInfo();
  
  // 如果失敗，使用通用方法
  if (!personalInfo) {
    personalInfo = extractPersonalInfoGeneric();
  }
  
  return personalInfo;
}

