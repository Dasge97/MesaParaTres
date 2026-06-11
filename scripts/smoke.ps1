# Smoke test end-to-end de la API (requiere API corriendo y seed aplicado).
# Uso: pwsh scripts/smoke.ps1 [-BaseUrl http://localhost:3001]
param(
  [string]$BaseUrl = 'http://localhost:3001',
  [string]$AdminEmail = 'admin@demo.com',
  [string]$AdminPassword = 'admin123',
  [string]$ToolsSecret = 'dev-tools-secret-cambiar-en-produccion',
  [bool]$Reset = $true
)

$ErrorActionPreference = 'Stop'

# Deja la DB de dev limpia de datos transaccionales para que el script sea repetible.
if ($Reset) {
  docker exec recepcionista-pg psql -U postgres -d recepcionista -q -c `
    'DELETE FROM call_logs; DELETE FROM reservations; DELETE FROM blocked_slots;' | Out-Null
}
$results = @()
function Check([string]$name, [bool]$cond) {
  $script:results += [pscustomobject]@{ ok = $cond; name = $name }
  if ($cond) { Write-Host "  OK  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name" -ForegroundColor Red }
}

# Fecha de prueba: el próximo viernes (cena con franjas en el seed)
$d = Get-Date
while ($d.DayOfWeek -ne 'Friday') { $d = $d.AddDays(1) }
if ($d.Date -eq (Get-Date).Date) { $d = $d.AddDays(7) }
$friday = $d.ToString('yyyy-MM-dd')
Write-Host "Fecha de prueba (viernes): $friday`n"

# 1. Login
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' `
  -Body (@{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json)
Check 'login devuelve token' ([bool]$login.token)
$auth = @{ Authorization = "Bearer $($login.token)" }

# 2. Sin token → 401
try { Invoke-RestMethod -Uri "$BaseUrl/restaurants" | Out-Null; Check 'API admin sin token → 401' $false }
catch { Check 'API admin sin token → 401' ($_.Exception.Response.StatusCode.value__ -eq 401) }

# 3. Restaurante demo
$restaurants = Invoke-RestMethod -Uri "$BaseUrl/restaurants" -Headers $auth
$rid = $restaurants[0].id
Check 'GET /restaurants devuelve el demo' ([bool]$rid)

# 4. availability/check (admin) + latencia (medida tras warm-up de conexión)
$body = @{ restaurant_id = $rid; date = $friday; time = '21:00'; party_size = 4 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BaseUrl/availability/check" -Headers $auth -ContentType 'application/json' -Body $body | Out-Null
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$avail = Invoke-RestMethod -Method Post -Uri "$BaseUrl/availability/check" -Headers $auth -ContentType 'application/json' -Body $body
$sw.Stop()
Check 'check 21:00 x4 disponible' ($avail.available -eq $true -and $avail.slot_time -eq '21:00')
Check "latencia availability/check < 500ms (real: $($sw.ElapsedMilliseconds)ms)" ($sw.ElapsedMilliseconds -lt 500)

# 5. Tools sin secreto → 401
try {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/check-availability" -ContentType 'application/json' -Body $body | Out-Null
  Check 'tools sin secreto → 401' $false
} catch { Check 'tools sin secreto → 401' ($_.Exception.Response.StatusCode.value__ -eq 401) }

$tools = @{ 'X-Tools-Secret' = $ToolsSecret }

# 6. Tool check_availability
$tcheck = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/check-availability" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; date = $friday; time = '21:10'; party_size = 4; call_id = 'call_smoke_1' } | ConvertTo-Json)
Check 'tool check redondea 21:10 y responde mensaje' ($tcheck.available -and $tcheck.message_for_customer -match '21:00')

# 7. Tool create_reservation → confirmed (con idempotencia)
$createBody = @{ restaurant_id = $rid; customer_name = 'Ana García'; customer_phone = '+34 600 111 222';
  date = $friday; time = '21:00'; party_size = 4; call_id = 'call_smoke_1'; idempotency_key = 'smoke-idem-1' } | ConvertTo-Json
$r1 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/create-reservation" -Headers $tools -ContentType 'application/json' -Body $createBody
Check 'tool create → confirmed' ($r1.success -and $r1.status -eq 'confirmed')
$r1b = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/create-reservation" -Headers $tools -ContentType 'application/json' -Body $createBody
Check 'reintento con misma idempotency_key → misma reserva' ($r1b.reservation_id -eq $r1.reservation_id)

# 8. Grupo grande → needs_review
$r2 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/create-reservation" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; customer_name = 'Empresa Pérez'; customer_phone = '600333444';
    date = $friday; time = '21:00'; party_size = 10; call_id = 'call_smoke_2' } | ConvertTo-Json)
Check 'grupo de 10 → needs_review' ($r2.success -and $r2.status -eq 'needs_review')

# 9. Llenar la franja (cap 30: 4 confirmadas + 8*3 = 28) y comprobar full
foreach ($i in 3..5) {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/create-reservation" -Headers $tools -ContentType 'application/json' `
    -Body (@{ restaurant_id = $rid; customer_name = "Mesa $i"; customer_phone = "60000000$i";
      date = $friday; time = '21:00'; party_size = 8 } | ConvertTo-Json) | Out-Null
}
$full = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/check-availability" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; date = $friday; time = '21:00'; party_size = 4 } | ConvertTo-Json)
Check 'franja llena → full con alternativas' ((-not $full.available) -and $full.reason -eq 'full' -and $full.suggested_times.Count -gt 0)

$fullCreate = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/create-reservation" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; customer_name = 'Tarde'; customer_phone = '600999888';
    date = $friday; time = '21:00'; party_size = 4 } | ConvertTo-Json)
