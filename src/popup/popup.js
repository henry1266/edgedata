// 彈出視窗的腳本 - 處理使用者介面互動
document.addEventListener('DOMContentLoaded', function() {
  // 獲取DOM元素
  const captureBtn = document.getElementById('captureBtn');
  const statusPanel = document.getElementById('statusPanel');
  const statusMessage = document.getElementById('statusMessage');
  const progressBar = document.getElementById('progressBar');
  const resultPanel = document.getElementById('resultPanel');
  const closeResultBtn = document.getElementById('closeResultBtn');
  const screenshotPreview = document.getElementById('screenshotPreview');
  const dataPreview = document.getElementById('dataPreview');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const helpBtn = document.getElementById('helpBtn');
  
  // 選項元素
  const autoDetectTable = document.getElementById('autoDetectTable');
  const saveAsCSV = document.getElementById('saveAsCSV');
  const saveAsJSON = document.getElementById('saveAsJSON');
  
  // 儲存選項設定
  function saveOptions() {
    chrome.storage.sync.set({
      autoDetectTable: autoDetectTable.checked,
      saveAsCSV: saveAsCSV.checked,
      saveAsJSON: saveAsJSON.checked
    });
  }
  
  // 載入選項設定
  function loadOptions() {
    chrome.storage.sync.get({
      autoDetectTable: true,
      saveAsCSV: true,
      saveAsJSON: false
    }, function(items) {
      autoDetectTable.checked = items.autoDetectTable;
      saveAsCSV.checked = items.saveAsCSV;
      saveAsJSON.checked = items.saveAsJSON;
    });
  }
  
  // 初始載入選項
  loadOptions();
  
  // 監聽選項變更
  autoDetectTable.addEventListener('change', saveOptions);
  saveAsCSV.addEventListener('change', saveOptions);
  saveAsJSON.addEventListener('change', saveOptions);
  
  // 截圖並擷取資料
  captureBtn.addEventListener('click', function() {
    // 顯示處理中狀態
    statusPanel.style.display = 'block';
    resultPanel.style.display = 'none';
    
    // 模擬進度條動畫
    let progress = 0;
    const progressInterval = setInterval(function() {
      progress += 5;
      progressBar.style.width = progress + '%';
      
      if (progress >= 100) {
        clearInterval(progressInterval);
      }
    }, 100);
    
    // 向背景腳本發送消息
    chrome.runtime.sendMessage({ action: 'captureAndExtract' }, function(response) {
      // 清除進度條動畫
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      
      // 處理回應
      if (response && response.success) {
        // 顯示結果
        setTimeout(function() {
          statusPanel.style.display = 'none';
          resultPanel.style.display = 'block';
          
          // 設置截圖預覽
          screenshotPreview.src = response.screenshot;
          
          // 生成資料表格預覽
          if (response.tableData && response.tableData.length > 0) {
            generateDataTable(response.tableData);
          } else {
            dataPreview.innerHTML = '<p class="no-data">未找到表格資料</p>';
          }
        }, 500);
      } else {
        // 顯示錯誤
        statusMessage.textContent = '發生錯誤: ' + (response ? response.error : '未知錯誤');
        setTimeout(function() {
          statusPanel.style.display = 'none';
        }, 3000);
      }
    });
  });
  
  // 生成資料表格預覽
  function generateDataTable(data) {
    if (!data || data.length === 0) return;
    
    // 創建表格
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // 創建表頭
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // 獲取所有列名
    const columns = Object.keys(data[0]);
    
    // 添加表頭單元格
    columns.forEach(column => {
      const th = document.createElement('th');
      th.textContent = column;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 創建表格內容
    const tbody = document.createElement('tbody');
    
    // 最多顯示10行資料
    const maxRows = Math.min(data.length, 10);
    
    // 添加資料行
    for (let i = 0; i < maxRows; i++) {
      const row = document.createElement('tr');
      
      columns.forEach(column => {
        const td = document.createElement('td');
        td.textContent = data[i][column] || '';
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    
    // 清空並添加表格
    dataPreview.innerHTML = '';
    dataPreview.appendChild(table);
    
    // 如果資料超過10行，顯示提示
    if (data.length > 10) {
      const note = document.createElement('p');
      note.className = 'data-note';
      note.textContent = `顯示 ${maxRows} 行，共 ${data.length} 行`;
      dataPreview.appendChild(note);
    }
  }
  
  // 關閉結果面板
  closeResultBtn.addEventListener('click', function() {
    resultPanel.style.display = 'none';
  });
  
  // 複製資料
  copyBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractTableData' }, function(response) {
        if (response && response.tableData) {
          // 轉換為CSV格式
          const csv = convertToCSV(response.tableData);
          
          // 複製到剪貼簿
          navigator.clipboard.writeText(csv).then(function() {
            showToast('資料已複製到剪貼簿');
          }).catch(function(err) {
            showToast('複製失敗: ' + err);
          });
        } else {
          showToast('沒有可複製的資料');
        }
      });
    });
  });
  
  // 轉換為CSV格式
  function convertToCSV(data) {
    if (!data || !data.length) return '';
    
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row => {
      return Object.values(row)
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
    });
    
    return [header, ...rows].join('\n');
  }
  
  // 顯示提示訊息
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  // 打開設定頁面
  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // 打開說明頁面
  helpBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/help.html') });
  });
});
