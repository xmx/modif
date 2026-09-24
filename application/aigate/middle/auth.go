package middle

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
)

func NewAuth(keys []string) echo.MiddlewareFunc {
	keymap := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		keymap[key] = struct{}{}
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if len(keymap) == 0 {
				return next(c)
			}

			r := c.Request()
			tok := r.Header.Get(echo.HeaderAuthorization)
			tok = strings.TrimPrefix(tok, "Bearer ")
			if _, exists := keymap[tok]; exists {
				return next(c)
			}

			// https://developers.openai.com/api/docs/guides/error-codes
			return &openai.Error{
				Message:    "Unauthorized",
				Type:       "invalid_request_error",
				StatusCode: http.StatusUnauthorized,
				Request:    r,
			}
		}
	}
}
