package wsocket

import (
	"io"
	"net"

	"github.com/gorilla/websocket"
)

func WriteToWebsocket(dst *websocket.Conn, src net.Conn) (int64, error) {
	var cnt int64
	buf := make([]byte, 32*1024)
	for {
		n, err := src.Read(buf)
		// 可能同时返回 n > 0 和 err != nil
		if n > 0 {
			if err1 := dst.WriteMessage(websocket.BinaryMessage, buf[:n]); err1 != nil {
				return cnt, err1
			}

			cnt += int64(n)
		}

		if err == io.EOF {
			return cnt, nil
		} else if err != nil {
			return cnt, err
		}
	}
}

func WriteToConn(dst net.Conn, src *websocket.Conn) (int64, error) {
	var cnt int64
	for {
		_, rd, err := src.NextReader()
		if err != nil {
			return cnt, err
		}
		n, err1 := io.Copy(dst, rd)
		cnt += n

		if err1 != nil {
			return cnt, err1
		}
	}
}
