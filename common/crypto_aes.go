package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
	"sync"
)

// F-006 多 Key / F-014 密钥安全：渠道 Key 的 AES-256-GCM 加解密。
// 主密钥来自环境变量 CHANNEL_KEY_ENCRYPTION_KEY（32 字节，支持 base64 或 hex 或任意字符串经 SHA256 派生）。
// 未配置主密钥时，EncryptString/DecryptString 退化为明文（不加密），保证开箱即用；
// 生产环境强烈建议配置主密钥。

const encryptionKeyEnv = "CHANNEL_KEY_ENCRYPTION_KEY"

var (
	encKeyOnce sync.Once
	encKey     []byte
	encKeyOK   bool
)

func loadEncryptionKey() {
	raw := os.Getenv(encryptionKeyEnv)
	if strings.TrimSpace(raw) == "" {
		encKeyOK = false
		return
	}
	// 优先按 base64 解析
	if b, err := base64.StdEncoding.DecodeString(raw); err == nil && len(b) == 32 {
		encKey = b
		encKeyOK = true
		return
	}
	if b, err := base64.RawStdEncoding.DecodeString(raw); err == nil && len(b) == 32 {
		encKey = b
		encKeyOK = true
		return
	}
	// 否则用原始字符串 SHA256 派生 32 字节
	encKey = sha256Sum([]byte(raw))
	encKeyOK = true
}

func sha256Sum(data []byte) []byte {
	h := sha256.New()
	h.Write(data)
	return h.Sum(nil)
}

// EncryptionEnabled 返回是否配置了加密主密钥。
func EncryptionEnabled() bool {
	encKeyOnce.Do(loadEncryptionKey)
	return encKeyOK
}

// EncryptString 使用 AES-256-GCM 加密；未配置主密钥时原样返回明文。
func EncryptString(plaintext string) (string, error) {
	encKeyOnce.Do(loadEncryptionKey)
	if !encKeyOK {
		return plaintext, nil
	}
	return encryptWithKey(plaintext, encKey)
}

// DecryptString 解密 EncryptString 的输出；未配置主密钥或非加密格式时原样返回。
func DecryptString(s string) (string, error) {
	if s == "" {
		return "", nil
	}
	if !strings.HasPrefix(s, "enc:") {
		return s, nil // 明文（未启用加密时的存量数据）
	}
	encKeyOnce.Do(loadEncryptionKey)
	if !encKeyOK {
		return "", errors.New("ciphertext present but CHANNEL_KEY_ENCRYPTION_KEY is not set")
	}
	return decryptWithKey(s, encKey)
}

// encryptedPrefix 标记密文前缀。
const encryptedPrefix = "enc:"

// isEncrypted 判断字符串是否为加密格式。
func isEncrypted(s string) bool { return strings.HasPrefix(s, encryptedPrefix) }

// encryptWithKey 使用给定 32 字节密钥执行 AES-256-GCM 加密，返回 "enc:"+base64(nonce+ciphertext)。
func encryptWithKey(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encryptedPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptWithKey 解密 encryptWithKey 的输出。
func decryptWithKey(s string, key []byte) (string, error) {
	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(s, encryptedPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// KeyHint 返回 Key 的脱敏展示（仅末 4 位）。
func KeyHint(key string) string {
	if len(key) <= 4 {
		return "****"
	}
	return "..." + key[len(key)-4:]
}
