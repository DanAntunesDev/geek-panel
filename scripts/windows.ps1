# Roda o painel no Windows sem precisar do VS Code.
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File scripts\windows.ps1            # instala o que falta e abre o app
#   powershell -ExecutionPolicy Bypass -File scripts\windows.ps1 -Installer # gera o instalador em release\
param([switch]$Installer)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Falta o Node.js (versão 20 ou mais nova): https://nodejs.org" -ForegroundColor Yellow
  exit 1
}
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
  Write-Host "Instalando o Yarn..."
  npm install --global yarn
}

yarn install --frozen-lockfile

if ($Installer) {
  yarn dist:win
  Write-Host "Pronto: instalador e versão portátil em release\" -ForegroundColor Green
} else {
  yarn start
}
