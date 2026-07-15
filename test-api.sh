#!/bin/bash
# Start Core API and test health
echo "Starting Core API..."
cd D:/360MoveData/Users/Administrator/Desktop/rwa.lat/rwa-lat/apps/api
node dist/main.js &
API_PID=$!
sleep 15
echo "Testing health..."
curl -s http://localhost:4000/v1/health
echo ""
if [ $? -eq 0 ]; then
  echo "Core API is healthy!"
else
  echo "Core API failed to respond"
fi
# Keep running
wait $API_PID