package core

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"github.com/gorilla/websocket"
	"net"
)

const (
	PROTOCOL_AUTH uint16 = iota
	PROTOCOL_NEW_SESSION
	PROTOCOL_CLOSE_SESSION
	PROTOCOL_TERM_DATA
	PROTOCOL_FS_OPERATION
	PROTOCOL_INFO
	PROTOCOL_RESIZE uint16 = 0x0100
)

const (
	SESSION_SHELL uint16 = 0
	SESSION_SFTP  uint16 = 1
)

// FS op code
const (
	FSOP_GETWD uint8 = iota
	FSOP_READDIR
	FSOP_MKDIR
	FSOP_REMOVE
	FSOP_RENAME
	FSOP_DOWNLOAD_FILE
	FSOP_UPLOAD_FILE
)

type AuthDesc struct {
	Question string `json:"question"`
	Password string `json:"password"`
	Saved    bool   `json:"saved"`
}

type NewSessionDesc struct {
	Type uint16
}

type CloseSessionDesc struct {
}

type FsOperationDesc struct {
	Op   int      `json:"op"`
	Args []string `json:"args"`
}

type InfoDesc struct {
	Type string `json:"type"`
	Info string `json:"info"`
}

type SizeDesc struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

type WsProtocol struct {
	*websocket.Conn
	CloseChan  chan bool
	Closed     bool
	sendChan   chan []byte
	sendCbChan chan error
	release    chan bool
}

func (c *WsProtocol) Release() {
	if c.release != nil {
		c.release <- true
	}
}

func (c *WsProtocol) testClose(err error) {
	if _, ok := err.(*websocket.CloseError); ok || errors.Is(err, net.ErrClosed) {
		if !c.Closed {
			c.CloseChan <- true
		}
		c.Closed = true
	}
}

func (c *WsProtocol) Recv() (uint16, interface{}, error) {
	_, msg, err := c.ReadMessage()
	if err != nil {
		c.testClose(err)
		return 0, nil, err
	}
	op := binary.LittleEndian.Uint16(msg[0:2])
	ssid := binary.LittleEndian.Uint16(msg[2:4])
	switch op {
	case PROTOCOL_AUTH:
		out := &AuthDesc{}
		_ = json.Unmarshal(msg[4:], out)
		return ssid, out, nil
	case PROTOCOL_NEW_SESSION:
		return ssid, &NewSessionDesc{
			Type: binary.LittleEndian.Uint16(msg[4:]),
		}, nil
	case PROTOCOL_CLOSE_SESSION:
		return ssid, &CloseSessionDesc{}, nil
	case PROTOCOL_TERM_DATA:
		return ssid, msg[4:], nil
	case PROTOCOL_FS_OPERATION:
		out := &FsOperationDesc{}
		_ = json.Unmarshal(msg[4:], out)
		return ssid, out, nil
	case PROTOCOL_RESIZE:
		out := &SizeDesc{}
		_ = json.Unmarshal(msg[4:], out)
		return ssid, out, nil
	default:
		return ssid, nil, nil
	}
}

func (c *WsProtocol) Start() {
	c.release = make(chan bool)
	for {
		buffer := <-c.sendChan
		err := c.WriteMessage(websocket.BinaryMessage, buffer)
		c.testClose(err)
		c.sendCbChan <- err
		if c.Closed {
			for {
				select {
				case <-c.sendChan:
					c.sendCbChan <- err
				case <-c.release:
					return
				}
			}
		}
	}
}

func (c *WsProtocol) send(op uint16, ssid uint16, data []byte) error {
	buffer := make([]byte, 4)
	binary.LittleEndian.PutUint16(buffer, op)
	binary.LittleEndian.PutUint16(buffer[2:], ssid)
	buffer = append(buffer, data...)
	//err := c.WriteMessage(websocket.BinaryMessage, buffer)
	c.sendChan <- buffer
	err := <-c.sendCbChan
	c.testClose(err)
	return err
}

func (c *WsProtocol) Auth(question string) error {
	return c.send(PROTOCOL_AUTH, 0, []byte(question))
}

func (c *WsProtocol) NewSession(ssid uint16, success bool, isWindowsPath bool) error {
	buffer := []byte{0, 0}
	if success {
		buffer[0] = 1
	}
	if isWindowsPath {
		buffer[1] = 1
	}
	return c.send(PROTOCOL_NEW_SESSION, ssid, buffer)
}

func (c *WsProtocol) TermData(ssid uint16, data []byte) error {
	return c.send(PROTOCOL_TERM_DATA, ssid, data)
}

func (c *WsProtocol) FsOperation(ssid uint16, op uint8, data any) error {
	buf, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return c.send(PROTOCOL_FS_OPERATION, ssid, append([]byte{op}, buf...))
}

func (c *WsProtocol) Info(data InfoDesc) error {
	buffer, err := json.Marshal(&data)
	if err != nil {
		return err
	}
	return c.send(PROTOCOL_INFO, 0, buffer)
}
