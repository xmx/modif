package repository

import (
	"context"

	"github.com/xmx/modif/datalayer/model"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Document interface {
	Collection[model.Document]
}

func NewDocument(db *mongo.Database, opts ...options.Lister[options.CollectionOptions]) Document {
	coll := NewCollection[model.Document](db, opts...)

	return &document{
		Collection: coll,
	}
}

type document struct {
	Collection[model.Document]
}

func (c *document) CreateIndex(ctx context.Context, opts ...options.Lister[options.CreateIndexesOptions]) ([]string, error) {
	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "checksum.sha1", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "checksum.sha256", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "checksum.sha512", Value: 1}}, Options: options.Index().SetUnique(true)},
	}

	return c.Indexes().CreateMany(ctx, indexes, opts...)
}
