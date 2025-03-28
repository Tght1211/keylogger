import os
import shutil
from pathlib import Path

def clean_build():
    """清理构建目录"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"已清理目录: {dir_name}")

def build_mac():
    """构建Mac应用程序"""
    # 清理旧的构建文件
    clean_build()
    
    # 设置图标路径
    icon_path = os.path.join('static', 'img', '工作留痕.png')
    if not os.path.exists(icon_path):
        print(f"警告: 找不到图标文件 {icon_path}")
        icon_path = None
    
    # 构建PyInstaller命令
    cmd = [
        'pyinstaller',
        '--noconfirm',
        '--onefile',  # 打包成单个文件
        '--noconsole',  # 不显示控制台窗口
        '--clean',
        '--name', '工作留痕',
        '--target-architecture', 'universal2',  # 支持Intel和M1芯片
    ]
    
    # 添加图标
    if icon_path:
        cmd.extend(['--icon', icon_path])
    
    # 添加必要的数据文件
    cmd.extend([
        '--add-data', f'templates:templates',  # Mac使用:作为分隔符
        '--add-data', f'static:static',
    ])
    
    # 添加隐藏导入
    hidden_imports = [
        'pynput.keyboard._darwin',
        'pynput.mouse._darwin',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageTk',
        'PIL.ImageColor',
        'webbrowser',
        'calendar',
        'sqlite3',
        'sqlalchemy',
        'flask',
    ]
    
    for imp in hidden_imports:
        cmd.extend(['--hidden-import', imp])
    
    # 添加主程序
    cmd.append('main.py')
    
    # 执行打包命令
    import subprocess
    print("开始打包...")
    print(f"执行命令: {' '.join(cmd)}")
    subprocess.run(cmd)
    print("打包完成！")

if __name__ == '__main__':
    build_mac() 