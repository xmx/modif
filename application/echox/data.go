package echox

import "github.com/labstack/echo/v5"

const routeFlagKey = "route-flag"

func CheckFlag(c *echo.Context) *RouteFlag {
	val := c.Get(routeFlagKey)
	if flag, ok := val.(*RouteFlag); ok && flag != nil {
		return flag
	}

	flag := new(RouteFlag)
	c.Set(routeFlagKey, flag)

	return flag
}

type RouteFlag struct {
	OpenAI bool
}

type Data struct {
	Name string
}
