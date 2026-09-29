package request

type TunnelConnect struct {
	Address string `json:"address" query:"address" validate:"required"`
}
