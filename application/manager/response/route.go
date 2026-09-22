package response

type RouteInfo struct {
	Name       string   `json:"name"`
	Method     string   `json:"method"`
	Path       string   `json:"path"`
	Parameters []string `json:"parameters,omitzero"`
}
