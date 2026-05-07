#!/bin/bash
# Comprehensive API endpoint test for both Monolith and Microservices

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

MONO_URL="http://localhost:4000"
MICRO_URL="http://localhost:8080"

PASS=0
FAIL=0
WARN=0

check() {
    local label="$1"
    local expected_code="$2"
    local actual_code="$3"
    local body="$4"

    if [ "$actual_code" == "$expected_code" ]; then
        echo -e "  ${GREEN}✅ PASS${NC} [$actual_code] $label"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}❌ FAIL${NC} [$actual_code expected $expected_code] $label"
        echo -e "     ${RED}Body: ${body:0:200}${NC}"
        FAIL=$((FAIL + 1))
    fi
}

# ─────────────────────────────────────────────────
# MONOLITH TESTS (port 4000)
# ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  MONOLITH BACKEND (localhost:4000)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"

# ── Health ──
echo -e "\n${YELLOW}── Health ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/health)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /health" "200" "$CODE" "$BODY"

# ── Auth ──
echo -e "\n${YELLOW}── Auth ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/auth/register -H "Content-Type: application/json" -d '{"username":"apitest_mono_'$RANDOM'","password":"testpass123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/register" "201" "$CODE" "$BODY"
MONO_USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/auth/login -H "Content-Type: application/json" -d '{"username":"apitest_mono_'$RANDOM'","password":"wrong"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/login (wrong password)" "401" "$CODE" "$BODY"

# Register a known user for the rest of the tests
MONO_USERNAME="monotest_$RANDOM"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/auth/register -H "Content-Type: application/json" -d '{"username":"'"$MONO_USERNAME"'","password":"testpass123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
MONO_USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/auth/login -H "Content-Type: application/json" -d '{"username":"'"$MONO_USERNAME"'","password":"testpass123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/login (correct)" "200" "$CODE" "$BODY"
MONO_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/auth/admin/users/count)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /auth/admin/users/count" "200" "$CODE" "$BODY"

# ── Products ──
echo -e "\n${YELLOW}── Products ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/products)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products" "200" "$CODE" "$BODY"
MONO_PRODUCT_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['products'][0]['id'])" 2>/dev/null)
echo -e "     ${CYAN}(Using product ID: $MONO_PRODUCT_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/products/$MONO_PRODUCT_ID)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/products/$MONO_PRODUCT_ID/reviews)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id/reviews" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/products/$MONO_PRODUCT_ID/reviews -H "Content-Type: application/json" -d '{"userId":"'"$MONO_USER_ID"'","title":"Test Review","content":"Automated test review","rating":4}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/:id/reviews (create)" "201" "$CODE" "$BODY"
MONO_REVIEW_ID=$(echo "$BODY" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('review',r).get('id',''))" 2>/dev/null)
echo -e "     ${CYAN}(Created review ID: $MONO_REVIEW_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/products/$MONO_PRODUCT_ID/reviews)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
REVIEW_FOUND=$(echo "$BODY" | python3 -c "import sys,json; reviews=json.load(sys.stdin); print('yes' if any(r.get('title')=='Test Review' for r in reviews) else 'no')" 2>/dev/null)
if [ "$REVIEW_FOUND" == "yes" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} [verified] GET /products/:id/reviews (new review visible)"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}❌ FAIL${NC} [not found] GET /products/:id/reviews (new review missing)"
    FAIL=$((FAIL + 1))
fi

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/products/$MONO_PRODUCT_ID/comments)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id/comments" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/products/$MONO_PRODUCT_ID/comments -H "Content-Type: application/json" -d '{"userId":"'"$MONO_USER_ID"'","content":"Test comment from API"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/:id/comments" "201" "$CODE" "$BODY"

# ── Orders (requires auth) ──
echo -e "\n${YELLOW}── Orders ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/orders -H "Content-Type: application/json" -H "Authorization: Bearer $MONO_TOKEN" -d '{"totalAmount":99.99,"products":[{"productId":"'"$MONO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders (create)" "201" "$CODE" "$BODY"
MONO_ORDER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])" 2>/dev/null)
echo -e "     ${CYAN}(Created order ID: $MONO_ORDER_ID for user $MONO_USER_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/orders/$MONO_USER_ID -H "Authorization: Bearer $MONO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /orders/:userId (fetch my orders)" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/orders/$MONO_ORDER_ID/buy -H "Authorization: Bearer $MONO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/:id/buy (checkout)" "200" "$CODE" "$BODY"

