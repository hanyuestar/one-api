package alibailian

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/relay/adaptor"
	"github.com/songquanpeng/one-api/relay/adaptor/ali"
	"github.com/songquanpeng/one-api/relay/meta"
	"github.com/songquanpeng/one-api/relay/model"
	"github.com/songquanpeng/one-api/relay/relaymode"
)

// Adaptor implements the relay/adaptor.Adaptor interface for Ali Bailian.
type Adaptor struct {
}

func (a *Adaptor) Init(meta *meta.Meta) {
}

func (a *Adaptor) GetRequestURL(meta *meta.Meta) (string, error) {
	switch meta.Mode {
	case relaymode.ChatCompletions:
		return fmt.Sprintf("%s/compatible-mode/v1/chat/completions", meta.BaseURL), nil
	case relaymode.Embeddings:
		return fmt.Sprintf("%s/compatible-mode/v1/embeddings", meta.BaseURL), nil
	case relaymode.ImagesGenerations:
		return fmt.Sprintf("%s/api/v1/services/aigc/text2image/image-synthesis", meta.BaseURL), nil
	default:
	}
	return "", fmt.Errorf("unsupported relay mode %d for ali bailian", meta.Mode)
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Request, meta *meta.Meta) error {
	adaptor.SetupCommonRequestHeader(c, req, meta)
	req.Header.Set("Authorization", "Bearer "+meta.APIKey)
	if meta.Mode == relaymode.ImagesGenerations {
		req.Header.Set("X-DashScope-Async", "enable")
	}
	return nil
}

func (a *Adaptor) ConvertRequest(c *gin.Context, relayMode int, request *model.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertImageRequest(request *model.ImageRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	aliRequest := ali.ConvertImageRequest(*request)
	return aliRequest, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, meta *meta.Meta, requestBody io.Reader) (*http.Response, error) {
	return adaptor.DoRequestHelper(a, c, meta, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, meta *meta.Meta) (usage *model.Usage, err *model.ErrorWithStatusCode) {
	if meta.Mode == relaymode.ImagesGenerations {
		err, _ = ali.ImageHandler(c, resp)
		return
	}
	// Bailian compatible-mode returns OpenAI-compatible responses, pass through after reading.
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, &model.ErrorWithStatusCode{
			Error:      model.Error{Message: readErr.Error(), Type: "read_response_failed"},
			StatusCode: http.StatusInternalServerError,
		}
	}
	resp.Body.Close()

	// For streaming responses, forward the SSE stream directly.
	if meta.IsStream {
		for k, v := range resp.Header {
			c.Writer.Header().Set(k, v[0])
		}
		c.Writer.WriteHeader(resp.StatusCode)
		c.Writer.Write(responseBody)
		return nil, nil
	}

	// For non-streaming, unmarshal to generic map to extract usage if available.
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	c.Writer.Write(responseBody)

	var genericResp struct {
		Usage *model.Usage `json:"usage"`
	}
	if json.Unmarshal(responseBody, &genericResp) == nil && genericResp.Usage != nil {
		return nil, nil
	}
	return nil, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return "alibailian"
}
