package ui

import (
	"fmt"
	"golang.org/x/sys/unix"
	"syscall"
)

var tauriFileName string
var tauriFd int

func tauriExec() (string, error) {
	if tauriFileName == "" {
		fd, err := unix.MemfdCreate("", 0)
		if err != nil {
			return "", err
		}
		_, err = syscall.Write(fd, tauriFile)
		if err != nil {
			unix.Close(fd)
			return "", err
		}
		tauriFileName = fmt.Sprintf("/proc/self/fd/%d", fd)
		tauriFd = fd
	}
	return tauriFileName, nil
}

func tauriClear() {
	if tauriFileName != "" {
		tauriFileName = ""
		unix.Close(tauriFd)
	}
}