# Try buying same order again (should fail)
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/orders/$MONO_ORDER_ID/buy -H "Authorization: Bearer $MONO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/:id/buy (already completed)" "400" "$CODE" "$BODY"

# Create another order then delete it
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/orders -H "Content-Type: application/json" -H "Authorization: Bearer $MONO_TOKEN" -d '{"totalAmount":50,"products":[{"productId":"'"$MONO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
MONO_ORDER_ID2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X DELETE $MONO_URL/orders/$MONO_ORDER_ID2 -H "Authorization: Bearer $MONO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /orders/:id (cancel order)" "200" "$CODE" "$BODY"

# ── Orders (no auth — should fail) ──
echo -e "\n${YELLOW}── Orders Auth Guard ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/orders -H "Content-Type: application/json" -d '{"totalAmount":10,"products":[{"productId":"'"$MONO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders (no token → 401)" "401" "$CODE" "$BODY"

# ── Recommendations ──
echo -e "\n${YELLOW}── Recommendations ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MONO_URL/recommendations/$MONO_USER_ID)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /recommendations/:userId" "200" "$CODE" "$BODY"

# ── LLM ──
echo -e "\n${YELLOW}── LLM ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MONO_URL/llm/summarize -H "Content-Type: application/json" -d '{"text":"This is a test product description for summarization."}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /llm/summarize" "200" "$CODE" "$BODY"

# ─────────────────────────────────────────────────
# MICROSERVICES TESTS (port 8080 via API Gateway)
# ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  MICROSERVICES (localhost:8080)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"

# ── Health ──
echo -e "\n${YELLOW}── Health ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/health)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /health (gateway)" "200" "$CODE" "$BODY"

# ── Auth ──
echo -e "\n${YELLOW}── Auth ──${NC}"
MICRO_USERNAME="microtest_$RANDOM"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/auth/register -H "Content-Type: application/json" -d '{"username":"'"$MICRO_USERNAME"'","password":"testpass123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/register" "201" "$CODE" "$BODY"
MICRO_USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/auth/login -H "Content-Type: application/json" -d '{"username":"'"$MICRO_USERNAME"'","password":"testpass123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/login (correct)" "200" "$CODE" "$BODY"
MICRO_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
MICRO_USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])" 2>/dev/null)
echo -e "     ${CYAN}(User ID: $MICRO_USER_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/auth/login -H "Content-Type: application/json" -d '{"username":"'"$MICRO_USERNAME"'","password":"wrong"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /auth/login (wrong password)" "401" "$CODE" "$BODY"

# ── Products ──
echo -e "\n${YELLOW}── Products ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/products)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products" "200" "$CODE" "$BODY"
MICRO_PRODUCT_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['_id'] if isinstance(d, list) else d['products'][0]['_id'])" 2>/dev/null)
echo -e "     ${CYAN}(Using product ID: $MICRO_PRODUCT_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/products/$MICRO_PRODUCT_ID)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/products/$MICRO_PRODUCT_ID/reviews)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id/reviews" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/products/$MICRO_PRODUCT_ID/reviews -H "Content-Type: application/json" -H "Authorization: Bearer $MICRO_TOKEN" -d '{"userId":"'"$MICRO_USER_ID"'","title":"Test Review","content":"Automated test review","rating":5}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/:id/reviews (create)" "201" "$CODE" "$BODY"
MICRO_REVIEW_ID=$(echo "$BODY" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('review',r).get('_id',''))" 2>/dev/null)
echo -e "     ${CYAN}(Created review ID: $MICRO_REVIEW_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/products/$MICRO_PRODUCT_ID/reviews)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
REVIEW_FOUND=$(echo "$BODY" | python3 -c "import sys,json; reviews=json.load(sys.stdin); print('yes' if any(r.get('title')=='Test Review' for r in reviews) else 'no')" 2>/dev/null)
if [ "$REVIEW_FOUND" == "yes" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} [verified] GET /products/:id/reviews (new review visible)"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}❌ FAIL${NC} [not found] GET /products/:id/reviews (new review missing)"
    FAIL=$((FAIL + 1))
