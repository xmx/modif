package restapi

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/application/manager/response"
	"github.com/xmx/modif/application/manager/service"
)

type Inject struct {
	svc *service.Inject
}

func NewInject(svc *service.Inject) *Inject {
	return &Inject{
		svc: svc,
	}
}

func (jet *Inject) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.GET("/inject/components", jet.componentsHTTP)
	return nil
}

func (jet *Inject) RegisterMCP(ms echox.MCPServer) error {
	tool := &mcp.Tool{
		Description: "获取容器内所有组件",
		Name:        "inject_components",
		Title:       "获取容器内所有组件",
	}
	return ms.AddTool(tool, jet.componentsMCP)
}

func (jet *Inject) componentsHTTP(c *echo.Context) error {
	val := jet.svc.Components()
	ret := response.NewRecords(val)

	return c.JSON(http.StatusOK, ret)
}

func (jet *Inject) componentsMCP(context.Context, *mcp.CallToolRequest, request.Zero) (*mcp.CallToolResult, response.Records[response.InjectComponent], error) {
	val := jet.svc.Components()
	ret := response.NewRecords(val)

	return nil, ret, nil
}
