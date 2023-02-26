package ui

import (
	_ "embed"
	"fmt"
	"os/exec"
)

//go:embed tauri-app
var tauriFile []byte

var cmdList = []*exec.Cmd{}

func TauriExec() *exec.Cmd {
	name, err := tauriExec()
	if err != nil {
		return nil
	}
	cmd := exec.Command(name, "--title-padding", "160px", "--app", "http://localhost:32300/?custom")
	cmdList = append(cmdList, cmd)
	return cmd
}

func TauriClear() {
	for _, cmd := range cmdList {
		if cmd.Process != nil {
			cmd.Process.Kill()
			err := cmd.Wait()
			fmt.Println(err)
		}
	}
	cmdList = []*exec.Cmd{}
	tauriClear()
}
