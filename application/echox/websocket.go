package echox

import (
	"net/http"

	"github.com/gorilla/websocket"
)

func NewWebsocketUpgrade() *websocket.Upgrader {
	return &websocket.Upgrader{
		CheckOrigin:       func(*http.Request) bool { return true },
		EnableCompression: true,
	}
}
