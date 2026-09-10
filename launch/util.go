package launch

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/xmx/modif/library/netutil"
)

func serveHTTP(errch chan error, srv *http.Server, secure bool, log *slog.Logger) {
	addr := srv.Addr
	if addr == "" {
		addr = ":https"
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		errch <- err
		log.Error("网络监听错误", "network", "tcp", "addr", addr, "err", err)
		return
	}

	laddr := ln.Addr()
	if a, ok := laddr.(*net.TCPAddr); ok {
		if name := netutil.IsRestrictedPort(uint32(a.Port)); name != "" {
			log.Warn(
				"【温馨提示】当前端口被 Chromium/Chrome 等浏览器标记为受限端口，可能出现 ERR_UNSAFE_PORT，建议更换监听端口",
				"port", a.Port, "service", name,
				"spec", "https://fetch.spec.whatwg.org/#port-blocking",
				"source", "https://chromium.googlesource.com/chromium/src/+/refs/tags/150.0.7865.1/net/base/port_util.cc#30",
			)
		}
	}

	if secure {
		errch <- srv.ServeTLS(ln, "", "")
	} else {
		errch <- srv.Serve(ln)
	}

}

func shutdownHTTP(parent context.Context, srv *http.Server, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	return srv.Shutdown(ctx)
}
