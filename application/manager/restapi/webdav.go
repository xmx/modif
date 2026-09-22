package restapi

import (
	"net/http"
	"sync/atomic"

	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/echox"
	"golang.org/x/net/webdav"
)

type WebDAV struct {
	dav   *webdav.Handler
	write atomic.Bool
}

func NewWebDAV(dir string) *WebDAV {
	return &WebDAV{
		dav: &webdav.Handler{
			FileSystem: webdav.Dir(dir),
			LockSystem: webdav.NewMemLS(),
		},
	}
}

func (wd *WebDAV) RegisterRoute(g echox.Group) {
	api := g.API
	wd.dav.Prefix = api.Prefix

	readonly := []string{
		http.MethodOptions, http.MethodGet, http.MethodHead, "PROPFIND",
	}
	modified := []string{
		http.MethodPost, http.MethodPut, http.MethodDelete,
		"LOCK", "UNLOCK", "PROPPATCH", "MKCOL", "COPY", "MOVE",
	}

	api.Group.Match(readonly, "/dav", wd.base)
	api.Group.Match(readonly, "/dav/*", wd.base)

	api.Group.Match(modified, "/dav", wd.check)
	api.Group.Match(modified, "/dav/*", wd.check)
}

func (wd *WebDAV) base(c *echo.Context) error {
	w, r := c.Response(), c.Request()
	wd.dav.ServeHTTP(w, r)
	return nil
}

func (wd *WebDAV) check(c *echo.Context) error {
	if !wd.write.Load() {
		return echo.ErrForbidden
	}

	w, r := c.Response(), c.Request()
	wd.dav.ServeHTTP(w, r)
	return nil
}
