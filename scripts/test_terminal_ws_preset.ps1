param(
  [string]$BaseUrl = 'http://127.0.0.1:8000',
  [string]$WsUrl = 'ws://127.0.0.1:8000/ws/terminal'
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonGet([string]$Url, [int]$TimeoutSec = 3) {
  return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec $TimeoutSec
}

function Invoke-JsonPost([string]$Url, [object]$BodyObj, [int]$TimeoutSec = 5) {
  $body = $BodyObj | ConvertTo-Json -Depth 10
  try {
    return Invoke-RestMethod -Method Post -Uri $Url -ContentType 'application/json' -Body $body -TimeoutSec $TimeoutSec
  } catch {
    $msg = $_.Exception.Message
    $respBody = $null

    try {
      if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $sr.ReadToEnd()
      }
    } catch {
      $respBody = $null
    }

    if ($respBody) {
      throw ("$msg`nresponseBody: $respBody")
    }
    throw
  }
}

function Invoke-JsonDelete([string]$Url, [int]$TimeoutSec = 5) {
  return Invoke-RestMethod -Method Delete -Uri $Url -TimeoutSec $TimeoutSec
}

function WS-SendText([System.Net.WebSockets.ClientWebSocket]$Ws, [string]$Text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Ws.SendAsync([System.ArraySegment[byte]]$bytes, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
}

function Wait-ForOutputLineToken(
  [System.Net.WebSockets.ClientWebSocket]$Ws,
  [string]$Token,
  [int]$TimeoutMs = 6000
) {
  $buffer = New-Object byte[] 16384
  $escaped = [regex]::Escape($Token)
  $pattern = $escaped

  $cts = New-Object System.Threading.CancellationTokenSource($TimeoutMs)
  try {
    while ($true) {
      $res = $Ws.ReceiveAsync([System.ArraySegment[byte]]$buffer, $cts.Token).GetAwaiter().GetResult()
      if ($res.Count -le 0) { continue }

      $text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $res.Count)
      Write-Output $text

      try {
        $obj = $text | ConvertFrom-Json -ErrorAction Stop
      } catch {
        continue
      }

      if ($null -eq $obj.type) { continue }
      if ($obj.type -ne 'output') { continue }
      $data = [string]$obj.payload.data
      if ($data -match $pattern) {
        return $true
      }
    }
  } catch {
    return $false
  } finally {
    try { $cts.Dispose() } catch {}
  }
}

$startedByScript = $false
$presetId = $null
$ws = $null

try {
  $st = Invoke-JsonGet "$BaseUrl/api/terminal/status" 3
  Write-Output ("Terminal status: {0}" -f ($st.status))

  if ($st.status -ne 'running') {
    $startResp = Invoke-JsonPost "$BaseUrl/api/terminal/start" @{ command = 'cmd.exe' } 8
    $startedByScript = $true
    Write-Output ("Terminal started: pid={0} session_id={1}" -f $startResp.pid, $startResp.session_id)
  }

  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$WsUrl, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  Write-Output 'WebSocket connected.'

  $nonce0 = [Guid]::NewGuid().ToString('N').Substring(0,8)
  $helloToken = "ws-hello-$nonce0"
  $helloMsg = @{ type = 'input'; payload = @{ data = "echo $helloToken`r`n" } } | ConvertTo-Json -Compress
  WS-SendText -Ws $ws -Text $helloMsg

  $ok1 = Wait-ForOutputLineToken -Ws $ws -Token $helloToken -TimeoutMs 8000
  if (-not $ok1) {
    throw "Did not observe $helloToken as its own output line in websocket output."
  }

  $nonce = [Guid]::NewGuid().ToString('N').Substring(0,8)
  $presetToken = "preset-$nonce"

  $createResp = Invoke-JsonPost "$BaseUrl/api/presets" @{ name = "WS Preset Test $nonce"; description = 'Temporary preset created by test script'; command = "echo $presetToken"; category = 'general'; shortcut = $null; scope = 'global'; project_path = $null } 8
  $presetId = $createResp.preset.id
  Write-Output ("Preset created: id={0}" -f $presetId)

  Invoke-JsonPost "$BaseUrl/api/presets/$presetId/execute?scope=global" @{ variables = @{} } 8 | Out-Null
  Write-Output 'Preset executed.'

  $ok2 = Wait-ForOutputLineToken -Ws $ws -Token $presetToken -TimeoutMs 12000
  if (-not $ok2) {
    throw ("Did not observe {0} in websocket output." -f $presetToken)
  }

  Write-Output 'OK: WebSocket streaming + input + preset execution verified.'
  exit 0
}
catch {
  Write-Output ("FAIL: {0}" -f $_)
  exit 1
}
finally {
  if ($ws) {
    try { $ws.Abort() } catch {}
  }

  if ($presetId) {
    try {
      $builder = [System.UriBuilder]::new("$BaseUrl/api/presets/$presetId")
      $builder.Query = 'scope=global'
      Invoke-JsonDelete $builder.Uri.AbsoluteUri 5 | Out-Null
      Write-Output 'Preset deleted.'
    } catch {
      Write-Output ("WARN: failed to delete preset: {0}" -f $_)
    }
  }

  if ($startedByScript) {
    try {
      Invoke-JsonPost "$BaseUrl/api/terminal/stop" @{ force = $false } 5 | Out-Null
      Write-Output 'Terminal stopped (started by script).'
    } catch {
      Write-Output ("WARN: failed to stop terminal: {0}" -f $_)
    }
  }
}
