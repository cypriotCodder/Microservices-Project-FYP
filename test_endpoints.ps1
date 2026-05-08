param([string]$RootDir = $PSScriptRoot)
$PASS = 0; $FAIL = 0; $WARN = 0

function Check([string]$label, [string]$expected, [string]$actual, [string]$body) {
    if ($actual -eq $expected) {
        Write-Host ("  [PASS][$actual] " + $label) -ForegroundColor Green
        $global:PASS++
    } else {
        Write-Host ("  [FAIL][$actual expected $expected] " + $label) -ForegroundColor Red
        if ($body) { Write-Host ("       " + $body.Substring(0, [Math]::Min(300,$body.Length))) -ForegroundColor DarkRed }
        $global:FAIL++
    }
}
function Warn([string]$label, [string]$body = "") {
    Write-Host ("  [WARN] " + $label) -ForegroundColor Yellow
    if ($body) { Write-Host ("       " + $body.Substring(0, [Math]::Min(200,$body.Length))) -ForegroundColor DarkYellow }
    $global:WARN++
}
function J([hashtable]$data) { return ($data | ConvertTo-Json -Compress) }
function Get-Field([string]$json, [string]$field) {
    try { return ($json | ConvertFrom-Json).$field } catch { return $null }
}

# Node.js HTTP request inside a container
function DC([string]$composeFile, [string]$service, [string]$method, [string]$url,
            [string]$token = "", [string]$jsonBody = "") {
    # Escape for passing into node -e
    $escapedBody = $jsonBody -replace "'", "'\"'\"'"
    $tokenHeader = if ($token) { "'Authorization': 'Bearer $token'," } else { "" }
    $nodeScript = @"
const http = require('http');
const https = require('https');
const u = new URL('$url');
const lib = u.protocol === 'https:' ? https : http;
const body = '$($jsonBody -replace "'","\'")';
const opts = {
  hostname: u.hostname, port: u.port || (u.protocol==='https:'?443:80),
  path: u.pathname + u.search, method: '$method',
  headers: { $tokenHeader $(if($jsonBody){"'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)"}) }
};
const req = lib.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(JSON.stringify({code: res.statusCode, body: d})));
});
req.on('error', e => console.log(JSON.stringify({code: 0, body: e.message})));
if (body && '$method' !== 'GET') req.write(body);
req.end();
"@
    $raw = docker compose -f $composeFile exec -T $service node -e $nodeScript 2>&1
    $json = ($raw | Where-Object { $_ -match '^\{"code"' } | Select-Object -Last 1)
    if ($json) {
        try {
            $obj = $json | ConvertFrom-Json
            return @{ code = "$($obj.code)"; body = $obj.body }
        } catch {}
    }
    return @{ code = ""; body = ($raw | Out-String).Trim() }
}

$monoFile  = Join-Path $RootDir "monolith\docker-compose.yml"
$microFile = Join-Path $RootDir "microservices\docker-compose.yml"

# ================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MONOLITH BACKEND (port 4000)"               -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`n-- Health --" -ForegroundColor Yellow
$r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/health"
Check "GET /health" "200" $r.code $r.body

Write-Host "`n-- Auth --" -ForegroundColor Yellow
$monoUser = "monoapi_$(([System.Guid]::NewGuid()).ToString('N').Substring(0,8))"

$r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/auth/register" -jsonBody (J @{username=$monoUser; password="testpass123"})
Check "POST /auth/register" "201" $r.code $r.body
$monoUserId = Get-Field $r.body "userId"

$r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/auth/login" -jsonBody (J @{username=$monoUser; password="testpass123"})
Check "POST /auth/login (correct)" "200" $r.code $r.body
$monoToken = Get-Field $r.body "token"
if (-not $monoUserId) { $monoUserId = Get-Field $r.body "userId" }
if ($monoToken) { Write-Host ("       (User: $monoUserId  Token: " + $monoToken.Substring(0,[Math]::Min(20,$monoToken.Length)) + "...)") -ForegroundColor DarkCyan }

