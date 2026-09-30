package echox

import (
	"github.com/gorilla/websocket"
)

func NewWebsocketUpgrade() *websocket.Upgrader {
	return &websocket.Upgrader{
		EnableCompression: true,
	}
}
