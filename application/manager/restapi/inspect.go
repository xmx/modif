package restapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/sourcegraph/jsonrpc2"
	jsonrpcws "github.com/sourcegraph/jsonrpc2/websocket"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/wsocket"
	"github.com/xmx/modif/library/jsonrpc"
)

type Inspect struct {
	hub aiflow.Huber
	log *slog.Logger
	upg *websocket.Upgrader
}

func NewInspect(hub aiflow.Huber, log *slog.Logger) *Inspect {
	return &Inspect{
		hub: hub,
		log: log,
		upg: &websocket.Upgrader{
			HandshakeTimeout:  5 * time.Second,
			ReadBufferSize:    4096,
			WriteBufferSize:   4096,
			CheckOrigin:       func(*http.Request) bool { return true },
			EnableCompression: true,
		},
	}
}

func (ist *Inspect) RegisterRoute(g echox.Group) {
	g.API.GET("/inspect/attach", ist.attach)
}

func (ist *Inspect) attach(c *echo.Context) error {
	w, r := c.Response(), c.Request()
	ws, err := ist.upg.Upgrade(w, r, nil)
	if err != nil {
		return err
	}

	ctx := r.Context()
	log := jsonrpc.NewLogger(ist.log)
	conn := jsonrpc2.NewConn(ctx, jsonrpcws.NewObjectStream(ws), nil, jsonrpc2.SetLogger(log))
	defer conn.Close()

	consume := wsocket.NewRPC(conn)
	ist.hub.AddChatCompletion(consume)
	ist.hub.AddResponse(consume)
	defer func() {
		ist.hub.DelChatCompletion(consume)
		ist.hub.DelResponse(consume)
	}()

	<-conn.DisconnectNotify()

	return nil
}
