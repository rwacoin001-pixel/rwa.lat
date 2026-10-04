param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$SigningDirectory,
    [string]$GradleCacheDirectory = (Join-Path $OutputDirectory 'gradle-cache')
)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path
$env:ANDROID_HOME = (Resolve-Path -LiteralPath $AndroidSdk).Path
$env:GRADLE_USER_HOME = $GradleCacheDirectory
New-Item -ItemType Directory -Path $OutputDirectory,$SigningDirectory -Force | Out-Null
$signingRoot = (Resolve-Path -LiteralPath $SigningDirectory).Path
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $signingRoot /inheritance:r /grant:r ('{0}:(OI)(CI)F' -f $currentIdentity) 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict local signing directory access' }
$keyPath = Join-Path $signingRoot 'rwa-lat-trial.p12'
$passwordPath = Join-Path $signingRoot 'password.txt'
if (!(Test-Path -LiteralPath $keyPath)) {
    if (Test-Path -LiteralPath $passwordPath) { throw 'Existing password without a keystore; resolve the signing directory first' }
    $passwordBytes = New-Object byte[] 32
    $randomSource = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomSource.GetBytes($passwordBytes)
    $randomSource.Dispose()
    [System.IO.File]::WriteAllText($passwordPath, [Convert]::ToBase64String($passwordBytes))
    $env:RWA_TRIAL_KEYSTORE_PASSWORD = [System.IO.File]::ReadAllText($passwordPath)
    & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -noprompt -keystore $keyPath -storetype PKCS12 -alias rwa-trial -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=RWA.LAT Local Trial, OU=Trial, O=RWA.LAT, C=SG' -storepass:env RWA_TRIAL_KEYSTORE_PASSWORD -keypass:env RWA_TRIAL_KEYSTORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Local trial signing key generation failed' }
}
try {
    $env:RWA_TRIAL_KEYSTORE_PASSWORD = [System.IO.File]::ReadAllText($passwordPath)
    Push-Location -LiteralPath $projectDirectory
    try {
        & '.\gradlew.bat' testReleaseUnitTest lintRelease assembleRelease --no-daemon --console plain
        if ($LASTEXITCODE -ne 0) { throw 'Android verification/build failed' }
    } finally { Pop-Location }
    $buildTools = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'
    $unsignedApk = Join-Path $projectDirectory 'app\build\outputs\apk\release\app-release-unsigned.apk'
    $alignedApk = Join-Path $OutputDirectory 'rwa-lat-trial-aligned.apk'
    $signedApk = Join-Path $OutputDirectory 'rwa-lat-0.1.0-trial.apk'
    & (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsignedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed' }
    & (Join-Path $buildTools 'apksigner.bat') sign --ks $keyPath --ks-key-alias rwa-trial --ks-pass env:RWA_TRIAL_KEYSTORE_PASSWORD --key-pass env:RWA_TRIAL_KEYSTORE_PASSWORD --out $signedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
    & (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $signedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
    & (Join-Path $buildTools 'zipalign.exe') -c -p 4 $signedApk
    if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed' }
    Get-FileHash -LiteralPath $signedApk -Algorithm SHA256
} finally { Remove-Item Env:\RWA_TRIAL_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue }
