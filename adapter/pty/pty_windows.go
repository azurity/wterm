package pty

import (
	"fmt"
	"github.com/azurity/go-conpty"
	"os"
	"os/exec"
	"wterm/core"
)

type ShellSession struct {
	*conpty.ConPty
}

func (ss *ShellSession) Resize(rows int, cols int) {
	_ = ss.ConPty.Resize(rows, cols)
}

func (ss *ShellSession) Close() error {
	ss.Kill()
	return ss.ConPty.Close()
}

func (instance *Instance) NewShell(id uint16) core.ShellSession {
	dir, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	cmd := exec.Command(instance.config.CMD[0], instance.config.CMD[1:]...)
	if instance.config.TermType != "" {
		env := append([]string{}, os.Environ()...)
		for index, it := range env {
			if len(it) >= 5 && it[:5] == "TERM=" {
				env[index] = fmt.Sprintf("TERM=%s", instance.config.TermType)
			}
		}
		cmd.Env = env
	}
	cmd.Dir = dir
	pty, err := conpty.Start(cmd)
	//ptyFile, err := pty.Start(cmd)
	if err != nil {
		return nil
	}
	return &ShellSession{pty}
}
