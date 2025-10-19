function freezeFrame(imgElement) {
  if (!imgElement) {
    return;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const tempImage = new Image();

  tempImage.onload = () => {
    canvas.width = tempImage.width;
    canvas.height = tempImage.height;
    context.drawImage(tempImage, 0, 0);
    imgElement.dataset.frozenSrc = canvas.toDataURL("image/jpeg");
    imgElement.src = imgElement.dataset.frozenSrc;
  };

  tempImage.src = imgElement.dataset.liveSrc || imgElement.src;
}

function restoreLiveFeed(imgElement) {
  if (!imgElement) {
    return;
  }

  const cameraId = imgElement.dataset.cameraId;
  imgElement.src = `/video_feed/${cameraId}?v=${Date.now()}`;
  imgElement.dataset.liveSrc = imgElement.src;
}

function downloadSnapshot(imgElement, cameraName) {
  if (!imgElement) {
    return;
  }

  const source = imgElement.src || imgElement.dataset.liveSrc;
  if (!source) {
    return;
  }

  const link = document.createElement("a");
  link.href = source;
  link.download = `${cameraName.replace(/\s+/g, "_")}_${Date.now()}.jpg`;
  link.click();
}

// 获取摄像头信息
async function getCameraInfo(cameraId) {
  try {
    const response = await fetch('/api/cameras');
    if (!response.ok) {
      throw new Error('获取摄像头信息失败');
    }
    const cameras = await response.json();
    return cameras.find(cam => cam.id === cameraId);
  } catch (error) {
    console.error('获取摄像头信息失败:', error);
    return null;
  }
}

// 更新视频流URL
function updateVideoFeed(cameraId, width = null, height = null, fps = null) {
  const previewFeed = document.getElementById('preview-feed');
  if (!previewFeed) return;

  let url = `/video_feed/${cameraId}`;
  const params = new URLSearchParams();
  
  if (width && height) {
    params.append('width', width);
    params.append('height', height);
  }
  
  if (fps) {
    params.append('fps', fps);
  }
  
  if (params.toString()) {
    url += '?' + params.toString();
  }
  
  previewFeed.src = url + '&v=' + Date.now();
  previewFeed.dataset.liveSrc = previewFeed.src;
}

// 设置摄像头参数
async function setCameraSettings(cameraId, width, height, fps) {
  try {
    const response = await fetch(`/api/camera/${cameraId}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        width: width,
        height: height,
        fps: fps
      })
    });
    
    if (!response.ok) {
      throw new Error('设置摄像头参数失败');
    }
    
    return await response.json();
  } catch (error) {
    console.error('设置摄像头参数失败:', error);
    return null;
  }
}

// 填充分辨率下拉框
function populateResolutionSelect(selectElement, resolutions, currentResolution) {
  selectElement.innerHTML = '<option value="">自动检测...</option>';
  
  resolutions.forEach(resolution => {
    const [width, height] = resolution;
    const option = document.createElement('option');
    option.value = `${width}x${height}`;
    option.textContent = `${width} × ${height}`;
    
    if (currentResolution && currentResolution[0] === width && currentResolution[1] === height) {
      option.selected = true;
    }
    
    selectElement.appendChild(option);
  });
}

// 填充帧率下拉框
function populateFpsSelect(selectElement, fpsOptions, currentFps) {
  selectElement.innerHTML = '<option value="">自动检测...</option>';
  
  fpsOptions.forEach(fps => {
    const option = document.createElement('option');
    option.value = fps;
    option.textContent = `${fps} FPS`;
    
    if (currentFps === fps) {
      option.selected = true;
    }
    
    selectElement.appendChild(option);
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  const previewFeed = document.getElementById("preview-feed");
  const pauseBtn = document.getElementById("pause-btn");
  const previewStatus = document.getElementById("preview-status");
  const resolutionSelect = document.getElementById("resolution-select");
  const fpsSelect = document.getElementById("fps-select");
  const applySettingsBtn = document.getElementById("apply-settings");

  if (!previewFeed || !pauseBtn || !previewStatus || !resolutionSelect || !fpsSelect || !applySettingsBtn) {
    return;
  }

  const cameraId = parseInt(previewFeed.dataset.cameraId);
  const cameraName = previewFeed.dataset.cameraName;
  
  // 获取摄像头信息
  const cameraInfo = await getCameraInfo(cameraId);
  
  if (cameraInfo) {
    // 填充下拉框
    populateResolutionSelect(resolutionSelect, cameraInfo.supported_resolutions, cameraInfo.current_resolution);
    populateFpsSelect(fpsSelect, cameraInfo.supported_fps, cameraInfo.current_fps);
    
    // 设置默认最高分辨率和帧率
    if (cameraInfo.current_resolution) {
      const [width, height] = cameraInfo.current_resolution;
      updateVideoFeed(cameraId, width, height, cameraInfo.current_fps);
    }
  }

  let isPaused = false;
  previewFeed.dataset.liveSrc = previewFeed.src;

  // 应用设置按钮事件
  applySettingsBtn.addEventListener("click", async () => {
    const resolutionValue = resolutionSelect.value;
    const fpsValue = fpsSelect.value;
    
    let width = null, height = null, fps = null;
    
    if (resolutionValue) {
      const [w, h] = resolutionValue.split('x').map(Number);
      width = w;
      height = h;
    }
    
    if (fpsValue) {
      fps = parseInt(fpsValue);
    }
    
    // 更新摄像头设置
    const result = await setCameraSettings(cameraId, width, height, fps);
    
    if (result) {
      // 更新视频流
      updateVideoFeed(cameraId, width, height, fps);
      
      // 如果当前是暂停状态，恢复实时预览
      if (isPaused) {
        restoreLiveFeed(previewFeed);
        previewStatus.textContent = "实时预览";
        pauseBtn.textContent = "暂停";
        isPaused = false;
      }
    }
  });

  pauseBtn.addEventListener("click", () => {
    isPaused = !isPaused;
    if (isPaused) {
      freezeFrame(previewFeed);
      previewStatus.textContent = "已暂停";
      pauseBtn.textContent = "继续";
    } else {
      restoreLiveFeed(previewFeed);
      previewStatus.textContent = "实时预览";
      pauseBtn.textContent = "暂停";
    }
  });
});
