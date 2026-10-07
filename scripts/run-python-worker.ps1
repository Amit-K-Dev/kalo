param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "deploy")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$configSource = Join-Path $projectRoot "wrangler-python.jsonc"
$temporaryConfig = Join-Path $projectRoot "wrangler.jsonc"
$createdConfig = $false
$exitCode = 1

if (Test-Path -LiteralPath $temporaryConfig) {
    throw "A wrangler.jsonc already exists. Move it aside before using this helper."
}

Push-Location $projectRoot
try {
    Copy-Item -LiteralPath $configSource -Destination $temporaryConfig
    $createdConfig = $true
    uv run pywrangler $Action
    $exitCode = $LASTEXITCODE
}
finally {
    if ($createdConfig -and (Test-Path -LiteralPath $temporaryConfig)) {
        Remove-Item -LiteralPath $temporaryConfig
    }
    Pop-Location
}

exit $exitCode
