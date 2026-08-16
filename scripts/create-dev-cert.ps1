param(
  [switch]$Trust
)

$ErrorActionPreference = 'Stop'

$openssl = (Get-Command openssl -ErrorAction SilentlyContinue).Source
if (-not $openssl) {
  $gitOpenSsl = 'C:\Program Files\Git\usr\bin\openssl.exe'
  if (Test-Path -LiteralPath $gitOpenSsl) {
    $openssl = $gitOpenSsl
  } else {
    throw 'OpenSSL est introuvable. Installez OpenSSL ou Git for Windows, puis relancez cette commande.'
  }
}

$certDirectory = Join-Path $PSScriptRoot '..\client\.cert'
New-Item -ItemType Directory -Force -Path $certDirectory | Out-Null
$key = Join-Path $certDirectory 'dev-key.pem'
$cert = Join-Path $certDirectory 'dev-cert.pem'

# Le certificat couvre localhost et toutes les IPv4 utilisables de la machine,
# afin de pouvoir tester depuis un téléphone, un VPN ou le réseau local.
$lanIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -ne 'WellKnown' -and
    $_.AddressState -eq 'Preferred'
  } |
  Select-Object -ExpandProperty IPAddress

$subjectAltName = 'subjectAltName=DNS:localhost,IP:127.0.0.1'
foreach ($lanIp in $lanIps) {
  $subjectAltName += ",IP:$lanIp"
}

& $openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 `
  -keyout $key -out $cert -subj '/CN=localhost' -addext $subjectAltName
if ($LASTEXITCODE -ne 0) {
  throw 'La génération du certificat OpenSSL a échoué.'
}

if ($Trust) {
  Import-Certificate -FilePath $cert -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
  Write-Host 'Certificat ajouté aux autorités racines de l’utilisateur Windows.'
}

Write-Host "Certificat créé : $cert"
Write-Host "Démarrez l’application avec : npm run dev:https"
foreach ($lanIp in $lanIps) {
  Write-Host "Adresse HTTPS locale : https://$lanIp`:5173"
}
