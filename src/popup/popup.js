// 彈出視窗的腳本 - 處理使用者介面互動

// 格式化錯誤訊息的輔助函數
function formatErrorMessage(error) {
  if (!error) return '未知錯誤';
  
  // 如果是字符串，直接返回
  if (typeof error === 'string') return error;
  
  // 如果是Error對象，返回message屬性
  if (error instanceof Error) return error.message;
  
  // 如果是對象且有message屬性
  if (error.message) return error.message;
  
  // 如果是其他對象，嘗試JSON序列化
  try {
    return JSON.stringify(error);
  } catch (e) {
    return '錯誤對象無法序列化';
  }
}

// 檢查是否為無害的通信錯誤
function isHarmlessCommunicationError(errorMessage) {
  const harmlessErrors = [
    'Could not establish connection. Receiving end does not exist',
    'The message port closed before a response was received',
    'Extension context invalidated',
    'Cannot access contents of the page'
  ];
  
  return harmlessErrors.some(harmlessError => 
    errorMessage.includes(harmlessError)
  );
}

document.addEventListener('DOMContentLoaded', function() {
  // 獲取DOM元素
  const captureBtn = document.getElementById('captureBtn');
  const statusPanel = document.getElementById('statusPanel');
  const statusMessage = document.getElementById('statusMessage');
  const progressBar = document.getElementById('progressBar');
  
  // 截圖並擷取資料
  captureBtn.addEventListener('click', function() {
    // 顯示處理中狀態
    statusPanel.style.display = 'block';
    statusMessage.textContent = '處理中...';
    
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
      
      // 檢查是否有chrome.runtime.lastError
      if (chrome.runtime.lastError) {
        const errorMessage = formatErrorMessage(chrome.runtime.lastError);
        console.error('發送消息時發生錯誤:', errorMessage);
        statusMessage.textContent = '通信錯誤: ' + errorMessage;
        
        // 5秒後隱藏狀態面板
        setTimeout(function() {
          statusPanel.style.display = 'none';
        }, 5000);
        return;
      }
      
      // 處理回應
      if (response && response.success) {
        // 顯示成功訊息
        statusMessage.textContent = '擷取完成！檔案已儲存到下載資料夾。';
        
        // 3秒後隱藏狀態面板
        setTimeout(function() {
          statusPanel.style.display = 'none';
          // 關閉彈出視窗
          window.close();
        }, 3000);
      } else {
        // 顯示錯誤
        let errorMessage = '未知錯誤';
        
        if (response) {
          // 優先使用message，然後是error，最後是默認值
          errorMessage = response.message || formatErrorMessage(response.error) || '處理失敗';
        }
        
        statusMessage.textContent = '發生錯誤: ' + errorMessage;
        console.error('擷取失敗:', errorMessage);
        
        // 5秒後隱藏狀態面板
        setTimeout(function() {
          statusPanel.style.display = 'none';
        }, 5000);
      }
    });
  });
});

