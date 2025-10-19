# 网络监控系统

一个基于Flask和OpenCV的简单网络监控系统，支持多摄像头实时监控和预览。

## 功能特性

- 📹 多摄像头检测和监控
- 🔧 可调节分辨率和帧率
- 🌐 Web界面实时预览
- 📱 响应式设计，支持移动设备
- ⚙️ 配置文件管理

## 安装依赖

1. 确保已安装Python 3.7+
2. 安装依赖包：

```bash
pip install -r requirements.txt
```

## 使用方法

1. 启动应用：
```bash
python app.py
```

2. 打开浏览器访问：`http://localhost:8080`

3. 在主页选择要监控的摄像头

4. 在预览页面可以调整分辨率和帧率设置

## 配置说明

配置文件 `config.ini` 可以设置服务器参数：

```ini
[server]
host = 0.0.0.0
port = 8080
```

## 项目结构

```
网络监控/
├── app.py              # 主应用文件
├── config.ini          # 配置文件
├── requirements.txt    # 依赖包列表
├── static/             # 静态文件
│   ├── script.js       # 前端脚本
│   ├── style.css       # 样式文件
│   └── preview.js      # 预览页面脚本
├── templates/          # HTML模板
│   ├── index.html      # 主页模板
│   └── preview.html    # 预览页面模板
└── README.md           # 项目说明
```

## API接口

- `GET /` - 主页
- `GET /api/cameras` - 获取可用摄像头列表
- `GET /video_feed/<camera_id>` - 摄像头视频流
- `GET /preview/<camera_id>` - 摄像头预览页面
- `POST /api/camera/<camera_id>/settings` - 设置摄像头参数

## 注意事项

- 确保摄像头设备已正确连接
- 首次运行可能需要安装摄像头驱动程序
- 建议在虚拟环境中运行

## 许可证

MIT License