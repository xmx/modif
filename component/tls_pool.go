package component

import (
	"log/slog"

	"github.com/xmx/modif/library/tlscert"
)

func NewTLSPool(log *slog.Logger) tlscert.Matcher {
	return tlscert.NewMatch(nil, log)
}
