package restapi

import (
	"github.com/labstack/echo/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/xmx/modif/application/echox"
)

type MCP struct {
	stm *mcp.StreamableHTTPHandler
}

func NewMCP(mcps echox.MCPServer) *MCP {
	stm := mcps.StreamableHTTPHandler(nil)
	return &MCP{
		stm: stm,
	}
}

func (mc *MCP) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.POST("/mcp", mc.endpoint)
	return nil
}

func (mc *MCP) endpoint(c *echo.Context) error {
	mc.stm.ServeHTTP(c.Response(), c.Request())
	return nil
}
