#!/usr/bin/env bash
# Run the website in a detached screen session so it outlives your terminal.
#   ./screen.sh            start (LAN by default)
#   ./screen.sh stop
#   ./screen.sh status
#   screen -r course       attach; ctrl-a d to detach
set -euo pipefail
cd "$(dirname "$0")"
S=course
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

up() { screen -ls 2>/dev/null | grep -q "[.]$S[[:space:]]"; }

case "${1:-start}" in
  stop)
    up && screen -S "$S" -X quit >/dev/null 2>&1 && echo "stopped" || echo "not running"
    exit 0 ;;
  status)
    screen -ls 2>/dev/null | grep "$S" || echo "no session"
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/" || echo 000)
    [ "$code" = "200" ] && echo "site :$PORT -> up" || echo "site :$PORT -> down ($code)"
    exit 0 ;;
esac

up && { screen -S "$S" -X quit >/dev/null 2>&1 || true; sleep 1; }
screen -dmS "$S" bash -c "PORT='$PORT' HOST='$HOST' ./run.sh 2>&1 | tee -a /tmp/course-site.log"

for _ in $(seq 1 20); do
  sleep 1
  if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/"; then
    lan=$(ip -4 -o addr show scope global 2>/dev/null \
          | awk '$2 !~ /^(docker|br-|veth|virbr|lo)/ {print $4}' | cut -d/ -f1 | head -1)
    echo
    echo "  site   http://${lan:-127.0.0.1}:$PORT"
    echo "  screen -r $S     (detach: ctrl-a d)"
    exit 0
  fi
done
echo "did not start; last output:" >&2
tail -20 /tmp/course-site.log >&2
exit 1
