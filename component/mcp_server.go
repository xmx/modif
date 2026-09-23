package component

import (
	"log/slog"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func NewMCPServer(log *slog.Logger) *mcp.Server {
	impl := &mcp.Implementation{Name: "MODIF", Version: "0.0.1"}
	opts := &mcp.ServerOptions{Logger: log}

	return mcp.NewServer(impl, opts)
}
