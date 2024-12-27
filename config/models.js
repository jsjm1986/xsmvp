// AI模型配置
const AI_MODELS = {
    // DeepSeek模型
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: {
            'deepseek-chat': {
                id: 'deepseek-chat',
                name: 'DeepSeek Chat',
                maxTokens: 4000,
                temperature: 0.7,
                description: '通用对话模型，适合创意写作'
            },
            'deepseek-coder': {
                id: 'deepseek-coder',
                name: 'DeepSeek Coder',
                maxTokens: 8000,
                temperature: 0.7,
                description: '代码生成模型'
            }
        },
        verifyEndpoint: '/chat/completions',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    
    // Claude模型
    anthropic: {
        name: 'Anthropic Claude',
        baseUrl: 'https://api.anthropic.com/v1',
        models: {
            'claude-2': {
                id: 'claude-2',
                name: 'Claude 2',
                maxTokens: 100000,
                temperature: 0.7,
                description: '强大的通用模型，适合长文本创作'
            },
            'claude-instant': {
                id: 'claude-instant',
                name: 'Claude Instant',
                maxTokens: 100000,
                temperature: 0.7,
                description: '快速响应模型，适合短文本创作'
            }
        },
        verifyEndpoint: '/messages',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        }
    },

    // OpenAI模型
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: {
            'gpt-4': {
                id: 'gpt-4',
                name: 'GPT-4',
                maxTokens: 8000,
                temperature: 0.7,
                description: '最强大的GPT模型，适合复杂创作'
            },
            'gpt-3.5-turbo': {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                maxTokens: 4000,
                temperature: 0.7,
                description: '性能均衡的GPT模型，适合一般创作'
            }
        },
        verifyEndpoint: '/chat/completions',
        headers: {
            'Content-Type': 'application/json'
        }
    }
};

// 获取所有可用的AI服务商
function getProviders() {
    return Object.entries(AI_MODELS).map(([key, provider]) => ({
        id: key,
        name: provider.name,
        baseUrl: provider.baseUrl
    }));
}

// 获取指定服务商的所有模型
function getModels(providerId) {
    const provider = AI_MODELS[providerId];
    if (!provider) {
        console.error('未找到服务商:', providerId);
        return [];
    }
    
    return Object.values(provider.models).map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        maxTokens: model.maxTokens
    }));
}

// 获取指定模型的配置
function getModelConfig(providerId, modelId) {
    const provider = AI_MODELS[providerId];
    if (!provider) {
        console.error('未找到服务商:', providerId);
        return null;
    }
    
    const model = provider.models[modelId];
    if (!model) {
        console.error('未找到模型:', modelId);
        return null;
    }
    
    return {
        ...model,
        baseUrl: provider.baseUrl,
        headers: provider.headers
    };
}

// 验证API密钥
async function verifyApiKey(providerId, apiKey, baseUrl) {
    console.log('开始验证API密钥:', { providerId, baseUrl });
    
    const provider = AI_MODELS[providerId];
    if (!provider) {
        console.error('未知的服务商:', providerId);
        return false;
    }

    const verifyUrl = `${baseUrl || provider.baseUrl}${provider.verifyEndpoint}`;
    const headers = {
        ...provider.headers,
        'Authorization': `Bearer ${apiKey}`
    };
    
    try {
        console.log('发送验证请求:', verifyUrl);
        const response = await fetch(verifyUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: Object.keys(provider.models)[0],
                messages: [
                    {
                        role: "user",
                        content: "验证API密钥"
                    }
                ],
                max_tokens: 10
            })
        });

        console.log('验证响应状态:', response.status);
        return response.ok;
    } catch (error) {
        console.error('验证API密钥时出错:', error);
        return false;
    }
}

module.exports = {
    AI_MODELS,
    getProviders,
    getModels,
    getModelConfig,
    verifyApiKey
}; 