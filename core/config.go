package core

import (
	"bufio"
	"encoding/json"
	"log"
	"os"
	"sync"
	"sync/atomic"
)

type ConfigBase struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

type ConnectionInfo struct {
	Id       int    `json:"id"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	Protocol string `json:"protocol"`
}

type ConfigHelper interface {
	LoadConfig(data []byte) interface{}
	StoreConfig(config interface{}) []byte
	New(config interface{}) ServeInstance
	Info(host string, id uint64, config interface{}) ConnectionInfo
}

var Helpers = map[string]ConfigHelper{}

type Record struct {
	Id   uint64
	Type string
	Full interface{}
}

var Configs []Record
var ConfigLock = sync.RWMutex{}

var Id = new(uint64)

func LoadConfig(filename string) {
	rd, err := os.Open(filename)
	defer rd.Close()
	if err != nil {
		return
	}
	recordList := []Record{}
	scanner := bufio.NewScanner(rd)
	scanner.Scan()
	ConfigLock.Lock()
	err = json.Unmarshal([]byte(scanner.Text()), &MainConfig)
	ConfigLock.Unlock()
	if err != nil {
		log.Println(err)
	}
	for scanner.Scan() {
		text := []byte(scanner.Text())
		base := ConfigBase{}
		err := json.Unmarshal(text, &base)
		if err != nil {
			log.Println(err)
			continue
		}
		if helper, ok := Helpers[base.Type]; ok {
			full := helper.LoadConfig(text)
			if full == nil {
				continue
			}
			recordList = append(recordList, Record{
				Id:   atomic.AddUint64(Id, 1),
				Type: base.Type,
				Full: full,
			})
		} else {
			log.Println("unknown type:", base.Type)
		}
	}
	rd.Close()
	ConfigLock.Lock()
	Configs = recordList
	ConfigLock.Unlock()
}

func SaveConfig(filename string) {
	file, err := os.Create(filename)
	if err != nil {
		return
	}
	ConfigLock.RLock()
	data, err := json.Marshal(MainConfig)
	if err != nil {
		log.Println(err)
		return
	}
	file.Write(data)
	file.WriteString("\n")
	for _, item := range Configs {
		data := Helpers[item.Type].StoreConfig(item.Full)
		if data == nil {
			continue
		}
		file.Write(data)
		file.WriteString("\n")
	}
	ConfigLock.RUnlock()
	file.Close()
}

type Settings struct {
	Launch     string `json:"launch"`
	FontFamily string `json:"fontFamily"`
	FontSize   int    `json:"fontSize"`
}

type MainConfigType struct {
	Layout   string   `json:"layout"`
	Settings Settings `json:"settings"`
}

var MainConfig MainConfigType
