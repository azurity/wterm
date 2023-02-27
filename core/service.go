package core

import (
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/hack-pad/hackpadfs"
	"github.com/ncruces/zenity"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sync"
	"sync/atomic"
)

type ShellSession interface {
	io.ReadWriteCloser
	Resize(rows int, cols int)
}

type FSBase interface {
	hackpadfs.FS
	hackpadfs.OpenFileFS
	hackpadfs.RenameFS
	//hackpadfs.StatFS // maybe use lstat?
	hackpadfs.ReadDirFS
	hackpadfs.RemoveFS
	hackpadfs.MkdirFS
}

type FilesystemSession interface {
	FSBase
	SubVolume(volumeName string) (FSBase, error)
	Getwd() (string, error)
	io.Closer
}

type ServeInstance interface {
	Connect(auth chan bool, callback func(question string)) error
	Auth(info AuthDesc)
	NewShell(id uint16) ShellSession
	NewFS(id uint16) FilesystemSession
	IsWindowsPath() bool
}

func shellSessionReader(id uint16, ss ShellSession, conn *WsProtocol) {
	buf := make([]byte, 1024)
	for {
		n, err := ss.Read(buf)
		if n > 0 {
			err = conn.TermData(id, buf[:n])
			if conn.Closed {
				return
			} else if err != nil {
				//logError(err)
				break
			}
		}
		if err != nil {
			break
		}
	}
}

var DownloadUrlSet = sync.Map{}
var downloadUrlName = new(uint64)
var UploadUrlSet = sync.Map{}
var uploadUrlName = new(uint64)

