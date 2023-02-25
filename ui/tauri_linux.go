package ui

import (
	"fmt"
	"golang.org/x/sys/unix"
	"syscall"
)

func TauriExecFile() (string, error) {
	if tauriFileName != "" {
		return tauriFileName, nil
	}
	fd, err := unix.MemfdCreate("", 0)
	if err != nil {
		return "", err
	}
	_, err = syscall.Write(fd, tauriFile)
	if err != nil {
		return "", err
	}
	tauriFileName = fmt.Sprintf("/proc/self/fd/%d", fd)
	return tauriFileName, nil
}
