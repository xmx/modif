package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Document struct {
	ID        bson.ObjectID `bson:"_id,omitempty"        json:"id"`
	Source    string        `bson:"source,omitempty"     json:"source"`
	Content   string        `bson:"content,omitempty"    json:"content,omitzero"`
	Size      int           `bson:"size,omitempty"       json:"size"`
	PointIDs  []string      `bson:"point_ids,omitempty"  json:"point_ids"`
	Checksum  Checksum      `bson:"checksum,omitempty"   json:"checksum"`
	CreatedAt time.Time     `bson:"created_at,omitempty" json:"created_at,omitzero"`
	UpdatedAt time.Time     `bson:"updated_at,omitempty" json:"updated_at,omitzero"`
}

func (Document) CollectionInfo() (string, string) {
	return "document", "文档"
}
