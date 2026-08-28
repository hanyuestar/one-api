package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/monitor"
)

// ---------- F-004 路由策略 ----------

func GetRoutingPolicies(c *gin.Context) {
	policies, err := model.GetAllRoutingPolicies()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": policies})
}

func CreateRoutingPolicy(c *gin.Context) {
	var p model.RoutingPolicy
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := p.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": p})
}

func UpdateRoutingPolicy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var p model.RoutingPolicy
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	p.Id = id
	if err := p.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteRoutingPolicy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteRoutingPolicy(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ---------- F-005 虚拟模型 ----------

func GetVirtualModels(c *gin.Context) {
	vms, err := model.GetAllVirtualModels()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": vms})
}

func CreateVirtualModel(c *gin.Context) {
	var v model.VirtualModel
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := v.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": v})
}

func UpdateVirtualModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var v model.VirtualModel
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	v.Id = id
	if err := v.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteVirtualModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteVirtualModel(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ---------- F-006 渠道多 Key ----------

func GetChannelKeys(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	keys, err := model.GetChannelKeys(channelId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	// 脱敏：不返回明文 Key，仅返回 hint
	type keyView struct {
		Id         int    `json:"id"`
		ChannelId  int    `json:"channel_id"`
		Name       string `json:"name"`
		Weight     *uint  `json:"weight"`
		Status     int    `json:"status"`
		FailCount  int    `json:"fail_count"`
		LastUsedAt int64  `json:"last_used_at"`
		KeyHint    string `json:"key_hint"`
	}
	views := make([]keyView, 0, len(keys))
	for _, k := range keys {
		views = append(views, keyView{
			Id: k.Id, ChannelId: k.ChannelId, Name: k.Name, Weight: k.Weight,
			Status: k.Status, FailCount: k.FailCount, LastUsedAt: k.LastUsedAt, KeyHint: k.KeyHint(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": views})
}

func CreateChannelKey(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	var k model.ChannelKey
	if err := c.ShouldBindJSON(&k); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if k.Key == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "key is required"})
		return
	}
	k.ChannelId = channelId
	if err := k.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": k.Id, "key_hint": k.KeyHint()}})
}

func UpdateChannelKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("kid"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid key id"})
		return
	}
	var k model.ChannelKey
	if err := c.ShouldBindJSON(&k); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	k.Id = id
	if err := k.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteChannelKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("kid"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid key id"})
		return
	}
	if err := model.DeleteChannelKey(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RecoverChannelKeys 手动恢复渠道下被隔离的 Key。
func RecoverChannelKeys(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	if err := model.RecoverChannelKeys(channelId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ---------- F-012 渠道健康 ----------

func GetChannelHealth(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	ch, err := model.GetChannelById(channelId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	probes, _ := model.GetRecentProbes(channelId, 20)
	circuit := monitor.GetCircuitSnapshot(channelId)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"channel_id":    ch.Id,
			"name":          ch.Name,
			"status":        ch.Status,
			"health_score":  ch.HealthScore,
			"response_time": ch.ResponseTime,
			"last_probe_at": ch.LastProbeAt,
			"circuit":       circuit,
			"key_count":     model.CountChannelKeys(channelId),
			"recent_probes": probes,
		},
	})
}

// MetricsHandler 输出 Prometheus 文本指标（F-010）。
func MetricsHandler(c *gin.Context) {
	c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(monitor.RenderPrometheus()))
}
