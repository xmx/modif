package echox

import (
	"github.com/NVIDIA/gontainer/v2"
	"github.com/labstack/echo/v5"
)

type Group struct {
	Echo *echo.Echo
	V1   EchoGroup // /v1
	API  EchoGroup // /api
}

func NewGroup(e *echo.Echo) Group {
	return Group{
		Echo: e,
		V1:   NewEchoGroup(e, "/v1"),
		API:  NewEchoGroup(e, "/api"),
	}
}

type EchoGroup struct {
	Prefix string
	Group  *echo.Group
}

func NewEchoGroup(e *echo.Echo, prefix string) EchoGroup {
	return EchoGroup{
		Prefix: prefix,
		Group:  e.Group(prefix),
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
