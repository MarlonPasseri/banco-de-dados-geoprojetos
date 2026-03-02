param(
  [string]$OutputPath = "",
  [string]$Container = "contratos_db",
  [string]$User = "postgres",
  [string]$Database = "contratos"
)

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputPath = "backups/contratos_$stamp.sql"
}

$dir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($dir) -and -not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

$dump = docker exec $Container pg_dump -U $User -d $Database --clean --if-exists --no-owner --no-privileges
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao gerar backup via docker exec."
}

$targetPath = $OutputPath
if (-not [System.IO.Path]::IsPathRooted($targetPath)) {
  $targetPath = Join-Path (Get-Location) $targetPath
}

[System.IO.File]::WriteAllText($targetPath, ($dump -join [Environment]::NewLine))
Write-Host "Backup salvo em $OutputPath"
