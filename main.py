import os
import sys
import json
import uuid
import datetime
import threading
import webbrowser
from pathlib import Path
from pynput import keyboard, mouse
import tkinter as tk
from tkinter import ttk, font, messagebox
from flask import Flask, render_template, jsonify, send_from_directory, request
import calendar
import sqlite3
from sqlalchemy import create_engine, Column, Integer, String, Text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
import pystray
from PIL import Image, ImageDraw
import winreg
import win32gui
import win32con
import argparse

# 全局变量
DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "keylogger.db"
MAC_ADDRESS = str(uuid.getnode())
TODAY = datetime.datetime.now().strftime("%Y-%m-%d")
is_recording = True
last_move_time = None  # 添加鼠标移动时间全局变量
app = Flask(__name__)
icon = None  # 系统托盘图标

def create_round_icon(width, height, color):
    # 创建一个圆形图标
    image = Image.new('RGB', (width, height), (0, 0, 0, 0))
    dc = ImageDraw.Draw(image)
    dc.ellipse([0, 0, width-1, height-1], fill=color)
    return image

def add_to_startup():
    # 添加到开机自启
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
    except:
        key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path)
    
    app_path = os.path.abspath(sys.argv[0])
    if app_path.endswith('.py'):
        # 如果是 Python 脚本，使用 pythonw.exe 运行
        python_path = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
        command = f'"{python_path}" "{app_path}"'
    else:
        # 如果是可执行文件，直接运行
        command = f'"{app_path}"'
    
    winreg.SetValueEx(key, "KeyLogger", 0, winreg.REG_SZ, command)
    winreg.CloseKey(key)

def remove_from_startup():
    # 从开机自启动中移除
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        winreg.DeleteValue(key, "KeyLogger")
        winreg.CloseKey(key)
    except:
        pass

def is_in_startup():
    # 检查是否在开机自启动中
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, "KeyLogger")
        winreg.CloseKey(key)
        return True
    except:
        return False

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)

# 数据库设置
Base = declarative_base()

class KeystrokeEvent(Base):
    __tablename__ = 'keystroke_events'
    
    id = Column(Integer, primary_key=True)
    mac = Column(String(50))
    date = Column(String(10))
    action = Column(String(50))
    time = Column(Integer)
    type = Column(String(10))
    
class ActivityTime(Base):
    __tablename__ = 'activity_times'
    
    id = Column(Integer, primary_key=True)
    mac = Column(String(50))
    date = Column(String(10))
    first_activity_time = Column(Integer, nullable=True)
    last_activity_time = Column(Integer, nullable=True)

# 创建数据库引擎和会话
engine = create_engine(f'sqlite:///{DB_PATH}')
Session = sessionmaker(bind=engine)
session = Session()

# 初始化数据库
def init_db():
    # 如果表不存在，创建表
    if not inspect(engine).has_table('keystroke_events'):
        Base.metadata.create_all(engine)
    if not inspect(engine).has_table('activity_times'):
        Base.metadata.create_all(engine)
    
    # 检查今天的活动时间记录是否存在
    activity = session.query(ActivityTime).filter_by(mac=MAC_ADDRESS, date=TODAY).first()
    if not activity:
        # 创建新的活动时间记录
        activity = ActivityTime(mac=MAC_ADDRESS, date=TODAY)
        session.add(activity)
        session.commit()

# 保存按键/鼠标事件
def save_event(action, event_type, timestamp):
    event = KeystrokeEvent(
        mac=MAC_ADDRESS,
        date=TODAY,
        action=action,
        time=timestamp,
        type=event_type
    )
    session.add(event)
    
    # 更新活动时间
    activity = session.query(ActivityTime).filter_by(mac=MAC_ADDRESS, date=TODAY).first()
    if not activity:
        activity = ActivityTime(mac=MAC_ADDRESS, date=TODAY)
        session.add(activity)
    
    # 更新最后活动时间
    activity.last_activity_time = timestamp
    
    # 如果是首次记录，更新第一次活动时间
    if activity.first_activity_time is None:
        activity.first_activity_time = timestamp
    
    # 每100次操作提交一次
    if session.new and len(session.new) >= 100:
        session.commit()

