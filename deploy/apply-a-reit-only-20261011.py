"""Apply the approved new-domain-only release. Secrets never leave the server."""
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time

revision, stage_arg = sys.argv[1:3]
assert re.fullmatch(r'[0-9a-f]{40}', revision)
base = pathlib.Path('/opt/rwa-lat')
stage = pathlib.Path(stage_arg).resolve()
assert stage.is_relative_to(base / 'releases')
compose = base / 'deploy/compose.oracle.yml'
caddy = pathlib.Path('/etc/caddy/Caddyfile')
candidate = stage / 'deploy/Caddyfile.oracle'
assert candidate.is_file()
bot_compose = base / 'deploy/compose.community-bot.yml'
bot_env = base / 'community-bot/community-bot.env'
bot = json.loads(subprocess.check_output(['docker', 'inspect', 'community-bot']))[0]
assert bot['Config']['Image'] == 'rwa-lat-community-bot:local'
assert bot_compose.is_file() and bot_env.is_file()
tags = {
    'api': 'rwa-lat-api:a-reit-only-' + revision[:7],
    'admin': 'rwa-lat-admin:a-reit-only-' + revision[:7],
    'admin_frontend': 'rwa-lat-admin-frontend:a-reit-only-' + revision[:7],
}
old_tags = {
    'api': 'rwa-lat-api:a-reit-34ea63c',
    'admin': 'rwa-lat-admin:admin-ops-502-6eb42b2',
    'admin_frontend': 'rwa-lat-admin-frontend:admin-ops-502-6eb42b2',
}
images = {}
for service, tag in tags.items():
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', tag]))[0]
    assert image['Config']['Labels']['org.opencontainers.image.revision'] == revision
    images[service] = image['Id']
    live = json.loads(subprocess.check_output(['docker', 'inspect', 'rwa-lat-oracle-' + service + '-1']))[0]
    assert live['Config']['Image'] == old_tags[service], service + ' baseline drift'
subprocess.run(['caddy', 'validate', '--config', str(candidate), '--adapter', 'caddyfile'], check=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = base / 'backups' / ('a-reit-only-' + stamp)
backup.mkdir(mode=0o700)
names = ['api.production.env', 'admin.production.env', 'admin-frontend.production.env']
backup_paths = [*(base / 'config' / name for name in names), compose, caddy, bot_env]
for path in backup_paths:
    shutil.copy2(path, backup / path.name)
    os.chmod(backup / path.name, 0o600)

def entries(value):
    return dict(re.findall(r'^([A-Z][A-Z0-9_]*)=(.*)$', value, re.MULTILINE))

def write_atomic(path, value):
    stat = path.stat()
    temp = path.with_name(path.name + '.a-reit-only.tmp')
    temp.write_text(value)
    os.chmod(temp, stat.st_mode & 0o777)
    os.chown(temp, stat.st_uid, stat.st_gid)
    os.replace(temp, path)

def modify(name, changes, remove=()):
    path = bot_env if name == 'community-bot.env' else base / 'config' / name
    original = path.read_text()
    old = entries(original)
    output, seen = [], set()
    for line in original.splitlines():
        key = line.split('=', 1)[0] if '=' in line else ''
        if key in remove:
            continue
        if key in changes:
            if key not in seen:
                output.append(key + '=' + changes[key])
                seen.add(key)
        else:
            output.append(line)
    output.extend(key + '=' + value for key, value in changes.items() if key not in seen)
    value = '\n'.join(output) + '\n'
    updated = entries(value)
    assert all(updated[key] == previous for key, previous in old.items() if key not in changes and key not in remove)
    write_atomic(path, value)
    return changes

receipt = {'revision': revision, 'images': images, 'backup': str(backup), 'settings': {}}
services = ['api', 'admin', 'admin_frontend']
try:
    receipt['settings']['api'] = modify('api.production.env', {
        'PUBLIC_API_URL': 'https://api.a-reit.com',
        'PUBLIC_APP_URL': 'https://a-reit.com',
        'CORS_ORIGINS': 'https://a-reit.com,https://www.a-reit.com',
        'PASSKEY_RP_ID': 'a-reit.com',
        'PASSKEY_RP_NAME': 'A-REIT',
        'PASSKEY_ORIGIN': 'https://a-reit.com',
        'GOOGLE_OAUTH_REDIRECT_URI': 'https://a-reit.com/auth/callback/google',
        'GITHUB_OAUTH_REDIRECT_URI': 'https://a-reit.com/auth/callback/github',
        'X_OAUTH_ENABLED': 'false',
        'X_OAUTH_REDIRECT_URI': 'https://a-reit.com/auth/callback/x',
        'DIDIT_CALLBACK_URL': 'https://a-reit.com/profile/kyc?status=complete',
        'EMAIL_FROM': 'no-reply@a-reit.com',
        'EMAIL_FROM_NAME': 'A-REIT',
    })
    receipt['settings']['admin'] = modify('admin.production.env', {
        'PUBLIC_ADMIN_API_URL': 'https://admin-api.a-reit.com',
        'ADMIN_CORS_ORIGINS': 'https://admin.a-reit.com',
        'EMAIL_FROM': 'no-reply@a-reit.com',
        'EMAIL_FROM_NAME': 'A-REIT',
    })
    modify('admin-frontend.production.env', {}, remove=('PUBLIC_ADMIN_FRONTEND_ORIGIN',))
    text = compose.read_text()
    for service, old in old_tags.items():
        line = '    image: ' + old
        assert text.count(line) == 1
        text = text.replace(line, '    image: ' + tags[service])
    assert 'command: ["node", "apps/api/dist/main.js"]' in text or 'command: [node, apps/api/dist/main.js]' in text
    write_atomic(compose, text)
    subprocess.run(['docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', *services], check=True)
    deadline = time.monotonic() + 150
    while True:
        states = [json.loads(subprocess.check_output(['docker', 'inspect', 'rwa-lat-oracle-' + service + '-1']))[0]['State'] for service in services]
        if all(state.get('Health', {}).get('Status') == 'healthy' for state in states):
            break
        assert all(state.get('Running') for state in states), 'container stopped'
        assert time.monotonic() < deadline, 'readiness deadline exceeded'
        time.sleep(3)
    write_atomic(caddy, candidate.read_text())
    subprocess.run(['systemctl', 'reload', 'caddy'], check=True)
    receipt['settings']['community-bot'] = modify('community-bot.env', {'COMMUNITY_API': 'https://api.a-reit.com'})
    subprocess.run(['docker', 'compose', '-f', str(bot_compose), 'up', '-d', '--no-deps', 'community-bot'], check=True)
    bot_after = json.loads(subprocess.check_output(['docker', 'inspect', 'community-bot']))[0]
    assert bot_after['State']['Running'] and bot_after['Image'] == bot['Image']
    assert bot_after.get('Mounts', []) == bot.get('Mounts', [])
    assert 'COMMUNITY_API=https://api.a-reit.com' in bot_after['Config']['Env']
except Exception:
    for path in backup_paths:
        write_atomic(path, (backup / path.name).read_text())
    subprocess.run(['docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', *services], check=True)
    subprocess.run(['systemctl', 'reload', 'caddy'], check=True)
    subprocess.run(['docker', 'compose', '-f', str(bot_compose), 'up', '-d', '--no-deps', 'community-bot'], check=True)
    raise

proof = backup / 'a-reit-only-receipt.json'
proof.write_text(json.dumps(receipt, indent=2) + '\n')
os.chmod(proof, 0o600)
print(json.dumps(receipt, indent=2))
