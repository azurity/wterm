#!/usr/bin/bash
rm -rf ui/frontend
rm -rf webapp/build
cd webapp
npm install
npm run build
cd ..
cp -r webapp/build ui/frontend
go mod download
go build -o dist/wterm_$(go env GOOS)_$(go env GOARCH) .