# 处理键盘事件
def on_press(key):
    if not is_recording:
        return
    print(str(key))
    try:
        # 尝试获取字符
        key_char = key.char
    except AttributeError:
        # 特殊键使用名称
        if key == keyboard.Key.space:
            key_char = "Space"
        elif key == keyboard.Key.enter:
            key_char = "Enter"
        elif key == keyboard.Key.backspace:
            key_char = "Backspace"
        elif key == keyboard.Key.tab:
            key_char = "Tab"
        elif key == keyboard.Key.shift or key == keyboard.Key.shift_l:
            key_char = "Shift"
        elif key == keyboard.Key.shift_r:
            key_char = "Shift_r"
        elif key == keyboard.Key.ctrl or key == keyboard.Key.ctrl_l:
            key_char = "Ctrl"
        elif key == keyboard.Key.ctrl_r:
            key_char = "Ctrl_r"
        elif key == keyboard.Key.alt or key == keyboard.Key.alt_l:
            key_char = "Alt"
        elif key == keyboard.Key.alt_r or key == keyboard.Key.alt_gr:
            key_char = "Alt_r"
        elif key == keyboard.Key.cmd:
            key_char = "Win"
        elif key == keyboard.Key.caps_lock:
            key_char = "Caps"
        elif key == keyboard.Key.esc:
            key_char = "Esc"
        elif key == keyboard.Key.delete:
            key_char = "Delete"
        elif key == keyboard.Key.f1:
            key_char = "F1"
        elif key == keyboard.Key.f2:
            key_char = "F2"
        elif key == keyboard.Key.f3:
            key_char = "F3"
        elif key == keyboard.Key.f4:
            key_char = "F4"
        elif key == keyboard.Key.f5:
            key_char = "F5"
        elif key == keyboard.Key.f6:
            key_char = "F6"
        elif key == keyboard.Key.f7:
            key_char = "F7"
        elif key == keyboard.Key.f8:
            key_char = "F8"
        elif key == keyboard.Key.f9:
            key_char = "F9"
        elif key == keyboard.Key.f10:
            key_char = "F10"
        elif key == keyboard.Key.f11:
            key_char = "F11"
        elif key == keyboard.Key.f12:
            key_char = "F12"
        elif key == keyboard.Key.menu:
            key_char = "Menu"
        else:
            key_char = str(key).replace("Key.", "")

    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    
    # 保存按键事件
    save_event(key_char, "keyboard", timestamp)

# 处理鼠标移动
def on_move(x, y):
    if not is_recording:
        return
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    current_time = datetime.datetime.now()
    
    # 全局变量用于限制移动事件记录频率
    global last_move_time
    
    # 每秒最多记录一次移动，避免数据过多
    if last_move_time is None or (current_time - last_move_time).total_seconds() >= 1:
        # 保存鼠标移动事件
        save_event("slide", "mouse", timestamp)
        last_move_time = current_time

# 处理鼠标点击
def on_click(x, y, button, pressed):
    if not is_recording or not pressed:
        return
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    
    # 识别按键
    if button == mouse.Button.left:
        button_name = "left_key"
    elif button == mouse.Button.right:
        button_name = "right_key"
    elif button == mouse.Button.middle:
        button_name = "middle_key"
    else:
        button_name = str(button)
    
    # 保存鼠标点击事件
    save_event(button_name, "mouse", timestamp)

# 处理鼠标滚轮
def on_scroll(x, y, dx, dy):
    if not is_recording:
        return
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    
    # 保存鼠标滚轮事件
    save_event("roller", "mouse", timestamp)

# Flask路由
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/favicon.ico')
def favicon():
    # 返回一个空响应，避免404错误
    return '', 204

@app.route('/api/keystroke_data')
def get_keystroke_data():
    try:
        # 获取所有日期的数据
        all_data = []
        dates = session.query(ActivityTime.date).distinct().all()
        
        for (date,) in dates:
            # 获取该日期的活动时间
            activity = session.query(ActivityTime).filter_by(date=date).first()
            
            # 获取该日期的所有事件
            events = session.query(KeystrokeEvent).filter_by(date=date).all()
            
            # 构建日期数据
            date_data = {
                "mac": MAC_ADDRESS,
                "date": date,
                "result": [
                    {
                        "action": event.action,
                        "time": event.time,
                        "type": event.type
                    } for event in events
                ]
            }
            
            # 添加活动时间
            if activity:
                date_data["first_activity_time"] = activity.first_activity_time
                date_data["last_activity_time"] = activity.last_activity_time
            
            all_data.append(date_data)
        
        return jsonify(all_data)
    except Exception as e:
        print(f"API调用出错: {str(e)}")
        return jsonify({"error": f"数据加载失败: {str(e)}"})

