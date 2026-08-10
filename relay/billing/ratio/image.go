package ratio

var ImageSizeRatios = map[string]map[string]float64{
	"dall-e-2": {
		"256x256":   1,
		"512x512":   1.125,
		"1024x1024": 1.25,
	},
	"dall-e-3": {
		"1024x1024": 1,
		"1024x1792": 2,
		"1792x1024": 2,
	},
	"ali-stable-diffusion-xl": {
		"512x1024":  1,
		"1024x768":  1,
		"1024x1024": 1,
		"576x1024":  1,
		"1024x576":  1,
	},
	"ali-stable-diffusion-v1.5": {
		"512x1024":  1,
		"1024x768":  1,
		"1024x1024": 1,
		"576x1024":  1,
		"1024x576":  1,
	},
	"wanx-v1": {
		"1024x1024": 1,
		"720x1280":  1,
		"1280x720":  1,
	},
	"wanx2.1-t2i-turbo": {
		"1024x1024": 1,
		"720x1280":  1,
		"1280x720":  1,
	},
	"wanx2.1-t2i-plus": {
		"1024x1024": 1,
		"720x1280":  1.2,
		"1280x720":  1.2,
	},
	"step-1x-medium": {
		"256x256":   1,
		"512x512":   1,
		"768x768":   1,
		"1024x1024": 1,
		"1280x800":  1,
		"800x1280":  1,
	},
	// Doubao Seedream
	"doubao-seedream-5-0-pro-250828": {
		"1024x1024": 1,
		"2048x2048": 1,
		"1K":        1,
		"1.5K":      1,
		"2K":        1,
	},
	"doubao-seedream-5-0-lite-260128": {
		"2048x2048": 1,
		"2K":        1,
		"3K":        1,
		"4K":        1,
	},
	"doubao-seedream-4-5-251128": {
		"2048x2048": 1,
		"2K":        1,
		"4K":        1,
	},
	"doubao-seedream-4-0": {
		"2048x2048": 1,
		"1K":        1,
		"2K":        1,
		"4K":        1,
	},
}

var ImageGenerationAmounts = map[string][2]int{
	"dall-e-2":                  {1, 10},
	"dall-e-3":                  {1, 1}, // OpenAI allows n=1 currently.
	"ali-stable-diffusion-xl":   {1, 4}, // Ali
	"ali-stable-diffusion-v1.5": {1, 4}, // Ali
	"wanx-v1":                   {1, 4}, // Ali
	"wanx2.1-t2i-turbo":         {1, 4}, // Ali
	"wanx2.1-t2i-plus":          {1, 4}, // Ali
	"cogview-3":                 {1, 1},
	"step-1x-medium":            {1, 1},
	// Doubao Seedream
	"doubao-seedream-5-0-pro-250828":  {1, 1},
	"doubao-seedream-5-0-lite-260128": {1, 1},
	"doubao-seedream-4-5-251128":      {1, 1},
	"doubao-seedream-4-0":             {1, 1},
}

var ImagePromptLengthLimitations = map[string]int{
	"dall-e-2":                  1000,
	"dall-e-3":                  4000,
	"ali-stable-diffusion-xl":   4000,
	"ali-stable-diffusion-v1.5": 4000,
	"wanx-v1":                   4000,
	"wanx2.1-t2i-turbo":         4000,
	"wanx2.1-t2i-plus":          4000,
	"cogview-3":                 833,
	"step-1x-medium":            4000,
	// Doubao Seedream
	"doubao-seedream-5-0-pro-250828":  1200,
	"doubao-seedream-5-0-lite-260128": 1200,
	"doubao-seedream-4-5-251128":      1200,
	"doubao-seedream-4-0":             1200,
}

var ImageOriginModelName = map[string]string{
	"ali-stable-diffusion-xl":   "stable-diffusion-xl",
	"ali-stable-diffusion-v1.5": "stable-diffusion-v1.5",
}
