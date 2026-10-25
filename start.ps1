# Kniffel & Mensch ärgere dich nicht – alles installieren und starten.
# Aufruf über start.bat (Doppelklick) oder: powershell -ExecutionPolicy Bypass -File start.ps1
param([switch]$Stop)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 3001
$pidFile = Join-Path $root ".run-pids"
$srvLog = Join-Path $env:TEMP "kniffel-server.log"
$cfLog = Join-Path $env:TEMP "kniffel-tunnel.log"

function Step($text) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $text) -ForegroundColor Cyan }

function Stop-Old {
    if (Test-Path $pidFile) {
        Get-Content $pidFile | ForEach-Object {
            Get-Process -Id $_ -ErrorAction SilentlyContinue |
                Where-Object { $_.ProcessName -in "node", "cloudflared" } |
                Stop-Process -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
}

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Install-WithWinget($id, $label) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$label fehlt und winget ist nicht verfügbar. Bitte $label manuell installieren und das Skript erneut starten."
    }
    Step "Installiere $label ..."
    winget install --id $id -e --accept-package-agreements --accept-source-agreements
    Refresh-Path
}

# Prüft, ob auf dem Port etwas antwortet (schnell, über IPv4)
function Test-Port($p) {
    try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $p); $c.Close(); return $true } catch { return $false }
}

function Show-Log($file, $lines = 15) {
    if (Test-Path $file) { Write-Host "--- $file ---" -ForegroundColor DarkGray; Get-Content $file -Tail $lines }
}