$r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/auth/login" -jsonBody (J @{username=$monoUser; password="wrongpass"})
Check "POST /auth/login (wrong password, expects 401)" "401" $r.code $r.body

$r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/auth/admin/users/count"
Check "GET /auth/admin/users/count" "200" $r.code $r.body

Write-Host "`n-- Products --" -ForegroundColor Yellow
$r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/products"
Check "GET /products" "200" $r.code $r.body
try   { $monoProdId = (($r.body | ConvertFrom-Json).products | Select-Object -First 1).id } catch { $monoProdId = $null }
if ($monoProdId) { Write-Host "       (Product ID: $monoProdId)" -ForegroundColor DarkCyan }
else { Warn "No products found - seeding may be needed" $r.body }

if ($monoProdId) {
    $r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/products/$monoProdId"
    Check "GET /products/:id" "200" $r.code $r.body

    $r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/products/$monoProdId/reviews"
    Check "GET /products/:id/reviews" "200" $r.code $r.body

    $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/products/$monoProdId/reviews" -jsonBody (J @{userId=$monoUserId; title="Test Review"; content="Automated test"; rating=4})
    Check "POST /products/:id/reviews" "201" $r.code $r.body

    $r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/products/$monoProdId/comments"
    Check "GET /products/:id/comments" "200" $r.code $r.body

    $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/products/$monoProdId/comments" -jsonBody (J @{userId=$monoUserId; content="Test comment"})
    Check "POST /products/:id/comments" "201" $r.code $r.body
}

Write-Host "`n-- Orders --" -ForegroundColor Yellow
if ($monoProdId -and $monoToken) {
    $ob = J @{ totalAmount=99.99; products=@(@{ productId=$monoProdId; quantity=1 }) }
    $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/orders" -token $monoToken -jsonBody $ob
    Check "POST /orders (create)" "201" $r.code $r.body
    try { $monoOrderId = (Get-Field $r.body "order").id } catch { $monoOrderId = $null }
    Write-Host "       (Order ID: $monoOrderId)" -ForegroundColor DarkCyan

    $r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/orders/$monoUserId" -token $monoToken
    Check "GET /orders/:userId" "200" $r.code $r.body

    if ($monoOrderId) {
        $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/orders/$monoOrderId/buy" -token $monoToken
        Check "POST /orders/:id/buy" "200" $r.code $r.body

        $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/orders/$monoOrderId/buy" -token $monoToken
        Check "POST /orders/:id/buy (already done, expects 400)" "400" $r.code $r.body
    }

    $r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/orders" -jsonBody $ob
    Check "POST /orders (no token, expects 401)" "401" $r.code $r.body
}

Write-Host "`n-- Recommendations --" -ForegroundColor Yellow
if ($monoUserId) {
    $r = DC $monoFile "monolith-backend" "GET" "http://localhost:4000/recommendations/$monoUserId"
    Check "GET /recommendations/:userId" "200" $r.code $r.body
}

Write-Host "`n-- LLM --" -ForegroundColor Yellow
$r = DC $monoFile "monolith-backend" "POST" "http://localhost:4000/llm/summarize" -jsonBody (J @{text="This is a test."})
if ($r.code -eq "200") { Check "POST /llm/summarize" "200" $r.code $r.body }
else { Warn ("POST /llm/summarize got " + $r.code + " (needs GROQ key)") $r.body }

# ================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MICROSERVICES (api-gateway port 8080)"      -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`n-- Health --" -ForegroundColor Yellow
$r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/health"
Check "GET /health (gateway)" "200" $r.code $r.body

Write-Host "`n-- Auth --" -ForegroundColor Yellow
$microUser = "microapi_$(([System.Guid]::NewGuid()).ToString('N').Substring(0,8))"

$r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/auth/register" -jsonBody (J @{username=$microUser; password="testpass123"})
Check "POST /auth/register" "201" $r.code $r.body