Check 'create sobre franja llena → success=false con alternativas' ((-not $fullCreate.success) -and $fullCreate.suggested_times.Count -gt 0)

# 10. Cancelación por teléfono
$cancel = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/cancel-reservation" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; customer_phone = '+34600111222'; call_id = 'call_smoke_3' } | ConvertTo-Json)
Check 'cancelación por teléfono (formato distinto) → cancelled' ($cancel.success -and $cancel.status -eq 'cancelled')

# 11. Handoff
$handoff = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tools/request-human-review" -Headers $tools -ContentType 'application/json' `
  -Body (@{ restaurant_id = $rid; caller_phone = '600555666'; reason = 'alergias múltiples';
    transcript_summary = 'Cliente con alergias pide menú especial'; call_id = 'call_smoke_4' } | ConvertTo-Json)
Check 'request_human_review → success' ($handoff.success -eq $true)

# 12. Panel: reservas y needs_review
$res = Invoke-RestMethod -Uri "$BaseUrl/reservations?restaurant_id=$rid&date=$friday" -Headers $auth
Check 'panel ve las reservas del día' ($res.Count -ge 5)
$review = Invoke-RestMethod -Uri "$BaseUrl/reservations?restaurant_id=$rid&status=needs_review" -Headers $auth
Check 'panel ve la cola needs_review' ($review.Count -ge 1)

# 13. Confirmar la needs_review desde el panel
$confirmed = Invoke-RestMethod -Method Post -Uri "$BaseUrl/reservations/$($review[0].id)/confirm" -Headers $auth -ContentType 'application/json' -Body '{}'
Check 'confirmar needs_review desde panel' ($confirmed.status -eq 'confirmed')

# 14. Call logs con tool_calls acumuladas por llamada
$logs = Invoke-RestMethod -Uri "$BaseUrl/call-logs?restaurant_id=$rid" -Headers $auth
$smoke1 = $logs | Where-Object { $_.provider_call_id -eq 'call_smoke_1' }
Check 'call log agrupa tool calls de la misma llamada' ($smoke1.tool_calls.Count -ge 2)
$handoffLog = $logs | Where-Object { $_.outcome -eq 'handoff' }
Check 'handoff registrado en call logs' ($handoffLog.Count -ge 1)

# 15. Bloqueo de día completo
Invoke-RestMethod -Method Post -Uri "$BaseUrl/restaurants/$rid/blocked-slots" -Headers $auth -ContentType 'application/json' `
  -Body (@{ date = $friday; reason = 'smoke test' } | ConvertTo-Json) | Out-Null
$blockedCheck = Invoke-RestMethod -Method Post -Uri "$BaseUrl/availability/check" -Headers $auth -ContentType 'application/json' -Body $body
Check 'día bloqueado → blocked' ($blockedCheck.reason -eq 'blocked')

$fails = ($results | Where-Object { -not $_.ok }).Count
Write-Host "`n$(($results.Count - $fails))/$($results.Count) checks OK"
if ($fails -gt 0) { exit 1 }