func ServeWS(c *websocket.Conn, instance ServeInstance) error {
	conn := &WsProtocol{
		Conn:       c,
		Closed:     false,
		CloseChan:  make(chan bool),
		sendChan:   make(chan []byte),
		sendCbChan: make(chan error),
	}
	go conn.Start()
	var err error
	authChan := make(chan bool)
	authorized := false
	updateAuth := make(chan bool)
	go func() {
		result := <-authChan
		if !result {
			c.Close()
			conn.Closed = true
			conn.CloseChan <- true
			return
		}
		authorized = true
		updateAuth <- true
	}()
	// start connect
	err = instance.Connect(authChan, func(question string) {
		conn.Auth(question)
	})
	if err != nil {
		return err
	}
	sessionSet := sync.Map{}
	go func() {
		type packType struct {
			ssid uint16
			msg  interface{}
		}
		caches := []packType{}
		recvChan := make(chan packType)
		go func() {
			for {
				ssid, msg, err := conn.Recv()
				if err != nil {
					if conn.Closed {
						break
					}
					// logError
					break
				}
				recvChan <- packType{ssid, msg}
			}
			recvChan <- packType{0, nil}
		}()
		for {
			pack := packType{}
			if !authorized {
				select {
				case pack = <-recvChan:
					if pack.msg == nil {
						return
					}
					break
				case <-updateAuth:
					continue
				}
			} else {
				if len(caches) > 0 {
					pack = caches[0]
					caches = caches[1:]
				} else {
					pack = <-recvChan
				}
			}
			ssid := pack.ssid
			msg := pack.msg
			if !authorized {
				if cased, ok := msg.(*AuthDesc); ok {
					instance.Auth(*cased)
				} else {
					caches = append(caches, pack)
				}
			} else {
				var err error
				if cased, ok := msg.(*NewSessionDesc); ok {
					if _, ok := sessionSet.Load(ssid); ok {
						err = conn.NewSession(ssid, false, false)
					} else if cased.Type == SESSION_SHELL {
						ret := instance.NewShell(ssid)
						if ret != nil {
							sessionSet.Store(ssid, ret)
							go shellSessionReader(ssid, ret, conn)
						}
						err = conn.NewSession(ssid, ret != nil, instance.IsWindowsPath())
					} else if cased.Type == SESSION_SFTP {
						ret := instance.NewFS(ssid)
						if ret != nil {
							sessionSet.Store(ssid, ret)
						}
						err = conn.NewSession(ssid, ret != nil, instance.IsWindowsPath())
					} else {
						// TODO:
						err = conn.NewSession(ssid, false, false)
					}
				} else if _, ok := msg.(*CloseSessionDesc); ok {
					if session, ok := sessionSet.Load(ssid); ok {
						err = session.(io.Closer).Close()
						sessionSet.Delete(ssid)
					}
				} else if cased, ok := msg.([]byte); ok {
					if session, ok := sessionSet.Load(ssid); ok {
						_, err = session.(ShellSession).Write(cased)
					}
				} else if cased, ok := msg.(*FsOperationDesc); ok {
					if session, ok := sessionSet.Load(ssid); ok {
						switch uint8(cased.Op) {
						case FSOP_GETWD:
							var path string
							path, err = session.(FilesystemSession).Getwd()
							if err != nil {
								// TODO:
								path = ""
							}
							err = conn.FsOperation(ssid, FSOP_GETWD, path)
							break
						case FSOP_READDIR:
							var list []hackpadfs.DirEntry
							vol, name := formatVolume(cased.Args[0], instance.IsWindowsPath())
							ssFS := session.(FSBase)
							if vol != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS READDIR] %s", err.Error()),
									})
									break
								}
							}
							list, err = ssFS.(FSBase).ReadDir(name)
							if err != nil {
								err = conn.Info(InfoDesc{
									Type: "ERROR",
									Info: fmt.Sprintf("[FS READDIR] %s", err.Error()),
								})
							} else {
								ret := []WebDirEntry{}
								for _, it := range list {
									info, _ := it.Info()
									ret = append(ret, WebDirEntry{
										Name:    it.Name(),
										Dir:     it.IsDir(),
										ModTime: info.ModTime().UnixMilli(),
										Perm:    int(info.Mode() & fs.ModePerm),
									})
								}
								err = conn.FsOperation(ssid, FSOP_READDIR, ret)
							}
							break
						case FSOP_MKDIR:
							vol, name := formatVolume(cased.Args[0], instance.IsWindowsPath())
							ssFS := session.(FSBase)
							if vol != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS MKDIR] %s", err.Error()),
									})
									break
								}
							}
							err = ssFS.(FSBase).Mkdir(name, 0755)
							if err != nil {
								err = conn.Info(InfoDesc{
									Type: "ERROR",
									Info: fmt.Sprintf("[FS MKDIR] %s", err.Error()),
								})
							} else {
								err = conn.FsOperation(ssid, FSOP_MKDIR, "")
							}
							break
						case FSOP_REMOVE:
							vol, name := formatVolume(cased.Args[0], instance.IsWindowsPath())
							ssFS := session.(FSBase)
							if vol != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS REMOVE] %s", err.Error()),
									})
									break
								}
							}
							err = ssFS.(FSBase).Remove(name)
							if err != nil {
								err = conn.Info(InfoDesc{
									Type: "ERROR",
									Info: fmt.Sprintf("[FS REMOVE] %s", err.Error()),
								})
							} else {
								err = conn.FsOperation(ssid, FSOP_REMOVE, "")
							}
							break
						case FSOP_RENAME:
							vol0, name0 := formatVolume(cased.Args[0], instance.IsWindowsPath())
							vol1, name1 := formatVolume(cased.Args[1], instance.IsWindowsPath())
							if vol0 != vol1 {
								err = conn.Info(InfoDesc{
									Type: "ERROR",
									Info: "[FS RENAME] file not in same volume",
								})
								break
							}
							ssFS := session.(FSBase)
							if vol0 != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol0)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS RENAME] %s", err.Error()),
									})
									break
								}
							}
							err = ssFS.(FSBase).Rename(name0, name1)
							if err != nil {
								err = conn.Info(InfoDesc{
									Type: "ERROR",
									Info: fmt.Sprintf("[FS RENAME] %s", err.Error()),
								})
							} else {
								err = conn.FsOperation(ssid, FSOP_RENAME, "")
							}
							break
						case FSOP_DOWNLOAD_FILE:
							vol, name := formatVolume(cased.Args[0], instance.IsWindowsPath())
							ssFS := session.(FSBase)
							if vol != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS DOWNLOAD] %s", err.Error()),
									})
									break
								}
							}
							var file hackpadfs.File
							file, err = ssFS.(FSBase).Open(name)
							if err != nil {
								err = conn.FsOperation(ssid, FSOP_DOWNLOAD_FILE, []string{"", ""})
							} else {
								id := atomic.AddUint64(downloadUrlName, 1)
								DownloadUrlSet.Store(id, file)
								stat, _ := file.Stat()
								err = conn.FsOperation(ssid, FSOP_DOWNLOAD_FILE, []string{stat.Name(), fmt.Sprintf("/api/download?id=%d", id)})
							}
							break
						case FSOP_UPLOAD_FILE:
							vol, name := formatVolume(cased.Args[0], instance.IsWindowsPath())
							ssFS := session.(FSBase)
							if vol != "" {
								ssFS, err = ssFS.(FilesystemSession).SubVolume(vol)
								if err != nil {
									err = conn.Info(InfoDesc{
										Type: "ERROR",
										Info: fmt.Sprintf("[FS UPLOAD] %s", err.Error()),
									})
									break
								}
							}
							if cased.Args[1] == "selected" {
								var file hackpadfs.File
								file, err := ssFS.(FSBase).OpenFile(name, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0644)
								if err != nil {
									err = conn.FsOperation(ssid, FSOP_UPLOAD_FILE, []string{""})
									break
								}
								id := atomic.AddUint64(uploadUrlName, 1)
								UploadUrlSet.Store(id, file)
								err = conn.FsOperation(ssid, FSOP_UPLOAD_FILE, []string{fmt.Sprintf("/api/upload?id=%d", id)})
							} else {
								go func() {
									paths, err := zenity.SelectFileMultiple(zenity.Title("upload files"))
									if err != nil {
										// TODO:
										return
									}
									for _, file := range paths {
										reader, err := os.Open(file)
										if err != nil {
											// TODO:
											continue
										}
										aim := path.Join(name, path.Base(file))
										writer, err := ssFS.(FSBase).OpenFile(aim, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0644)
										if err != nil {
											// TODO:
											continue
										}
										io.Copy(writer.(hackpadfs.ReadWriterFile), reader)
										writer.Close()
										reader.Close()
									}
									err = conn.FsOperation(ssid, FSOP_UPLOAD_FILE, []string{})
									// TODO:
								}()
							}
							break
						}
					}
				} else if cased, ok := msg.(SizeDesc); ok {
					if session, ok := sessionSet.Load(ssid); ok {
						session.(ShellSession).Resize(cased.Rows, cased.Cols)
					}
				}
				if err != nil {
					if conn.Closed {
						return
					}
					// logError
					break
				}
			}
		}
	}()
	<-conn.CloseChan
	sessionSet.Range(func(key, value any) bool {
		value.(io.Closer).Close()
		return true
	})
	conn.Release()
	return nil
}

type WebDirEntry struct {
	Name    string `json:"name"`
	Dir     bool   `json:"dir"`
	ModTime int64  `json:"modTime"`
	Perm    int    `json:"perm"`
}

func formatVolume(path string, isWindowsPath bool) (string, string) {
	if isWindowsPath {
		volume := filepath.VolumeName(path)
		if volume == path {
			path = "."
		} else if volume != "" {
			path = path[len(volume)+1:]
		}
		return volume, path
	}
	return "", path
}
