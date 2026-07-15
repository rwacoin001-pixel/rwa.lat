@echo off
set APP_ENV=development
set NODE_ENV=development
set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rwa_lat_dev
set S3_REGION=us-east-1
set S3_ENDPOINT=http://localhost:9000
set S3_ACCESS_KEY=minioadmin
set S3_SECRET_KEY=minioadmin
cd /d D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\apps\api
node dist/main.js