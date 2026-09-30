"""Use protected local MFA configuration without printing or copying its values.

Only the three MFA configuration variables are imported. Database URLs, account
credentials and other production credentials in the vault are never imported.
"""
import base64
import os
from pathlib import Path
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
MODES = {
    '--check': ['scripts/rebind-local-admin-mfa.mjs', '--check'],
    '--self-test': ['scripts/rebind-local-admin-mfa.mjs', '--self-test'],
    '--auth-check': ['scripts/check-local-admin-auth.mjs', '--mfa-check'],
    '--rebind': ['scripts/rebind-local-admin-mfa.mjs'],
    '--runtime-check': ['scripts/local-ops-runtime.mjs', '--check'],
    '--runtime': ['scripts/local-ops-runtime.mjs'],
}

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in MODES:
        print('Choose --check, --self-test, --auth-check, --rebind, --runtime-check or --runtime.')
        return 1
    loader = Path(os.environ['USERPROFILE']) / 'Desktop' / 'rwa' / 'load-rwa-secrets.py'
    values = runpy.run_path(str(loader))['load']()
    env = os.environ.copy()
    for key in ('ADMIN_MFA_ENCRYPTION_KEY', 'ADMIN_MFA_KEYS_JSON', 'ADMIN_MFA_ACTIVE_KEY_VERSION'):
        env.pop(key, None)
        if values.get(key):
            env[key] = values[key]
    # An existing protected key is required. Never replace the vault or generate
    # an unpersisted encryption key that would break the next restart.
    legacy = env.get('ADMIN_MFA_ENCRYPTION_KEY')
    if not env.get('ADMIN_MFA_KEYS_JSON') and (not legacy or len(base64.b64decode(legacy, validate=True)) != 32):
        raise ValueError('Protected MFA configuration unavailable')
    result = subprocess.call(['node', *MODES[sys.argv[1]]], cwd=str(ROOT), env=env)
    if sys.argv[1] == '--rebind' and sys.stdin.isatty():
        input('Press Enter to close this window.')
    return result

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('Protected local MFA configuration could not be loaded. No secret values printed.')
        sys.exit(1)
