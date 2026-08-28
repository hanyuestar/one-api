package common

import "testing"

func TestAESGCM_RoundTrip(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef") // 32 bytes
	plain := "sk-secret-key-1234567890"
	enc, err := encryptWithKey(plain, key)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if enc == plain {
		t.Fatal("ciphertext should differ from plaintext")
	}
	if !isEncrypted(enc) {
		t.Fatalf("ciphertext should have %q prefix", encryptedPrefix)
	}
	dec, err := decryptWithKey(enc, key)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != plain {
		t.Fatalf("roundtrip mismatch: got %q want %q", dec, plain)
	}
}

func TestAESGCM_DeriveKeyFromPassphrase(t *testing.T) {
	plain := "sk-abc"
	key := sha256Sum([]byte("my-passphrase"))
	enc, err := encryptWithKey(plain, key)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	dec, err := decryptWithKey(enc, key)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != plain {
		t.Fatalf("mismatch: %q", dec)
	}
}

func TestDecryptString_PlaintextPassthrough(t *testing.T) {
	// 未加密的旧数据应原样返回
	v, err := DecryptString("plain-old-key")
	if err != nil {
		t.Fatalf("decrypt plaintext: %v", err)
	}
	if v != "plain-old-key" {
		t.Fatalf("got %q", v)
	}
}

func TestKeyHint(t *testing.T) {
	h := KeyHint("sk-1234567890abcdef")
	if h != "...cdef" {
		t.Fatalf("hint = %q", h)
	}
	h2 := KeyHint("ab")
	if h2 != "****" {
		t.Fatalf("short hint = %q", h2)
	}
}
