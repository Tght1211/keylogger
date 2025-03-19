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
from tkinter import ttk
from flask import Flask, render_template, jsonify, send_from_directory, request
import calendar

# 全局变量
DATA_DIR = Path(__file__).parent / "data"
MAC_ADDRESS = str(uuid.getnode())
TODAY = datetime.datetime.now().strftime("%Y-%m-%d")
keystroke_data = {
    "mac": MAC_ADDRESS,
    "date": TODAY,
    "result": [],
    "first_activity_time": None,  # 记录当日第一次活动时间
    "last_activity_time": None    # 记录当日最后一次活动时间
}
last_activity_time = None
app = Flask(__name__)
is_recording = True

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)

# 保存数据
def save_data():
    today_file = DATA_DIR / f"{TODAY}.json"
    with open(today_file, "w") as f:
        json.dump(keystroke_data, f, indent=4)

# 处理键盘事件
def on_press(key):
    global last_activity_time
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
    current_time = datetime.datetime.now()
    
    # 添加按键记录
    keystroke_data["result"].append({
        "action": key_char,
        "time": timestamp,
        "type": "keyboard"
    })
    
    # 更新最后活动时间
    last_activity_time = current_time
    keystroke_data["last_activity_time"] = timestamp
    
    # 如果是首次记录，更新第一次活动时间
    if keystroke_data["first_activity_time"] is None:
        keystroke_data["first_activity_time"] = timestamp
    
    # 每100次按键保存一次数据
    if len(keystroke_data["result"]) % 100 == 0:
        save_data()

# 处理鼠标移动
def on_move(x, y):
    global last_activity_time
    if not is_recording:
        return
    
    # 仅在移动超过阈值距离时记录(避免过度记录)
    # 这里可以根据需要添加距离检查
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    current_time = datetime.datetime.now()
    
    # 每秒最多记录一次移动，避免数据过多
    if last_activity_time is None or (current_time - last_activity_time).total_seconds() >= 1:
        # 添加鼠标移动记录
        keystroke_data["result"].append({
            "action": "slide",
            "time": timestamp,
            "type": "mouse"
        })
        
        # 更新最后活动时间
        last_activity_time = current_time
        keystroke_data["last_activity_time"] = timestamp
        
        # 如果是首次记录，更新第一次活动时间
        if keystroke_data["first_activity_time"] is None:
            keystroke_data["first_activity_time"] = timestamp

# 处理鼠标点击
def on_click(x, y, button, pressed):
    if not is_recording or not pressed:
        return
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    current_time = datetime.datetime.now()
    
    # 识别按键
    if button == mouse.Button.left:
        button_name = "left_key"
    elif button == mouse.Button.right:
        button_name = "right_key"
    elif button == mouse.Button.middle:
        button_name = "middle_key"
    else:
        button_name = str(button)
    
    # 添加鼠标点击记录
    keystroke_data["result"].append({
        "action": button_name,
        "time": timestamp,
        "type": "mouse"
    })
    
    # 更新最后活动时间
    global last_activity_time
    last_activity_time = current_time
    keystroke_data["last_activity_time"] = timestamp
    
    # 如果是首次记录，更新第一次活动时间
    if keystroke_data["first_activity_time"] is None:
        keystroke_data["first_activity_time"] = timestamp
    
    # 每100次操作保存一次数据
    if len(keystroke_data["result"]) % 100 == 0:
        save_data()

# 处理鼠标滚轮
def on_scroll(x, y, dx, dy):
    if not is_recording:
        return
    
    # 获取当前时间戳
    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    current_time = datetime.datetime.now()
    
    # 添加鼠标滚轮记录
    keystroke_data["result"].append({
        "action": "roller",
        "time": timestamp,
        "type": "mouse"
    })
    
    # 更新最后活动时间
    global last_activity_time
    last_activity_time = current_time
    keystroke_data["last_activity_time"] = timestamp
    
    # 如果是首次记录，更新第一次活动时间
    if keystroke_data["first_activity_time"] is None:
        keystroke_data["first_activity_time"] = timestamp
    
    # 每100次操作保存一次数据
    if len(keystroke_data["result"]) % 100 == 0:
        save_data()

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
    # 读取所有数据文件
    all_data = []
    print("正在读取数据文件...")
    
    try:
        for data_file in DATA_DIR.glob("*.json"):
            print(f"发现数据文件: {data_file}")
            try:
                with open(data_file, "r") as f:
                    try:
                        data = json.load(f)
                        # 检查数据格式
                        if "date" in data and "result" in data:
                            # 兼容旧数据格式，确保所有记录都有type字段
                            for item in data["result"]:
                                if "type" not in item:
                                    if "keyboard" in item:
                                        item["action"] = item["keyboard"]
                                        del item["keyboard"]
                                        item["type"] = "keyboard"
                            all_data.append(data)
                            print(f"成功加载数据文件: {data_file}, 操作数量: {len(data.get('result', []))}")
                        else:
                            print(f"数据文件格式不正确: {data_file}")
                    except json.JSONDecodeError:
                        print(f"解析数据文件失败: {data_file}")
            except Exception as e:
                print(f"读取文件时出错: {data_file}, 错误: {str(e)}")
        
        print(f"总共找到 {len(all_data)} 个有效数据文件")
        return jsonify(all_data)
    except Exception as e:
        print(f"API调用出错: {str(e)}")
        return jsonify({"error": f"数据加载失败: {str(e)}"})

