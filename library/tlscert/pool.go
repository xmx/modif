package tlscert

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"log/slog"
	"math/big"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// CertificateLoader 证书加载器。
type CertificateLoader interface {
	// LoadCertificate 加载证书。
	LoadCertificate(context.Context) ([]*tls.Certificate, error)
}

type Matcher interface {
	GetCertificate(ch *tls.ClientHelloInfo) (*tls.Certificate, error)

	// SelfSigned 获取自签证书状态。
	SelfSigned() (enable bool)

	// SetSelfSigned 设置自签证书开关状态。
	SetSelfSigned(enable bool)

	Reset()
}

func NewMatch(load CertificateLoader, log *slog.Logger) Matcher {
	return &certificateMatcher{
		load: load,
		log:  log,
	}
}

type certificateMatcher struct {
	load        CertificateLoader
	log         *slog.Logger
	mutex       sync.Mutex
	disableSelf bool                            // 是否禁用自签名证书
	pool        atomic.Pointer[certificatePool] // 证书池
	self        atomic.Pointer[tls.Certificate] // 自签证书
}

func (m *certificateMatcher) GetCertificate(ch *tls.ClientHelloInfo) (*tls.Certificate, error) {
	sni := ch.ServerName
	attrs := []any{"sni", sni}
	m.log.Debug("开始匹配的证书", attrs...)

	pool := m.pool.Load()
	if pool == nil {
		ctx := ch.Context()
		m.log.Debug("懒加载证书池", attrs...)
		pool = m.slowLoadPool(ctx)
	}
	if crt, err := pool.Match(sni); crt != nil {
		m.log.Debug("证书池中匹配到了合适的证书", attrs...)
		return crt, nil
	} else if err != nil {
		attrs = append(attrs, "match_error", err)
		m.log.Warn("证书池匹配证书出错", attrs...)
	} else {
		m.log.Info("证书池未匹配到证书", attrs...)
	}

	// 如果没有拿到合适的证书，就返回自签证书。
	if self := m.self.Load(); self != nil {
		m.log.Debug("返回已生成的自签证书", attrs...)
		return self, nil
	}

	m.log.Info("开始自签证书", attrs...)
	self, err := m.selfSignature()
	if err != nil {
		attrs = append(attrs, "err", err)
		m.log.Warn("自签证书生成错误", attrs...)
	} else if self == nil {
		m.log.Debug("当前禁用了自签证书", attrs...)
	} else {
		m.log.Info("自签证书生成完毕", attrs...)
	}

	return self, err
}

func (m *certificateMatcher) SelfSigned() bool {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	return !m.disableSelf
}

func (m *certificateMatcher) SetSelfSigned(enable bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.disableSelf = !enable
	if m.disableSelf {
		m.self.Store(nil)
	}
}

func (m *certificateMatcher) Reset() {
	m.self.Store(nil)
	m.pool.Store(nil)
}

func (m *certificateMatcher) slowLoadPool(parent context.Context) *certificatePool {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if pool := m.pool.Load(); pool != nil {
		return pool
	}

	pool := &certificatePool{certs: make(map[string][]*tls.Certificate, 16)}
	if m.load == nil {
		return pool
	}

	ctx, cancel := context.WithTimeout(parent, time.Minute)
	defer cancel()

	pairs, err := m.load.LoadCertificate(ctx)
	if err != nil {
		pool.err = err
		// 可能是网络波动导致的超时问题，不放入结果缓存。
		if te, ok := err.(interface{ Timeout() bool }); !ok || !te.Timeout() {
			m.pool.Store(pool)
		}

		return pool
	}

	for _, kp := range pairs {
		pool.put(kp)
	}
	m.pool.Store(pool)

	return pool
}

func (m *certificateMatcher) selfSignature() (*tls.Certificate, error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.disableSelf { // 禁用自签证书
		return nil, nil
	}
	if crt := m.self.Load(); crt != nil {
		return crt, nil
	}

	serialNumber, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		return nil, err
	}
	priv, err := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	template := &x509.Certificate{
		IsCA:                  true,
		SerialNumber:          serialNumber,
		Subject:               pkix.Name{CommonName: "aegis", Organization: []string{"aegis"}},
		NotBefore:             now.AddDate(0, 0, -1),
		NotAfter:              now.AddDate(1, 0, 0),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{{127, 0, 0, 1}},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, &priv.PublicKey, priv)
	if err != nil {
		return nil, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	privBytes, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		return nil, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privBytes})

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, err
	}
	m.self.Store(&tlsCert)

	return &tlsCert, nil
}

type certificatePool struct {
	err   error
	certs map[string][]*tls.Certificate
}

func (cm *certificatePool) Match(sni string) (*tls.Certificate, error) {
	if cm.err != nil || len(cm.certs) == 0 {
		return nil, cm.err
	}

	now := time.Now()
	// https://github.com/golang/go/blob/go1.22.5/src/crypto/tls/common.go#L1141-L1154
	name := strings.ToLower(sni)
	var last *tls.Certificate
	for _, crt := range cm.certs[name] {
		notBefore, notAfter := crt.Leaf.NotBefore, crt.Leaf.NotAfter
		if now.After(notBefore) && now.Before(notAfter) {
			return crt, nil
		}
		last = crt
	}

	labels := strings.Split(name, ".")
	labels[0] = "*"
	wildcardName := strings.Join(labels, ".")
	for _, crt := range cm.certs[wildcardName] {
		notBefore, notAfter := crt.Leaf.NotBefore, crt.Leaf.NotAfter
		if now.After(notBefore) && now.Before(notAfter) {
			return crt, nil
		}
		last = crt
	}

	return last, nil
}

func (cm *certificatePool) put(crt *tls.Certificate) {
	leaf := crt.Leaf
	for _, name := range leaf.DNSNames {
		cm.certs[name] = append(cm.certs[name], crt)
	}
	for _, ip := range leaf.IPAddresses {
		name := ip.String()
		cm.certs[name] = append(cm.certs[name], crt)
	}
}
