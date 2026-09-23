package request

type DocumentEmbed struct {
	Source  string `json:"source"  validate:"required,lte=255"`
	Content string `json:"content" validate:"required,lte=500000"`
}
