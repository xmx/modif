package model

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"hash"
	"io"
)

type Checksum struct {
	MD5    string `json:"md5"    bson:"md5"`
	SHA1   string `json:"sha1"   bson:"sha1"`
	SHA256 string `json:"sha256" bson:"sha256"`
	SHA512 string `json:"sha512" bson:"sha512"`
}

func (chk Checksum) Map() map[string]string {
	return map[string]string{
		"md5":    chk.MD5,
		"sha1":   chk.SHA1,
		"sha256": chk.SHA256,
		"sha512": chk.SHA512,
	}
}

func HashFrom(r io.Reader) (Checksum, error) {
	w := NewHashWriter()
	if _, err := io.Copy(w, r); err != nil {
		return Checksum{}, err
	}

	return w.Sum(), nil
}

func HashBytes(b []byte) Checksum {
	w := NewHashWriter()
	_, _ = w.Write(b)

	return w.Sum()
}

func NewHashWriter() *HashWriter {
	return &HashWriter{
		md5:    md5.New(),
		sha1:   sha1.New(),
		sha256: sha256.New(),
		sha512: sha512.New(),
	}
}

type HashWriter struct {
	md5    hash.Hash
	sha1   hash.Hash
	sha256 hash.Hash
	sha512 hash.Hash
}

func (hw *HashWriter) Write(p []byte) (int, error) {
	n := len(p)
	_, _ = hw.md5.Write(p)
	_, _ = hw.sha1.Write(p)
	_, _ = hw.sha256.Write(p)
	_, _ = hw.sha512.Write(p)

	return n, nil
}

func (hw *HashWriter) Sum() Checksum {
	md5s := hw.md5.Sum(nil)
	sha1s := hw.sha1.Sum(nil)
	sha256s := hw.sha256.Sum(nil)
	sha512s := hw.sha512.Sum(nil)

	return Checksum{
		MD5:    hex.EncodeToString(md5s),
		SHA1:   hex.EncodeToString(sha1s),
		SHA256: hex.EncodeToString(sha256s),
		SHA512: hex.EncodeToString(sha512s),
	}
}
