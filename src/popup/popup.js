// 彈出視窗的腳本 - 處理使用者介面互動
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
        const errorMessage = response ? (response.message || response.error || '未知錯誤') : '未知錯誤';
        statusMessage.textContent = '發生錯誤: ' + errorMessage;
        
        // 5秒後隱藏狀態面板
        setTimeout(function() {
          statusPanel.style.display = 'none';
        }, 5000);
      }
    });
  });
});

