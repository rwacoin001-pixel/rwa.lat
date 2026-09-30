$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
& python (Join-Path $PSScriptRoot 'with-local-mfa-vault.py') --rebind
Write-Host ''
Read-Host 'Press Enter to close this window' | Out-Null
