#!/usr/bin/env bash
# FixIt dev server auto-restart wrapper.
# The Next.js 16 dev server occasionally gets OOM-killed in the 4GB cgroup.
# This wrapper restarts it automatically so the Preview Panel stays available.
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1400"
while true; do
  echo "[$(date +%H:%M:%S)] starting next dev (webpack)..."
  node node_modules/next/dist/bin/next dev -p 3000 --webpack 2>&1 | tee -a /home/z/my-project/dev.log
  echo "[$(date +%H:%M:%S)] next dev exited (code $?); restarting in 3s..."
  sleep 3
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1
done
