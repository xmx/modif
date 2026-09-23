package echox

import (
	"github.com/NVIDIA/gontainer/v2"
	"github.com/labstack/echo/v5"
)

type HTTPRegister interface {
	RegisterHTTP(EchoRoute) error
}

type EchoRoute struct {
	Echo *echo.Echo
	V1   EchoGroup
	API  EchoGroup
}

func NewEchoRoute(e *echo.Echo) EchoRoute {
	return EchoRoute{
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

func (rg EchoRoute) Registers(rts gontainer.Multiple[HTTPRegister]) error {
	for _, rt := range rts {
		if err := rt.RegisterHTTP(rg); err != nil {
			return err
		}
	}
	return nil
}
