package response

import (
	"net"
	"slices"
	"time"

	"github.com/gorilla/websocket"
)

type TunnelStat struct {
	ID              int64     `json:"id,string"`
	Address         string    `json:"address"`
	SourceAddr      string    `json:"source_addr"`
	DestinationAddr string    `json:"destination_addr"`
	EstablishedAt   time.Time `json:"established_at"`
}

type TunnelInfo struct {
	ID            int64
	Address       string
	Source        *websocket.Conn
	Destination   net.Conn
	EstablishedAt time.Time
}

type TunnelInfos []*TunnelInfo

func (tis TunnelInfos) Stats() []TunnelStat {
	stats := make([]TunnelStat, 0, len(tis))
	for _, info := range tis {
		stat := TunnelStat{
			ID:              info.ID,
			Address:         info.Address,
			SourceAddr:      info.Source.RemoteAddr().String(),
			DestinationAddr: info.Destination.RemoteAddr().String(),
			EstablishedAt:   info.EstablishedAt,
		}
		stats = append(stats, stat)
	}

	return stats
}

func (tis TunnelInfos) Sort() {
	slices.SortFunc(tis, func(a, b *TunnelInfo) int {
		return int(a.ID - b.ID)
	})
}
