package restapi

import (
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/sourcegraph/jsonrpc2"
	jsonrpcws "github.com/sourcegraph/jsonrpc2/websocket"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/application/manager/response"
	"github.com/xmx/modif/application/manager/wsocket"
	"github.com/xmx/modif/library/jsonrpc"
)

type Inspect struct {
	hub aiflow.Huber
	wsu *websocket.Upgrader
	log *slog.Logger
}

func NewInspect(hub aiflow.Huber, wsu *websocket.Upgrader, log *slog.Logger) *Inspect {
	return &Inspect{
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

	rewrite := new(atomic.Bool) // 是否启用改写模式
	mux := jsonrpc.NewMux()
	mux.HandleFunc("modif/change-rewrite-status", func(rc *jsonrpc.RPCContext) error {
		req := new(request.Data[bool])
		if err1 := rc.Bind(req); err1 != nil {
			return err1
		}
		rewrite.Store(req.Data)

		return rc.Reply(response.NewData(rewrite.Load()))
	})
	mux.HandleFunc("modif/get-rewrite-status", func(rc *jsonrpc.RPCContext) error {
		return rc.Reply(response.NewData(rewrite.Load()))
	})

	ctx := r.Context()
	opts := jsonrpc2.SetLogger(jsonrpc.NewLogger(ist.log))
	conn := jsonrpc2.NewConn(ctx, jsonrpcws.NewObjectStream(ws), mux, opts)
	defer conn.Close()

	consume := wsocket.NewRPC(conn, rewrite)
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
