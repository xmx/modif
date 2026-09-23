package restapi

import (
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/sourcegraph/jsonrpc2"
	jsonrpcws "github.com/sourcegraph/jsonrpc2/websocket"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/wsocket"
	"github.com/xmx/modif/config"
	"github.com/xmx/modif/library/jsonrpc"
)

type Inspect struct {
	cfg config.Config
	hub aiflow.Huber
	wsu *websocket.Upgrader
	log *slog.Logger
}

func NewInspect(cfg config.Config, hub aiflow.Huber, wsu *websocket.Upgrader, log *slog.Logger) *Inspect {
	return &Inspect{
		cfg: cfg,
		hub: hub,
		wsu: wsu,
		log: log,
	}
}

func (ist *Inspect) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.GET("/inspect/attach", ist.attach)
	return nil
}

func (ist *Inspect) attach(c *echo.Context) error {
	w, r := c.Response(), c.Request()
	ws, err := ist.wsu.Upgrade(w, r, nil)
	if err != nil {
		ist.log.Warn("websocket 协议升级失败", "err", err)
		return err
	}

	realIP := c.RealIP()
	key := r.Header.Get("Sec-Websocket-Key")
	args := []any{"key", key, "real_ip", realIP}
	ist.log.Info("有 websocket 建立连接了", args...)

	ctx := r.Context()
	opts := jsonrpc2.SetLogger(jsonrpc.NewLogger(ist.log))
	conn := jsonrpc2.NewConn(ctx, jsonrpcws.NewObjectStream(ws), nil, opts)
	defer conn.Close()

	consume := wsocket.NewRPC(conn, ist.cfg.Notify)
	ist.hub.AddChatCompletion(consume)
	ist.hub.AddResponse(consume)
	defer func() {
		ist.hub.DelChatCompletion(consume)
		ist.hub.DelResponse(consume)
	}()

	var fails int
	var closed bool
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for !closed {
		select {
		case <-ctx.Done():
			err = ctx.Err()
			closed = true
		case <-conn.DisconnectNotify():
			closed = true
			err = jsonrpc2.ErrClosed
		case now := <-ticker.C:
			dead := now.Add(10 * time.Second)
			if err = ws.WriteControl(websocket.PingMessage, nil, dead); err == nil {
				fails = 0
			} else {
				fails++
				closed = fails >= 3
			}
		}
	}
	args = append(args, "err", err)
	ist.log.Info("websocket 连接已断开", args...)

	return nil
}
