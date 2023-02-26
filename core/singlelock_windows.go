package core

import (
	"fmt"
	"github.com/Microsoft/go-winio"
	"net"
	"os/user"
)

var spipe net.Listener

func SingleLock() bool {
	u, err := user.Current()
	if err != nil {
		return false
	}
	pipeName := fmt.Sprintf(`\\.\pipe\wterm-lock-%s`, u.Username)
	spipe, err = winio.ListenPipe(pipeName, nil)
	return err == nil
}

func SingleUnlock() {
	if spipe != nil {
		spipe.Close()
	}
}
