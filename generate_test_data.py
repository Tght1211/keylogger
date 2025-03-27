import os
import uuid
import random
import datetime
from pathlib import Path
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from main import KeystrokeEvent, ActivityTime, Base

# 全局变量
DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "keylogger.db"
MAC_ADDRESS = str(uuid.getnode())

# 创建数据库引擎和会话
engine = create_engine(f'sqlite:///{DB_PATH}')
Session = sessionmaker(bind=engine)
session = Session()

# 模拟的键盘按键
KEYBOARD_KEYS = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'Space', 'Enter', 'Backspace', 'Tab', 'Shift', 'Ctrl', 'Alt'
]

# 模拟的鼠标操作
MOUSE_ACTIONS = ['left_key', 'right_key', 'middle_key', 'slide', 'roller']

def generate_data_for_date(date_str, start_hour=9, end_hour=18):
    """为指定日期生成模拟数据"""
    print(f"正在生成 {date_str} 的数据...")
    
    # 检查该日期是否已有数据
    existing = session.query(ActivityTime).filter_by(date=date_str).first()
    if existing:
        print(f"{date_str} 已存在数据，跳过")
        return
    
    # 生成工作时间范围（早上9点到下午6点）
    base_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    start_time = base_date.replace(hour=start_hour, minute=0, second=0)
    end_time = base_date.replace(hour=end_hour, minute=0, second=0)
    
    # 创建活动时间记录
    first_activity_time = int(start_time.timestamp() * 1000)
    last_activity_time = int(end_time.timestamp() * 1000)
    
    activity = ActivityTime(
        mac=MAC_ADDRESS,
        date=date_str,
        first_activity_time=first_activity_time,
        last_activity_time=last_activity_time
    )
    session.add(activity)
    
    # 生成事件数据
    current_time = start_time
    events = []
    
    while current_time < end_time:
        # 随机决定是键盘还是鼠标事件
        event_type = random.choice(['keyboard', 'mouse'])
        
        if event_type == 'keyboard':
            action = random.choice(KEYBOARD_KEYS)
        else:
            action = random.choice(MOUSE_ACTIONS)
        
        # 添加事件
        event = KeystrokeEvent(
            mac=MAC_ADDRESS,
            date=date_str,
            action=action,
            time=int(current_time.timestamp() * 1000),
            type=event_type
        )
        events.append(event)
        
        # 随机增加时间（0.5秒到30秒之间）
        current_time += datetime.timedelta(seconds=random.uniform(0.5, 30))
    
    # 批量添加事件
    session.bulk_save_objects(events)
    session.commit()
    print(f"已生成 {len(events)} 条事件数据")

def main():
    # 确保数据目录存在
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # 确保表存在
    if not inspect(engine).has_table('keystroke_events'):
        Base.metadata.create_all(engine)
    
    # 生成过去7天的数据
    today = datetime.datetime.now().date()
    for i in range(1, 8):  # 生成昨天到7天前的数据
        date = today - datetime.timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        # 如果是周末，设置不同的工作时间
        if date.weekday() >= 5:  # 5是周六，6是周日
            generate_data_for_date(date_str, start_hour=14, end_hour=17)  # 周末假设工作时间短一些
        else:
            generate_data_for_date(date_str, start_hour=9, end_hour=18)

if __name__ == "__main__":
    try:
        main()
        print("数据生成完成！")
    except Exception as e:
        print(f"生成数据时出错: {e}")
        session.rollback() 