$r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/auth/login" -jsonBody (J @{username=$microUser; password="testpass123"})
Check "POST /auth/login (correct)" "200" $r.code $r.body
$microToken  = Get-Field $r.body "token"
$microUserId = Get-Field $r.body "userId"
Write-Host "       (User ID: $microUserId)" -ForegroundColor DarkCyan

$r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/auth/login" -jsonBody (J @{username=$microUser; password="wrongpass"})
Check "POST /auth/login (wrong password, expects 401)" "401" $r.code $r.body

Write-Host "`n-- Products --" -ForegroundColor Yellow
$r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/products"
Check "GET /products" "200" $r.code $r.body
try {
    $parsed = $r.body | ConvertFrom-Json
    $microProdId = if ($parsed -is [array]) { $parsed[0]._id } else { $parsed.products[0]._id }
} catch { $microProdId = $null }
if ($microProdId) { Write-Host "       (Product ID: $microProdId)" -ForegroundColor DarkCyan }
else { Warn "No products found" $r.body }

if ($microProdId) {
    $r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/products/$microProdId"
    Check "GET /products/:id" "200" $r.code $r.body

    $r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/products/$microProdId/reviews"
    Check "GET /products/:id/reviews" "200" $r.code $r.body

    $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/products/$microProdId/reviews" -token $microToken -jsonBody (J @{userId=$microUserId; title="Test Review"; content="Automated test"; rating=5})
    Check "POST /products/:id/reviews" "201" $r.code $r.body

    $r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/products/$microProdId/comments"
    Check "GET /products/:id/comments" "200" $r.code $r.body

    $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/products/$microProdId/comments" -token $microToken -jsonBody (J @{userId=$microUserId; content="Test comment"})
    Check "POST /products/:id/comments (async via RabbitMQ)" "202" $r.code $r.body
}

Write-Host "`n-- Orders --" -ForegroundColor Yellow
if ($microProdId -and $microToken) {
    $ob = J @{ totalAmount=99.99; products=@(@{ productId=$microProdId; quantity=1 }) }
    $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/orders" -token $microToken -jsonBody $ob
    Check "POST /orders (create)" "201" $r.code $r.body
    try { $microOrderId = (Get-Field $r.body "order")._id } catch { $microOrderId = $null }
    Write-Host "       (Order ID: $microOrderId)" -ForegroundColor DarkCyan

    $r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/orders/$microUserId" -token $microToken
    Check "GET /orders/:userId" "200" $r.code $r.body

    if ($microOrderId) {
        $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/orders/$microOrderId/buy" -token $microToken
        Check "POST /orders/:id/buy" "200" $r.code $r.body

        $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/orders/$microOrderId/buy" -token $microToken
        Check "POST /orders/:id/buy (already done, expects 400)" "400" $r.code $r.body
    }

    $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/orders" -jsonBody $ob
    Check "POST /orders (no token, expects 401)" "401" $r.code $r.body
}

Write-Host "`n-- Recommendations --" -ForegroundColor Yellow
if ($microUserId) {
    $r = DC $microFile "auth-service" "GET" "http://api-gateway:8080/recommendations/$microUserId"
    Check "GET /recommendations/:userId" "200" $r.code $r.body
}

Write-Host "`n-- LLM --" -ForegroundColor Yellow
if ($microToken) {
    $r = DC $microFile "auth-service" "POST" "http://api-gateway:8080/llm/summarize" -token $microToken -jsonBody (J @{text="This is a test."})
    if ($r.code -eq "200") { Check "POST /llm/summarize" "200" $r.code $r.body }
    else { Warn ("POST /llm/summarize got " + $r.code + " (needs GROQ key)") $r.body }
}

# ================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY"                               -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Passed:   $PASS"   -ForegroundColor Green
Write-Host "  Failed:   $FAIL"   -ForegroundColor Red
Write-Host "  Warnings: $WARN"   -ForegroundColor Yellow
Write-Host "  Total:    $($PASS + $FAIL + $WARN)"
Write-Host ""
if ($FAIL -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else             { Write-Host "  $FAIL TEST(S) FAILED" -ForegroundColor Red }
Write-Host ""