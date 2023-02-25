package main

import (
	"bytes"
	"encoding/json"
	"fyne.io/systray"
	"github.com/azurity/go-onefile"
	"github.com/google/shlex"
	"github.com/gorilla/websocket"
	"github.com/hack-pad/hackpadfs"
	"github.com/pkg/browser"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"sync/atomic"
	"wterm/adapter/pty"
	"wterm/adapter/ssh"
	"wterm/core"
	"wterm/ui"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var configFilename string

func initConfig() {
	core.Helpers["PTY"] = &pty.ConfigHelper{}
	core.Helpers["ssh"] = &ssh.ConfigHelper{}

	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	configFilename = home + "/.wterm_sessions"
	core.LoadConfig(configFilename)
}

func configService(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Methods", "*")
	if request.Method == http.MethodGet {
		if !request.URL.Query().Has("id") {
			list := []core.ConnectionInfo{}
			core.ConfigLock.RLock()
			for _, item := range core.Configs {
				list = append(list, core.Helpers[item.Type].Info("ws://localhost:32300", item.Id, item.Full))
			}
			core.ConfigLock.RUnlock()
			data, err := json.Marshal(list)
			if err != nil {
				writer.WriteHeader(http.StatusInternalServerError)
			} else {
				writer.Write(data)
			}
			return
		} else {
			id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
			if err != nil {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			core.ConfigLock.RLock()
			for _, item := range core.Configs {
				if item.Id == id {
					writer.Write(core.Helpers[item.Type].StoreConfig(item.Full))
					core.ConfigLock.RUnlock()
					return
				}
			}
			core.ConfigLock.RUnlock()
			writer.WriteHeader(http.StatusNotFound)
		}
	} else if request.Method == http.MethodPost {
		data, err := io.ReadAll(request.Body)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		base := core.ConfigBase{}
		err = json.Unmarshal(data, &base)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		var full interface{}
		if helper, ok := core.Helpers[base.Type]; ok {
			full = helper.LoadConfig(data)
			if full == nil {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
		} else {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		if !request.URL.Query().Has("id") {
			core.ConfigLock.Lock()
			core.Configs = append(core.Configs, core.Record{
				Id:   atomic.AddUint64(core.Id, 1),
				Type: base.Type,
				Full: full,
			})
			core.ConfigLock.Unlock()
			writer.WriteHeader(http.StatusOK)
		} else {
			id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
			if err != nil {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			core.ConfigLock.Lock()
			for index, item := range core.Configs {
				if item.Id == id {
					if item.Type != base.Type {
						core.ConfigLock.Unlock()
						writer.WriteHeader(http.StatusBadRequest)
						return
					}
					core.Configs[index].Full = full
					core.ConfigLock.Unlock()
					writer.WriteHeader(http.StatusOK)
					return
				}
			}
			writer.WriteHeader(http.StatusNotFound)
		}
		if configFilename != "" {
			core.SaveConfig(configFilename)
		}
	} else if request.Method == http.MethodDelete {
		if !request.URL.Query().Has("id") {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		index := -1
		core.ConfigLock.Lock()
		for i, item := range core.Configs {
			if item.Id == id {
				index = i
				break
			}
		}
		if index >= 0 {
			newList := append([]core.Record{}, core.Configs[:index]...)
			core.Configs = append(newList, core.Configs[index+1:]...)
		}
		core.ConfigLock.Unlock()
		writer.WriteHeader(http.StatusOK)
		if configFilename != "" {
			core.SaveConfig(configFilename)
		}
	} else if request.Method != http.MethodOptions {
		writer.WriteHeader(http.StatusBadRequest)
	}
}

func layoutService(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Methods", "*")
	if request.Method == http.MethodGet {
		core.ConfigLock.RLock()
		writer.Write([]byte(core.MainConfig.Layout))
		core.ConfigLock.RUnlock()
	} else if request.Method == http.MethodPost {
		data, err := io.ReadAll(request.Body)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		core.MainConfig.Layout = string(data)
		core.SaveConfig(configFilename)
	} else if request.Method != http.MethodOptions {
		writer.WriteHeader(http.StatusBadRequest)
	}
}

func downloadFileService(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Methods", "*")
	if request.Method == http.MethodGet {
		if !request.URL.Query().Has("id") {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		if file, ok := core.DownloadUrlSet.Load(id); ok {
			io.Copy(writer, file.(hackpadfs.File))
			file.(hackpadfs.File).Close()
			core.DownloadUrlSet.Delete(id)
		} else {
			writer.WriteHeader(http.StatusNotFound)
		}
	} else if request.Method != http.MethodOptions {
		writer.WriteHeader(http.StatusBadRequest)
	}
}

func uploadFileService(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Methods", "*")
	if request.Method == http.MethodPost {
		if !request.URL.Query().Has("id") {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		err = request.ParseMultipartForm(32 << 20)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		uFile, _, err := request.FormFile("file")
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		if file, ok := core.UploadUrlSet.Load(id); ok {
			io.Copy(file.(hackpadfs.ReadWriterFile), uFile)
			file.(hackpadfs.File).Close()
			uFile.Close()
			core.UploadUrlSet.Delete(id)
		} else {
			writer.WriteHeader(http.StatusNotFound)
		}
	} else if request.Method != http.MethodOptions {
		writer.WriteHeader(http.StatusBadRequest)
	}
}

func initMux() http.Handler {
	mux := http.NewServeMux()
	webFS, _ := fs.Sub(ui.FrontendFS, "frontend")
	mux.Handle("/", onefile.New(webFS, &onefile.Overwrite{
		Fsys: nil,
		Pair: map[string]string{},
	}, "/index.html"))
	mux.HandleFunc("/ws", func(writer http.ResponseWriter, request *http.Request) {
		if !request.URL.Query().Has("id") {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		id, err := strconv.ParseUint(request.URL.Query().Get("id"), 10, 64)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		var instance core.ServeInstance = nil
		for _, item := range core.Configs {
			if item.Id == id {
				instance = core.Helpers[item.Type].New(item.Full)
				break
			}
		}
		if instance == nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		c, err := upgrader.Upgrade(writer, request, nil)
		defer c.Close()
		core.ServeWS(c, instance)
	})
	mux.HandleFunc("/api/config", configService)
	mux.HandleFunc("/api/layout", layoutService)
	mux.HandleFunc("/api/download", downloadFileService)
	mux.HandleFunc("/api/upload", uploadFileService)
	return mux
}

func launch() {
	if core.MainConfig.Launch != "" {
		if core.MainConfig.Launch[0] == '$' {
			// custom command
			t, err := template.New("launch").Parse(core.MainConfig.Launch)
			if err == nil {
				buf := &bytes.Buffer{}
				_ = t.Execute(buf, "http://localhost:32300/")
				cmdText, _ := shlex.Split(buf.String())
				cmd := exec.Command(cmdText[0], cmdText[1:]...)
				go cmd.Run()
				return
			}
		} else if core.MainConfig.Launch == "@" {
			// embed tauri
			tauriFile, err := ui.TauriExecFile()
			if err == nil {
				cmd := exec.Command(tauriFile, "--title-padding", "160px", "--app", "http://localhost:32300/?custom")
				go cmd.Run()
				return
			}
		}
	}
	browser.OpenURL("http://localhost:32300/")
}

func main() {
	core.MainConfig.Launch = "@"
	initConfig()
	mux := initMux()
	//http.ListenAndServe("localhost:32300", mux)
	server := &http.Server{Addr: "localhost:32300", Handler: mux}

	go systray.Run(func() {
		systray.SetTitle("wterm")
		systray.SetTooltip("wterm")
		show := systray.AddMenuItem("show", "")
		quit := systray.AddMenuItem("quit", "")
		launch()
		go func() {
			for {
				select {
				case <-show.ClickedCh:
					launch()
					break
				case <-quit.ClickedCh:
					server.Close()
					systray.Quit()
					break
				}
			}
		}()
	}, func() {})

	server.ListenAndServe()
}
