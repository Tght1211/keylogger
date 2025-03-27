import os
import shutil
import subprocess
import sys

def clean_build_directories():
    """清理打包产生的临时目录"""
    dirs_to_clean = ['build', 'dist']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            print(f"清理目录: {dir_name}")
            shutil.rmtree(dir_name)

def build_exe():
    """使用PyInstaller打包Windows可执行文件"""
    print("开始打包Windows可执行文件...")
    
    # 设置图标路径
    icon_path = os.path.join('static', 'img', '工作留痕.ico')
    
    # 检查是否存在.ico图标文件
    if not os.path.exists(icon_path):
        print(f"警告: 未找到图标文件: {icon_path}")
        print("请确保图标文件存在于static/img目录下")
        return False
    
    # 创建空的data目录
    data_dir = os.path.join('data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
    
    # 构建PyInstaller命令
    cmd = [
        'pyinstaller',
        '--noconfirm',
        '--windowed',  # 不显示控制台窗口
        f'--icon={icon_path}',  # 设置应用程序图标
        '--name=工作留痕',  # 设置输出的exe文件名
        # 添加所需的数据文件
        '--add-data=static;static',  # Windows使用分号作为路径分隔符
        '--add-data=templates;templates',
        '--add-data=data;data',  # 添加data目录
        # 添加必要的依赖
        '--hidden-import=pystray._win32',
        '--hidden-import=PIL._tkinter_finder',
        '--hidden-import=keyboard',
        '--hidden-import=mouse',
        'main.py'  # 入口脚本
    ]
    
    print("执行命令:", ' '.join(cmd))
    
    try:
        subprocess.run(cmd, check=True)
        print("应用程序打包完成!")
        
        # 确保dist目录中的data目录存在
        dist_data_dir = os.path.join('dist', '工作留痕', 'data')
        if not os.path.exists(dist_data_dir):
            os.makedirs(dist_data_dir)
            print(f"已创建dist目录中的data目录: {dist_data_dir}")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"打包失败: {e}")
        return False

def create_data_directory():
    """在打包后的dist目录中创建data目录"""
    data_dir = os.path.join('dist', 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")

def main():
    # 清理之前的构建
    clean_build_directories()
    
    # 构建exe
    if build_exe():
        # 创建空的data目录
        create_data_directory()
        
        print("\n============================================")
        print("打包已完成!")
        print("EXE文件位置: dist/工作留痕.exe")
        print("============================================")
        print("请注意:")
        print("1. 程序首次运行时会在exe同级目录下创建data文件夹用于存储数据")
        print("2. 您可以分发exe文件，用户不需要Python环境即可运行")
        print("3. 如果要迁移现有数据，用户可以复制data目录到exe所在目录")
        print("============================================")
    else:
        print("\n打包失败! 请检查错误信息。")

if __name__ == "__main__":
    main() 