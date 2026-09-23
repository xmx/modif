package request

type Size struct {
	Size int64 `json:"size" query:"size" form:"size" validate:"lte=1000"`
}

func (s Size) SN() int64 {
	if s.Size <= 0 {
		return 10
	} else if s.Size > 1000 {
		return 1000
	}

	return s.Size
}

type Page struct {
	Page int64 `json:"page" query:"page" form:"page" validate:"gte=0"`
}

func (p Page) PN() int64 {
	if p.Page <= 0 {
		return 1
	}

	return p.Page
}

type PageSize struct {
	Page
	Size
}

func (p PageSize) PSN() (int64, int64) {
	return p.PN(), p.SN()
}
