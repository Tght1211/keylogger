# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('static', 'static'),
        ('templates', 'templates'),
    ],
    hiddenimports=[
        'pystray._darwin',  # Mac版本的pystray后端
        'PIL._tkinter_finder',
        'pandas._libs.tslibs.base', 
        'pandas._libs.tslibs.timedeltas',
        'pandas._libs.tslibs.np_datetime', 
        'pandas._libs.tslibs.nattype',
        'pandas._libs.tslibs.timestamps',
        'flask',
        'plotly',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='工作留痕',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='static/img/工作留痕.icns',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='工作留痕',
)

app = BUNDLE(
    coll,
    name='工作留痕.app',
    icon='static/img/工作留痕.icns',
    bundle_identifier='com.akr.keylogger',
    info_plist={
        'NSPrincipalClass': 'NSApplication',
        'NSAppleScriptEnabled': False,
        'CFBundleDisplayName': '工作留痕',
        'CFBundleName': '工作留痕',
        'CFBundleExecutable': '工作留痕',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
        'LSUIElement': True,  # 让应用程序在Dock中隐藏
        'NSHighResolutionCapable': True,
    }
) 