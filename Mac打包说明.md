# Mac版本打包说明

本文档提供了在Mac系统上打包"工作留痕"应用程序的详细步骤。

## 前提条件

1. Mac系统（macOS 10.14或更高版本）
2. Python 3.9+
3. 安装PyInstaller: `pip install pyinstaller`

## 打包步骤

### 1. 准备工作

1. 将工作留痕项目文件复制到Mac系统中
2. 打开终端，进入项目目录

```bash
cd 项目目录路径
```

3. 安装所需依赖库

```bash
pip install -r requirements.txt
```

### 2. 创建图标文件

Mac应用需要.icns格式的图标文件。项目中提供了`png_to_icns.py`工具来将PNG转换为ICNS格式：

```bash
python png_to_icns.py static/img/工作留痕.png static/img/工作留痕.icns
```

### 3. 使用自动化脚本打包

项目提供了`build_mac.py`脚本，可以自动完成打包工作：

```bash
python build_mac.py
```

脚本将自动执行以下操作：
- 创建.app应用程序
- 生成DMG安装文件
- 处理图标和必要的文件

### 4. 手动打包（如果自动脚本失败）

如果自动脚本不能正常工作，可以按照以下步骤手动打包：

#### 4.1 使用PyInstaller生成.app文件

```bash
pyinstaller 工作留痕_mac.spec
```

#### 4.2 创建DMG文件

1. 创建一个临时目录并复制应用程序

```bash
mkdir -p mac_dist/data
cp -r dist/工作留痕.app mac_dist/
```

2. 使用hdiutil创建DMG文件

```bash
hdiutil create -volname 工作留痕 -srcfolder mac_dist -ov mac_dist/工作留痕安装包.dmg -format UDZO
```

## 代码调整

在Mac系统上打包时，需要注意以下几点：

1. 路径分隔符：Windows使用分号(;)，Mac使用冒号(:)
   ```
   # Windows
   --add-data=static;static
   
   # Mac
   --add-data=static:static
   ```

2. 系统托盘：Mac使用`pystray._darwin`而不是`pystray._win32`

3. 辅助功能权限：Mac系统需要授予应用程序辅助功能权限，才能监听全局键盘和鼠标事件

## 签名与公证

如果需要分发应用程序，建议进行代码签名和公证：

1. 获取Apple开发者证书
2. 使用以下命令签名应用程序：

```bash
codesign --force --deep --sign "Developer ID Application: 您的开发者名称" dist/工作留痕.app
```

3. 使用以下命令公证应用程序：

```bash
xcrun altool --notarize-app --primary-bundle-id "com.akr.keylogger" --username "您的Apple ID" --password "您的密码" --file mac_dist/工作留痕安装包.dmg
```

## 常见问题

1. **问题**: 打包后应用程序无法监听键盘和鼠标事件  
   **解决**: 确保在系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能中授予应用程序权限

2. **问题**: 打包时找不到某些模块  
   **解决**: 在spec文件的hiddenimports列表中添加缺失的模块

3. **问题**: 图标未正确显示  
   **解决**: 确保.icns文件格式正确，如有问题可以使用专业图标编辑工具如Icon Composer创建

4. **问题**: 应用程序崩溃启动失败  
   **解决**: 检查Console.app中的应用程序日志，查找具体错误信息

## 测试

打包完成后，建议进行以下测试：

1. 在不同版本的macOS上测试应用程序
2. 测试键盘和鼠标监听功能
3. 测试数据存储和统计功能
4. 确认系统托盘图标正常显示

如有任何问题，请参阅PyInstaller文档或联系开发人员。 