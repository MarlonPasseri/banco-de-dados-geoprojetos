param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$Container = "contratos_db",
  [string]$User = "postgres",
  [string]$Database = "contratos"
)

if (-not (Test-Path $InputPath)) {
  throw "Arquivo nao encontrado: $InputPath"
}

$sql = Get-Content -Path $InputPath -Raw
$sql | docker exec -i $Container psql -U $User -d $Database
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao restaurar backup via docker exec."
}

Write-Host "Restore concluido a partir de $InputPath"
