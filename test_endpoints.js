#!/usr/bin/env node
// Endpoint test runner for Monolith + Microservices
// Usage: node test_endpoints.js
// Runs HTTP requests from inside Docker containers using Node's built-in http module

const { execSync } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const MONO_FILE = path.join(ROOT, 'monolith', 'docker-compose.yml');
const MICRO_FILE = path.join(ROOT, 'microservices', 'docker-compose.yml');

let PASS = 0, FAIL = 0, WARN = 0;

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m';

function check(label, expected, actual, body) {
    if (String(actual) === String(expected)) {
        console.log(`  ${GREEN}[PASS][${actual}]${RESET} ${label}`);
        PASS++;
    } else {
        console.log(`  ${RED}[FAIL][${actual} expected ${expected}]${RESET} ${label}`);
        if (body) console.log(`       ${RED}${String(body).substring(0, 300)}${RESET}`);
        FAIL++;
    }
}

function warn(label, body = '') {
    console.log(`  ${YELLOW}[WARN] ${label}${RESET}`);
    if (body) console.log(`       ${YELLOW}${String(body).substring(0, 200)}${RESET}`);
    WARN++;
}

// Execute an HTTP request inside a Docker container via Node.js
function dc(composeFile, service, method, url, token = '', jsonBody = '') {
    const bodyStr = jsonBody ? JSON.stringify(JSON.parse(jsonBody)) : '';
    const tokenHeader = token ? `,'Authorization':'Bearer ${token}'` : '';
    const contentHeaders = bodyStr ? `,'Content-Type':'application/json','Content-Length':Buffer.byteLength('${bodyStr.replace(/'/g, "\\'")}')}` : `}`;

    const nodeCode = `
const http=require('http'),u=new URL('${url}');
const b='${bodyStr.replace(/'/g, "\\'")}';
const opts={hostname:u.hostname,port:parseInt(u.port)||80,path:u.pathname+(u.search||''),method:'${method}',headers:{'Accept':'application/json'${tokenHeader}${bodyStr ? `,'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)` : ''}}};
const req=http.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>process.stdout.write(JSON.stringify({code:res.statusCode,body:d})))});
req.on('error',e=>process.stdout.write(JSON.stringify({code:0,body:e.message})));
${bodyStr ? "req.write(b);" : ''}req.end();`;

    try {
        const raw = execSync(
            `docker compose -f "${composeFile}" exec -T ${service} node -e "${nodeCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const lines = raw.split('\n').filter(l => l.trim().startsWith('{'));
        if (lines.length) {
            const obj = JSON.parse(lines[lines.length - 1]);
            return { code: String(obj.code), body: obj.body };
        }
    } catch (e) {
        const out = e.stdout || '';
        const lines = out.split('\n').filter(l => l.trim().startsWith('{'));
        if (lines.length) {
            try {
                const obj = JSON.parse(lines[lines.length - 1]);
                return { code: String(obj.code), body: obj.body };
            } catch {}
        }
    }
    return { code: '', body: '' };
}

function field(json, key) {
    try { return JSON.parse(json)[key]; } catch { return null; }
}

function uid() {
    return Math.random().toString(36).substring(2, 10);
}

// ================================================================
console.log(`\n${CYAN}=============================================${RESET}`);
console.log(`${CYAN}  MONOLITH BACKEND (port 4000)${RESET}`);
console.log(`${CYAN}=============================================${RESET}`);

// Health
console.log(`\n${YELLOW}-- Health --${RESET}`);
let r = dc(MONO_FILE, 'monolith-backend', 'GET', 'http://localhost:4000/health');
check('GET /health', '200', r.code, r.body);

// Auth
console.log(`\n${YELLOW}-- Auth --${RESET}`);
const monoUser = `monoapi_${uid()}`;

r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/auth/register', '', JSON.stringify({username:monoUser,password:'testpass123'}));
check('POST /auth/register', '201', r.code, r.body);
let monoUserId = String(field(r.body, 'userId') || '');

r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/auth/login', '', JSON.stringify({username:monoUser,password:'testpass123'}));
check('POST /auth/login (correct)', '200', r.code, r.body);
const monoToken = field(r.body, 'token');
if (!monoUserId || monoUserId === 'null') monoUserId = String(field(r.body, 'userId') || '');
if (monoToken) console.log(`       (User: ${monoUserId}  Token: ${monoToken.substring(0,20)}...)`);

r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/auth/login', '', JSON.stringify({username:monoUser,password:'wrongpass'}));
check('POST /auth/login (wrong password, expects 401)', '401', r.code, r.body);

r = dc(MONO_FILE, 'monolith-backend', 'GET', 'http://localhost:4000/auth/admin/users/count');
check('GET /auth/admin/users/count', '200', r.code, r.body);

