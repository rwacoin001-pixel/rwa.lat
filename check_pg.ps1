Get-Service -Name *postgres* 2>$null
Get-Service -Name *postgresql* 2>$null
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
Get-Process postgres* 2>$null