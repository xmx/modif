package restapi

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/bininfo"
)

type System struct {
}

func NewSystem() *System {
	return new(System)
}

func (s *System) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.GET("/system/buildinfo", s.buildinfo)

	return nil
}

func (s *System) buildinfo(c *echo.Context) error {
	ret := bininfo.Get()
	return c.JSON(http.StatusOK, ret)
}
