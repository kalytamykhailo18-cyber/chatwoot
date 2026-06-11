#!/usr/bin/env bash
# Full test suite for the Articket Chatwoot deployment.
# Layers: API checks -> Playwright E2E (panel + widget) -> email round-trip.
set -uo pipefail
cd "$(dirname "$0")"

fail=0
echo "############ 1) API CHECKS ############"
node api-check.js || fail=1

echo "############ 2) E2E (panel + widget) ############"
npx playwright test || fail=1

echo "############ 3) EMAIL ROUND-TRIP ############"
node email-roundtrip.js || fail=1

echo "############ CLEANUP TEST DATA ############"
./cleanup.sh || true

if [ "$fail" -eq 0 ]; then
  echo "============ ALL TESTS PASSED ============"
else
  echo "============ SOME TESTS FAILED ============"
fi
exit $fail
