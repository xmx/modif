package repository

type Pages[T any] struct {
	Page    int64 `json:"page"`
	Size    int64 `json:"size"`
	Total   int64 `json:"total"`
	Records []*T  `json:"records,omitzero"`
}

func NewEmptyPages[T any](size int64) *Pages[T] {
	if size <= 0 {
		size = 10
	}

	return &Pages[T]{
		Page: 1,
		Size: size,
	}
}

// paginate 分页计算，如果页码过大导致超出页数，则会保留最后一页的内容，并返回修正后的最后页码。
func paginate(page, size, count int64) (fixedPage, skip int64) {
	if maximum := (count + size - 1) / size; maximum > 0 && maximum < page {
		page = maximum
	}
	skip = (page - 1) * size

	return page, skip
}

// clampPageSize 对输入的 page size 参数做区间限制处理。
func clampPageSize(page, size int64) (int64, int64) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	} else if size > 10000 {
		size = 10000
	}

	return page, size
}
