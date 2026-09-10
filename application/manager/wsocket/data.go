package wsocket

const methodPrefix = "modif/"

type Metadata struct {
	RequestID string `json:"request_id"`
	SessionID string `json:"session_id,omitzero"`
	UserAgent string `json:"user_agent,omitzero"`
}

type ErrorMessage struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
