package component

import (
	"errors"
	"log/slog"

	"github.com/xmx/modif/config"
	"github.com/xmx/modif/datalayer/repository"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/x/mongo/driver/connstring"
)

func NewMongoDB(cfg config.MongoDB, log *slog.Logger) (*repository.BaseDB, error) {
	uri := cfg.URI
	cs, err := connstring.ParseAndValidate(uri)
	if err != nil {
		return nil, err
	}
	if dbname := cs.Database; dbname == "" {
		return nil, errors.New("database name is required")
	}

	opts := options.Client().ApplyURI(uri)
	cli, err := mongo.Connect(opts)
	if err != nil {
		return nil, err
	}

	dbname := cs.Database
	db := cli.Database(dbname)
	rdb := repository.NewBaseDB(db, log)

	return rdb, nil
}
