package restapi

import (
	"net/http"

	"github.com/NVIDIA/gontainer/v2"
	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/response"
)

type Inject struct {
	opts []gontainer.Option
}

func NewInject(opts []gontainer.Option) *Inject {
	return &Inject{
		opts: opts,
	}
}

func (inj *Inject) RegisterRoute(g echox.Group) {
	g.API.Group.GET("/inject/components", inj.components)
}

func (inj *Inject) components(c *echo.Context) error {
	ret := make([]response.InjectComponent, 0, len(inj.opts))
	for _, opt := range inj.opts {

		switch v := opt.(type) {
		case *gontainer.Factory:
			ele := response.InjectComponent{Name: v.Name(), Source: v.Source()}
			ret = append(ret, ele)
		case *gontainer.Entrypoint:
			ele := response.InjectComponent{Name: v.Name(), Source: v.Source()}
			ret = append(ret, ele)
		}
	}

	return c.JSON(http.StatusOK, ret)
}
