param(
  [ValidateSet('dev','prod')]
  [string]$Mode = 'dev',

  [int]$BackendPort = 9998,
  [int]$FrontendPort = 9999,

  [bool]$SinglePort = $true,

  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$NoBackend,
  [switch]$NoFrontend,
  [switch]$ForceKillPorts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-RepoRoot() {
  $root = Resolve-Path (Join-Path $PSScriptRoot '..')
  return $root.Path
}

function Get-NpmPath() {
  $cmd = Get-Command npm -ErrorAction Stop
  return $cmd.Source
}

function Invoke-Npm(
  [string]$WorkingDirectory,
  [string[]]$NpmArgs
) {
  $npm = Get-NpmPath
  Push-Location $WorkingDirectory
  try {
    & $npm @NpmArgs
  } finally {
    Pop-Location
  }
}

function Get-ListeningPidsOnPort([int]$Port) {
  $lines = & netstat -ano -p tcp 2>$null
  $processIds = New-Object System.Collections.Generic.List[int]

  foreach ($line in $lines) {
    if ($line -notmatch 'LISTENING') { continue }

    # Example: " TCP    0.0.0.0:9998     0.0.0.0:0      LISTENING       1234"
    # Example: " TCP    [::]:9998        [::]:0         LISTENING       1234"
    if ($line -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
      $localPort = [int]$Matches[1]
      $processId = [int]$Matches[2]
      if ($localPort -eq $Port -and $processId -gt 0) { [void]$processIds.Add($processId) }
    }
  }

  return ($processIds | Sort-Object -Unique)
}

function Stop-ProcessListeningOnPort([int]$Port) {
  foreach ($processId in @(Get-ListeningPidsOnPort -Port $Port)) {
    try { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue } catch {}
  }
}

function Assert-PortFree([int]$Port, [string]$Name) {
  $processIds = @(Get-ListeningPidsOnPort -Port $Port)
  if ($processIds.Length -gt 0) {
    $pidList = ($processIds | Sort-Object -Unique) -join ', '
    throw ("{0} port {1} is already in use (PID(s): {2}). Use -ForceKillPorts to stop them or choose another port." -f $Name, $Port, $pidList)
  }
}

$repoRoot = Get-RepoRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$backendDir = Join-Path $repoRoot 'backend-node'

# If called with no explicit args (ex: Task Scheduler), prefer single-port production mode
# when build output exists. This keeps the UI+API on port 9999 without needing task args.
if ($PSBoundParameters.Count -eq 0) {
  $staticIndex = Join-Path $backendDir 'static\\index.html'
  if (Test-Path $staticIndex) {
    $Mode = 'prod'
    $SinglePort = $true
    $SkipInstall = $true
    $SkipBuild = $true
    $FrontendPort = 9999
  }
}

if (-not (Test-Path $frontendDir)) { throw "Frontend directory not found: $frontendDir" }
if (-not (Test-Path $backendDir)) { throw "Backend directory not found: $backendDir" }

if (-not $SkipInstall) {
  if (-not $NoFrontend) {
    Write-Host "[PocketCodex] Installing frontend..." -ForegroundColor Cyan
    Invoke-Npm -WorkingDirectory $frontendDir -NpmArgs @('install')
  }
  if (-not $NoBackend) {
    Write-Host "[PocketCodex] Installing backend..." -ForegroundColor Cyan
    Invoke-Npm -WorkingDirectory $backendDir -NpmArgs @('install')
  }
}

if ($NoBackend -and $NoFrontend) {
  throw "Nothing to start: both -NoBackend and -NoFrontend were set."
}

if ($Mode -eq 'prod' -and $SinglePort) {
  $BackendPort = $FrontendPort
  $NoFrontend = $true
}

if ($ForceKillPorts) {
  if (-not $NoBackend) { Stop-ProcessListeningOnPort -Port $BackendPort }
  if (-not $NoFrontend) { Stop-ProcessListeningOnPort -Port $FrontendPort }
}

$startBackend = -not $NoBackend
$startFrontend = -not $NoFrontend

if ($startBackend) {
  $backendInUse = @(
    Get-ListeningPidsOnPort -Port $BackendPort
  )
  if ($backendInUse.Length -gt 0) {
    Write-Host ("[PocketCodex] Backend port {0} already in use (PID(s): {1}); assuming backend is already running." -f $BackendPort, (($backendInUse | Sort-Object -Unique) -join ', ')) -ForegroundColor Yellow
    $startBackend = $false
  }
}

if ($startFrontend) {
  $frontendInUse = @(
    Get-ListeningPidsOnPort -Port $FrontendPort
  )
  if ($frontendInUse.Length -gt 0) {
    Write-Host ("[PocketCodex] Frontend port {0} already in use (PID(s): {1}); assuming frontend is already running." -f $FrontendPort, (($frontendInUse | Sort-Object -Unique) -join ', ')) -ForegroundColor Yellow
    $startFrontend = $false
  }
}

if ($Mode -eq 'prod' -and -not $SkipBuild) {
  if (-not $NoFrontend) {
    Write-Host "[PocketCodex] Building frontend..." -ForegroundColor Cyan
    Invoke-Npm -WorkingDirectory $frontendDir -NpmArgs @('run','build')
  }
  if (-not $NoBackend) {
    Write-Host "[PocketCodex] Building backend..." -ForegroundColor Cyan
    Invoke-Npm -WorkingDirectory $backendDir -NpmArgs @('run','build')
  }
}

$backendProc = $null
try {
  if ($startBackend) {
    Write-Host ("[PocketCodex] Starting backend ({0}) on port {1}..." -f $Mode, $BackendPort) -ForegroundColor Green
    $env:PORT = [string]$BackendPort

    $backendArgs =
      if ($Mode -eq 'prod') { @('start') }
      else { @('run','dev') }

    if ($startFrontend) {
      $npm = Get-NpmPath
      $backendProc = Start-Process -FilePath $npm -ArgumentList $backendArgs -WorkingDirectory $backendDir -PassThru
    } else {
      Invoke-Npm -WorkingDirectory $backendDir -NpmArgs $backendArgs
    }
  }

  if ($startFrontend) {
    if ($Mode -eq 'prod') {
      Write-Host ("[PocketCodex] Starting frontend preview on port {0}..." -f $FrontendPort) -ForegroundColor Green
      Invoke-Npm -WorkingDirectory $frontendDir -NpmArgs @('run','preview','--','--host','--port',"$FrontendPort")
    } else {
      Write-Host ("[PocketCodex] Starting frontend dev server on port {0}..." -f $FrontendPort) -ForegroundColor Green
      Invoke-Npm -WorkingDirectory $frontendDir -NpmArgs @('run','dev','--','--host','--port',"$FrontendPort")
    }
  }

  if (-not $startFrontend) {
    Write-Host "[PocketCodex] Frontend not started." -ForegroundColor Yellow
  }
  if (-not $startBackend) {
    Write-Host "[PocketCodex] Backend not started." -ForegroundColor Yellow
  }
}
finally {
  if ($backendProc -and -not $backendProc.HasExited) {
    try { Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue } catch {}
  }
}
