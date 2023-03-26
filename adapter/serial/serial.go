package serial

import (
	"encoding/json"
	"fmt"
	"go.bug.st/serial"
	"log"
	"wterm/core"
)

type Config struct {
	core.ConfigBase
	Serial string `json:"serial"`
	Rate   int    `json:"rate"`
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
	port, err := serial.Open(instance.config.Serial, &serial.Mode{
		BaudRate: instance.config.Rate,
	})
	if err != nil {
		return nil
	}
	return &ShellSession{
		session: port,
	}
}

func (instance *Instance) NewFS(id uint16) core.FilesystemSession {
	return nil
}

func (*Instance) IsWindowsPath() bool {
	return false
}

type ShellSession struct {
	session serial.Port
}

func (s *ShellSession) Read(p []byte) (n int, err error) {
	return s.session.Read(p)
}

func (s *ShellSession) Write(p []byte) (n int, err error) {
	return s.session.Write(p)
}

func (s *ShellSession) Close() error {
	return s.session.Close()
}

func (s *ShellSession) Resize(rows int, cols int) {
	//_ = s.session.WindowChange(rows, cols)
}

type ConfigHelper struct {
}

func (helper *ConfigHelper) LoadConfig(data []byte) interface{} {
	ret := Config{}
	err := json.Unmarshal(data, &ret)
	if err != nil {
		log.Println(err)
		return nil
	}
	return &ret
}

func (helper *ConfigHelper) StoreConfig(config interface{}) []byte {
	ret, err := json.Marshal(config)
	if err != nil {
		log.Println(err)
		return nil
	}
	return ret
}

func (helper *ConfigHelper) New(config interface{}) core.ServeInstance {
	return &Instance{
		config: *config.(*Config),
	}
}

func (helper *ConfigHelper) Info(host string, id uint64, config interface{}) core.ConnectionInfo {
	cased := config.(*Config)
	return core.ConnectionInfo{
		Id:       int(id),
		Name:     cased.Name,
		URL:      fmt.Sprintf("%s/ws?id=%d", host, id),
		Protocol: "standard",
		FixSize:  true,
	}
}