@app.route('/api/today_data')
def get_today_data():
    save_data()  # 确保最新数据已保存
    today_file = DATA_DIR / f"{TODAY}.json"
    
    print(f"请求今日数据，文件路径: {today_file}")
    
    try:
        if today_file.exists():
            try:
                with open(today_file, "r") as f:
                    try:
                        data = json.load(f)
                        # 检查数据格式
                        if "date" in data and "result" in data:
                            # 兼容旧数据格式，确保所有记录都有type字段
                            for item in data["result"]:
                                if "type" not in item:
                                    if "keyboard" in item:
                                        item["action"] = item["keyboard"]
                                        del item["keyboard"]
                                        item["type"] = "keyboard"
                            print(f"成功读取今日数据，操作数量: {len(data.get('result', []))}")
                            return jsonify(data)
                        else:
                            print("今日数据文件格式不正确")
                            return jsonify({"error": "数据格式不正确"})
                    except json.JSONDecodeError:
                        print("解析今日数据文件失败")
                        return jsonify({"error": "数据文件解析失败"})
            except Exception as e:
                print(f"读取今日数据文件时出错: {str(e)}")
                return jsonify({"error": f"数据文件读取失败: {str(e)}"})
        else:
            # 如果文件不存在但内存中有数据
            if len(keystroke_data["result"]) > 0:
                print("今日数据文件不存在，返回内存中的数据")
                return jsonify(keystroke_data)
            else:
                print("今日数据文件不存在且内存中无数据")
                return jsonify({"date": TODAY, "mac": MAC_ADDRESS, "result": []})
    except Exception as e:
        print(f"今日数据API调用出错: {str(e)}")
        return jsonify({"error": f"数据加载失败: {str(e)}"})

@app.route('/api/operation_distribution')
def get_operation_distribution():
    try:
        # 获取时间范围参数
        mode = request.args.get('mode', 'today')  # 默认是today模式
        
        if mode == 'today':
            # 只处理今日数据
            today_file = DATA_DIR / f"{TODAY}.json"
            if not today_file.exists():
                return jsonify({"error": "今日数据不存在"})
                
            with open(today_file, "r") as f:
                data = json.load(f)
                
            if not data.get("result"):
                return jsonify({"error": "没有操作记录"})
                
            # 初始化24小时的数据结构
            hourly_data = {
                "keyboard": [0] * 24,  # 键盘操作
                "mouse": [0] * 24,     # 鼠标操作
                "total": [0] * 24      # 总操作
            }
            
            # 统计每个小时的操作次数
            for record in data["result"]:
                timestamp = record["time"]
                hour = datetime.datetime.fromtimestamp(timestamp/1000).hour
                
                if record["type"] == "keyboard":
                    hourly_data["keyboard"][hour] += 1
                elif record["type"] == "mouse":
                    hourly_data["mouse"][hour] += 1
                    
                hourly_data["total"][hour] += 1
                
            return jsonify(hourly_data)
        
        elif mode in ['week', 'month']:
            # 周或月模式，需要处理多个文件
            now = datetime.datetime.now()
            all_files = []
            
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
            
            # 初始化24小时的数据结构
            hourly_data = {
                "keyboard": [0] * 24,  # 键盘操作
                "mouse": [0] * 24,     # 鼠标操作
                "total": [0] * 24      # 总操作
            }
            
            # 遍历日期范围内的所有文件
            for date in date_range:
                date_str = date.strftime("%Y-%m-%d")
                file_path = DATA_DIR / f"{date_str}.json"
                
                if file_path.exists():
                    try:
                        with open(file_path, "r") as f:
                            data = json.load(f)
                        
                        if data.get("result"):
                            for record in data["result"]:
                                timestamp = record["time"]
                                hour = datetime.datetime.fromtimestamp(timestamp/1000).hour
                                
                                if record.get("type") == "keyboard":
                                    hourly_data["keyboard"][hour] += 1
                                elif record.get("type") == "mouse":
                                    hourly_data["mouse"][hour] += 1
                                    
                                hourly_data["total"][hour] += 1
                    except Exception as e:
                        print(f"处理文件 {file_path} 时出错: {str(e)}")
            
            return jsonify(hourly_data)
        
        else:
            return jsonify({"error": "不支持的模式"})
            
    except Exception as e:
        return jsonify({"error": f"获取操作分布数据失败: {str(e)}"})

