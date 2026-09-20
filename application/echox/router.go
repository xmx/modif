package echox

import (
	"github.com/NVIDIA/gontainer/v2"
	"github.com/labstack/echo/v5"
)

type Group struct {
	V1  *echo.Group // /v1
	API *echo.Group // /api
}

func NewGroup(e *echo.Echo) Group {
	return Group{
		V1:  e.Group("/v1"),
		API: e.Group("/api"),
	}
}

func (g Group) Registers(rts gontainer.Multiple[RouteRegister]) {
	for _, rt := range rts {
		rt.RegisterRoute(g)
	}
}

type RouteRegister interface {
	RegisterRoute(g Group)
}
