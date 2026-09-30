package repository

import (
	"context"

	"github.com/xmx/modif/datalayer/model"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Tunnel interface {
	Collection[model.Tunnel]
}

func NewTunnel(db *mongo.Database, opts ...options.Lister[options.CollectionOptions]) Tunnel {
	coll := NewCollection[model.Tunnel](db, opts...)

	return &tunnel{
		Collection: coll,
	}
}

type tunnel struct {
	Collection[model.Tunnel]
}

func (c *tunnel) CreateIndex(ctx context.Context, opts ...options.Lister[options.CreateIndexesOptions]) ([]string, error) {
	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "secret_key", Value: 1}}, Options: options.Index().SetUnique(true)},
	}

	return c.Indexes().CreateMany(ctx, indexes, opts...)
}
