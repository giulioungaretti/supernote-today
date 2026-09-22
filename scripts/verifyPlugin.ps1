param(
    [string]$PackagePath = "build\outputs\SupernoteToday.snplg"
)
$ErrorActionPreference = "Stop"
$package = (Resolve-Path -LiteralPath $PackagePath).Path
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$verification = Join-Path $root ("build\verify-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verification | Out-Null
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($package, $verification)
    & (Join-Path $root "node_modules\.bin\tsx.cmd") (Join-Path $PSScriptRoot "verifyPackage.ts") $verification
    if ($LASTEXITCODE -ne 0) {
        throw "Plugin package verification failed"
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($package)
    try {
        [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "") |
            Set-Content -LiteralPath "$package.sha256"
    } finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
} finally {
    Remove-Item -LiteralPath $verification -Recurse -Force
}
