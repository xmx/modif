package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Tunnel struct {
	ID        bson.ObjectID `bson:"_id,omitempty"        json:"id"`
	Name      string        `bson:"name"                 json:"name"`
	Status    bool          `bson:"status"               json:"status"`
	SecretKey string        `bson:"secret_key"           json:"secret_key"`
	CreatedAt time.Time     `bson:"created_at,omitempty" json:"created_at,omitzero"`
	UpdatedAt time.Time     `bson:"updated_at,omitempty" json:"updated_at,omitzero"`
}

func (Tunnel) CollectionInfo() (string, string) {
	return "tunnel", "代理通道"
}
