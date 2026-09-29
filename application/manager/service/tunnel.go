package service

import (
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/xmx/modif/application/manager/wsocket"
)

type Tunnel struct {
	log *slog.Logger
}

func NewTunnel(log *slog.Logger) *Tunnel {
	return &Tunnel{
		log: log,
	}
}

func (tun *Tunnel) Connect(cli *websocket.Conn, addr string) error {
	//goland:noinspection GoUnhandledErrorResult
	defer cli.Close()

	clientAddr, ingressAddr := cli.RemoteAddr(), cli.LocalAddr()
	args := []any{
		"raw_address", addr,
		"client_addr", clientAddr.String(),
		"ingress_addr", ingressAddr.String(),
	}
	tun.log.Info("准备建立代理", args...)
	srv, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		args = append(args, "err", err)
		tun.log.Error("代理建立失败", args...)
		return err
	}

	// client_addr -> ingress_addr -> egress_addr -> server_addr
	serverAddr, egressAddr := srv.RemoteAddr(), srv.LocalAddr()
	args = append(args,
		"egress_addr", egressAddr.String(),
		"server_addr", serverAddr.String(),
	)
	//goland:noinspection GoUnhandledErrorResult
	defer srv.Close()

	// client --[write to]--> server
	var ctoscnt int64
	var ctoserr error

	wg := new(sync.WaitGroup)
	wg.Go(func() {
		ctoscnt, ctoserr = wsocket.WriteToConn(srv, cli)
		_ = srv.Close() // 任何一个方向结束，都要关闭另一端。
	})

	stoccnt, stocerr := wsocket.WriteToWebsocket(cli, srv)
	_ = cli.Close() // 任何一个方向结束，都要关闭另一端。
	wg.Wait()

	args = append(args,
		"client_write_server_bytes", ctoscnt,
		"client_write_server_error", ctoserr,
		"server_write_client_bytes", stoccnt,
		"server_write_client_error", stocerr,
	)
	tun.log.Info("代理断开连接", args...)

	return nil
}