# GUI类
class KeyLoggerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("键盘&鼠标活动记录")
        self.root.geometry("300x200")
        self.root.resizable(False, False)
        
        # 设置样式
        style = ttk.Style()
        style.configure("TButton", font=("Helvetica", 12))
        style.configure("TLabel", font=("Helvetica", 12))
        
        # 创建组件
        main_frame = ttk.Frame(root, padding=10)
        main_frame.pack(fill="both", expand=True)
        
        status_frame = ttk.Frame(main_frame)
        status_frame.pack(pady=10)
        
        ttk.Label(status_frame, text="状态: ").pack(side="left")
        self.status_label = ttk.Label(status_frame, text="正在记录", foreground="green")
        self.status_label.pack(side="left")
        
        self.toggle_button = ttk.Button(main_frame, text="暂停记录", command=self.toggle_recording)
        self.toggle_button.pack(pady=10, fill="x")
        
        ttk.Button(main_frame, text="查看统计", command=self.show_stats).pack(pady=10, fill="x")
        
        # 显示总操作数
        self.keystroke_count = ttk.Label(main_frame, text=f"今日操作: {len(keystroke_data['result'])}")
        self.keystroke_count.pack(pady=10)
        
        # 定期更新界面
        self.update_ui()
    
    def toggle_recording(self):
        global is_recording
        is_recording = not is_recording
        
        if is_recording:
            self.status_label.config(text="正在记录", foreground="green")
            self.toggle_button.config(text="暂停记录")
        else:
            self.status_label.config(text="已暂停", foreground="red")
            self.toggle_button.config(text="继续记录")
    
    def show_stats(self):
        # 确保数据已保存
        save_data()
        
        # 启动Flask服务器
        webbrowser.open("http://127.0.0.1:5000")
    
    def update_ui(self):
        self.keystroke_count.config(text=f"今日操作: {len(keystroke_data['result'])}")
        self.root.after(1000, self.update_ui)  # 每秒更新一次

# 主函数
def main():
    # 检查今日数据文件是否存在，如果存在则载入
    today_file = DATA_DIR / f"{TODAY}.json"
    global keystroke_data
    
    if today_file.exists():
        try:
            with open(today_file, "r") as f:
                loaded_data = json.load(f)
                keystroke_data = loaded_data
                
                # 确保keystroke_data包含所有需要的键
                if "first_activity_time" not in keystroke_data:
                    keystroke_data["first_activity_time"] = None
                if "last_activity_time" not in keystroke_data:
                    keystroke_data["last_activity_time"] = None
                
                # 兼容旧数据格式，添加type字段
                for item in keystroke_data["result"]:
                    if "type" not in item:
                        # 如果包含keyboard字段说明是老格式的键盘数据
                        if "keyboard" in item:
                            item["action"] = item["keyboard"]
                            del item["keyboard"]
                            item["type"] = "keyboard"
        except (json.JSONDecodeError, FileNotFoundError):
            # 如果文件损坏，使用新的数据结构
            pass
    
    # 创建并启动键盘监听器
    keyboard_listener = keyboard.Listener(on_press=on_press)
    keyboard_listener.start()
    
    # 创建并启动鼠标监听器
    mouse_listener = mouse.Listener(
        on_move=on_move,
        on_click=on_click,
        on_scroll=on_scroll
    )
    mouse_listener.start()
    
    # 创建并启动Flask服务器线程
    def run_flask():
        global app
        app.run(port=5000, debug=False, use_reloader=False)
    
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    # 创建并运行GUI
    root = tk.Tk()
    app = KeyLoggerApp(root)
    
    # 设置退出时的保存操作
    def on_closing():
        save_data()
        root.destroy()
    
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()

if __name__ == "__main__":
    main() 