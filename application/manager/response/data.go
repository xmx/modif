package response

type Records[T any] struct {
	Records []T `json:"records,omitzero"`
}

func NewRecords[T any](ts []T) Records[T] {
	return Records[T]{Records: ts}
}
