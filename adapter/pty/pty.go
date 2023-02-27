package pty

import (
	"encoding/json"
	"fmt"
	hos "github.com/hack-pad/hackpadfs/os"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"wterm/core"
)

type FilesystemSession struct {
	hos.FS
}

func (ss *FilesystemSession) SubVolume(volumeName string) (core.FSBase, error) {
	f, err := ss.FS.SubVolume(volumeName)
	return f.(core.FSBase), err
}

func (ss *FilesystemSession) Getwd() (string, error) {
	path, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(path), nil
}

func (ss *FilesystemSession) Close() error {
	return nil
}

type Instance struct {
	config Config
}

func (instance *Instance) Connect(auth chan bool, callback func(question string)) error {
	auth <- true
	return nil
}

func (instance *Instance) Auth(info core.AuthDesc) {}

func (instance *Instance) NewFS(id uint16) core.FilesystemSession {
	return &FilesystemSession{*hos.NewFS()}
}

func (*Instance) IsWindowsPath() bool {
	return runtime.GOOS == "windows"
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