try {
    if ($Stop) { Stop-Old; Write-Host "Server und Tunnel wurden beendet."; return }
    Stop-Old

    Step "1/6 Node.js prüfen"
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js" }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js wurde installiert, wird aber noch nicht gefunden. Bitte dieses Fenster schließen und start.bat noch einmal ausführen."
    }

    Step "2/6 cloudflared prüfen"
    if (-not (Find-Cloudflared)) { Install-WithWinget "Cloudflare.cloudflared" "cloudflared" }
    $cloudflared = Find-Cloudflared
    if (-not $cloudflared) {
        throw "cloudflared wurde installiert, wird aber noch nicht gefunden. Bitte dieses Fenster schließen und start.bat noch einmal ausführen."
    }

    Step "3/6 Pakete prüfen"
    if (-not (Test-Path "node_modules")) {
        Write-Host "    Installiere Server-Pakete (einmalig) ..."
        npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "npm install ist fehlgeschlagen." }
    }
    if (-not (Test-Path "client\node_modules")) {
        Write-Host "    Installiere Browser-Pakete (einmalig, kann 1-3 Minuten dauern) ..."
        npm.cmd --prefix client install
        if ($LASTEXITCODE -ne 0) { throw "npm install im Ordner client ist fehlgeschlagen." }
    }

    Step "4/6 Webseite bauen (falls nötig)"
    $dist = "client\dist\index.html"
    $newest = Get-ChildItem "client\src" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not (Test-Path $dist) -or $newest.LastWriteTime -gt (Get-Item $dist).LastWriteTime) {
        npm.cmd --prefix client run build
        if ($LASTEXITCODE -ne 0) { throw "Der Build ist fehlgeschlagen. Die Fehlermeldung steht weiter oben." }
    } else {
        Write-Host "    Ist schon aktuell."
    }

    Step "5/6 Server starten"
    if (Test-Port $port) { throw "Port $port ist schon belegt. Führe stop.bat aus oder beende andere Programme, die ihn nutzen." }
    Remove-Item $srvLog, "$srvLog.err" -ErrorAction SilentlyContinue
    $server = Start-Process node -ArgumentList "server/index.js" -WorkingDirectory $root -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $srvLog -RedirectStandardError "$srvLog.err"
    $server.Id | Set-Content $pidFile

    $ready = $false
    for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
        if ($server.HasExited) { break }
        if (Test-Port $port) { $ready = $true } else { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) {
        Show-Log "$srvLog.err"
        Show-Log $srvLog
        throw ($(if ($server.HasExited) { "Der Server hat sich sofort beendet." } else { "Der Server antwortet nicht." }) + " Die Meldung steht oben.")
    }
    Write-Host "    Server läuft."

    Step "6/6 Tunnel starten (kann bis zu 30 Sekunden dauern)"
    Remove-Item $cfLog, "$cfLog.out" -ErrorAction SilentlyContinue
    $tunnel = Start-Process $cloudflared -ArgumentList "tunnel", "--url", "http://127.0.0.1:$port" -PassThru -WindowStyle Hidden `
        -RedirectStandardError $cfLog -RedirectStandardOutput "$cfLog.out"
    @($server.Id, $tunnel.Id) | Set-Content $pidFile

    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
        if ($tunnel.HasExited) { break }
        Start-Sleep -Milliseconds 500
        try {
            $m = [regex]::Match((Get-Content $cfLog -Raw -ErrorAction Stop), "https://[a-z0-9-]+\.trycloudflare\.com")
            if ($m.Success) { $url = $m.Value }
        } catch { }
    }
    if (-not $url) { Show-Log $cfLog 20; throw "Der Tunnel liefert keine Adresse. Die Meldung steht oben (oft: keine Internetverbindung oder Firewall)." }

    # Die Adresse wird erst ein paar Sekunden nach dem Start im Internet bekannt (DNS) – darauf warten
    Step "Warte, bis die Adresse im Internet erreichbar ist (bis zu 2 Minuten) ..."
    $hostName = ([uri]$url).Host
    $online = $false
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while (-not $online -and $sw.Elapsed.TotalSeconds -lt 120) {
        try { Clear-DnsClientCache -ErrorAction Stop } catch { }
        try {
            $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $online = $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    if ($online) {
        Write-Host "    Erreichbar." -ForegroundColor Green
    } else {
        $local = $null; $viaCf = $null
        try { $local = Resolve-DnsName $hostName -Type A -DnsOnly -ErrorAction Stop } catch { }
        try { $viaCf = Resolve-DnsName $hostName -Type A -DnsOnly -Server 1.1.1.1 -ErrorAction Stop } catch { }
        Write-Host ""
        if (-not $local -and $viaCf) {
            Write-Host "Problem: Der DNS-Server deines Netzwerks kennt die Adresse nicht, der von Cloudflare (1.1.1.1) schon." -ForegroundColor Yellow
            Write-Host "Lösung: In den Windows-Netzwerkeinstellungen als DNS-Server 1.1.1.1 und 1.0.0.1 eintragen." -ForegroundColor Yellow
        } else {
            Write-Host "Die Adresse antwortet noch nicht. Prüfe die Internetverbindung oder warte kurz und lade die Seite neu." -ForegroundColor Yellow
        }
        Write-Host "Die Adresse bekommst du trotzdem; der Browser wird nicht automatisch geöffnet." -ForegroundColor Yellow
    }

    Set-Clipboard $url
    Write-Host ""
    Write-Host "Fertig! Dein Spiel läuft unter:" -ForegroundColor Green
    Write-Host "    $url" -ForegroundColor Yellow
    Write-Host "(Die Adresse ist in der Zwischenablage.)"
    Write-Host ""
    Write-Host "Öffne diese Adresse selbst (nicht localhost), erstelle dort einen Raum"
    Write-Host "und schick den Einladungslink an deine Mitspieler."
    Write-Host ""
    if ($online) { Start-Process $url }

    Write-Host "Zum Beenden: Enter drücken. Das Fenster offen lassen, solange gespielt wird." -ForegroundColor Cyan
    [void](Read-Host)
    Stop-Old
    Write-Host "Beendet."
}
catch {
    Write-Host ""
    Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
    Stop-Old
}
