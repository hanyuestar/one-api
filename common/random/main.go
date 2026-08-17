package random

import (
	cryptorand "crypto/rand"
	"encoding/binary"
	"math/rand"
	"strings"

	"github.com/google/uuid"
)

func GetUUID() string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	return code
}

const keyChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const keyNumbers = "0123456789"

const maxUint64 = ^uint64(0)

// cryptoRandInt 返回 [0, max) 的密码学安全随机整数（拒绝采样消除取模偏差）。
// 令牌 Key 等鉴权凭据必须使用安全随机源，不能使用 math/rand。
func cryptoRandInt(max int) int {
	if max <= 0 {
		return 0
	}
	buf := make([]byte, 8)
	limit := maxUint64 - maxUint64%uint64(max)
	for {
		if _, err := cryptorand.Read(buf); err != nil {
			// 系统熵源不可用时必须立即失败，绝不能退化为弱随机
			panic(err)
		}
		n := binary.LittleEndian.Uint64(buf)
		if n < limit {
			return int(n % uint64(max))
		}
	}
}

func GenerateKey() string {
	key := make([]byte, 48)
	for i := range key {
		key[i] = keyChars[cryptoRandInt(len(keyChars))]
	}
	return string(key)
}

func GetRandomString(length int) string {
	key := make([]byte, length)
	for i := range key {
		key[i] = keyChars[cryptoRandInt(len(keyChars))]
	}
	return string(key)
}

func GetRandomNumberString(length int) string {
	key := make([]byte, length)
	for i := range key {
		key[i] = keyNumbers[cryptoRandInt(len(keyNumbers))]
	}
	return string(key)
}

// RandRange returns a random number between min and max (max is not included)
// 仅供非安全用途（如随机渠道选择等），保留 math/rand 即可
func RandRange(min, max int) int {
	return min + rand.Intn(max-min)
}
