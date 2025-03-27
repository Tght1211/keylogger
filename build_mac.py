import os
import shutil
import subprocess
import sys
from pathlib import Path

def clean_build_directories():
    """清理打包产生的临时目录"""
    dirs_to_clean = ['build', 'dist', 'mac_dist']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            print(f"清理目录: {dir_name}")
            shutil.rmtree(dir_name)

def build_mac_app():
    """使用PyInstaller打包Mac应用程序"""
    print("开始打包Mac应用程序...")
    
    # 设置图标路径
    icon_path = os.path.join('static', 'img', '工作留痕.icns')
    
    # 检查是否存在.icns图标文件（Mac系统需要）
    if not os.path.exists(icon_path):
        png_icon = os.path.join('static', 'img', '工作留痕.png')
        if os.path.exists(png_icon):
            print(f"警告: 未找到Mac图标文件({icon_path})，但找到PNG图标，将尝试转换")
            try:
                # 如果在Mac系统上，可以使用以下命令创建icns文件
                # 注意: 这需要安装png2icns或iconutil工具
                os.makedirs('icon.iconset', exist_ok=True)
                subprocess.run(['sips', '-z', '16', '16', png_icon, '--out', 'icon.iconset/icon_16x16.png'], check=True)
                subprocess.run(['sips', '-z', '32', '32', png_icon, '--out', 'icon.iconset/icon_16x16@2x.png'], check=True)
                subprocess.run(['sips', '-z', '32', '32', png_icon, '--out', 'icon.iconset/icon_32x32.png'], check=True)
                subprocess.run(['sips', '-z', '64', '64', png_icon, '--out', 'icon.iconset/icon_32x32@2x.png'], check=True)
                subprocess.run(['sips', '-z', '128', '128', png_icon, '--out', 'icon.iconset/icon_128x128.png'], check=True)
                subprocess.run(['sips', '-z', '256', '256', png_icon, '--out', 'icon.iconset/icon_128x128@2x.png'], check=True)
                subprocess.run(['sips', '-z', '256', '256', png_icon, '--out', 'icon.iconset/icon_256x256.png'], check=True)
                subprocess.run(['sips', '-z', '512', '512', png_icon, '--out', 'icon.iconset/icon_256x256@2x.png'], check=True)
                subprocess.run(['sips', '-z', '512', '512', png_icon, '--out', 'icon.iconset/icon_512x512.png'], check=True)
                subprocess.run(['sips', '-z', '1024', '1024', png_icon, '--out', 'icon.iconset/icon_512x512@2x.png'], check=True)
                
                # 创建icns文件
                icon_dir = os.path.dirname(icon_path)
                os.makedirs(icon_dir, exist_ok=True)
                subprocess.run(['iconutil', '-c', 'icns', 'icon.iconset', '-o', icon_path], check=True)
                
                # 清理临时目录
                shutil.rmtree('icon.iconset')
                print(f"已成功创建Mac图标文件: {icon_path}")
            except Exception as e:
                print(f"警告: 创建图标文件失败: {e}")
                print("请手动创建.icns文件并放在static/img/目录下")
                return False
        else:
            print(f"错误: 图标文件不存在: {icon_path}或{png_icon}")
            print("请创建.icns文件并放在static/img/目录下")
            return False
    
    # 构建PyInstaller命令
    cmd = [
        'pyinstaller',
        '--noconfirm',
        '--windowed',  # 不显示控制台窗口
        f'--icon={icon_path}',  # 设置应用程序图标
        '--name=工作留痕',  # 设置输出的app文件名
        '--osx-bundle-identifier=com.akr.keylogger',  # 设置Bundle ID
        # 添加所需的数据文件，但不包括data目录
        '--add-data=static:static',  # 注意Mac和Windows的路径分隔符不同
        '--add-data=templates:templates',  # 注意Mac和Windows的路径分隔符不同
        '--hidden-import=pystray._darwin',  # Mac版本的pystray后端
        '--hidden-import=PIL._tkinter_finder',
        'main.py'  # 入口脚本
    ]
    
    print("执行命令:", ' '.join(cmd))
    
    try:
        subprocess.run(cmd, check=True)
        print("应用程序打包完成!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"打包失败: {e}")
        return False

def create_dmg():
    """创建DMG文件"""
    print("开始创建DMG文件...")
    
    # 检查是否存在app文件
    app_path = os.path.join('dist', '工作留痕.app')
    if not os.path.exists(app_path):
        print(f"错误: 应用程序不存在: {app_path}")
        return False
    
    # 创建目标文件夹
    mac_dist = os.path.join('mac_dist')
    os.makedirs(mac_dist, exist_ok=True)
    
    # 创建空的data目录
    data_dir = os.path.join(mac_dist, 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
    
    # 复制应用程序到目标文件夹
    dest_app = os.path.join(mac_dist, '工作留痕.app')
    if os.path.exists(dest_app):
        shutil.rmtree(dest_app)
    shutil.copytree(app_path, dest_app)
    print(f"已复制应用程序到: {dest_app}")
    
    # 创建README文件
    readme_path = os.path.join(mac_dist, 'README.txt')
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("""# 工作留痕 - Mac版本使用说明

## 使用方法

1. 将应用程序"工作留痕.app"拖动到"应用程序"文件夹中
2. 在"应用程序"文件夹中双击"工作留痕.app"运行程序
3. 程序会自动在系统菜单栏中显示图标，点击图标可查看菜单选项

## 功能特点

- 自动记录键盘按键和鼠标活动，以SQLite数据库格式高效存储
- 提供直观的数据可视化和统计分析
- 多维度查看数据：今日、本周和本月
- 键盘热力图展示按键使用频率
- 工作时长日历视图
- 时间分布热力图
- 分钟级活动曲线，展示工作强度变化
- 实时更新数据和统计信息

## 数据存储

- 数据将存储在用户主目录下的"{app_name}/data"文件夹中
- 如需迁移数据，请复制整个data文件夹到新的位置

## 注意事项

- 首次运行时，您可能需要授予应用程序辅助功能权限，以便记录键盘和鼠标活动
- 所有数据都保存在本地，不会上传到任何服务器
""".replace("{app_name}", "工作留痕"))
    print(f"已创建README文件: {readme_path}")
    
    # 创建DMG文件
    dmg_path = os.path.join('mac_dist', '工作留痕安装包.dmg')
    cmd = [
        'hdiutil', 'create',
        '-volname', '工作留痕',
        '-srcfolder', mac_dist,
        '-ov', dmg_path,
        '-format', 'UDZO'
    ]
    
    print("执行命令:", ' '.join(cmd))
    
    try:
        subprocess.run(cmd, check=True)
        print(f"DMG文件创建成功: {dmg_path}")
        return True
    except Exception as e:
        print(f"创建DMG文件失败: {e}")
        # 如果hdiutil命令失败，可能是在非Mac系统上运行，提供提示
        print("提示: 创建DMG文件需要在Mac系统上运行")
        print("您可以将mac_dist目录复制到Mac系统上，然后使用以下命令创建DMG文件:")
        print(f"cd mac_dist的父目录")
        print(f"hdiutil create -volname 工作留痕 -srcfolder mac_dist -ov mac_dist/工作留痕安装包.dmg -format UDZO")
        return False

def main():
    """主函数"""
    # 判断当前系统
    if sys.platform != 'darwin':
        print("警告: 当前非Mac系统，可能无法正确打包Mac应用")
        print("建议在Mac系统上运行此脚本")
        choice = input("是否继续? (y/n): ")
        if choice.lower() != 'y':
            return
    
    # 清理之前的构建
    clean_build_directories()
    
    # 构建Mac应用
    if build_mac_app():
        # 尝试创建DMG文件
        if create_dmg():
            print("\n============================================")
            print("打包已完成!")
            print("DMG文件位置: mac_dist/工作留痕安装包.dmg")
            print("============================================")
            print("请注意:")
            print("1. 用户需要将应用程序拖到Applications文件夹中安装")
            print("2. 首次运行时用户可能需要授予辅助功能权限")
            print("3. 数据将存储在用户主目录下的工作留痕/data文件夹中")
            print("============================================")
        else:
            print("\nDMG文件创建失败，但应用程序已打包成功")
            print("应用程序位置: dist/工作留痕.app")
    else:
        print("\n打包失败! 请检查错误信息。")

if __name__ == "__main__":
    main() 