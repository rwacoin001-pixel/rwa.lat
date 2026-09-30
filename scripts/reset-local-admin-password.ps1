param([string]$Email = '')
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if ($taskRoot -ne 'D:\rwa-lat') { throw 'This helper is only for the local D:\rwa-lat checkout.' }
$taskPassword = Read-Host 'New local administrator password (12 or more characters)' -AsSecureString
$taskConfirm = Read-Host 'Confirm the new password' -AsSecureString
$taskPasswordPtr = [IntPtr]::Zero
$taskConfirmPtr = [IntPtr]::Zero
try {
  $taskPasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPassword)
  $taskConfirmPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskConfirm)
  $taskPasswordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPasswordPtr)
  $taskConfirmText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskConfirmPtr)
  if ($taskPasswordText.Length -lt 12 -or $taskPasswordText.Length -gt 512) { throw 'Use 12 to 512 characters.' }
  if ($taskPasswordText -cne $taskConfirmText) { throw 'Passwords do not match.' }
  $taskStart = New-Object System.Diagnostics.ProcessStartInfo
  $taskStart.FileName = (Get-Command node -ErrorAction Stop).Source
  $taskStart.Arguments = '"' + (Join-Path $PSScriptRoot 'reset-local-admin-password.mjs') + '"'
  $taskStart.WorkingDirectory = $taskRoot
  $taskStart.UseShellExecute = $false
  $taskStart.CreateNoWindow = $true
  $taskStart.RedirectStandardInput = $true
  $taskStart.RedirectStandardOutput = $true
  $taskStart.RedirectStandardError = $true
  $taskProcess = [System.Diagnostics.Process]::Start($taskStart)
  $taskPayload = @{email=$Email;password=$taskPasswordText} | ConvertTo-Json -Compress
  $taskProcess.StandardInput.Write($taskPayload)
  $taskProcess.StandardInput.Close()
  $taskOutput = $taskProcess.StandardOutput.ReadToEnd()
  $taskError = $taskProcess.StandardError.ReadToEnd()
  $taskProcess.WaitForExit()
  if ($taskProcess.ExitCode -ne 0) { throw ('Local recovery failed. ' + $taskError) }
  Write-Host $taskOutput
} finally {
  if ($taskPasswordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPasswordPtr) }
  if ($taskConfirmPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskConfirmPtr) }
  $taskPasswordText = $null; $taskConfirmText = $null; $taskPayload = $null
  $taskPassword.Dispose(); $taskConfirm.Dispose()
}
