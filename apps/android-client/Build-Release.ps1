# Release build of the A-REIT Android client (com.areit.app), signed with YOUR long-term release key.
#
# The key is yours to create and keep; this script never creates, copies or stores it, and the password is read
# from the console into this process only. Lose the key and installed users can no longer receive updates.
# One-time key creation (run yourself, keep the .p12 and its password safe and backed up):
#   & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore D:\path\a-reit-release.p12 -storetype PKCS12 `
#       -alias a-reit -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=A-REIT"
#
# Usage:
#   .\Build-Release.ps1 -JavaHome E:\rwa-android-build\jdk -AndroidSdk E:\rwa-android-build\sdk `
#       -OutputDirectory E:\rwa-android-build\release -Keystore D:\path\a-reit-release.p12 -KeyAlias a-reit
# Output: a-reit-android-<version>.apk plus its SHA-256, for public/download/ and lib/android-app.ts.
param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$Keystore,
    [Parameter(Mandatory=$true)][string]$KeyAlias,
    [string]$GradleCacheDirectory = (Join-Path $OutputDirectory 'gradle-cache')
)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path
$env:ANDROID_HOME = (Resolve-Path -LiteralPath $AndroidSdk).Path
$env:GRADLE_USER_HOME = $GradleCacheDirectory
$keyPath = (Resolve-Path -LiteralPath $Keystore).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$version = (Select-String -LiteralPath (Join-Path $projectDirectory 'app\build.gradle') -Pattern "versionName '([^']+)'").Matches[0].Groups[1].Value
if (-not $version) { throw 'versionName not found in app\build.gradle' }

$secure = Read-Host -AsSecureString "Password for $KeyAlias in $keyPath"
$env:AREIT_RELEASE_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
try {
    Push-Location -LiteralPath $projectDirectory
    try {
        & '.\gradlew.bat' testReleaseUnitTest lintRelease assembleRelease --no-daemon --console plain
        if ($LASTEXITCODE -ne 0) { throw 'Android verification/build failed' }
    } finally { Pop-Location }
    $buildTools = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'
    $unsignedApk = Join-Path $projectDirectory 'app\build\outputs\apk\release\app-release-unsigned.apk'
    $alignedApk = Join-Path $OutputDirectory 'a-reit-android-aligned.apk'
    $signedApk = Join-Path $OutputDirectory "a-reit-android-$version.apk"
    & (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsignedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed' }
    & (Join-Path $buildTools 'apksigner.bat') sign --ks $keyPath --ks-key-alias $KeyAlias --ks-pass env:AREIT_RELEASE_KEY_PASSWORD --key-pass env:AREIT_RELEASE_KEY_PASSWORD --out $signedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
    Remove-Item -LiteralPath $alignedApk -Force
    & (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $signedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
    $hash = (Get-FileHash -LiteralPath $signedApk -Algorithm SHA256).Hash.ToLowerInvariant()
    $size = (Get-Item -LiteralPath $signedApk).Length
    Write-Host ''
    Write-Host "APK:     $signedApk"
    Write-Host "Version: $version"
    Write-Host "Size:    $size bytes"
    Write-Host "SHA-256: $hash"
    Write-Host ''
    Write-Host "Next: copy the APK to public/download/ and set lib/android-app.ts to"
    Write-Host "  { url: '/download/a-reit-android-$version.apk', version: '$version', sha256: '$hash' }"
} finally { Remove-Item Env:\AREIT_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue }
