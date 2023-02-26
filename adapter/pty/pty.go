package pty

import (
	"encoding/json"
	"fmt"
	"github.com/creack/pty"
	hos "github.com/hack-pad/hackpadfs/os"
	"log"
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

type FilesystemSession struct {
	hos.FS
}

func (ss *FilesystemSession) Getwd() (string, error) {
	return os.UserHomeDir()
}

func (ss *FilesystemSession) Close() error {
	return nil
}

func (ss *ShellSession) Resize(rows int, cols int) {
	pty.Setsize(ss.File, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
}

type Instance struct {
	config Config
}

func (instance *Instance) Connect(auth chan bool, callback func(question string)) error {
	auth <- true
	return nil
}

func (instance *Instance) Auth(info core.AuthDesc) {}

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
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return nil
	}
	return &ShellSession{ptyFile, cmd}
}

func (instance *Instance) NewFS(id uint16) core.FilesystemSession {
	return &FilesystemSession{*hos.NewFS()}
}

type Config struct {
	core.ConfigBase
	CMD      []string `json:"cmd"`
	TermType string   `json:"termType"`
}

type ConfigHelper struct {
}

func (h *ConfigHelper) LoadConfig(data []byte) interface{} {
	ret := Config{}
	err := json.Unmarshal(data, &ret)
	if err != nil {
		log.Println(err)
		return nil
	}
	return &ret
}

func (h *ConfigHelper) StoreConfig(config interface{}) []byte {
	ret, err := json.Marshal(config)
	if err != nil {
		log.Println(err)
		return nil
	}
	return ret
}

func (h *ConfigHelper) New(config interface{}) core.ServeInstance {
	return &Instance{
		config: *config.(*Config),
	}
}

func (h *ConfigHelper) Info(host string, id uint64, config interface{}) core.ConnectionInfo {
	cased := config.(*Config)
	return core.ConnectionInfo{
		Id:       int(id),
		Name:     cased.Name,
		URL:      fmt.Sprintf("%s/ws?id=%d", host, id),
		Protocol: "standard",
	}
}
