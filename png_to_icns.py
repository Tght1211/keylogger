#!/usr/bin/env python3
"""
将PNG图像转换为Mac系统使用的ICNS图标文件

此脚本需要在Mac系统上运行，并且需要安装sips和iconutil工具（Mac OS默认已安装）
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

def convert_png_to_icns(png_file, output_icns=None):
    """
    将PNG文件转换为ICNS文件
    
    Args:
        png_file: PNG文件路径
        output_icns: 输出的ICNS文件路径，默认为与输入文件相同目录下的同名文件
    
    Returns:
        成功返回True，失败返回False
    """
    # 检查操作系统
    if sys.platform != 'darwin':
        print("错误: 此脚本只能在Mac OS系统上运行")
        return False
    
    # 检查输入文件
    if not os.path.exists(png_file):
        print(f"错误: 输入文件不存在: {png_file}")
        return False
    
    # 设置输出文件路径
    if output_icns is None:
        output_dir = os.path.dirname(os.path.abspath(png_file))
        output_name = os.path.splitext(os.path.basename(png_file))[0]
        output_icns = os.path.join(output_dir, f"{output_name}.icns")
    
    # 创建临时iconset目录
    iconset_dir = 'icon.iconset'
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir)
    
    # 使用sips生成不同尺寸的图标
    try:
        # 创建不同尺寸的图标
        sizes = [16, 32, 64, 128, 256, 512, 1024]
        for size in sizes:
            # 标准分辨率图标
            if size <= 512:
                subprocess.run([
                    'sips', 
                    '-z', str(size), str(size), 
                    png_file, 
                    '--out', f"{iconset_dir}/icon_{size}x{size}.png"
                ], check=True)
            
            # 高分辨率图标 (2x)
            if size <= 512:
                subprocess.run([
                    'sips', 
                    '-z', str(size*2), str(size*2), 
                    png_file, 
                    '--out', f"{iconset_dir}/icon_{size}x{size}@2x.png"
                ], check=True)
        
        # 使用iconutil将iconset转换为icns
        subprocess.run([
            'iconutil', 
            '-c', 'icns', 
            iconset_dir, 
            '-o', output_icns
        ], check=True)
        
        print(f"成功创建ICNS文件: {output_icns}")
        return True
    
    except subprocess.CalledProcessError as e:
        print(f"错误: 转换过程失败: {e}")
        return False
    except Exception as e:
        print(f"错误: {e}")
        return False
    finally:
        # 清理临时目录
        if os.path.exists(iconset_dir):
            shutil.rmtree(iconset_dir)

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python png_to_icns.py <PNG文件路径> [输出ICNS文件路径]")
        return
    
    png_file = sys.argv[1]
    
    output_icns = None
    if len(sys.argv) > 2:
        output_icns = sys.argv[2]
    
    convert_png_to_icns(png_file, output_icns)

if __name__ == "__main__":
    main() 