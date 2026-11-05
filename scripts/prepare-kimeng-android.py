"""Prepare a separate Kimeng Android project from the reviewed A-REIT Android source."""
from pathlib import Path
import shutil
import sys

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
    ("versionCode 12","versionCode 1"),("versionName '1.1.9'","versionName '1.0.0'")])
edit('app/src/main/AndroidManifest.xml',[('android:label="A-REIT"','android:label="金英 KIMENG"'),
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
edit(java+'AppPack.java',[('"a-reit.com".equalsIgnoreCase','"kimengresearch.com".equalsIgnoreCase'),
    ('brand/a-reit','brand/(?:a-reit|kimeng)')])
tests='app/src/test/java/lat/rwa/trial/'
for filename in ('UrlPolicyTest.java','AppPackTest.java'):
    path=destination/tests/filename
    data=path.read_text(encoding='utf-8').replace('api.a-reit.com','API_ORIGIN_SENTINEL')
    data=data.replace('A-REIT.COM','KIMENGRESEARCH.COM').replace('a-reit.com','kimengresearch.com').replace('areit://','kimeng://')
    path.write_text(data.replace('API_ORIGIN_SENTINEL','api.a-reit.com'),encoding='utf-8',newline='\n')
shutil.copyfile(root/'public/brand/kimeng/app-icon-512.png',destination/'app/src/main/res/drawable-nodpi/rwa_icon.png')
print('Prepared separate Kimeng Android project:',destination)
