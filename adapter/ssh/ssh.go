package ssh

import (
	"encoding/json"
	"fmt"
	"github.com/hack-pad/hackpadfs"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"io"
	"io/fs"
	"log"
	"net"
	"path"
	"wterm/core"
)

type Config struct {
	core.ConfigBase
	TermType string `json:"termType"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"` // optional
	Password string `json:"password"` // optional
}

type Instance struct {
	client       *ssh.Client
	config       Config
	authChan     chan bool
	authCB       func(question string)
	passwordChan chan string
	updateConfig func(username string, password string) // TODO:
}

func (instance *Instance) connectImpl() {
	authMethods := []ssh.AuthMethod{}
	// TODO: support key file here
	if instance.config.Password != "" {
		authMethods = append(authMethods, ssh.Password(instance.config.Password))
	} else {
		authMethods = append(authMethods, ssh.PasswordCallback(func() (secret string, err error) {
			instance.authCB("password")
			password := <-instance.passwordChan
			return password, nil
		}))
	}
	clientConf := &ssh.ClientConfig{
		Config: ssh.Config{},
		User:   instance.config.Username,
		Auth:   authMethods,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			return nil
		},
	}
	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", instance.config.Host, instance.config.Port), clientConf)
	if err != nil {
		instance.authChan <- false
		// TODO:
		return
	}
	instance.client = client
	instance.authChan <- true
}

func (instance *Instance) Connect(auth chan bool, callback func(question string)) error {
	instance.authChan = auth
	instance.authCB = callback
	if instance.config.Username == "" {
		go func() {
			callback("username")
		}()
		return nil
	} else {
		go instance.connectImpl()
		return nil
	}
}

func (instance *Instance) Auth(info core.AuthDesc) {
	if info.Question == "username" {
		instance.config.Username = info.Password
		// TODO: proc save
		go instance.connectImpl()
	} else if info.Question == "password" {
		instance.config.Password = info.Password
		// TODO: proc save
		instance.passwordChan <- instance.config.Password
	}
}

func (instance *Instance) NewShell(id uint16) core.ShellSession {
	if instance.client == nil {
		return nil
	}
	session, err := instance.client.NewSession()
	if err != nil {
		// TODO:
		return nil
	}
	termType := instance.config.TermType
	if termType == "" {
		termType = "xterm-256color"
	}
	mode := ssh.TerminalModes{
		ssh.ECHO: 1,
	}
	if err = session.RequestPty(termType, 40, 80, mode); err != nil {
		_ = session.Close()
		// TODO:
		return nil
	}
	sinr, sinw := io.Pipe()
	soutr, soutw := io.Pipe()
	session.Stdin = sinr
	session.Stdout = soutw
	session.Stderr = soutw
	if err = session.Shell(); err != nil {
		_ = session.Close()
		// TODO:
		return nil
	}
	return &ShellSession{
		session: session,
		reader:  soutr,
		writer:  sinw,
	}
}

func (instance *Instance) NewFS(id uint16) core.FilesystemSession {
	client, err := sftp.NewClient(instance.client)
	if err != nil {
		// TODO:
		return nil
	}
	return &FilesystemSession{client}
}

func (*Instance) IsWindowsPath() bool {
	return false
}

type ShellSession struct {
	session *ssh.Session
	reader  io.Reader
	writer  io.Writer
}

func (s *ShellSession) Read(p []byte) (n int, err error) {
	return s.reader.Read(p)
}

func (s *ShellSession) Write(p []byte) (n int, err error) {
	return s.writer.Write(p)
}

func (s *ShellSession) Close() error {
	return s.session.Close()
}

func (s *ShellSession) Resize(rows int, cols int) {
	_ = s.session.WindowChange(rows, cols)
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
		client:       nil,
		config:       *config.(*Config),
		authChan:     nil,
		authCB:       nil,
		passwordChan: make(chan string),
		updateConfig: nil, // TODO:
	}
}

func (helper *ConfigHelper) Info(host string, id uint64, config interface{}) core.ConnectionInfo {
	cased := config.(*Config)
	return core.ConnectionInfo{
		Id:       int(id),
		Name:     cased.Name,
		URL:      fmt.Sprintf("%s/ws?id=%d", host, id),
		Protocol: "standard",
	}
}

type FilesystemSession struct {
	client *sftp.Client
}

func pathProc(name string) string {
	return path.Clean(path.Join("/", name))
}

func (ss *FilesystemSession) Open(name string) (fs.File, error) {
	name = pathProc(name)
	return ss.client.Open(name)
}

func (ss *FilesystemSession) OpenFile(name string, flag int, perm hackpadfs.FileMode) (hackpadfs.File, error) {
	name = pathProc(name)
	return ss.client.OpenFile(name, flag)
}

func (ss *FilesystemSession) Rename(oldname, newname string) error {
	oldname = pathProc(oldname)
	newname = pathProc(newname)
	return ss.client.Rename(oldname, newname)
}

//func (ss *FilesystemSession) Stat(name string) (hackpadfs.FileInfo, error) {
//	return ss.client.Stat(name)
//}

type sftpDirEntry struct {
	name string
	typ  hackpadfs.FileMode
	info hackpadfs.FileInfo
}

func (d *sftpDirEntry) Name() string                      { return d.name }
func (d *sftpDirEntry) IsDir() bool                       { return d.typ.IsDir() }
func (d *sftpDirEntry) Type() hackpadfs.FileMode          { return d.typ }
func (d *sftpDirEntry) Info() (hackpadfs.FileInfo, error) { return d.info, nil }

func (ss *FilesystemSession) ReadDir(name string) ([]hackpadfs.DirEntry, error) {
	name = pathProc(name)
	list, err := ss.client.ReadDir(name)
	if err != nil {
		return nil, err
	}
	ret := []hackpadfs.DirEntry{}
	for _, it := range list {
		ret = append(ret, &sftpDirEntry{
			name: it.Name(),
			typ:  it.Mode(),
			info: it,
		})
	}
	return ret, nil
}

func (ss *FilesystemSession) Remove(name string) error {
	name = pathProc(name)
	return ss.client.Remove(name)
}

func (ss *FilesystemSession) Mkdir(name string, perm hackpadfs.FileMode) error {
	name = pathProc(name)
	return ss.client.Mkdir(name)
}

func (ss *FilesystemSession) SubVolume(volumeName string) (core.FSBase, error) {
	// TODO: maybe return error?
	return ss, nil
}

func (ss *FilesystemSession) Getwd() (string, error) {
	return ss.client.Getwd()
}

func (ss *FilesystemSession) Close() error {
	return ss.client.Close()
}
