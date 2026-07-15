[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$EnvFile,

  [ValidateSet('Locked', 'Live')]
  [string]$Mode = 'Locked',

  [string]$ImageTag = (Get-Date -Format 'yyyyMMddHHmmss'),

  [switch]$ApproveLiveFunds,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedEnv = (Resolve-Path -LiteralPath $EnvFile).Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is required on the deployment host.'
}
docker compose version | Out-Null

function Read-EnvFlags([string]$Path) {
  $result = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $parts = $line -split '=', 2
    $result[$parts[0].Trim()] = $parts[1].Trim()
  }
  return $result
}

function Wait-HttpReady([string]$Url, [int]$Attempts = 12) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 $Url | Out-Null
      return
    } catch {
      if ($attempt -eq $Attempts) { throw }
      Start-Sleep -Seconds 5
    }
  }
}

$flags = Read-EnvFlags $resolvedEnv
if ($Mode -eq 'Locked') {
  if ($flags['PRODUCTION_FINANCIAL_FEATURES_ENABLED'] -ne 'false' -or
      $flags['WALLET_EXECUTION_ENABLED'] -ne 'false' -or
      $flags['WALLET_EXECUTION_WORKER_ENABLED'] -ne 'false') {
    throw 'Locked release requires financial features, wallet execution, and its worker to all be false.'
  }
} else {
  if (-not $ApproveLiveFunds) {
    throw 'Live release requires the explicit -ApproveLiveFunds switch.'
  }
  if ($flags['PRODUCTION_FINANCIAL_FEATURES_ENABLED'] -ne 'true' -or
      $flags['WALLET_EXECUTION_ENABLED'] -ne 'true' -or
      $flags['WALLET_EXECUTION_WORKER_ENABLED'] -ne 'true') {
    throw 'Live release requires financial features, wallet execution, and its leased worker to all be true.'
  }
  if ([string]::IsNullOrWhiteSpace($flags['FINANCIAL_RELEASE_CHANGE_ID'])) {
    throw 'Live release requires a non-secret FINANCIAL_RELEASE_CHANGE_ID for the audited change record.'
  }
}
if ($flags['POLYMARKET_TRADING_ENABLED'] -ne 'false') {
  throw 'POLYMARKET_TRADING_ENABLED must remain false until signed trading approval is complete.'
}

$env:RWA_ENV_FILE = $resolvedEnv
$env:IMAGE_TAG = $ImageTag
$env:COMPOSE_PARALLEL_LIMIT = '1'
$compose = Join-Path $PSScriptRoot 'compose.production.yml'
$composeArgs = @('compose', '--env-file', $resolvedEnv, '-f', $compose)

Push-Location $repoRoot
try {
  & docker @composeArgs config --quiet
  if (-not $SkipBuild) {
    & docker @composeArgs build api
    & docker @composeArgs build admin
  }

  & docker @composeArgs run --rm --no-deps api node -e "require('./apps/api/dist/config/production-environment.js').validateEnvironment(process.env)"
  & docker @composeArgs run --rm --no-deps api node -e "require('./apps/api/dist/config/production-runtime-capabilities.js').validateProductionRuntimeCapabilities(process.env)"
  & docker @composeArgs run --rm --no-deps admin node -e "require('./apps/admin/dist/production-environment.js').validateAdminEnvironment(process.env)"

  & docker @composeArgs --profile release run --rm migrate
  & docker @composeArgs up -d --no-build api admin

  $apiPort = if ([string]::IsNullOrWhiteSpace($flags['API_HOST_PORT'])) { '4000' } else { $flags['API_HOST_PORT'] }
  $adminPort = if ([string]::IsNullOrWhiteSpace($flags['ADMIN_HOST_PORT'])) { '4100' } else { $flags['ADMIN_HOST_PORT'] }
  Wait-HttpReady "http://127.0.0.1:$apiPort/v1/health/ready"
  Wait-HttpReady "http://127.0.0.1:$adminPort/v1/admin/health"

  if ($Mode -eq 'Live') {
    Write-Output "Live-capable release deployed with image tag $ImageTag; withdrawal execution remains database-paused until a two-admin resume is approved."
  } else {
    Write-Output "Production release completed in Locked mode with image tag $ImageTag."
  }
} finally {
  Pop-Location
}
