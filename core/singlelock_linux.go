package core

import (
	"golang.org/x/sys/unix"
	"os"
	"path"
)

var lockPath string
var file *os.File

func SingleLock() bool {
	dir, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	lockPath = path.Join(dir, ".wterm.lock")
	file, err = os.OpenFile(lockPath, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0700)
	if err != nil {
		return false
	}
	err = unix.Flock(int(file.Fd()), unix.LOCK_EX|unix.LOCK_NB)
	if err != nil {
		file.Close()
		file = nil
		return false
	}
	return true
}

func SingleUnlock() {
	if file != nil {
		unix.Flock(int(file.Fd()), unix.LOCK_UN)
		file.Close()
		os.Remove(lockPath)
		file = nil
	}
}
