package restapi

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/echox"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/application/manager/service"
)

type Document struct {
	svc *service.Document
}

func NewDocument(svc *service.Document) *Document {
	return &Document{
		svc: svc,
	}
}

func (doc *Document) RegisterHTTP(g echox.EchoRoute) error {
	g.API.Group.GET("/documents", doc.page)
	g.API.Group.POST("/document/embed", doc.embed)
	g.API.Group.GET("/document/:id", doc.get)
	g.API.Group.DELETE("/document/:id", doc.delete)
	return nil
}

func (doc *Document) get(c *echo.Context) error {
	var req request.ObjectID
	if err := c.Bind(&req); err != nil {
		return err
	}
	ctx := c.Request().Context()
	ret, err := doc.svc.Get(ctx, req.OID())
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, ret)
}

func (doc *Document) page(c *echo.Context) error {
	var req request.PageSize
	if err := c.Bind(&req); err != nil {
		return err
	}
	ctx := c.Request().Context()
	ret, err := doc.svc.Page(ctx, req)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, ret)
}

func (doc *Document) embed(c *echo.Context) error {
	var req request.DocumentEmbed
	if err := c.Bind(&req); err != nil {
		return err
	}
	ctx := c.Request().Context()

	return doc.svc.Embed(ctx, req)
}

func (doc *Document) delete(c *echo.Context) error {
	var req request.ObjectID
	if err := c.Bind(&req); err != nil {
		return err
	}
	ctx := c.Request().Context()

	return doc.svc.Delete(ctx, req.OID())
}