fi

RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/products/$MICRO_PRODUCT_ID/comments)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /products/:id/comments" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/products/$MICRO_PRODUCT_ID/comments -H "Content-Type: application/json" -H "Authorization: Bearer $MICRO_TOKEN" -d '{"userId":"'"$MICRO_USER_ID"'","content":"Test comment from API"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /products/:id/comments (async via RabbitMQ)" "202" "$CODE" "$BODY"

# ── Orders (requires auth via x-user-id) ──
echo -e "\n${YELLOW}── Orders ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/orders -H "Content-Type: application/json" -H "Authorization: Bearer $MICRO_TOKEN" -d '{"totalAmount":99.99,"products":[{"productId":"'"$MICRO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders (create)" "201" "$CODE" "$BODY"
MICRO_ORDER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['_id'])" 2>/dev/null)
echo -e "     ${CYAN}(Created order ID: $MICRO_ORDER_ID)${NC}"

RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/orders/$MICRO_USER_ID -H "Authorization: Bearer $MICRO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /orders/:userId (fetch my orders)" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/orders/$MICRO_ORDER_ID/buy -H "Authorization: Bearer $MICRO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/:id/buy (checkout)" "200" "$CODE" "$BODY"

# Try buying same order again (should fail)
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/orders/$MICRO_ORDER_ID/buy -H "Authorization: Bearer $MICRO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders/:id/buy (already completed)" "400" "$CODE" "$BODY"

# Create another order then delete it
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/orders -H "Content-Type: application/json" -H "Authorization: Bearer $MICRO_TOKEN" -d '{"totalAmount":50,"products":[{"productId":"'"$MICRO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
MICRO_ORDER_ID2=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['_id'])" 2>/dev/null)

RESP=$(curl -s -w "\n%{http_code}" -X DELETE $MICRO_URL/orders/$MICRO_ORDER_ID2 -H "Authorization: Bearer $MICRO_TOKEN")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "DELETE /orders/:id (cancel order)" "200" "$CODE" "$BODY"

# ── Orders Auth Guard ──
echo -e "\n${YELLOW}── Orders Auth Guard ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/orders -H "Content-Type: application/json" -d '{"totalAmount":10,"products":[{"productId":"'"$MICRO_PRODUCT_ID"'","quantity":1}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /orders (no token → 401)" "401" "$CODE" "$BODY"

# ── Recommendations ──
echo -e "\n${YELLOW}── Recommendations ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" $MICRO_URL/recommendations/$MICRO_USER_ID)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /recommendations/:userId" "200" "$CODE" "$BODY"

# ── LLM ──
echo -e "\n${YELLOW}── LLM ──${NC}"
RESP=$(curl -s -w "\n%{http_code}" -X POST $MICRO_URL/llm/summarize -H "Content-Type: application/json" -H "Authorization: Bearer $MICRO_TOKEN" -d '{"text":"This is a test product description for summarization."}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /llm/summarize" "200" "$CODE" "$BODY"

# ─────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  TEST SUMMARY${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  Total:  $TOTAL"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}🎉 ALL TESTS PASSED!${NC}"
else
    echo -e "  ${RED}${BOLD}⚠️  $FAIL TEST(S) FAILED${NC}"
fi
echo ""

# ─────────────────────────────────────────────────
# CLEANUP — delete test-generated comments
# ─────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  CLEANUP${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════${NC}"

RESP=$(curl -s -w "\n%{http_code}" -X DELETE $MONO_URL/products/comments/k6)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" == "200" ]; then
    echo -e "  ${GREEN}✅ Monolith:      $BODY${NC}"
else
    echo -e "  ${RED}❌ Monolith cleanup failed [$CODE]: $BODY${NC}"
fi

RESP=$(curl -s -w "\n%{http_code}" -X DELETE $MICRO_URL/products/comments/k6)
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$CODE" == "200" ]; then
    echo -e "  ${GREEN}✅ Microservices: $BODY${NC}"
else
    echo -e "  ${RED}❌ Microservices cleanup failed [$CODE]: $BODY${NC}"
fi
echo ""
