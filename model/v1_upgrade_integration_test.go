package model

import (
	"os"
	"path/filepath"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 打开临时 SQLite 文件并迁移新表，返回清理函数。
func setupTestDB(t *testing.T) func() {
	t.Helper()
	// 固定加密密钥，保证加密往返可测
	_ = os.Setenv("CHANNEL_KEY_ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy0xMjM0NTY=")
	dir := t.TempDir()
	dsn := filepath.Join(dir, "test.db") + "?_busy_timeout=5000"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(
		&Channel{}, &RoutingPolicy{}, &ChannelKey{},
		&VirtualModel{}, &ChannelProbeLog{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	InitRoutingPolicyCache()
	InitVirtualModelCache()
	return func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		_ = os.Unsetenv("CHANNEL_KEY_ENCRYPTION_KEY")
	}
}

func TestIntegration_RoutingPolicyCRUD(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	p := &RoutingPolicy{Group: "default", Model: "gpt-4", Strategy: RoutingStrategyWeighted}
	if err := p.Insert(); err != nil {
		t.Fatalf("insert: %v", err)
	}
	if got := GetEffectiveStrategy("default", "gpt-4"); got != RoutingStrategyWeighted {
		t.Fatalf("strategy = %s, want weighted", got)
	}
	// 通配兜底
	p2 := &RoutingPolicy{Group: "*", Model: "*", Strategy: RoutingStrategyLatency}
	if err := p2.Insert(); err != nil {
		t.Fatalf("insert wildcard: %v", err)
	}
	if got := GetEffectiveStrategy("vip", "claude"); got != RoutingStrategyLatency {
		t.Fatalf("wildcard strategy = %s, want latency", got)
	}
	// 无效策略拒绝
	if err := (&RoutingPolicy{Group: "g", Model: "m", Strategy: "bogus"}).Insert(); err == nil {
		t.Fatal("invalid strategy should be rejected")
	}
	// 更新
	p.Strategy = RoutingStrategyRandom
	if err := p.Update(); err != nil {
		t.Fatalf("update: %v", err)
	}
	if got := GetEffectiveStrategy("default", "gpt-4"); got != RoutingStrategyRandom {
		t.Fatalf("after update = %s", got)
	}
	// 删除
	if err := DeleteRoutingPolicy(p.Id); err != nil {
		t.Fatalf("delete: %v", err)
	}
}

func TestIntegration_VirtualModelCRUD(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	v := &VirtualModel{
		Name:     "pool",
		Enabled:  true,
		Strategy: "weighted",
		Config:   `{"candidates":[{"model":"gpt-4o","weight":1},{"model":"gpt-4o-mini","weight":1}]}`,
	}
	if err := v.Insert(); err != nil {
		t.Fatalf("insert: %v", err)
	}
	hit := map[string]bool{}
	for i := 0; i < 100; i++ {
		m, vn, _ := ResolveVirtualModel("default", "pool")
		if vn != "pool" {
			t.Fatalf("virtual name = %q", vn)
		}
		hit[m] = true
	}
	if len(hit) != 2 {
		t.Fatalf("expected 2 candidates, got %v", hit)
	}
	// 无候选拒绝
	if err := (&VirtualModel{Name: "empty", Config: `{"candidates":[]}`}).Insert(); err == nil {
		t.Fatal("empty candidates should be rejected")
	}
	// 禁用后透传
	v.Enabled = false
	if err := v.Update(); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if _, vn, _ := ResolveVirtualModel("default", "pool"); vn != "" {
		t.Fatal("disabled virtual model should passthrough")
	}
}

func TestIntegration_ChannelKeyLifecycle(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	ch := &Channel{Name: "test", Type: 1, Key: "legacy-key", Status: ChannelStatusEnabled}
	if err := DB.Create(ch).Error; err != nil {
		t.Fatalf("create channel: %v", err)
	}

	// 1) 无多 Key 时回退 legacy
	key, kid, _ := ch.SelectKey()
	if key != "legacy-key" || kid != 0 {
		t.Fatalf("expected legacy fallback, got key=%q kid=%d", key, kid)
	}

	// 2) 迁移 legacy key
	if err := MigrateLegacyChannelKey(ch); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := DB.First(ch, ch.Id).Error; err != nil {
		t.Fatalf("reload: %v", err)
	}
	if ch.Key != "" {
		t.Fatalf("legacy key should be cleared after migration, got %q", ch.Key)
	}
	// 幂等：再次迁移不应重复插入
	if err := MigrateLegacyChannelKey(ch); err != nil {
		t.Fatalf("idempotent migrate: %v", err)
	}
	if n := CountChannelKeys(ch.Id); n != 1 {
		t.Fatalf("expected 1 key after idempotent migrate, got %d", n)
	}

	// 3) 新增多 Key
	w1 := uint(1)
	w2 := uint(99)
	k1 := &ChannelKey{ChannelId: ch.Id, Name: "k1", Key: "sk-aaa", Weight: &w1}
	k2 := &ChannelKey{ChannelId: ch.Id, Name: "k2", Key: "sk-bbb", Weight: &w2}
	if err := k1.Insert(); err != nil {
		t.Fatalf("insert k1: %v", err)
	}
	if err := k2.Insert(); err != nil {
		t.Fatalf("insert k2: %v", err)
	}
	// 密文不应等于明文
	var raw ChannelKey
	DB.First(&raw, k1.Id)
	if raw.Key == "sk-aaa" || !isEncrypted(raw.Key) {
		t.Fatalf("key should be encrypted at rest, got %q", raw.Key)
	}

	// 4) 加权选择应偏向 k2
	invalidateKeyCache(ch.Id)
	chosen := map[string]int{}
	for i := 0; i < 60; i++ {
		plain, id, _ := ch.SelectKey()
		chosen[plain]++
		_ = id
	}
	if chosen["sk-bbb"] <= chosen["sk-aaa"] {
		t.Fatalf("weighted selection should favor k2: %v", chosen)
	}

	// 5) 隔离 k2 后不再选中
	if err := QuarantineChannelKey(k2.Id, "auth_fail"); err != nil {
		t.Fatalf("quarantine: %v", err)
	}
	invalidateKeyCache(ch.Id)
	for i := 0; i < 30; i++ {
		plain, _, _ := ch.SelectKey()
		if plain == "sk-bbb" {
			t.Fatal("quarantined key should not be selected")
		}
	}

	// 6) 恢复后可再选
	if err := RecoverChannelKeys(ch.Id); err != nil {
		t.Fatalf("recover: %v", err)
	}
	invalidateKeyCache(ch.Id)
	gotB := false
	for i := 0; i < 40; i++ {
		plain, _, _ := ch.SelectKey()
		if plain == "sk-bbb" {
			gotB = true
		}
	}
	if !gotB {
		t.Fatal("recovered key should be selectable")
	}
}

func TestIntegration_ProbeRecording(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	ch := &Channel{Name: "probe", Type: 1, Key: "x", Status: ChannelStatusEnabled}
	DB.Create(ch)

	for i := 0; i < 5; i++ {
		_ = RecordProbe(&ChannelProbeLog{ChannelId: ch.Id, Model: "gpt-4", Success: true, LatencyMs: 200})
	}
	_ = RecordProbe(&ChannelProbeLog{ChannelId: ch.Id, Model: "gpt-4", Success: false, LatencyMs: 0, ErrorClass: "upstream_5xx"})

	probes, err := GetRecentProbes(ch.Id, 10)
	if err != nil {
		t.Fatalf("get probes: %v", err)
	}
	if len(probes) != 6 {
		t.Fatalf("expected 6 probes, got %d", len(probes))
	}
	// 倒序：最新的在最前
	if probes[0].Success {
		t.Fatal("latest probe should be the failure")
	}
}
