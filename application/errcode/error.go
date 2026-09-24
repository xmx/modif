package errcode

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

var (
	ErrUnauthorized       = echo.NewHTTPError(http.StatusUnauthorized, "认证无效")
	ErrDocumentDuplicated = echo.NewHTTPError(http.StatusConflict, "文档已存在")
)
