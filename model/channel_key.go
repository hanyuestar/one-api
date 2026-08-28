package model

import (
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/logger"
)

// F-006 多 Key 负载均衡：单渠道支持多个上游 Key，按权重选择、失败隔离、探活恢复。

const (
	ChannelKeyStatusEnabled     = 1
	ChannelKeyStatusDisabled    = 2
	ChannelKeyStatusQuarantined = 3
)

type ChannelKey struct {
	Id         int    `json:"id" gorm:"primaryKey"`
	ChannelId  int    `json:"channel_id" gorm:"index;not null"`
	Key        string `json:"-" gorm:"type:text;not null"` // 加密存储，永不序列化给前端
	Name       string `json:"name" gorm:"size:64;default:''"`
	Weight     *uint  `json:"weight" gorm:"default:0"`
	Status     int    `json:"status" gorm:"default:1"`
	FailCount  int    `json:"fail_count" gorm:"default:0"`
	LastUsedAt int64  `json:"last_used_at" gorm:"bigint;default:0"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}

func (ChannelKey) TableName() string { return "channel_keys" }

func (k *ChannelKey) GetWeight() uint {
	if k.Weight == nil || *k.Weight == 0 {
		return 1
	}
	return *k.Weight
}

// KeyHint 返回脱敏后的 Key（仅末 4 位）。
func (k *ChannelKey) KeyHint() string {
	plain, err := common.DecryptString(k.Key)
	if err != nil {
		return "****"
	}
	return common.KeyHint(plain)
}

// Decrypt 返回明文 Key。
func (k *ChannelKey) Decrypt() (string, error) {
	return common.DecryptString(k.Key)
}

// --- CRUD ---

func GetChannelKeys(channelId int, includeDisabled bool) ([]*ChannelKey, error) {
	var keys []*ChannelKey
	tx := DB.Where("channel_id = ?", channelId)
	if !includeDisabled {
		tx = tx.Where("status = ?", ChannelKeyStatusEnabled)
	}
	err := tx.Order("id asc").Find(&keys).Error
	return keys, err
}

func GetChannelKeyById(id int) (*ChannelKey, error) {
	var k ChannelKey
	err := DB.First(&k, "id = ?", id).Error
	return &k, err
}

func (k *ChannelKey) Insert() error {
	enc, err := common.EncryptString(k.Key)
	if err != nil {
		return err
	}
	k.Key = enc
	now := time.Now().Unix()
	k.CreatedAt = now
	k.UpdatedAt = now
	if k.Status == 0 {
		k.Status = ChannelKeyStatusEnabled
	}
	err = DB.Create(k).Error
	if err == nil {
		invalidateKeyCache(k.ChannelId)
	}
	return err
}

func (k *ChannelKey) Update() error {
	k.UpdatedAt = time.Now().Unix()
	updates := map[string]any{
		"name":       k.Name,
		"weight":     k.Weight,
		"status":     k.Status,
		"updated_at": k.UpdatedAt,
	}
	// Key 字段传入新明文时加密更新；为空或已是密文则不覆盖
	if k.Key != "" && !isEncrypted(k.Key) {
		enc, err := common.EncryptString(k.Key)
		if err != nil {
			return err
		}
		updates["key"] = enc
	}
	err := DB.Model(k).Updates(updates).Error
	if err == nil {
		invalidateKeyCache(k.ChannelId)
	}
	return err
}

func DeleteChannelKey(id int) error {
	k, err := GetChannelKeyById(id)
	if err != nil {
		return err
	}
	err = DB.Delete(&ChannelKey{}, id).Error
	if err == nil {
		invalidateKeyCache(k.ChannelId)
	}
	return err
}

func isEncrypted(s string) bool { return len(s) > 4 && s[:4] == "enc:" }

// QuarantineChannelKey 将 Key 标记为隔离（认证失败/额度不足时调用）。
func QuarantineChannelKey(id int, reason string) error {
	k, err := GetChannelKeyById(id)
	if err != nil {
		return err
	}
	return DB.Model(k).Updates(map[string]any{
		"status":     ChannelKeyStatusQuarantined,
		"fail_count": k.FailCount + 1,
		"updated_at": time.Now().Unix(),
	}).Error
}

// RecoverChannelKeys 恢复渠道下所有被隔离的 Key（探活成功后调用）。
func RecoverChannelKeys(channelId int) error {
	err := DB.Model(&ChannelKey{}).Where("channel_id = ? and status = ?", channelId, ChannelKeyStatusQuarantined).
		Updates(map[string]any{"status": ChannelKeyStatusEnabled, "fail_count": 0, "updated_at": time.Now().Unix()}).Error
	if err == nil {
		invalidateKeyCache(channelId)
	}
	return err
}

// RecordChannelKeyUsed 更新最后使用时间（批量/异步，低优先级）。
func RecordChannelKeyUsed(id int) {
	DB.Model(&ChannelKey{}).Where("id = ?", id).Update("last_used_at", time.Now().Unix())
}

// --- 选择逻辑（带内存缓存） ---

var (
	keyCache   sync.Map // channelId(int) -> *keyCacheEntry
	keyCacheMu sync.Mutex
)

type keyCacheEntry struct {
	keys     []*ChannelKey
	loadedAt time.Time
}

const keyCacheTTL = 30 * time.Second

func loadKeysCached(channelId int) []*ChannelKey {
	if v, ok := keyCache.Load(channelId); ok {
		entry := v.(*keyCacheEntry)
		if time.Since(entry.loadedAt) < keyCacheTTL {
			return entry.keys
		}
	}
	keys, err := GetChannelKeys(channelId, false)
	if err != nil {
		logger.SysError("failed to load channel keys: " + err.Error())
		return nil
	}
	keyCache.Store(channelId, &keyCacheEntry{keys: keys, loadedAt: time.Now()})
	return keys
}

func invalidateKeyCache(channelId int) { keyCache.Delete(channelId) }

// SelectKey 为渠道选择一个可用 Key，返回 (明文key, keyId, keyName)。
// 未配置多 Key 时回退到 legacy channel.Key，返回 (key, 0, "")。
func (channel *Channel) SelectKey() (string, int, string) {
	keys := loadKeysCached(channel.Id)
	if len(keys) == 0 {
		return channel.Key, 0, ""
	}
	// 加权随机
	total := 0.0
	for _, k := range keys {
		total += float64(k.GetWeight())
	}
	if total <= 0 {
		return channel.Key, 0, ""
	}
	r := rand.Float64() * total
	acc := 0.0
	var chosen *ChannelKey
	for _, k := range keys {
		acc += float64(k.GetWeight())
		if r <= acc {
			chosen = k
			break
		}
	}
	if chosen == nil {
		chosen = keys[len(keys)-1]
	}
	plain, err := chosen.Decrypt()
	if err != nil {
		logger.SysError("failed to decrypt channel key: " + err.Error())
		return channel.Key, 0, ""
	}
	// 异步更新最后使用时间，不阻塞请求
	go RecordChannelKeyUsed(chosen.Id)
	return plain, chosen.Id, chosen.Name
}

// CountChannelKeys 返回渠道配置的 Key 数量（含禁用，供 UI/健康检查）。
func CountChannelKeys(channelId int) int64 {
	var n int64
	DB.Model(&ChannelKey{}).Where("channel_id = ?", channelId).Count(&n)
	return n
}

// MigrateLegacyChannelKey 将 channels.key 迁移为 channel_keys 首条记录（幂等）。
func MigrateLegacyChannelKey(channel *Channel) error {
	if channel.Key == "" {
		return nil
	}
	n := CountChannelKeys(channel.Id)
	if n > 0 {
		return nil
	}
	k := &ChannelKey{
		ChannelId: channel.Id,
		Key:       channel.Key,
		Name:      "default",
		Status:    ChannelKeyStatusEnabled,
	}
	if err := k.Insert(); err != nil {
		return err
	}
	// 迁移成功后清空 legacy key 列（保留为空串），避免双写不一致
	return DB.Model(channel).Update("key", "").Error
}

// MigrateAllLegacyChannelKeys 启动时一次性迁移所有启用渠道的 legacy 单 Key 到 channel_keys 表。
// 幂等：已有 channel_keys 记录的渠道会被 MigrateLegacyChannelKey 内部跳过。
func MigrateAllLegacyChannelKeys() {
	var channels []*Channel
	if err := DB.Where("status = ?", ChannelStatusEnabled).Find(&channels).Error; err != nil {
		logger.SysError("failed to load channels for legacy key migration: " + err.Error())
		return
	}
	migrated := 0
	for _, ch := range channels {
		if ch.Key == "" {
			continue
		}
		if err := MigrateLegacyChannelKey(ch); err != nil {
			logger.SysError(fmt.Sprintf("migrate legacy key for channel #%d failed: %s", ch.Id, err.Error()))
			continue
		}
		migrated++
	}
	if migrated > 0 {
		logger.SysLog(fmt.Sprintf("migrated %d legacy channel key(s) to channel_keys", migrated))
	}
}

var errNoChannelKeys = errors.New("no channel keys configured")
