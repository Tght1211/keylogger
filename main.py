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
from tkinter import ttk, font
from flask import Flask, render_template, jsonify, send_from_directory, request
import calendar
import sqlite3
from sqlalchemy import create_engine, Column, Integer, String, Text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker

# 全局变量
DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "keylogger.db"
MAC_ADDRESS = str(uuid.getnode())
TODAY = datetime.datetime.now().strftime("%Y-%m-%d")
is_recording = True
app = Flask(__name__)

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
        elif key == keyboard.Key.shift:
            key_char = "Shift"
        elif key == keyboard.Key.ctrl:
            key_char = "Ctrl"
        elif key == keyboard.Key.alt:
            key_char = "Alt"
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

# 初始化数据库
init_db()

# GUI类
class KeyLoggerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("操作记录器")
        self.root.geometry("400x320")
        self.root.configure(bg="#f5f5f7")
        self.root.resizable(False, False)
        
        # 创建自定义图标
        self.create_custom_icon()
        
        # Apple风格颜色
        self.colors = {
            "bg": "#f5f5f7",           # 背景色
            "accent": "#0071e3",       # 蓝色强调色
            "text": "#1d1d1f",         # 文本颜色
            "secondary_text": "#86868b", # 次要文本颜色
            "success": "#31b057",      # 成功状态颜色
            "warning": "#ff9f0a"       # 警告状态颜色
        }
        
        # 自定义字体
        self.default_font = font.nametofont("TkDefaultFont")
        self.default_font.configure(family="SF Pro Display, Helvetica, Arial", size=11)
        self.root.option_add("*Font", self.default_font)
        
        # 创建主容器
        self.main_frame = tk.Frame(root, bg=self.colors["bg"])
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=30, pady=30)
        
        # 应用标题
        self.title_label = tk.Label(
            self.main_frame, 
            text="操作记录器", 
            font=("SF Pro Display, Helvetica, Arial", 22, "bold"),
            fg=self.colors["text"],
            bg=self.colors["bg"]
        )
        self.title_label.pack(pady=(0, 20), anchor="w")
        
        # 状态指示器
        self.status_frame = tk.Frame(self.main_frame, bg=self.colors["bg"])
        self.status_frame.pack(fill=tk.X, pady=(0, 25))
        
        self.status_indicator = tk.Canvas(
            self.status_frame, 
            width=12, 
            height=12, 
            bg=self.colors["bg"], 
            highlightthickness=0
        )
        self.status_indicator.pack(side=tk.LEFT, padx=(0, 10))
        self.status_indicator.create_oval(2, 2, 10, 10, fill=self.colors["success"], outline="")
        
        self.status_label = tk.Label(
            self.status_frame, 
            text="正在记录操作", 
            font=("SF Pro Display, Helvetica, Arial", 14),
            fg=self.colors["text"],
            bg=self.colors["bg"]
        )
        self.status_label.pack(side=tk.LEFT)
        
        # 创建按钮风格
        self.style = ttk.Style()
        self.style.configure(
            "Primary.TButton", 
            font=("SF Pro Display, Helvetica, Arial", 12),
            background=self.colors["accent"],
            foreground="white",
            borderwidth=0,
            focusthickness=0,
            padding=(16, 10)
        )
        self.style.map(
            "Primary.TButton",
            background=[("active", "#0059B3"), ("pressed", "#004080")]
        )
        
        self.style.configure(
            "Secondary.TButton", 
            font=("SF Pro Display, Helvetica, Arial", 12),
            background="#e5e5ea",
            foreground=self.colors["text"],
            borderwidth=0,
            focusthickness=0,
            padding=(16, 10)
        )
        self.style.map(
            "Secondary.TButton",
            background=[("active", "#d1d1d6"), ("pressed", "#c7c7cc")]
        )
        
        # 按钮容器
        self.button_frame = tk.Frame(self.main_frame, bg=self.colors["bg"])
        self.button_frame.pack(fill=tk.X, pady=10)
        
        # 暂停/继续按钮
        self.toggle_button = ttk.Button(
            self.button_frame, 
            text="暂停记录", 
            command=self.toggle_recording,
            style="Primary.TButton"
        )
        self.toggle_button.pack(fill=tk.X, pady=(0, 15))
        
        # 查看统计按钮
        self.stats_button = ttk.Button(
            self.button_frame, 
            text="查看统计分析", 
            command=self.show_stats,
            style="Secondary.TButton"
        )
        self.stats_button.pack(fill=tk.X)
        
        # 版本信息
        self.version_label = tk.Label(
            self.main_frame, 
            text="版本 1.0", 
            font=("SF Pro Display, Helvetica, Arial", 10),
            fg=self.colors["secondary_text"],
            bg=self.colors["bg"]
        )
        self.version_label.pack(side=tk.BOTTOM, anchor="e", pady=(20, 0))
        
        # 定期更新UI
        self.update_ui()
    
    def create_custom_icon(self):
        """创建自定义图标用于窗口标题栏"""
        try:
            # 创建临时图标文件
            icon_size = 32
            icon = tk.PhotoImage(width=icon_size, height=icon_size)
            
            # 填充透明背景
            for y in range(icon_size):
                for x in range(icon_size):
                    icon.put("transparent", (x, y))
            
            # 计算圆的参数
            center = icon_size // 2
            radius = (icon_size // 2) - 2
            color = "#0071e3"  # 蓝色
            
            # 绘制圆形图标
            for y in range(icon_size):
                for x in range(icon_size):
                    # 计算到中心的距离
                    distance = ((x - center) ** 2 + (y - center) ** 2) ** 0.5
                    if distance <= radius:
                        icon.put(color, (x, y))
            
            # 设置为窗口图标
            self.root.iconphoto(True, icon)
        except Exception as e:
            print(f"创建图标时出错: {e}")
            # 忽略错误，继续运行
    
    def toggle_recording(self):
        global is_recording
        is_recording = not is_recording
        
        if is_recording:
            self.status_label.config(text="正在记录操作")
            self.toggle_button.config(text="暂停记录")
            self.status_indicator.itemconfig(1, fill=self.colors["success"])
        else:
            self.status_label.config(text="已暂停记录")
            self.toggle_button.config(text="继续记录")
            self.status_indicator.itemconfig(1, fill=self.colors["warning"])
    
    def show_stats(self):
        # 确保数据已保存
        session.commit()
        # 打开浏览器查看统计
        webbrowser.open('http://127.0.0.1:5000/')
    
    def update_ui(self):
        # 更新UI（可以在这里添加实时统计等功能）
        self.root.after(1000, self.update_ui)

def main():
    # 初始化变量
    global last_move_time
    last_move_time = None
    
    # 迁移旧的JSON数据到SQLite (如果需要)
    migrate_json_to_sqlite()
    
    # 启动键盘和鼠标监听器
    keyboard_listener = keyboard.Listener(on_press=on_press)
    keyboard_listener.start()
    
    mouse_listener = mouse.Listener(
        on_move=on_move,
        on_click=on_click,
        on_scroll=on_scroll
    )
    mouse_listener.start()
    
    # 创建GUI
    root = tk.Tk()
    
    # 配置GUI样式 - Apple Design风格
    # 设置DPI感知以获得更清晰的界面
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except:
        pass
    
    # 窗口圆角和阴影效果（仅适用于Windows 10/11）
    try:
        root.attributes('-alpha', 0.0)  # 先隐藏窗口
        root.update()
        hwnd = windll.user32.GetParent(root.winfo_id())
        # 窗口样式：WS_EX_LAYERED | WS_EX_TRANSPARENT
        style = windll.user32.GetWindowLongW(hwnd, -20)
        windll.user32.SetWindowLongW(hwnd, -20, style | 0x00080000 | 0x00000020)
        root.attributes('-alpha', 1.0)  # 显示窗口
    except:
        pass
    
    # 设置窗口对焦效果
    root.focus_force()
    
    # 应用主题颜色
    root.configure(background="#f5f5f7")
    
    # 创建应用实例
    app = KeyLoggerApp(root)
    
    # 启动Flask服务器
    server_thread = threading.Thread(target=run_flask)
    server_thread.daemon = True
    server_thread.start()
    
    # 设置关闭窗口时的操作
    root.protocol("WM_DELETE_WINDOW", on_closing)
    
    # 启动GUI主循环
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
    main() 