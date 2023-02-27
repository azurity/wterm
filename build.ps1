rm -Recurse -Force ui/frontend
rm -Recurse -Force webapp/build
cd webapp
npm install
npm run build
cd ..
cp -Recurse webapp/build ui/frontend
cd tauri-app
npm install
npm run build
cd ..
cp tauri-app/src-tauri/target/release/tauri-app.exe ui/tauri-app
go mod download
go-winres simply --icon tauri-app/src-tauri/icons/icon.ico --out wterm
$env:CGO_ENABLED=0
go build -ldflags="-H windowsgui" -o dist/wterm_$(go env GOOS)_$(go env GOARCH).exe .
