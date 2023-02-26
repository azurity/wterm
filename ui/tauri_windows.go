package ui

import (
	"fmt"
	"os"
	"path"
)

var tauriFileName string

func tauriExec() (string, error) {
	if tauriFileName == "" {
		file, err := os.OpenFile(path.Join(os.TempDir(), "wterm-1.0-tauri.exe"), os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0700)
		if err != nil {
			return "", err
		}
		_, err = file.Write(tauriFile)
		if err != nil {
			return "", err
		}
		tauriFileName = file.Name()
		file.Close()
	}
	return tauriFileName, nil
}

func tauriClear() {
	if tauriFileName != "" {
		err := os.Remove(tauriFileName)
		if err != nil {
			fmt.Println(err)
		}
	}
}
