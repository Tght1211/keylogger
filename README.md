# 工作留痕 - 工作效率分析工具

工作留痕是一款专为工作场景设计的操作活动记录和分析工具，它能够帮助您跟踪和分析您的键盘和鼠标使用情况，从而提高工作效率。

## 功能特点

- 📊 自动记录键盘按键和鼠标活动，以SQLite数据库格式高效存储
- 📈 提供直观的数据可视化和统计分析
- 🔍 多维度查看数据：今日、本周和本月
- ⌨️ 键盘热力图展示按键使用频率
- 📅 工作时长日历视图
- 🕒 时间分布热力图
- 🔄 实时更新数据和统计信息
- 💾 高性能数据库存储，支持大量数据高效查询

> 效果图如下

![image](https://github.com/user-attachments/assets/cc07fbc1-c3a3-4cc1-b228-2b98300a4a12)


## 技术实现

- 后端：Python + Flask + SQLite + SQLAlchemy
- 前端：HTML5 + CSS3 + JavaScript
- 数据可视化：Plotly.js, Chart.js
- 样式设计：借鉴Apple Design风格

## 安装说明

1. 确保您已安装Miniconda或Anaconda
2. 克隆或下载此仓库到本地
3. 使用Conda创建虚拟环境并安装依赖:

```bash
cd keylogger
conda create -n keylogger python=3.10
conda activate keylogger
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 使用方法

1. 启动应用程序:

```bash
python main.py
```

2. 应用程序将在后台运行，并开始记录您的键盘和鼠标活动
3. 通过GUI界面上的"查看统计"按钮，可以打开数据可视化面板
4. 通过"暂停记录"按钮可以随时暂停活动记录

## 数据存储

所有数据存储在SQLite数据库（`data/keylogger.db`）中，包含以下两个主要表：

1. `keystroke_events` - 记录所有按键和鼠标事件:
```
- id: 主键
- mac: 机器MAC地址
- date: 日期
- action: 操作类型（按键或鼠标动作）
- time: 时间戳（毫秒）
- type: 事件类型（keyboard或mouse）
```

2. `activity_times` - 记录每日活动时间:
```
- id: 主键
- mac: 机器MAC地址
- date: 日期
- first_activity_time: 首次活动时间戳
- last_activity_time: 最后活动时间戳
```

如果您之前使用的是旧版本的JSON存储格式，程序首次启动时会自动将JSON数据迁移到SQLite数据库中。

## 隐私说明

- 工作留痕仅记录按键和鼠标事件，不记录输入的实际文本内容
- 所有数据均存储在本地，不会上传到任何服务器
- 您可以随时删除数据库文件以清除记录

## 许可证

MIT License

## 联系方式

如有任何问题或建议，请联系作者。 
