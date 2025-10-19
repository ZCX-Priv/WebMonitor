async function fetchCameras() {
  try {
    const response = await fetch("/api/cameras");
    if (!response.ok) {
      throw new Error(`获取摄像头列表失败：${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

function createCameraListItem(camera, isActive) {
  const item = document.createElement("li");
  item.className = "camera-list__item";
  item.dataset.cameraId = camera.id;
  
  if (isActive) {
    item.classList.add("camera-list__item--active");
  }

  const name = document.createElement("span");
  name.textContent = camera.name;

  const status = document.createElement("span");
  status.className = "camera-list__status";
  status.textContent = "在线";

  item.appendChild(name);
  item.appendChild(status);

  // 添加点击事件
  item.addEventListener("click", (event) => {
    // 阻止事件冒泡，避免被页面点击事件监听器捕获
    event.stopPropagation();
    selectCamera(camera.id);
  });

  return item;
}

function createCameraCard(camera) {
  const card = document.createElement("article");
  card.className = "camera-card";
  card.dataset.cameraId = camera.id;

  const header = document.createElement("header");
  header.className = "camera-card__header";

  const title = document.createElement("h2");
  title.className = "camera-card__title";
  title.textContent = camera.name;

  const status = document.createElement("span");
  status.className = "camera-card__status";
  status.textContent = "在线";

  header.appendChild(title);
  header.appendChild(status);

  const feed = document.createElement("img");
  feed.className = "camera-card__feed";
  feed.alt = `${camera.name} 视频流`;
  feed.src = `/video_feed/${camera.id}`;

  card.appendChild(header);
  card.appendChild(feed);

  // 修改点击事件：先选中摄像头，再跳转到预览页面
  card.addEventListener("click", (event) => {
    // 阻止事件冒泡，避免被页面点击事件监听器捕获
    event.stopPropagation();
    
    // 转换为字符串进行比较
    const cameraIdStr = String(camera.id);
    
    // 如果点击的是当前已选中的摄像头，则取消选中并返回（不跳转）
    if (selectedCameraId === cameraIdStr) {
      selectCamera(camera.id);
      return;
    }
    
    selectCamera(camera.id);
    // 延迟跳转，让用户看到选中效果
    setTimeout(() => {
      window.location.href = `/preview/${camera.id}`;
    }, 300);
  });

  return card;
}

// 摄像头选择功能
let selectedCameraId = null;

function selectCamera(cameraId) {
  // 转换为字符串进行比较
  const cameraIdStr = String(cameraId);
  
  // 如果点击的是当前已选中的摄像头，则取消选中
  if (selectedCameraId === cameraIdStr) {
    clearSelection();
    return;
  }
  
  // 清除所有之前选中的状态（确保单选模式）
  const allSelectedListItems = document.querySelectorAll('.camera-list__item--selected');
  const allSelectedCards = document.querySelectorAll('.camera-card--selected');
  
  allSelectedListItems.forEach(item => item.classList.remove("camera-list__item--selected"));
  allSelectedCards.forEach(card => card.classList.remove("camera-card--selected"));
  
  // 设置新的选中状态
  selectedCameraId = cameraIdStr;
  
  const listItems = document.querySelectorAll(`.camera-list__item[data-camera-id="${cameraId}"]`);
  const cards = document.querySelectorAll(`.camera-card[data-camera-id="${cameraId}"]`);
  
  listItems.forEach(item => item.classList.add("camera-list__item--selected"));
  cards.forEach(card => card.classList.add("camera-card--selected"));
  
  // 保存选中状态到本地存储
  localStorage.setItem('selectedCameraId', cameraIdStr);
}

// 清除选中状态
function clearSelection() {
  if (selectedCameraId) {
    const allSelectedListItems = document.querySelectorAll('.camera-list__item--selected');
    const allSelectedCards = document.querySelectorAll('.camera-card--selected');
    
    allSelectedListItems.forEach(item => item.classList.remove("camera-list__item--selected"));
    allSelectedCards.forEach(card => card.classList.remove("camera-card--selected"));
    
    selectedCameraId = null;
    localStorage.removeItem('selectedCameraId');
  }
}

async function initApp() {
  const cameraList = document.getElementById("camera-list");
  const cameraGrid = document.getElementById("camera-grid");
  const refreshBtn = document.getElementById("refresh-btn");

  async function renderCameras() {
    const cameras = await fetchCameras();

    if (!cameras.length) {
      cameraList.innerHTML = "<li class=\"camera-list__item\">未检测到摄像头</li>";

      cameraGrid.innerHTML = "";
      const emptyState = document.createElement("div");
      emptyState.className = "camera-card camera-card__placeholder";
      emptyState.textContent = "暂无可用摄像头";
      cameraGrid.appendChild(emptyState);
      return;
    }

    cameraList.innerHTML = "";
    cameraGrid.innerHTML = "";

    // 从本地存储恢复选中的摄像头
    const savedCameraId = localStorage.getItem('selectedCameraId');
    
    // 如果本地存储中有选中的摄像头ID，先设置到全局变量中
    if (savedCameraId) {
      selectedCameraId = savedCameraId;
    }
    
    cameras.forEach((camera, index) => {
      const isSelected = savedCameraId !== null && String(camera.id) === savedCameraId;
      
      const listItem = createCameraListItem(camera, false);
      cameraList.appendChild(listItem);

      const card = createCameraCard(camera);
      cameraGrid.appendChild(card);
      
      // 如果这是之前选中的摄像头，设置选中状态
      if (isSelected) {
        listItem.classList.add("camera-list__item--selected");
        card.classList.add("camera-card--selected");
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      await renderCameras();
      refreshBtn.disabled = false;
    });
  }

  await renderCameras();
}

// 页面可见性变化时重新初始化视频流
function handleVisibilityChange() {
  if (!document.hidden) {
    // 页面变为可见状态时重新初始化应用
    initApp();
  }
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', handleVisibilityChange);

// 监听页面加载完成
window.addEventListener("DOMContentLoaded", () => {
  initApp();
  
  // 添加页面点击事件监听器，用于点击其他地方取消选中
  document.addEventListener('click', (event) => {
    // 检查点击的目标是否是摄像头列表项或卡片
    const isCameraItem = event.target.closest('.camera-list__item');
    const isCameraCard = event.target.closest('.camera-card');
    
    // 如果点击的不是摄像头元素，且当前有选中的摄像头，则清除选中状态
    if (!isCameraItem && !isCameraCard && selectedCameraId) {
      clearSelection();
    }
  });
});

// 监听页面显示事件（从其他页面返回时触发）
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // 页面从缓存中恢复时重新初始化
    initApp();
  }
});

// 侧边栏收起/展开功能
function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  
  if (!sidebar || !toggleBtn) return;
  
  // 检查本地存储中的侧边栏状态
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  
  if (isCollapsed) {
    sidebar.classList.add('sidebar--collapsed');
    toggleBtn.title = '展开侧边栏';
    toggleBtn.querySelector('svg').style.transform = 'rotate(180deg)';
  }
  
  toggleBtn.addEventListener('click', () => {
    const isCurrentlyCollapsed = sidebar.classList.contains('sidebar--collapsed');
    
    if (isCurrentlyCollapsed) {
      // 展开侧边栏
      sidebar.classList.remove('sidebar--collapsed');
      toggleBtn.title = '收起侧边栏';
      toggleBtn.querySelector('svg').style.transform = 'rotate(0deg)';
      localStorage.setItem('sidebarCollapsed', 'false');
    } else {
      // 收起侧边栏
      sidebar.classList.add('sidebar--collapsed');
      toggleBtn.title = '展开侧边栏';
      toggleBtn.querySelector('svg').style.transform = 'rotate(180deg)';
      localStorage.setItem('sidebarCollapsed', 'true');
    }
  });
}

// 在DOM加载完成后初始化侧边栏切换功能
window.addEventListener("DOMContentLoaded", () => {
  initSidebarToggle();
});
