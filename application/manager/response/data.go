package response

type Records[T any] struct {
	Records []T `json:"records,omitzero"`
}

func NewRecords[T any](ts []T) Records[T] {
	return Records[T]{Records: ts}
}

type Data[T any] struct {
	Data T `json:"data"`
}

func NewData[T any](t T) Data[T] {
	return Data[T]{Data: t}
}
