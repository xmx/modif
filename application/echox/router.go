package echox

import "github.com/labstack/echo/v5"

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

type RouteRegister interface {
	RegisterRoute(g Group)
}

type RouteRegisters []RouteRegister

func (rrs RouteRegisters) RegisterRoute(g Group) {
	for _, rr := range rrs {
		rr.RegisterRoute(g)
	}
}
