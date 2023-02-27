package pty

import (
	"fmt"
	"github.com/creack/pty"
	"os"
	"os/exec"
	"wterm/core"
)

type ShellSession struct {
	*os.File
	cmd *exec.Cmd
}

func (ss *ShellSession) Close() error {
	ss.cmd.Process.Kill()
	return ss.File.Close()
}

func (ss *ShellSession) Resize(rows int, cols int) {
	pty.Setsize(ss.File, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
}

func (instance *Instance) NewShell(id uint16) core.ShellSession {
	dir, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	cmd := exec.Command(instance.config.CMD[0], instance.config.CMD[1:]...)
	if instance.config.TermType != "" {
		termStr := fmt.Sprintf("TERM=%s", instance.config.TermType)
		env := append([]string{termStr}, os.Environ()...)
		for index, it := range env {
			if len(it) >= 5 && it[:5] == "TERM=" {
				env[index] = termStr
			}
		}
		cmd.Env = env
	}
	cmd.Dir = dir
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return nil
	}
	return &ShellSession{ptyFile, cmd}
}
