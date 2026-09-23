package repository

import (
	"context"
	"log/slog"
	"reflect"

	"go.mongodb.org/mongo-driver/v2/mongo"
)

type BaseDB struct {
	db  *mongo.Database
	log *slog.Logger

	document Document
}

func NewBaseDB(db *mongo.Database, log *slog.Logger) *BaseDB {
	return &BaseDB{
		db:  db,
		log: log,

		document: NewDocument(db),
	}
}

func (b *BaseDB) Database() *mongo.Database { return b.db }

func (b *BaseDB) Document() Document { return b.document }

func (b *BaseDB) CreateIndex(ctx context.Context) error {
	rv := reflect.ValueOf(b)
	for _, mv := range rv.Methods() {
		idx, inf := b.reflectCall(mv)
		if idx == nil {
			continue
		}

		name, description := inf.CollectionInfo()
		args := []any{"name", name, "description", description}
		b.log.DebugContext(ctx, "准备创建索引", args...)

		indexes, err := idx.CreateIndex(ctx)
		if err != nil {
			args = append(args, "err", err)
			b.log.ErrorContext(ctx, "索引创建错误", args...)
			return err
		}

		if len(indexes) == 0 {
			b.log.Debug("该集合无需创建索引", args...)
		} else {
			args = append(args, "indexes", indexes)
			b.log.Debug("集合索引创建完毕", args...)
		}
	}

	return nil
}

func (b *BaseDB) reflectCall(mv reflect.Value) (CreateIndexer, CollectionInfer) {
	if mt := mv.Type(); mt.NumIn() != 0 || mt.NumOut() != 1 {
		return nil, nil
	}

	rets := mv.Call([]reflect.Value{})
	if len(rets) != 1 {
		return nil, nil
	}
	ret := rets[0]
	if ret.IsNil() || !ret.IsValid() {
		return nil, nil
	}

	val := ret.Interface()
	ic, ok := val.(CreateIndexer)
	if !ok {
		return nil, nil
	}

	if inf, yes := val.(CollectionInfer); yes {
		return ic, inf
	}

	name := ret.Type().Name()
	if ni, yes := val.(interface{ Name() string }); yes {
		name = ni.Name()
	}
	fake := &fakeCollectionInfo{name: name}

	return ic, fake
}

type fakeCollectionInfo struct {
	name string
}

func (f *fakeCollectionInfo) CollectionInfo() (name, description string) {
	return f.name, ""
}
