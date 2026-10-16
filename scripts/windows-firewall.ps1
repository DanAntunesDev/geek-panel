# Libera (ou remove) as portas que o painel usa para falar com o aparelho, só em redes privadas.
# Precisa de um PowerShell aberto como administrador.
#   powershell -ExecutionPolicy Bypass -File scripts\windows-firewall.ps1           # libera
#   powershell -ExecutionPolicy Bypass -File scripts\windows-firewall.ps1 -Remove   # remove
param([switch]$Remove)

$ErrorActionPreference = "Stop"
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host "Abra o PowerShell como administrador e rode de novo." -ForegroundColor Yellow
  exit 1
}

$rules = @(
  @{ Name = "Geek Panel (TCP 4601)"; Protocol = "TCP"; Port = 4601 },
  @{ Name = "Geek Panel (UDP 4602)"; Protocol = "UDP"; Port = 4602 }
)

foreach ($rule in $rules) {
  Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  if (-not $Remove) {
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol $rule.Protocol -LocalPort $rule.Port -Profile Private | Out-Null
  }
}

if ($Remove) { Write-Host "Regras removidas." -ForegroundColor Green }
else { Write-Host "Portas 4601 (TCP) e 4602 (UDP) liberadas para redes privadas." -ForegroundColor Green }