// Products
console.log(`\n${YELLOW}-- Products --${RESET}`);
r = dc(MONO_FILE, 'monolith-backend', 'GET', 'http://localhost:4000/products');
check('GET /products', '200', r.code, r.body);
let monoProdId = null;
try { monoProdId = JSON.parse(r.body).products[0].id; } catch {}
if (monoProdId) console.log(`       (Product ID: ${monoProdId})`);
else warn('No products found - run /seed first', r.body);

if (monoProdId) {
    r = dc(MONO_FILE, 'monolith-backend', 'GET', `http://localhost:4000/products/${monoProdId}`);
    check('GET /products/:id', '200', r.code, r.body);

    r = dc(MONO_FILE, 'monolith-backend', 'GET', `http://localhost:4000/products/${monoProdId}/reviews`);
    check('GET /products/:id/reviews', '200', r.code, r.body);

    r = dc(MONO_FILE, 'monolith-backend', 'POST', `http://localhost:4000/products/${monoProdId}/reviews`, '', JSON.stringify({userId:monoUserId,title:'Test Review',content:'Automated test',rating:4}));
    check('POST /products/:id/reviews', '201', r.code, r.body);

    r = dc(MONO_FILE, 'monolith-backend', 'GET', `http://localhost:4000/products/${monoProdId}/comments`);
    check('GET /products/:id/comments', '200', r.code, r.body);

    r = dc(MONO_FILE, 'monolith-backend', 'POST', `http://localhost:4000/products/${monoProdId}/comments`, '', JSON.stringify({userId:monoUserId,content:'Test comment'}));
    check('POST /products/:id/comments', '201', r.code, r.body);
}

// Orders
console.log(`\n${YELLOW}-- Orders --${RESET}`);
if (monoProdId && monoToken) {
    const ob = JSON.stringify({totalAmount:99.99, products:[{productId:monoProdId,quantity:1}]});
    r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/orders', monoToken, ob);
    check('POST /orders (create)', '201', r.code, r.body);
    let monoOrderId = null;
    try { monoOrderId = JSON.parse(r.body).order.id; } catch {}
    console.log(`       (Order ID: ${monoOrderId})`);

    r = dc(MONO_FILE, 'monolith-backend', 'GET', `http://localhost:4000/orders/${monoUserId}`, monoToken);
    check('GET /orders/:userId', '200', r.code, r.body);

    if (monoOrderId) {
        r = dc(MONO_FILE, 'monolith-backend', 'POST', `http://localhost:4000/orders/${monoOrderId}/buy`, monoToken);
        check('POST /orders/:id/buy', '200', r.code, r.body);

        r = dc(MONO_FILE, 'monolith-backend', 'POST', `http://localhost:4000/orders/${monoOrderId}/buy`, monoToken);
        check('POST /orders/:id/buy (already done, expects 400)', '400', r.code, r.body);
    }

    r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/orders', '', ob);
    check('POST /orders (no token, expects 401)', '401', r.code, r.body);
}

// Recommendations
console.log(`\n${YELLOW}-- Recommendations --${RESET}`);
if (monoUserId) {
    r = dc(MONO_FILE, 'monolith-backend', 'GET', `http://localhost:4000/recommendations/${monoUserId}`);
    check('GET /recommendations/:userId', '200', r.code, r.body);
}

// LLM
console.log(`\n${YELLOW}-- LLM --${RESET}`);
r = dc(MONO_FILE, 'monolith-backend', 'POST', 'http://localhost:4000/llm/summarize', '', JSON.stringify({text:'Test product description.'}));
if (r.code === '200') check('POST /llm/summarize', '200', r.code, r.body);
else warn(`POST /llm/summarize got ${r.code} (needs GROQ_API_KEY in .env)`, r.body);

// ================================================================
console.log(`\n${CYAN}=============================================${RESET}`);
console.log(`${CYAN}  MICROSERVICES (api-gateway port 8080)${RESET}`);
console.log(`${CYAN}=============================================${RESET}`);

// Health
console.log(`\n${YELLOW}-- Health --${RESET}`);
r = dc(MICRO_FILE, 'auth-service', 'GET', 'http://api-gateway:8080/health');
check('GET /health (gateway)', '200', r.code, r.body);

// Auth
console.log(`\n${YELLOW}-- Auth --${RESET}`);
const microUser = `microapi_${uid()}`;

r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/auth/register', '', JSON.stringify({username:microUser,password:'testpass123'}));
check('POST /auth/register', '201', r.code, r.body);

r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/auth/login', '', JSON.stringify({username:microUser,password:'testpass123'}));
check('POST /auth/login (correct)', '200', r.code, r.body);
const microToken = field(r.body, 'token');
const microUserId = field(r.body, 'userId');
console.log(`       (User ID: ${microUserId})`);

