"""Prepare a separate Kimeng Android project from the reviewed A-REIT Android source."""
from pathlib import Path
import re
import shutil
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
source = root / 'apps/android-client'
destination = Path(sys.argv[1]).resolve()
if destination.exists():
    raise SystemExit('Destination must be a new directory')
shutil.copytree(source, destination, ignore=shutil.ignore_patterns('build', '.gradle', 'pack', 'local.properties'))

def edit(relative, changes):
    path=destination/relative
    original=path.read_text(encoding='utf-8')
    for before, after in changes:
        if before not in original:
            raise RuntimeError(f'Expected source missing in {relative}: {before}')
        original=original.replace(before,after)
    path.write_text(original,encoding='utf-8',newline='\n')

edit('app/build.gradle',[("applicationId 'com.areit.app'","applicationId 'com.kimeng.app'"),
    ("versionCode 12","versionCode 3"),("versionName '1.1.9'","versionName '1.0.2'")])
edit('app/src/main/AndroidManifest.xml',[('android:label="A-REIT"','android:label="KIMENG"'),
    ('android:scheme="areit"','android:scheme="kimeng"')])
java='app/src/main/java/lat/rwa/trial/'
edit(java+'UrlPolicy.java',[
    ('https://a-reit.com','https://kimengresearch.com'),
    ('"a-reit.com".equalsIgnoreCase','"kimengresearch.com".equalsIgnoreCase'),
    ('"android-app", "areit"','"android-app", "kimeng"')])
edit(java+'MainActivity.java',[
    ('https://a-reit.com','https://kimengresearch.com'),
    ('"areit".equals(data.getScheme())','"kimeng".equals(data.getScheme())'),
    ('"退出 A-REIT？"','"退出金英？"'),('setTitle("A-REIT")','setTitle("KIMENG")'),
    ('"/A-REIT"','"/KIMENG"'),('"A-REIT");','"KIMENG");')])
edit(java+'AppPack.java',[('"a-reit.com".equalsIgnoreCase','"kimengresearch.com".equalsIgnoreCase')])
tests='app/src/test/java/lat/rwa/trial/'
for filename in ('UrlPolicyTest.java','AppPackTest.java'):
    path=destination/tests/filename
    data=path.read_text(encoding='utf-8').replace('api.a-reit.com','API_ORIGIN_SENTINEL')
    data=data.replace('A-REIT.COM','KIMENGRESEARCH.COM').replace('a-reit.com','kimengresearch.com').replace('areit://','kimeng://')
    path.write_text(data.replace('API_ORIGIN_SENTINEL','api.a-reit.com'),encoding='utf-8',newline='\n')
shutil.copyfile(root/'public/brand/kimeng/app-icon-512.png',destination/'app/src/main/res/drawable-nodpi/rwa_icon.png')

# Use the bare vector for the system splash. The launcher keeps its separate tile.
res = destination / 'app/src/main/res'
ns = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ns)

def element(parent, name, **attrs):
    values = {f'{{{ns}}}{key}': value for key, value in attrs.items()}
    return ET.Element(name, values) if parent is None else ET.SubElement(parent, name, values)

def drawable(name, node):
    ET.ElementTree(node).write(res / f'drawable/{name}.xml', encoding='utf-8', xml_declaration=True)

master = ET.parse(root / 'public/brand/kimeng/mark-light.svg').getroot()
_, _, width, height = master.attrib['viewBox'].split()
group, = list(master)
shift_x, shift_y, scale = re.fullmatch(r'translate\(([^,]+),([^)]+)\) scale\(([^)]+)\)', group.attrib['transform']).groups()
for theme, color in [('light', '#000000'), ('dark', '#FFFFFF')]:
    vector = element(None, 'vector', width='112dp', height='112dp', viewportWidth=width, viewportHeight=height)
    layout = element(vector, 'group', translateX=shift_x, translateY=shift_y, scaleX=scale, scaleY=scale)
    for path in group:
        x, y = re.fullmatch(r'translate\(([^,]+),([^)]+)\)', path.attrib['transform']).groups()
        translated = element(layout, 'group', translateX=x, translateY=y)
        element(translated, 'path', fillColor=color, pathData=path.attrib['d'])
    drawable(f'launch_mark_{theme}', vector)
    drawable(f'splash_icon_{theme}', element(None, 'inset', drawable=f'@drawable/launch_mark_{theme}', inset='30.56%'))
    edit(f'app/src/main/res/drawable/launch_window_{theme}.xml', [('@drawable/rwa_icon', f'@drawable/launch_mark_{theme}')])
    background = f'<item name="android:windowSplashScreenBackground">@color/launch_bg_{theme}</item>'
    edit('app/src/main/res/values-v31/styles.xml', [(background,
        f'{background}\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon_{theme}</item>')])

for folder, theme in [('values', 'light'), ('values-night', 'dark')]:
    edit(f'app/src/main/res/{folder}/colors.xml', [
        ('</resources>', f'    <item type="drawable" name="launch_mark">@drawable/launch_mark_{theme}</item>\n</resources>'),
    ])
edit('app/src/main/res/drawable/launch_window.xml', [('@drawable/rwa_icon', '@drawable/launch_mark')])
drawable('splash_icon', element(None, 'inset', drawable='@drawable/launch_mark', inset='30.56%'))
print('Prepared separate Kimeng Android project:',destination)
