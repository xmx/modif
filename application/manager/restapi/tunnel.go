package restapi

import (
	"log/slog"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/application/manager/service"
)

type Tunnel struct {
	wsu *websocket.Upgrader
	svc *service.Tunnel
	log *slog.Logger
}

func NewTunnel(wsu *websocket.Upgrader, svc *service.Tunnel, log *slog.Logger) *Tunnel {
	return &Tunnel{
		wsu: wsu,
		svc: svc,
		log: log,
	}
}

func (tun *Tunnel) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.GET("/tunnel", tun.connect)

	return nil
}

func (tun *Tunnel) connect(c *echo.Context) error {
	var req request.TunnelConnect
	if err := c.Bind(&req); err != nil {
		return err
	}

	w, r := c.Response(), c.Request()
	ws, err := tun.wsu.Upgrade(w, r, nil)
	if err != nil {
		tun.log.Warn("tunnel websocket 协议升级失败", "err", err)
		return err
	}

	realIP := c.RealIP()
	key := r.Header.Get("Sec-Websocket-Key")
	args := []any{"key", key, "real_ip", realIP}
	tun.log.Info("有 websocket tunnel 建立连接了", args...)

	_ = tun.svc.Connect(ws, req.Address)

	return nil
}
