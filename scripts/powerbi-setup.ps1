param(
  [string]$BiUser = "powerbi_reader",
  [string]$BiPassword = "",
  [string]$Container = "contratos_db",
  [string]$User = "postgres",
  [string]$Database = "contratos"
)

$sqlPath = Join-Path $PSScriptRoot "sql/powerbi_setup.sql"
if (-not (Test-Path $sqlPath)) {
  throw "Arquivo SQL nao encontrado: $sqlPath"
}

$sql = Get-Content -Path $sqlPath -Raw
$dockerArgs = @("exec", "-i", $Container, "psql", "-v", "ON_ERROR_STOP=1")

if (-not [string]::IsNullOrWhiteSpace($BiPassword)) {
  $dockerArgs += @("-v", "bi_user=$BiUser", "-v", "bi_password=$BiPassword")
}

$dockerArgs += @("-U", $User, "-d", $Database)
$sql | & docker @dockerArgs

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao aplicar a camada de BI no Postgres."
}

Write-Host "Views de BI atualizadas no banco $Database."
if (-not [string]::IsNullOrWhiteSpace($BiPassword)) {
  Write-Host "Usuario readonly '$BiUser' criado/atualizado."
} else {
  Write-Host "Usuario readonly nao foi criado porque nenhuma senha foi informada."
}
