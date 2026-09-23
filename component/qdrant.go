package component

import (
	"github.com/qdrant/go-client/qdrant"
	"github.com/xmx/modif/config"
)

func NewQdrant(c config.Qdrant) (*qdrant.Client, error) {
	cfg := &qdrant.Config{
		Host:   c.Host,
		Port:   c.Port,
		APIKey: c.APIKey,
		UseTLS: c.UseTLS,
	}

	return qdrant.NewClient(cfg)
}
