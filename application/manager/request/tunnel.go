package request

type TunnelConnect struct {
	Address string `json:"address" query:"address" validate:"required"`
}

type TunnelCreate struct {
	Name string `json:"name" validate:"required"`
}