@app.route('/api/today_data')
def get_today_data():
    session.commit()  # 确保最新数据已保存
    
    try:
        # 获取今日活动时间
        activity = session.query(ActivityTime).filter_by(date=TODAY).first()
        
        # 获取今日所有事件
        events = session.query(KeystrokeEvent).filter_by(date=TODAY).all()
        
        # 构建今日数据
        today_data = {
            "mac": MAC_ADDRESS,
            "date": TODAY,
            "result": [
                {
                    "action": event.action,
                    "time": event.time,
                    "type": event.type
                } for event in events
            ]
        }
        
        # 添加活动时间
        if activity:
            today_data["first_activity_time"] = activity.first_activity_time
            today_data["last_activity_time"] = activity.last_activity_time
        
        return jsonify(today_data)
    except Exception as e:
        print(f"获取今日数据出错: {str(e)}")
        return jsonify({"error": f"数据加载失败: {str(e)}"})

@app.route('/api/operation_distribution')
def get_operation_distribution():
    try:
        # 获取日期参数
        date = request.args.get('date', TODAY)
        mode = request.args.get('mode', 'today')
        
        # 初始化24小时的数据结构
        hourly_data = {
            "keyboard": [0] * 24,  # 键盘操作
            "mouse": [0] * 24,     # 鼠标操作
            "total": [0] * 24      # 总操作
        }

        if mode == 'today':
            # 只处理今日数据
            events = session.query(KeystrokeEvent).filter_by(date=TODAY).all()
            
            # 统计每个小时的操作次数
            for event in events:
                timestamp = event.time
                hour = datetime.datetime.fromtimestamp(timestamp/1000).hour
                
                if event.type == "keyboard":
                    hourly_data["keyboard"][hour] += 1
                elif event.type == "mouse":
                    hourly_data["mouse"][hour] += 1
                    
                hourly_data["total"][hour] += 1
            
            return jsonify(hourly_data)
        
        elif mode in ['week', 'month']:
            # 周或月模式，需要处理多个日期
            now = datetime.datetime.now()
            
            # 确定日期范围
            if mode == 'week':
                # 获取本周的所有日期
                today = now.date()
                weekday = today.weekday()  # 0是周一，6是周日
                start_date = today - datetime.timedelta(days=weekday)
                date_range = [start_date + datetime.timedelta(days=i) for i in range(7)]
            else:  # month模式
                # 获取本月的所有日期
                year, month = now.year, now.month
                _, last_day = calendar.monthrange(year, month)
                date_range = [datetime.date(year, month, day) for day in range(1, last_day + 1)]
            
            # 遍历日期范围内的所有数据
            for date in date_range:
                date_str = date.strftime("%Y-%m-%d")
                events = session.query(KeystrokeEvent).filter_by(date=date_str).all()
                
                for event in events:
                    timestamp = event.time
                    hour = datetime.datetime.fromtimestamp(timestamp/1000).hour
                    
                    if event.type == "keyboard":
                        hourly_data["keyboard"][hour] += 1
                    elif event.type == "mouse":
                        hourly_data["mouse"][hour] += 1
                        
                    hourly_data["total"][hour] += 1
            
            return jsonify(hourly_data)
        
        else:
            return jsonify({"error": "不支持的模式"})
        
    except Exception as e:
        print(f"获取操作分布出错: {str(e)}")
        return jsonify({"error": f"数据加载失败: {str(e)}"})

