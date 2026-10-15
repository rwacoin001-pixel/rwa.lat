# Creates the A-REIT Android release signing key once, without anyone typing or seeing the password.
#
# The folder gets an ACL for the current Windows account (and SYSTEM) only. It holds the PKCS12 key and a random
# password file; nothing is printed. BACK THE WHOLE FOLDER UP (external drive or encrypted cloud): every future update
# must be signed with this same key, and without it installed users can never be updated.
#
# Usage: .\New-ReleaseKey.ps1 -JavaHome D:\tools\jdk-21 -SigningDirectory G:\Archive\a-reit-android-signing
param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$SigningDirectory,
    [string]$KeyAlias = 'a-reit'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $SigningDirectory -Force | Out-Null
$root = (Resolve-Path -LiteralPath $SigningDirectory).Path
$keyPath = Join-Path $root 'a-reit-release.p12'
$passwordPath = Join-Path $root 'password.txt'
if (Test-Path -LiteralPath $keyPath) { throw "A release key already exists in $root. Never replace it: updates must keep the same key." }
if (Test-Path -LiteralPath $passwordPath) { throw "A password file exists without a key in $root; resolve this folder by hand first." }

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $root /inheritance:r /grant:r ('{0}:(OI)(CI)F' -f $identity) 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict the signing folder' }

$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B')
[System.IO.File]::WriteAllText($passwordPath, $password)
$env:AREIT_NEW_KEY_PASSWORD = $password
try {
    & (Join-Path $JavaHome 'bin\keytool.exe') -genkeypair -noprompt -keystore $keyPath -storetype PKCS12 -alias $KeyAlias `
        -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=A-REIT, O=A-REIT' `
        -storepass:env AREIT_NEW_KEY_PASSWORD -keypass:env AREIT_NEW_KEY_PASSWORD | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Release key generation failed' }
} finally {
    Remove-Item Env:\AREIT_NEW_KEY_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
}
[System.IO.File]::WriteAllText((Join-Path $root 'README.txt'), "A-REIT Android release signing key (alias '$KeyAlias'), created $(Get-Date -Format s).`r`nKeep this folder backed up. Every update of com.areit.app must be signed with this exact key.`r`nBuild: apps/android-client/Build-Release.ps1 -Keystore `"$keyPath`" -KeyAlias $KeyAlias -PasswordFile `"$passwordPath`"`r`n")
Write-Host "Release key created in $root (alias $KeyAlias). Back this folder up now."
