import configparser
import os
import threading
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional

import cv2
from flask import Flask, Response, abort, jsonify, render_template, request, stream_with_context


CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.ini")
MAX_CAMERA_INDEX = 10

# 常见的分辨率选项
RESOLUTION_OPTIONS = [
    (1920, 1080),  # 1080p
    (1280, 720),   # 720p
    (640, 480),    # 480p
    (480, 360),    # 360p
    (320, 240),    # 240p
    (256, 144),    # 144p
]

# 常见的帧率选项
FPS_OPTIONS = [60, 30, 25, 20, 15, 10, 5]


def load_config() -> configparser.ConfigParser:
    config = configparser.ConfigParser()
    config.read_dict({"server": {"host": "0.0.0.0", "port": "8080"}})

    if os.path.exists(CONFIG_PATH):
        config.read(CONFIG_PATH, encoding="utf-8")

    return config


@dataclass
class CameraInfo:
    camera_id: int
    name: str
    supported_resolutions: List[Tuple[int, int]] = None
    supported_fps: List[int] = None
    current_resolution: Tuple[int, int] = None
    current_fps: int = None


def detect_camera_capabilities(camera_id: int) -> Tuple[List[Tuple[int, int]], List[int]]:
    """检测摄像头支持的分辨率和帧率"""
    cap = cv2.VideoCapture(camera_id)
    if cap is None or not cap.isOpened():
        return [], []
    
    supported_resolutions = []
    supported_fps = []
    
    # 测试常见分辨率
    for width, height in RESOLUTION_OPTIONS:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        
        actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        
        # 如果摄像头支持该分辨率
        if actual_width == width and actual_height == height:
            supported_resolutions.append((width, height))
    
    # 测试常见帧率
    for fps in FPS_OPTIONS:
        cap.set(cv2.CAP_PROP_FPS, fps)
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        
        # 如果摄像头支持该帧率
        if actual_fps >= fps * 0.8:  # 允许一定的误差
            supported_fps.append(fps)
    
    cap.release()
    
    # 如果没有检测到支持的分辨率，使用默认值
    if not supported_resolutions:
        supported_resolutions = [(640, 480)]
    
    if not supported_fps:
        supported_fps = [30]
    
    return supported_resolutions, supported_fps


def list_available_cameras(max_index: int = MAX_CAMERA_INDEX) -> List[CameraInfo]:
    cameras: List[CameraInfo] = []

    for index in range(max_index):
        cap = cv2.VideoCapture(index)
        if cap is None or not cap.isOpened():
            cap.release()
            continue

        name = f"摄像头 {index}"
        
        # 检测摄像头能力
        supported_resolutions, supported_fps = detect_camera_capabilities(index)
        
        # 设置默认最高分辨率和帧率
        current_resolution = max(supported_resolutions, key=lambda x: x[0] * x[1]) if supported_resolutions else (640, 480)
        current_fps = max(supported_fps) if supported_fps else 30
        
        camera = CameraInfo(
            camera_id=index,
            name=name,
            supported_resolutions=supported_resolutions,
            supported_fps=supported_fps,
            current_resolution=current_resolution,
            current_fps=current_fps
        )
        cameras.append(camera)
        cap.release()

    return cameras


def generate_mjpeg_stream(camera_id: int, width: int = None, height: int = None, fps: int = None):
    cap = cv2.VideoCapture(camera_id)
    if cap is None or not cap.isOpened():
        cap.release()
        return

    # 设置分辨率
    if width and height:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    
    # 设置帧率
    if fps:
        cap.set(cv2.CAP_PROP_FPS, fps)

    try:
        while True:
            success, frame = cap.read()
            if not success:
                break

            success, buffer = cv2.imencode(".jpg", frame)
            if not success:
                continue

            frame_bytes = buffer.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
    finally:
        cap.release()


def capture_frame(camera_id: int):
    cap = cv2.VideoCapture(camera_id)
    if cap is None or not cap.isOpened():
        cap.release()
        return None

    try:
        success, frame = cap.read()
        if not success:
            return None

        success, buffer = cv2.imencode(".jpg", frame)
        if not success:
            return None

        return buffer.tobytes()
    finally:
        cap.release()


app = Flask(__name__)
_config = load_config()

_camera_cache: Dict[int, CameraInfo] = {}
_camera_cache_lock = threading.Lock()


def refresh_camera_cache() -> List[CameraInfo]:
    cameras = list_available_cameras()
    with _camera_cache_lock:
        _camera_cache.clear()
        for cam in cameras:
            _camera_cache[cam.camera_id] = cam
    return cameras


def get_camera_info(camera_id: int) -> CameraInfo:
    with _camera_cache_lock:
        camera = _camera_cache.get(camera_id)

    if camera is None:
        refresh_camera_cache()
        with _camera_cache_lock:
            camera = _camera_cache.get(camera_id)

    if camera is None:
        camera = CameraInfo(camera_id=camera_id, name=f"摄像头 {camera_id}")

    return camera


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/cameras")
def api_cameras():
    cameras = refresh_camera_cache()
    response = []
    for cam in cameras:
        camera_data = {
            "id": cam.camera_id,
            "name": cam.name,
            "supported_resolutions": cam.supported_resolutions,
            "supported_fps": cam.supported_fps,
            "current_resolution": cam.current_resolution,
            "current_fps": cam.current_fps
        }
        response.append(camera_data)
    return jsonify(response)


@app.route("/video_feed/<int:camera_id>")
def video_feed(camera_id: int):
    if request.args.get("snapshot") is not None:
        frame = capture_frame(camera_id)
        if frame is None:
            abort(404)
        return Response(frame, mimetype="image/jpeg")

    # 获取分辨率参数
    width = request.args.get("width", type=int)
    height = request.args.get("height", type=int)
    fps = request.args.get("fps", type=int)

    with _camera_cache_lock:
        if camera_id not in _camera_cache:
            _camera_cache[camera_id] = CameraInfo(camera_id=camera_id, name=f"摄像头 {camera_id}")

    return Response(
        stream_with_context(generate_mjpeg_stream(camera_id, width, height, fps)),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/api/camera/<int:camera_id>/settings", methods=["POST"])
def set_camera_settings(camera_id: int):
    """设置摄像头分辨率和帧率"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400
    
    width = data.get("width")
    height = data.get("height")
    fps = data.get("fps")
    
    # 验证参数
    if width is not None and height is not None:
        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            return jsonify({"error": "无效的分辨率参数"}), 400
    
    if fps is not None and (not isinstance(fps, int) or fps <= 0):
        return jsonify({"error": "无效的帧率参数"}), 400
    
    # 更新摄像头缓存中的设置
    with _camera_cache_lock:
        if camera_id in _camera_cache:
            camera = _camera_cache[camera_id]
            if width is not None and height is not None:
                camera.current_resolution = (width, height)
            if fps is not None:
                camera.current_fps = fps
    
    return jsonify({
        "message": "设置已更新",
        "camera_id": camera_id,
        "resolution": (width, height) if width and height else None,
        "fps": fps
    })


@app.route("/preview/<int:camera_id>")
def preview(camera_id: int):
    camera = get_camera_info(camera_id)
    return render_template("preview.html", camera=camera)


if __name__ == "__main__":
    host = _config.get("server", "host", fallback="0.0.0.0")
    port = _config.getint("server", "port", fallback=8080)
    app.run(host=host, port=port, threaded=True)