# GUI类
class KeyLoggerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("键盘记录器")
        self.root.geometry("360x480")
        
        # 设置窗口样式
        self.root.configure(bg='#ffffff')
        
        # 设置字体
        self.default_font = ('SF Pro Display', 13)
        self.title_font = ('SF Pro Display', 20, 'bold')
        self.button_font = ('SF Pro Display', 13)
        
        # 创建系统托盘图标
        self.create_tray_icon()
        
        # 绑定窗口关闭事件
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # 创建主框架
        main_frame = ttk.Frame(root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # 添加控件
        self.create_widgets(main_frame)
        
        # 初始化录制状态
        self.recording_var = tk.BooleanVar(value=True)
        
        # 配置主题样式
        self.configure_styles()
        
        # 更新UI
        self.update_ui()
    
    def configure_styles(self):
        # 创建自定义样式
        style = ttk.Style()
        
        # 配置标签样式
        style.configure('Title.TLabel',
            font=self.title_font,
            foreground='#000000',
            background='#ffffff',
            padding=(0, 10)
        )
        
        style.configure('Status.TLabel',
            font=self.default_font,
            foreground='#666666',
            background='#ffffff',
            padding=(0, 5)
        )
        
        # 配置按钮样式
        style.configure('Primary.TButton',
            font=self.button_font,
            background='#007AFF',
            foreground='#FFFFFF',
            padding=(20, 10),
            borderwidth=0
        )
        
        style.map('Primary.TButton',
            background=[('active', '#0051D5')],
            foreground=[('active', '#FFFFFF')]
        )
        
        style.configure('Secondary.TButton',
            font=self.button_font,
            background='#F5F5F7',
            foreground='#000000',
            padding=(20, 10),
            borderwidth=0
        )
        
        style.map('Secondary.TButton',
            background=[('active', '#E5E5E7')],
            foreground=[('active', '#000000')]
        )
        
        # 配置Checkbutton样式
        style.configure('Switch.TCheckbutton',
            font=self.default_font,
            background='#ffffff',
            foreground='#000000'
        )
    
    def create_widgets(self, frame):
        # 标题
        title_label = ttk.Label(
            frame,
            text="键盘记录器",
            style='Title.TLabel'
        )
        title_label.pack(fill=tk.X, pady=(0, 20))
        
        # 状态标签
        self.status_label = ttk.Label(
            frame,
            text="状态：正在记录",
            style='Status.TLabel'
        )
        self.status_label.pack(fill=tk.X, pady=(0, 30))
        
        # 按钮容器
        button_frame = ttk.Frame(frame)
        button_frame.pack(fill=tk.X, pady=(0, 20))
        
        # 开始/停止按钮
        self.toggle_button = ttk.Button(
            button_frame,
            text="停止记录",
            command=self.toggle_recording,
            style='Primary.TButton'
        )
        self.toggle_button.pack(fill=tk.X, pady=(0, 10))
        
        # 查看统计按钮
        self.stats_button = ttk.Button(
            button_frame,
            text="查看统计",
            command=self.show_stats,
            style='Secondary.TButton'
        )
        self.stats_button.pack(fill=tk.X, pady=(0, 10))
        
        # 最小化到托盘按钮
        self.minimize_button = ttk.Button(
            button_frame,
            text="最小化到托盘",
            command=self.minimize_to_tray,
            style='Secondary.TButton'
        )
        self.minimize_button.pack(fill=tk.X, pady=(0, 20))
        
        # 开机自启动复选框
        self.startup_var = tk.BooleanVar(value=is_in_startup())
        self.startup_cb = ttk.Checkbutton(
            frame,
            text="开机自启动",
            variable=self.startup_var,
            command=self.toggle_startup,
            style='Switch.TCheckbutton'
        )
        self.startup_cb.pack(fill=tk.X)
    
    def create_tray_icon(self):
        # 创建系统托盘图标
        image = create_round_icon(64, 64, 'green' if is_recording else 'red')
        menu = (
            pystray.MenuItem("显示主窗口", self.show_window),
            pystray.MenuItem("开始记录", self.start_recording, checked=lambda item: is_recording),
            pystray.MenuItem("停止记录", self.stop_recording, checked=lambda item: not is_recording),
            pystray.MenuItem("查看统计", self.show_stats),
            pystray.MenuItem("退出", self.quit_app)
        )
        self.icon = pystray.Icon("keylogger", image, "键盘记录器", menu)
        
    def show_window(self, icon=None, item=None):
        self.icon.stop()
        self.root.deiconify()
        self.root.state('normal')
        self.create_tray_icon()
    
    def minimize_to_tray(self):
        self.root.withdraw()
        self.icon.run()
    
    def start_recording(self, icon=None, item=None):
        global is_recording
        is_recording = True
        self.recording_var.set(True)
        self.update_ui()
        self.icon.icon = create_round_icon(64, 64, 'green')
    
    def stop_recording(self, icon=None, item=None):
        global is_recording
        is_recording = False
        self.recording_var.set(False)
        self.update_ui()
        self.icon.icon = create_round_icon(64, 64, 'red')
    
    def toggle_startup(self):
        if self.startup_var.get():
            add_to_startup()
            messagebox.showinfo("提示", "已添加到开机自启动")
        else:
            remove_from_startup()
            messagebox.showinfo("提示", "已从开机自启动中移除")
    
    def toggle_recording(self):
        if is_recording:
            self.stop_recording()
        else:
            self.start_recording()
    
    def quit_app(self, icon=None, item=None):
        if icon:
            icon.stop()
        self.root.quit()
    
    def on_closing(self):
        if messagebox.askyesno("确认", "是否最小化到系统托盘？\n选择'否'将退出程序。"):
            self.minimize_to_tray()
        else:
            self.quit_app()
    
    def update_ui(self):
        if is_recording:
            self.status_label.config(text="状态：正在记录")
            self.toggle_button.config(text="停止记录")
        else:
            self.status_label.config(text="状态：已停止")
            self.toggle_button.config(text="开始记录")

    def show_stats(self, icon=None):
        # 确保数据已保存
        session.commit()
        # 打开浏览器查看统计
        webbrowser.open('http://127.0.0.1:5000/')

def main():
    # 初始化数据库
    init_db()
    
    # 启动 Flask 服务器
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # 启动键盘监听
    keyboard_listener = keyboard.Listener(on_press=on_press)
    keyboard_listener.start()
    
    # 启动鼠标监听
    mouse_listener = mouse.Listener(
        on_move=on_move,
        on_click=on_click,
        on_scroll=on_scroll
    )
    mouse_listener.start()
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='键盘记录器')
    parser.add_argument('--minimized', action='store_true', help='以最小化状态启动')
    parser.add_argument('--background', action='store_true', help='在后台运行（无界面）')
    args = parser.parse_args()
    
    if args.background:
        # 创建系统托盘图标
        image = create_round_icon(64, 64, 'green')
        menu = (
            pystray.MenuItem("显示主窗口", lambda: start_gui(True)),
            pystray.MenuItem("开始记录", lambda: set_recording(True)),
            pystray.MenuItem("停止记录", lambda: set_recording(False)),
            pystray.MenuItem("查看统计", lambda: webbrowser.open('http://127.0.0.1:5000/')),
            pystray.MenuItem("退出", lambda: sys.exit(0))
        )
        icon = pystray.Icon("keylogger", image, "键盘记录器", menu)
        icon.run()
    else:
        # 创建主窗口
        root = tk.Tk()
        app = KeyLoggerApp(root)
        
        if args.minimized:
            root.withdraw()
            app.minimize_to_tray()
        else:
            root.mainloop()

