package service

import (
	"context"
	"log/slog"
	"time"
	"uuid"

	"github.com/qdrant/go-client/qdrant"
	"github.com/xmx/modif/application/errcode"
	"github.com/xmx/modif/application/manager/request"
	"github.com/xmx/modif/component"
	"github.com/xmx/modif/datalayer/model"
	"github.com/xmx/modif/datalayer/repository"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Document struct {
	mdb *repository.BaseDB
	qdb *qdrant.Client
	ebd component.Embedding
	log *slog.Logger
}

func NewDocument(mdb *repository.BaseDB, qdb *qdrant.Client, ebd component.Embedding, log *slog.Logger) *Document {
	return &Document{
		mdb: mdb,
		qdb: qdb,
		ebd: ebd,
		log: log,
	}
}

func (doc *Document) Page(ctx context.Context, req request.PageSize) (*repository.Pages[model.Document], error) {
	coll := doc.mdb.Document()
	page, size := req.PSN()
	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).
		SetProjection(bson.M{"content": 0})

	return coll.Page(ctx, bson.D{}, page, size, opts)
}

func (doc *Document) Embed(ctx context.Context, req request.DocumentEmbed) error {
	now := time.Now()

	bcontent := []byte(req.Content)
	size := len(bcontent)
	coll := doc.mdb.Document()
	chk := model.HashBytes(bcontent)

	if cnt, err := coll.CountDocuments(ctx, bson.M{"checksum.sha512": chk.SHA512}); err != nil {
		return err
	} else if cnt != 0 {
		return errcode.ErrDocumentDuplicated
	}

	pid := uuid.New().String()
	f32s, err := doc.ebd.Embedding(ctx, req.Content)
	if err != nil {
		return err
	}
	point := &qdrant.PointStruct{
		Id:      qdrant.NewID(pid),
		Vectors: qdrant.NewVectors(f32s...),
		Payload: qdrant.NewValueMap(map[string]any{
			"content": req.Content,
			"source":  req.Source,
		}),
	}
	if _, err = doc.qdb.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: "ssoc",
		Points:         []*qdrant.PointStruct{point},
	}); err != nil {
		return err
	}

	mod := &model.Document{
		Source:    req.Source,
		Content:   req.Content,
		Size:      size,
		PointIDs:  []string{pid},
		Checksum:  chk,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err = coll.InsertOne(ctx, mod); err != nil {
		_, _ = doc.qdb.Delete(ctx, &qdrant.DeletePoints{
			CollectionName: "ssoc",
			Points: qdrant.NewPointsSelector(
				qdrant.NewID(pid),
			),
		})
	}

	return err
}

func (doc *Document) Delete(ctx context.Context, id bson.ObjectID) error {
	coll := doc.mdb.Document()
	dat, err := coll.FindOneAndDelete(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	} else if dat == nil || len(dat.PointIDs) == 0 {
		return nil
	}

	var ids []*qdrant.PointId
	for _, pid := range dat.PointIDs {
		ids = append(ids, qdrant.NewID(pid))
	}

	if _, err = doc.qdb.Delete(ctx, &qdrant.DeletePoints{
		CollectionName: "ssoc",
		Points:         qdrant.NewPointsSelector(ids...),
	}); err != nil {
		doc.log.Error("删除文档成功但是删除向量出错了", "point_ids", ids, "err", err)
	}

	return nil
}
