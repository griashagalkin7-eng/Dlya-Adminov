param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference = 'Stop'
# This check is intentionally limited to the disposable Windows CI account.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
  throw 'Installer checks must only run on the disposable Windows CI runner.'
}
$installDir = Join-Path $env:RUNNER_TEMP 'DlyaAdminov-install-check'
$dataDir = Join-Path $env:APPDATA 'Dlya Adminov'
$dataFile = Join-Path $dataDir 'ledger.json'
if (Test-Path $dataFile) { throw 'Refusing to overwrite an existing ledger.' }
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot '../test/fixtures/ledger-v1.json') $dataFile
$expectedHash = (Get-FileHash $dataFile -Algorithm SHA256).Hash
function Assert-Ledger {
  if (!(Test-Path $dataFile) -or (Get-FileHash $dataFile -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'Installation changed or deleted the ledger from v1.'
  }
}
function Install-App {
  $process = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer returned $($process.ExitCode)" }
  if (!(Test-Path (Join-Path $installDir 'Dlya Adminov.exe'))) { throw 'Installed executable was not found.' }
  Assert-Ledger
}
Install-App
# Reinstall over the existing app, as with a normal update.
Install-App
$uninstaller = Join-Path $installDir 'Uninstall Dlya Adminov.exe'
$process = Start-Process -FilePath $uninstaller -ArgumentList @('/S', "_?=$installDir") -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Uninstaller returned $($process.ExitCode)" }
Assert-Ledger
if (Test-Path (Join-Path $installDir 'Dlya Adminov.exe')) { throw 'Uninstallation did not remove the executable.' }
Install-App
Write-Host 'Installer passed: update, uninstall and reinstall preserved the v1 ledger byte for byte.'