def set_recording(state):
    global is_recording
    is_recording = state

def start_gui(minimized=False):
    root = tk.Tk()
    app = KeyLoggerApp(root)
    if minimized:
        root.withdraw()
        app.minimize_to_tray()
    else:
        root.mainloop()

def migrate_json_to_sqlite():
    """将旧的JSON数据迁移到SQLite数据库"""
    try:
        print("检查是否需要迁移JSON数据...")
        json_files = list(DATA_DIR.glob("*.json"))
        if not json_files:
            print("没有找到JSON文件，无需迁移")
            return
        
        print(f"找到{len(json_files)}个JSON文件，开始迁移数据...")
        for json_file in json_files:
            # 从文件名中提取日期
            date = json_file.stem
            
            # 检查该日期的数据是否已存在
            existing_count = session.query(KeystrokeEvent).filter_by(date=date).count()
            if existing_count > 0:
                print(f"日期 {date} 的数据已存在，跳过迁移")
                continue
            
            print(f"迁移 {date} 的数据...")
            try:
                with open(json_file, "r") as f:
                    data = json.load(f)
                    
                    # 检查数据格式
                    if "date" in data and "result" in data:
                        # 创建活动时间记录
                        activity = ActivityTime(
                            mac=data.get("mac", MAC_ADDRESS),
                            date=data["date"],
                            first_activity_time=data.get("first_activity_time"),
                            last_activity_time=data.get("last_activity_time")
                        )
                        session.add(activity)
                        
                        # 添加事件记录
                        for item in data["result"]:
                            event = KeystrokeEvent(
                                mac=data.get("mac", MAC_ADDRESS),
                                date=data["date"],
                                action=item.get("action", item.get("keyboard", "")),
                                time=item.get("time", 0),
                                type=item.get("type", "keyboard" if "keyboard" in item else "mouse")
                            )
                            session.add(event)
                        
                        # 每1000条提交一次
                        session.commit()
                        print(f"成功迁移 {date} 的 {len(data['result'])} 条记录")
                    else:
                        print(f"数据文件格式不正确: {json_file}")
            except Exception as e:
                print(f"迁移 {date} 数据时出错: {str(e)}")
                session.rollback()
        
        print("数据迁移完成")
    except Exception as e:
        print(f"数据迁移过程中出错: {str(e)}")
        session.rollback()

def run_flask():
    app.run(debug=False, threaded=True)

def on_closing():
    # 保存最后的数据
    session.commit()
    sys.exit(0)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n程序已退出")
    except Exception as e:
        print(f"发生错误: {e}")
        sys.exit(1) 