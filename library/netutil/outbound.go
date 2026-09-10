package netutil

import (
	"net"
	"net/netip"
	"strings"
	"time"
)

//goland:noinspection GoUnhandledErrorResult
func OutboundIP() netip.Addr {
	conn, err := net.DialTimeout("udp", "8.8.8.8:53", time.Second)
	if err != nil {
		return netip.Addr{}
	}
	defer conn.Close()

	laddr := conn.LocalAddr()
	if uaddr, _ := laddr.(*net.UDPAddr); uaddr != nil {
		ip, _ := netip.AddrFromSlice(uaddr.IP)
		return ip
	}

	return netip.Addr{}
}

// ResolvableAddr 将监听地址转换为“可访问地址”。
//
// 规则：
//   - 若 addr 为 ":port" 或 "0.0.0.0:port" / "[::]:port"，会尝试替换为本机对外 IP。
//   - 若 addr 为具体 IP（非 unspecified）或域名（如 "localhost"），保持不变。
//   - 若无法获取有效对外 IP，则返回原始 addr。
//
// 典型用途：
//   - 服务启动日志中输出可供客户端访问的地址
//   - 服务注册（service discovery）时提供可连接地址
func ResolvableAddr(addr string) string {
	var port string
	if strings.HasPrefix(addr, ":") {
		port, _ = strings.CutPrefix(addr, ":")
	} else {
		saddr, sport, err := net.SplitHostPort(addr)
		if err != nil {
			return addr
		}
		paddr, err := netip.ParseAddr(saddr)
		if err != nil || !paddr.IsUnspecified() {
			return addr
		}
		port = sport
	}
	if ip := OutboundIP(); ip.IsValid() {
		sip := ip.String()
		return net.JoinHostPort(sip, port)
	}

	return addr
}
