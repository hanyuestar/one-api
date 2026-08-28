package model

import (
	"encoding/json"
	"errors"
	"math/rand"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common/logger"
)

// F-005 虚拟模型（Model Pool）：将一组真实模型聚合为一个入口，运行时按权重选择实际模型。
// Config JSON 示例：
// {
//   "candidates": [
//     {"model": "gpt-4o", "channel_id": 0, "weight": 3},
//     {"model": "gpt-4o-mini", "channel_id": 0, "weight": 1}
//   ]
// }

type VirtualCandidate struct {
	Model     string `json:"model"`
	ChannelId int    `json:"channel_id"` // 0 表示不指定渠道，走正常路由
	Weight    uint   `json:"weight"`
}

type VirtualModelConfig struct {
	Candidates []VirtualCandidate `json:"candidates"`
}

type VirtualModel struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	Name        string `json:"name" gorm:"uniqueIndex;size:64;not null"`
	Description string `json:"description" gorm:"type:text;default:''"`
	Strategy    string `json:"strategy" gorm:"size:32;default:'weighted'"`
	Config      string `json:"config" gorm:"type:text;default:''"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (VirtualModel) TableName() string { return "virtual_models" }

func (v *VirtualModel) ParseConfig() (*VirtualModelConfig, error) {
	var cfg VirtualModelConfig
	if v.Config == "" {
		return &cfg, nil
	}
	if err := json.Unmarshal([]byte(v.Config), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

var (
	virtualModelCache   = make(map[string]*VirtualModel)
	virtualModelCacheMu sync.RWMutex
)

func InitVirtualModelCache() {
	vms, err := GetAllVirtualModels()
	if err != nil {
		logger.SysError("failed to load virtual models: " + err.Error())
		return
	}
	newCache := make(map[string]*VirtualModel, len(vms))
	for _, v := range vms {
		newCache[v.Name] = v
	}
	virtualModelCacheMu.Lock()
	virtualModelCache = newCache
	virtualModelCacheMu.Unlock()
	logger.SysLog("virtual models cached")
}

func GetAllVirtualModels() ([]*VirtualModel, error) {
	var vms []*VirtualModel
	err := DB.Find(&vms).Error
	return vms, err
}

func GetEnabledVirtualModels() []*VirtualModel {
	virtualModelCacheMu.RLock()
	defer virtualModelCacheMu.RUnlock()
	out := make([]*VirtualModel, 0, len(virtualModelCache))
	for _, v := range virtualModelCache {
		if v.Enabled {
			out = append(out, v)
		}
	}
	return out
}

func GetVirtualModelByName(name string) (*VirtualModel, error) {
	var v VirtualModel
	err := DB.Where("name = ?", name).First(&v).Error
	return &v, err
}

func (v *VirtualModel) Insert() error {
	if v.Name == "" {
		return errors.New("virtual model name is required")
	}
	cfg, err := v.ParseConfig()
	if err != nil {
		return err
	}
	if len(cfg.Candidates) == 0 {
		return errors.New("at least one candidate is required")
	}
	now := time.Now().Unix()
	v.CreatedAt = now
	v.UpdatedAt = now
	if v.Strategy == "" {
		v.Strategy = "weighted"
	}
	err = DB.Create(v).Error
	if err == nil {
		InitVirtualModelCache()
	}
	return err
}

func (v *VirtualModel) Update() error {
	if v.Config != "" {
		if _, err := v.ParseConfig(); err != nil {
			return err
		}
	}
	v.UpdatedAt = time.Now().Unix()
	err := DB.Model(v).Updates(map[string]any{
		"description": v.Description,
		"strategy":    v.Strategy,
		"config":      v.Config,
		"enabled":     v.Enabled,
		"updated_at":  v.UpdatedAt,
	}).Error
	if err == nil {
		InitVirtualModelCache()
	}
	return err
}

func DeleteVirtualModel(id int) error {
	err := DB.Delete(&VirtualModel{}, id).Error
	if err == nil {
		InitVirtualModelCache()
	}
	return err
}

// pickCandidate 按权重从候选中选择一个。
func pickCandidate(candidates []VirtualCandidate) *VirtualCandidate {
	if len(candidates) == 0 {
		return nil
	}
	total := 0.0
	for _, c := range candidates {
		w := c.Weight
		if w == 0 {
			w = 1
		}
		total += float64(w)
	}
	r := rand.Float64() * total
	acc := 0.0
	for i := range candidates {
		w := candidates[i].Weight
		if w == 0 {
			w = 1
		}
		acc += float64(w)
		if r <= acc {
			return &candidates[i]
		}
	}
	return &candidates[len(candidates)-1]
}

// ResolveVirtualModel 若 name 是已启用的虚拟模型，返回 (实际模型名, 虚拟模型名, 指定渠道ID)；
// 否则返回 (name, "", 0)。
func ResolveVirtualModel(group string, name string) (string, string, int) {
	virtualModelCacheMu.RLock()
	v, ok := virtualModelCache[name]
	virtualModelCacheMu.RUnlock()
	if !ok || !v.Enabled {
		return name, "", 0
	}
	cfg, err := v.ParseConfig()
	if err != nil || len(cfg.Candidates) == 0 {
		return name, "", 0
	}
	c := pickCandidate(cfg.Candidates)
	if c == nil || c.Model == "" {
		return name, "", 0
	}
	return c.Model, v.Name, c.ChannelId
}