r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/auth/login', '', JSON.stringify({username:microUser,password:'wrongpass'}));
check('POST /auth/login (wrong password, expects 401)', '401', r.code, r.body);

// Products
console.log(`\n${YELLOW}-- Products --${RESET}`);
r = dc(MICRO_FILE, 'auth-service', 'GET', 'http://api-gateway:8080/products');
check('GET /products', '200', r.code, r.body);
let microProdId = null;
try {
    const p = JSON.parse(r.body);
    microProdId = Array.isArray(p) ? p[0]._id : p.products[0]._id;
} catch {}
if (microProdId) console.log(`       (Product ID: ${microProdId})`);
else warn('No products found', r.body);

if (microProdId) {
    r = dc(MICRO_FILE, 'auth-service', 'GET', `http://api-gateway:8080/products/${microProdId}`);
    check('GET /products/:id', '200', r.code, r.body);

    r = dc(MICRO_FILE, 'auth-service', 'GET', `http://api-gateway:8080/products/${microProdId}/reviews`);
    check('GET /products/:id/reviews', '200', r.code, r.body);

    r = dc(MICRO_FILE, 'auth-service', 'POST', `http://api-gateway:8080/products/${microProdId}/reviews`, microToken, JSON.stringify({userId:microUserId,title:'Test Review',content:'Automated test',rating:5}));
    check('POST /products/:id/reviews', '201', r.code, r.body);

    r = dc(MICRO_FILE, 'auth-service', 'GET', `http://api-gateway:8080/products/${microProdId}/comments`);
    check('GET /products/:id/comments', '200', r.code, r.body);

    r = dc(MICRO_FILE, 'auth-service', 'POST', `http://api-gateway:8080/products/${microProdId}/comments`, microToken, JSON.stringify({userId:microUserId,content:'Test comment'}));
    check('POST /products/:id/comments (async via RabbitMQ)', '202', r.code, r.body);
}

// Orders
console.log(`\n${YELLOW}-- Orders --${RESET}`);
if (microProdId && microToken) {
    const ob = JSON.stringify({totalAmount:99.99, products:[{productId:microProdId,quantity:1}]});
    r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/orders', microToken, ob);
    check('POST /orders (create)', '201', r.code, r.body);
    let microOrderId = null;
    try { microOrderId = JSON.parse(r.body).order._id; } catch {}
    console.log(`       (Order ID: ${microOrderId})`);

    r = dc(MICRO_FILE, 'auth-service', 'GET', `http://api-gateway:8080/orders/${microUserId}`, microToken);
    check('GET /orders/:userId', '200', r.code, r.body);

    if (microOrderId) {
        r = dc(MICRO_FILE, 'auth-service', 'POST', `http://api-gateway:8080/orders/${microOrderId}/buy`, microToken);
        check('POST /orders/:id/buy', '200', r.code, r.body);

        r = dc(MICRO_FILE, 'auth-service', 'POST', `http://api-gateway:8080/orders/${microOrderId}/buy`, microToken);
        check('POST /orders/:id/buy (already done, expects 400)', '400', r.code, r.body);
    }

    r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/orders', '', ob);
    check('POST /orders (no token, expects 401)', '401', r.code, r.body);
}

// Recommendations
console.log(`\n${YELLOW}-- Recommendations --${RESET}`);
if (microUserId) {
    r = dc(MICRO_FILE, 'auth-service', 'GET', `http://api-gateway:8080/recommendations/${microUserId}`);
    check('GET /recommendations/:userId', '200', r.code, r.body);
}

// LLM
console.log(`\n${YELLOW}-- LLM --${RESET}`);
if (microToken) {
    r = dc(MICRO_FILE, 'auth-service', 'POST', 'http://api-gateway:8080/llm/summarize', microToken, JSON.stringify({text:'Test product description.'}));
    if (r.code === '200') check('POST /llm/summarize', '200', r.code, r.body);
    else warn(`POST /llm/summarize got ${r.code} (needs GROQ_API_KEY in .env)`, r.body);
}

// ================================================================
console.log(`\n${CYAN}=============================================${RESET}`);
console.log(`${CYAN}  TEST SUMMARY${RESET}`);
console.log(`${CYAN}=============================================${RESET}`);
console.log(`  ${GREEN}Passed:   ${PASS}${RESET}`);
console.log(`  ${RED}Failed:   ${FAIL}${RESET}`);
console.log(`  ${YELLOW}Warnings: ${WARN}${RESET}`);
console.log(`  Total:    ${PASS + FAIL + WARN}`);
console.log('');
if (FAIL === 0) console.log(`  ${GREEN}ALL TESTS PASSED!${RESET}`);
else console.log(`  ${RED}${FAIL} TEST(S) FAILED${RESET}`);
console.log('');
process.exit(FAIL > 0 ? 1 : 0);
