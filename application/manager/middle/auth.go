package middle

import (
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/errcode"
)

func NewAuth(token string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			r := c.Request()
			auth := r.Header.Get(echo.HeaderAuthorization)
			auth = strings.TrimPrefix(auth, "Bearer ")
			if auth != token {
				return errcode.ErrUnauthorized
			}

			return next(c)
		}
	}
}
