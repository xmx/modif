package restapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/application/manager/response"
	"github.com/xmx/modif/config"
)

type Route struct {
	uis map[string][]config.Static
	log *slog.Logger
	eg  echox.EchoRoute
}

func NewRoute(statics map[string][]config.Static, log *slog.Logger) *Route {
	mps := make(map[string][]config.Static, 4)
	for k, vs := range statics {
		if k == "" {
			continue
		}

		slugs := make(map[string]struct{}, 4)
		for _, v := range vs {
			slug, path := v.Slug, v.Path
			if _, ok := slugs[slug]; ok || path == "" {
				continue
			}

			slugs[slug] = struct{}{}
			mps[k] = append(mps[k], v)
		}
	}

	return &Route{
		uis: mps,
		log: log,
	}
}

func (ui *Route) RegisterHTTP(g echox.EchoRoute) error {
	ui.eg = g

	for k, ss := range ui.uis {
		num := len(ss)
		if num == 0 {
			continue
		}

		fallback := ss[0]
		slugs := make(map[string]config.Static, num)
		for _, s := range ss {
			slugs[s.Slug] = s
		}

		h := ui.serveFS(slugs, fallback)
		g.Echo.GET(k+"*", h)
	}

	g.API.Group.GET("/route/webui", ui.webui)
	g.API.Group.GET("/routes", ui.routesHTTP)

	return nil
}

func (ui *Route) RegisterMCP(ms echox.MCPServer) error {
	tool := &mcp.Tool{
		Description: "获取所有路由信息",
		Name:        "routes",
		Title:       "获取所有路由信息",
	}
	return ms.AddTool(tool, ui.routesMCP)
}

func (ui *Route) serveFS(slugs map[string]config.Static, fallback config.Static) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var slug string
		if cok, _ := c.Cookie("ui"); cok != nil {
			slug = cok.Value
		}
		hfs, ok := slugs[slug]
		if !ok {
			hfs = fallback
		}
		next := echo.StaticDirectoryHandler(hfs, false)

		return next(c)
	}
}

func (ui *Route) webui(c *echo.Context) error {
	return c.JSON(http.StatusOK, ui.uis)
}

func (ui *Route) routesHTTP(c *echo.Context) error {
	ret := ui.routes()
	return c.JSON(http.StatusOK, ret)
}

func (ui *Route) routesMCP(context.Context, *mcp.CallToolRequest, request.Zero) (*mcp.CallToolResult, response.Records[response.RouteInfo], error) {
	ret := ui.routes()
	return nil, ret, nil
}

func (ui *Route) routes() response.Records[response.RouteInfo] {
	routes := ui.eg.Echo.Router().Routes()
	rts := make([]response.RouteInfo, 0, len(routes))
	for _, inf := range routes {
		dat := response.RouteInfo{
			Name:       inf.Name,
			Method:     inf.Method,
			Path:       inf.Path,
			Parameters: inf.Parameters,
		}
		rts = append(rts, dat)
	}

	return response.NewRecords(rts)
}
