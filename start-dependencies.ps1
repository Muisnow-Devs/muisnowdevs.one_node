# Development dependencies are managed by Compose. Existing container data is not deleted.
$ErrorActionPreference = "Stop"
docker compose -f (Join-Path $PSScriptRoot 'compose.yaml') up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
