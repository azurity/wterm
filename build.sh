#!/usr/bin/bash
rm -rf ui/frontend
rm -rf webapp/build
cd webapp
npm install
npm run build
cd ..
cp -r webapp/build ui/frontend
cd tauri-app
npm install
npm run build
cd ..
cp tauri-app/src-tauri/target/release/tauri-app ui/
go mod download
go build -o dist/wterm_$(go env GOOS)_$(go env GOARCH) .
