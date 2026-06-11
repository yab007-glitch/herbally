#!/bin/bash
# Check Upstash Redis usage for 1Herb
# Usage: ./scripts/check-redis-usage.sh

# Load environment variables from .env.local or .env if they exist
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

REDIS_URL_FULL="${UPSTASH_REDIS_REST_URL}"
REDIS_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"

if [ -z "$REDIS_URL_FULL" ] || [ -z "$REDIS_TOKEN" ]; then
  echo "❌ Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured."
  echo "Please check your .env.local or .env file."
  exit 1
fi

echo "📊 Upstash Redis Usage for 1Herb"
echo "================================"

# Get memory info
MEMORY=$(curl -s -X POST "${REDIS_URL_FULL}/pipeline" \
  -H "Authorization: Bearer ${REDIS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[["INFO", "memory"]]' | jq -r '.[0].result' 2>/dev/null)

echo ""
echo "💾 Memory:"
echo "$MEMORY" | grep -E "used_memory_human|maxmemory_human" | while read line; do
  echo "   $line"
done

# Get stats
STATS=$(curl -s -X POST "${REDIS_URL_FULL}/pipeline" \
  -H "Authorization: Bearer ${REDIS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[["INFO", "stats"]]' | jq -r '.[0].result' 2>/dev/null)

echo ""
echo "📈 Stats:"
echo "$STATS" | grep -E "total_commands_processed|instantaneous_ops_per_sec|max_ops_per_sec" | while read line; do
  echo "   $line"
done

# Get key count
KEYS=$(curl -s -X POST "${REDIS_URL_FULL}/pipeline" \
  -H "Authorization: Bearer ${REDIS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[["DBSIZE"]]' | jq -r '.[0].result' 2>/dev/null)

echo ""
echo "🔑 Keys: $KEYS"

# Daily limits
echo ""
echo "📋 Free Tier Limits:"
echo "   Commands: 10,000/day"
echo "   Bandwidth: 256 MB/day"
echo "   Memory: 256 MB"
echo ""
echo "Console: https://console.upstash.com/redis/93618e01-838d-4b4e-b5c9-dc6212e5f000"