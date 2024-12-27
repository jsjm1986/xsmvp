// API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 在文件开头添加
let isApiKeyVerified = false;
let globalConfig = null;
let novelContent = []; // 用于存储小说内容

// 章节拆分和细化处理模块
class ChapterSplitter {
    constructor() {
        this.originalChapter = null;
        this.subChapters = [];
    }

    // 初始化拆分配置
    async initializeSplit(chapterContent, originalChapterNum, targetCount) {
        this.originalChapter = {
            content: chapterContent,
            chapterNum: originalChapterNum
        };
        
        return await this.generateSubChapters(targetCount);
    }

    // 生成子章节
    async generateSubChapters(targetCount) {
        const prompt = `作为专业的小说章节拆分专家，请将以下章节内容拆分成${targetCount}个紧密相连的子章节。

原始章节内容：
${this.originalChapter.content}

拆分要求：
1. 将原始章节扩展为${targetCount}个子章节，每个子章节必须与前一个场景紧密衔接
2. 每个子章节必须包含：
   - 子章节标题（反映当前场景核心）
   - 主要人物（当前场景的核心人物）
   - 核心事件（当前场景的主要事件）
   - 详细内容（场景的具体展开）

3. 情节连贯性要求：
   - 每个子章节必须从上一个场景的结束处自然延续
   - 保持场景、环境、氛围的连续性
   - 人物的情绪状态要基于前一个场景的发展
   - 对话和行动要呼应前文的互动
   - 不能出现突兀的场景转换
   - 每个场景都要为下一个场景做好铺垫

4. 每个子章节的详细内容必须包含：
   - 与前一场景的自然过渡
   - 场景的具体描写（继承前一场景的环境元素）
   - 人物的心理活动（基于前一场景的情绪延续）
   - 对话内容（呼应前文的互动）
   - 情节发展（基于前一场景的事件推进）
   - 为下一场景埋下伏笔

请按照以下格式输出每个子章节，使用"---章节分隔符---"分隔：

第X-1节：[子章节标题]
主要人物：[人物列表]
核心事件：[事件描述]
详细内容：[具体内容]
---章节分隔符---
第X-2节：[子章节标题]
...`;

        try {
            const response = await callAIAPI([
                {
                    role: "system",
                    content: `你是一个专业的小说章节拆分专家，擅长创作连贯流畅的场景。
当前正在将第${this.originalChapter.chapterNum}章拆分为${targetCount}个紧密相连的子章节。
请确保：
1. 每个子章节都是前一个场景的自然延续
2. 场景转换要流畅自然，不能生硬跳转
3. 人物的情绪和行为要基于前文发展
4. 环境和氛围要保持连贯性
5. 每个场景都要为下一个场景做好铺垫`
                },
                {
                    role: "user",
                    content: prompt
                }
            ], 0.7, 4000);

            // 解析子章节
            this.subChapters = this.parseSubChapters(response);
            
            // 验证和优化每个子章节
            await this.validateAndOptimizeSubChapters();

            return this.subChapters;
        } catch (error) {
            console.error('生成子章节时出错:', error);
            throw error;
        }
    }

    // 解析子章节内容
    parseSubChapters(content) {
        const chapters = content.split('---章节分隔符---')
            .map(chapter => chapter.trim())
            .filter(chapter => chapter.length > 0);

        return chapters.map(chapter => {
            const lines = chapter.split('\n');
            // 修改标题匹配模式，支持"第X-Y节：标题"格式
            const titleMatch = lines[0].match(/第(\d+)-(\d+)节：(.+)/);
            
            if (!titleMatch) {
                console.warn('子章节标题格式不正确:', lines[0]);
                return null;
            }

            const subChapter = {
                mainChapterNum: parseInt(titleMatch[1]),
                subChapterNum: parseInt(titleMatch[2]),
                title: titleMatch[3].trim(),
                characters: '',
                mainEvent: '',
                content: ''
            };

            let currentSection = '';
            for (const line of lines.slice(1)) {
                if (line.startsWith('主要人物：')) {
                    subChapter.characters = line.replace('主要人物：', '').trim();
                } else if (line.startsWith('核心事件：')) {
                    subChapter.mainEvent = line.replace('核心事件：', '').trim();
                } else if (line.startsWith('详细内容：')) {
                    currentSection = 'content';
                } else if (currentSection === 'content') {
                    subChapter.content += line + '\n';
                }
            }

            subChapter.content = subChapter.content.trim();
            return subChapter;
        }).filter(chapter => chapter !== null);
    }

    // 验证和优化子章节
    async validateAndOptimizeSubChapters() {
        const optimizedChapters = [];
        
        for (let chapter of this.subChapters) {
            if (!this.validateSubChapter(chapter)) {
                chapter = await this.optimizeSubChapter(chapter);
            }
            optimizedChapters.push(chapter);
        }

        this.subChapters = optimizedChapters;
    }

    // 验证子章节
    validateSubChapter(chapter) {
        // 检查必要字段
        if (!chapter.title || !chapter.characters || !chapter.mainEvent || !chapter.content) {
            return false;
        }

        // 检查内容长度
        if (chapter.content.length < 500) {
            return false;
        }

        // 检查必要叙事元素
        const requiredElements = [
            { name: '场景', keywords: ['场景', '环境', '周围', '地点', '空间'] },
            { name: '对话', keywords: ['对话', '说道', '问道', '回答', '开口'] },
            { name: '心理', keywords: ['心理', '感受', '想法', '内心', '情绪'] },
            { name: '情节', keywords: ['情节', '发生', '进展', '事件', '经过'] },
            { name: '转折', keywords: ['转折', '突然', '变化', '却', '但是'] }
        ];

        for (const element of requiredElements) {
            if (!element.keywords.some(keyword => chapter.content.includes(keyword))) {
                return false;
            }
        }

        return true;
    }

    // 优化子章节
    async optimizeSubChapter(chapter) {
        const prompt = `请优化以下子章节内容，确保包含所有必要的叙事元素和足够的细节。

当前内容：
第${chapter.mainChapterNum}-${chapter.subChapterNum}节：${chapter.title}
主要人物：${chapter.characters}
核心事件：${chapter.mainEvent}
详细内容：${chapter.content}

要求：
1. 保持原有的标题、人物和核心事件
2. 扩充详细内容，使其至少包含500字
3. 必须包含以下叙事元素：
   - 场景描写
   - 人物对话
   - 心理活动
   - 情节发展
   - 情节转折
4. 确保内容的连贯性和完整性
5. 与其他子章节保持剧情关联

请按照原格式输出优化后的内容。`;

        try {
            const response = await callAIAPI([
                {
                    role: "system",
                    content: "你是一个专业的小说编辑，擅长优化章节内容和故事结构。"
                },
                {
                    role: "user",
                    content: prompt
                }
            ], 0.7, 3000);

            // 解析优化后的内容
            const lines = response.split('\n');
            const optimizedChapter = { ...chapter };

            let currentSection = '';
            for (const line of lines) {
                if (line.startsWith('主要人物：')) {
                    optimizedChapter.characters = line.replace('主要人物：', '').trim();
                } else if (line.startsWith('核心事件：')) {
                    optimizedChapter.mainEvent = line.replace('核心事件：', '').trim();
                } else if (line.startsWith('详细内容：')) {
                    currentSection = 'content';
                    optimizedChapter.content = '';
                } else if (currentSection === 'content') {
                    optimizedChapter.content += line + '\n';
                }
            }

            optimizedChapter.content = optimizedChapter.content.trim();
            return optimizedChapter;
        } catch (error) {
            console.error('优化子章节时出错:', error);
            return chapter;
        }
    }
}

// 验证API密钥
async function verifyApiKey(apiKey) {
    try {
        console.log('开始验证API密钥...');
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "user",
                        content: "测试API密钥"
                    }
                ],
                max_tokens: 10
            })
        });

        console.log('API响应状态:', response.status);
        const data = await response.json();

        if (!response.ok) {
            console.error('API响应错误:', data);
            return false;
        }

        return true;
    } catch (error) {
        console.error('API密钥验证失败:', error);
        return false;
    }
}

// 通用的API调用函数
async function callAIAPI(messages, temperature = 0.7, maxTokens = 2000) {
    const savedConfig = localStorage.getItem('ai_config');
    if (!savedConfig) {
        throw new Error('API配置未找到');
    }

    const config = JSON.parse(savedConfig);
    const requestBody = {
        model: config.model || "deepseek-chat",
        messages: messages,
        temperature: temperature,
        max_tokens: Math.min(maxTokens, 4096),  // 确保不超过最大限制
        presence_penalty: 0,
        frequency_penalty: 0,
        top_p: 0.95,
        stream: false
    };

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText,
                requestBody: requestBody
            });
            throw new Error(`API请求失败: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

// 工具函数：调用Deepseek API
async function callDeepseekAPI(messages, temperature = 0.7, maxTokens = 2000) {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        throw new Error('请输入API密钥！');
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages,
            temperature,
            max_tokens: maxTokens,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.3
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || '请求失败');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// API调用函数
async function generatePlot(title, theme) {
    const prompt = `
作为一个专业的小说策划师，请为这部小说创作一个引人入胜的主要剧情：

小说标题：${title}
类型：${theme}

要求：
1. 构思完整的故事主线，包含开端、发展、高潮和结局
2. 设计合理的情节转折点
3. 故事要有吸引力和创新性
4. 符合${theme}类型小说的特点
5. 篇幅在500字左右

请直接输出剧情内容，不需要其他额外说明。`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的小说策划师，擅长设计引人入胜的故事情节。"
        },
        {
            role: "user",
            content: prompt
        }
    ], 0.8, 1000);
}

async function generateCharacters(title, theme, plot) {
    const prompt = `
作为一个专业的小说角色设计师，请为这部小说创建主要人物设定：

小说标题：${title}
类型：${theme}
主要剧情：${plot}

要求：
1. 设计3-5个主要角色
2. 包含每个角色的性格特点、背景故事、外貌特征
3. 人物性格要丰富立体，避免脸谱化
4. 角色之间要有合理的关系和互动
5. 人物设定要符合故事背景和主题
6. 每个角色的设定200字左右

请直接输出人物设定，不需要其他额外说明。`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的小说角色设计师，擅长创造丰富立体的人物形象。"
        },
        {
            role: "user",
            content: prompt
        }
    ], 0.8, 1500);
}

async function generateWorld(title, theme, plot) {
    const prompt = `
作为一个专业的小说世界观设计师，请为这部小说创建完整的世界观设定：

小说标题：${title}
类型：${theme}
主要剧情：${plot}

要求：
1. 详细描述故事发生的时代背景和环境
2. 设计独特的世界规则和运行机制
3. 包含社会制度、文化习俗等内容
4. 如有必要，可以包含特殊的力量体系或科技水平
5. 世界观要符合故事主题和类型特点
6. 设定要合理且具有内在逻辑性
7. 篇幅在500字左右

请直接输出世界观设定，不需要其他额外说明。`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的小说世界观设计师，擅长创造独特而合理的故事背景��"
        },
        {
            role: "user",
            content: prompt
        }
    ], 0.8, 1000);
}

async function optimizeContent(content, type) {
    const prompt = `
作为一个专业的小说内容优化专家，请优化以下${type}：

原始内容：
${content}

优化要求：
1. 保持原有内容的核心思想
2. 改善文字表达，使其更加生动形象
3. 增加细节描写，丰富内容
4. 确保逻辑性和连贯性
5. 修正可能存在的问题或漏洞
6. ${type === '剧情' ? '优化情节发展和转折' : 
     type === '人物设定' ? '使人物形象更加丰满立体' : 
     '完善世界观的合理性和独特性'}

请直接输出优化后的内容，不需要其他额外说明。`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的小说内容优化专家，擅长改进和完善文学创作内容。"
        },
        {
            role: "user",
            content: prompt
        }
    ], 0.7, 2000);
}

// 获取章节上下文信息
async function getChapterContext(currentChapter, novelContent) {
    if (currentChapter === 1) {
        return {
            previousChapter: null,
            keyPlots: [],
            characters: new Map(),
            timeline: []
        };
    }

    const previousChapter = novelContent[currentChapter - 2];
    const keyPlots = extractKeyPlots(novelContent.slice(0, currentChapter - 1));
    const characters = trackCharacters(novelContent.slice(0, currentChapter - 1));
    const timeline = buildTimeline(novelContent.slice(0, currentChapter - 1));

    return {
        previousChapter,
        keyPlots,
        characters,
        timeline
    };
}

// 取关键情点
function extractKeyPlots(previousChapters) {
    const keyPlots = [];
    previousChapters.forEach((chapter, index) => {
        // 用AI分析提取关键情节
        const chapterSummary = {
            chapter: index + 1,
            key_events: [],
            important_decisions: [],
            character_developments: []
        };
        // 这里可以添加更详细的情节分析逻辑
        keyPlots.push(chapterSummary);
    });
    return keyPlots;
}

// 追踪人物状态
function trackCharacters(previousChapters) {
    const characters = new Map();
    previousChapters.forEach(chapter => {
        // 分析章节中的人物状态变化
        // 记录人物的情感、关系、能力变化
    });
    return characters;
}

// 构建时间线
function buildTimeline(previousChapters) {
    const timeline = [];
    previousChapters.forEach((chapter, index) => {
        // 提取时间相关的信息
        // 记录重要事件的发顺序
    });
    return timeline;
}

// 修改generateChapter函数的参数分
async function generateChapter(params) {
    const context = await getChapterContext(params.currentChapter, novelContent);
    
    const chapterPrompt = `
作为一个专业的小说创作者，请根据以下信息创作一个精彩的章节：

小说标题：${params.title}
类型：${params.theme}
写作风格：${params.writingStyle}
当前章节：第${params.currentChapter}章（共${params.totalChapters}章）
章节类型：${params.chapterType}章节

世界观设定：
${params.worldSetting}

主要人物设定：
${params.characterInfo}

整体剧情概要：
${params.mainPlot}

本章大纲：
${params.chapterOutline}

${context.previousChapter ? `上一章内容：\n${context.previousChapter.content}\n` : ''}

关键情节梳理：
${formatKeyPlots(context.keyPlots)}

人物状态追踪：
${formatCharacterStatus(context.characters)}

时间线：
${formatTimeline(context.timeline)}

写作要求：
1. 这是第${params.currentChapter}章，共${params.totalChapters}章，请把握好情节推进的节奏
2. 这是一个${params.chapterType}章节，要符合${params.chapterType}章节的特点
3. 字数控制在${params.chapterLength}字左右
4. 使用${params.writingStyle}的写作风格
5. 注意人物性格的一致性和发展
6. 场景描写要细腻，对话要生动
7. 符合${params.theme}类型小说的特点
8. 确保与上一章节的情节自然衔接
9. 维持人物行为和性格的一致性
10. 保持时间线的连贯性
11. 合理继承和发展已有的情节线索

${params.currentChapter === 1 ? '作为开篇章节，需要吸引读者注意力，并做好人物和背景的铺垫。' : ''}
${params.currentChapter === params.totalChapters ? '作为结局章节，需要完美收所有情节，给读者一个满意的结局。' : ''}
${params.chapterType === '高潮' ? '作为高潮章节，需要制造足够的戏剧冲突和情节张力。' : ''}

请直接开始创作小说内容，不需要其他额外说明。`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: `你是一个专业的小说创作者，擅长${params.theme}类型的小说创作。你需要创作出符合要求的小说章节，特别注意与前文的连贯性和人物塑造的一致性。`
        },
        {
            role: "user",
            content: chapterPrompt
        }
    ], params.creativity / 100, Math.min(params.chapterLength * 2, 4000));
}

// 格式化关键情节信息
function formatKeyPlots(keyPlots) {
    return keyPlots.map(plot => `
第${plot.chapter}章关键事件：
- 重要事件：${plot.key_events.join('、')}
- 关键决定：${plot.important_decisions.join('、')}
- 人物发展：${plot.character_developments.join('、')}
`).join('\n');
}

// 格式化人物状态信息
function formatCharacterStatus(characters) {
    let result = '';
    characters.forEach((status, character) => {
        result += `${character}：\n`;
        result += `- 当前状态：${status.current_state}\n`;
        result += `- 情感变化：${status.emotional_changes}\n`;
        result += `- 关系网络：${status.relationships}\n`;
    });
    return result;
}

// 格式化时间线信息
function formatTimeline(timeline) {
    return timeline.map(event => `- ${event.time}: ${event.description}`).join('\n');
}

// 添加故事主线追踪功能
class StorylineTracker {
    constructor() {
        this.mainPlotPoints = [];  // 主要情节点
        this.subPlots = new Map(); // 子情节线
        this.characterArcs = new Map(); // 人物成长线
        this.conflicts = []; // 主要冲突
        this.themes = new Set(); // 主题元素
        this.foreshadowing = []; // 伏笔
    }

    // 添加情节点
    addPlotPoint(point) {
        this.mainPlotPoints.push({
            chapter: point.chapter,
            event: point.event,
            impact: point.impact,
            relatedCharacters: point.characters
        });
    }

    // 添加或更新子情节
    updateSubPlot(plotName, development) {
        if (!this.subPlots.has(plotName)) {
            this.subPlots.set(plotName, []);
        }
        this.subPlots.get(plotName).push(development);
    }

    // 更新人物成长线
    updateCharacterArc(character, development) {
        if (!this.characterArcs.has(character)) {
            this.characterArcs.set(character, []);
        }
        this.characterArcs.get(character).push(development);
    }

    // 添加伏笔
    addForeshadowing(setup) {
        this.foreshadowing.push({
            setupChapter: setup.chapter,
            content: setup.content,
            payoffChapter: setup.payoffChapter,
            status: 'pending'
        });
    }

    // 获取当前章节需要的上下文
    getChapterContext(currentChapter) {
        return {
            activeSubplots: this.getActiveSubplots(currentChapter),
            pendingForeshadowing: this.getPendingForeshadowing(currentChapter),
            relevantCharacterArcs: this.getRelevantCharacterArcs(currentChapter),
            thematicElements: Array.from(this.themes),
            unresolvedConflicts: this.getUnresolvedConflicts(currentChapter)
        };
    }

    // 获取活跃的子情节
    getActiveSubplots(currentChapter) {
        const active = new Map();
        this.subPlots.forEach((developments, plotName) => {
            const recentDevelopments = developments.filter(d => 
                d.chapter < currentChapter && currentChapter - d.chapter <= 5);
            if (recentDevelopments.length > 0) {
                active.set(plotName, recentDevelopments);
            }
        });
        return active;
    }

    // 获取未解决的伏笔
    getPendingForeshadowing(currentChapter) {
        return this.foreshadowing.filter(f => 
            f.setupChapter < currentChapter && 
            f.status === 'pending' &&
            (!f.payoffChapter || f.payoffChapter >= currentChapter)
        );
    }

    // 获取相关的人物成长线
    getRelevantCharacterArcs(currentChapter) {
        const relevant = new Map();
        this.characterArcs.forEach((developments, character) => {
            const recentDevelopments = developments.filter(d => d.chapter < currentChapter)
                .slice(-3); // 获取最近的三个发展点
            if (recentDevelopments.length > 0) {
                relevant.set(character, recentDevelopments);
            }
        });
        return relevant;
    }

    // 获取未解的突
    getUnresolvedConflicts(currentChapter) {
        return this.conflicts.filter(c => 
            !c.resolutionChapter || c.resolutionChapter >= currentChapter
        );
    }
}

// 设置大纲控制功能
function setupOutlineControls(outlineElement, outline) {
    const splitBtn = outlineElement.querySelector('.split-outline-btn');
    const editBtn = outlineElement.querySelector('.edit-outline-btn');
    const saveBtn = outlineElement.querySelector('.save-outline-btn');
    const splitPreview = outlineElement.querySelector('.split-preview');
    const splitPreviewContent = splitPreview.querySelector('.split-preview-content');

    // 编辑按钮事件
    editBtn?.addEventListener('click', () => {
        const textElements = outlineElement.querySelectorAll('.text');
        textElements.forEach(el => {
            const editArea = document.createElement('textarea');
            editArea.className = 'edit-field';
            editArea.value = el.textContent;
            el.style.display = 'none';
            editArea.style.display = 'block';
            el.parentNode.insertBefore(editArea, el);
        });
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
    });

    // 保存按钮事件
    saveBtn?.addEventListener('click', () => {
        const textElements = outlineElement.querySelectorAll('.text');
        const editFields = outlineElement.querySelectorAll('.edit-field');
        textElements.forEach((el, index) => {
            el.textContent = editFields[index].value;
            el.style.display = 'inline';
            editFields[index].remove();
        });
        saveBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';

        // 更新outline对象
        const [charactersText, eventText, contentText] = textElements;
        outline.characters = charactersText.textContent.split(/[、，,]/).map(c => c.trim()).filter(Boolean);
        outline.mainEvent = eventText.textContent;
        outline.content = contentText.textContent;
    });

    // 拆分按钮事件
    splitBtn?.addEventListener('click', async () => {
        try {
            splitBtn.disabled = true;
            splitPreview.style.display = 'block';
            splitPreviewContent.innerHTML = '<div class="loading">正在生成子章节...</div>';

            // 获取全局拆分数量设置
            const globalSplitCount = document.getElementById('batchSplitCount');
            const splitCount = globalSplitCount ? parseInt(globalSplitCount.value) : 3;

            // 初始化章节拆分器
            const splitter = new ChapterSplitter();
            const subChapters = await splitter.initializeSplit(
                outline.content,
                outline.chapter,
                splitCount
            );

            // 显示拆分结果
            splitPreviewContent.innerHTML = subChapters.map(chapter => `
                <div class="sub-outline">
                    <div class="sub-outline-header">
                        <h4>第${chapter.mainChapterNum}-${chapter.subChapterNum}节：${chapter.title}</h4>
                    </div>
                    <div class="sub-outline-info">
                        <div class="info-item">
                            <span class="label">主要人物：</span>
                            <span class="value">${chapter.characters}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">核心事件：</span>
                            <span class="value">${chapter.mainEvent}</span>
                        </div>
                    </div>
                    <div class="sub-outline-content">
                        <div class="sub-outline-text">${chapter.content}</div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('拆分大纲时出错:', error);
            splitPreviewContent.innerHTML = '<div class="error">拆分失败，请重试</div>';
        } finally {
            splitBtn.disabled = false;
        }
    });
}

// 创建全局故事线追踪器实例
const storylineTracker = new StorylineTracker();

// 修改大纲生成配置
const OUTLINE_CONFIG = {
    batchSize: 1,           // 单次生成一章
    minWordsPerOutline: 10, // 降低最小字数要求
    maxWordsPerOutline: 500,
    delayBetweenBatches: 2000,
    maxRetries: 2,
    retryDelay: 1000
};

// 添加重试工具函数
async function withRetry(operation, maxRetries, retryDelay, errorHandler) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            if (result) return result;
            throw new Error('Operation returned empty result');
        } catch (error) {
            lastError = error;
            if (errorHandler) {
                errorHandler(error, attempt);
            }
            if (attempt < maxRetries) {
                const delay = retryDelay * Math.pow(2, attempt - 1); // 指数退避
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// 添加进度条相关函数
function createProgressBar() {
    // 检查是否已存在进度条
    let progressContainer = document.querySelector('.progress-container');
    
    // 如果不存在，创建新的进度条
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
            <div class="progress">
                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
            </div>
            <div class="progress-text">准备生成大纲...</div>
        `;
        
        // 将进度条插入到合适的位置
        const outlinesList = document.getElementById('chapterOutlinesList');
        if (outlinesList) {
            outlinesList.parentElement.insertBefore(progressContainer, outlinesList);
        } else {
            // 如果找不到大纲列表，插入到body中
            document.body.appendChild(progressContainer);
        }
    }
    
    // 重置进度条状态
    const progressBar = progressContainer.querySelector('.progress-bar');
    const progressText = progressContainer.querySelector('.progress-text');
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    if (progressText) {
        progressText.textContent = '准备生成大纲...';
    }
    
    return progressContainer;
}

function updateProgress(current, total, message) {
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
        const progressBar = progressContainer.querySelector('.progress-bar');
        const progressText = progressContainer.querySelector('.progress-text');
        
        if (progressBar) {
            const percentage = Math.round((current / total) * 100);
            progressBar.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = message || `正在生成第 ${current} 章大纲，共 ${total} 章`;
        }
    }
}

// 修改生成大纲的函数
async function generateOutlineBatch({ title, theme, mainPlot, characterInfo, worldSetting, phase, startChapter, batchSize, totalChapters, previousOutlines = [] }) {
    // 创建进度条
    const progressContainer = createProgressBar();
    const progressBar = progressContainer.querySelector('.progress-bar');
    const progressText = progressContainer.querySelector('.progress-text');

    // 显示进度条
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    
    const outlines = [];
    
    for (let i = 0; i < batchSize; i++) {
        const chapterNum = startChapter + i;
        if (chapterNum > totalChapters) break;

        try {
            updateProgress(chapterNum, totalChapters, `正在生成第 ${chapterNum} 章大纲...`);
            
            const outline = await generateSingleOutline({
                title,
                theme,
                mainPlot,
                characterInfo,
                worldSetting,
                phase,
                chapterNum,
                totalChapters
            });

            if (!outline) {
                console.error('解析大纲失败');
                throw new Error('大纲解析失败');
            }

            outlines.push(outline);
            
            // 更新进度显示
            updateProgress(chapterNum, totalChapters, `已成功生成第 ${chapterNum} 章大纲`);

            // 等待一小段时间，避免API调用过于频繁
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`生成第${chapterNum}章大纲时出错:`, error);
            throw error;
        }
    }

    // 生成完成后隐藏进度条
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }

    // 显示生成的大纲
    const outlinesList = document.getElementById('chapterOutlinesList');
    if (outlinesList) {
        // 清空现有内容
        outlinesList.innerHTML = '';

        // 遍历并显示每个大纲
        outlines.forEach(outline => {
            // 创建大纲元素
            const outlineElement = document.createElement('div');
            outlineElement.className = 'chapter-outline';
            outlineElement.innerHTML = `
                <div class="outline-header">
                    <h3>第${outline.chapter}章：${outline.title}</h3>
                    <div class="outline-controls">
                        <button class="split-outline-btn">拆分</button>
                        <button class="edit-outline-btn">编辑</button>
                        <button class="save-outline-btn" style="display:none">保存</button>
                    </div>
                </div>
                <div class="outline-content">
                    <div class="info-item">
                        <span class="label">主要人物：</span>
                        <span class="text">${outline.characters.join('、')}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">核心事件：</span>
                        <span class="text">${outline.mainEvent}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">详细内容：</span>
                        <span class="text">${outline.content}</span>
                    </div>
                </div>
                <div class="split-preview" style="display:none">
                    <div class="split-preview-content"></div>
                </div>
            `;

            // 添加到列表中
            outlinesList.appendChild(outlineElement);
            
            // 设置大纲控制功能
            setupOutlineControls(outlineElement, outline);
        });
    }

    return outlines;
}

// 添加单个大纲显示函数
function displayOutline(outline) {
    const outlinesList = document.getElementById('chapterOutlinesList');
    if (!outlinesList) {
        console.error('找不到大纲列表容器');
        return;
    }

    // 创建大纲元素
    const outlineElement = document.createElement('div');
    outlineElement.className = 'chapter-outline';
    
    // 构建大纲HTML内容
    outlineElement.innerHTML = `
        <div class="outline-header">
            <span class="chapter-number">第${outline.chapter}章</span>
            <span class="chapter-title">${outline.title || ''}</span>
            <div class="outline-actions">
                <button class="split-outline-btn" title="拆分章节">
                    <i class="fas fa-cut"></i>
                </button>
                <button class="edit-outline-btn" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="save-outline-btn" style="display:none" title="保存">
                    <i class="fas fa-save"></i>
                </button>
            </div>
        </div>
        <div class="outline-content">
            <div class="outline-characters">
                <span class="label">主要人物：</span>
                <span class="text">${Array.isArray(outline.characters) ? outline.characters.join('、') : outline.characters}</span>
            </div>
            <div class="outline-event">
                <span class="label">核心事件：</span>
                <span class="text">${outline.mainEvent || ''}</span>
            </div>
            <div class="outline-detail">
                <span class="text">${outline.content || ''}</span>
            </div>
        </div>
        <div class="split-preview" style="display:none">
            <div class="split-preview-content"></div>
        </div>
    `;

    // 添加到列表中
    outlinesList.appendChild(outlineElement);
    
    // 纲加拆分和编辑功能
    const splitBtn = outlineElement.querySelector('.split-outline-btn');
    const editBtn = outlineElement.querySelector('.edit-outline-btn');
    const saveBtn = outlineElement.querySelector('.save-outline-btn');
    const splitPreview = outlineElement.querySelector('.split-preview');
    const splitPreviewContent = splitPreview.querySelector('.split-preview-content');

    // 拆分按钮事件
    splitBtn?.addEventListener('click', async () => {
        try {
            splitBtn.disabled = true;
            splitPreview.style.display = 'block';
            splitPreviewContent.innerHTML = '<div class="loading">正在生成子章节...</div>';

            // 获取全局拆分数量设置
            const globalSplitCount = document.getElementById('batchSplitCount');
            const splitCount = globalSplitCount ? parseInt(globalSplitCount.value) : 3;

            await splitOutline(outlineElement, outline, splitCount);

        } catch (error) {
            console.error('拆分大纲时出错:', error);
            splitPreviewContent.innerHTML = '<div class="error">拆分失败，请重试</div>';
        } finally {
            splitBtn.disabled = false;
        }
    });

    // 编辑按钮事件
    editBtn?.addEventListener('click', () => {
        const textElements = outlineElement.querySelectorAll('.text');
        textElements.forEach(el => {
            const editArea = document.createElement('textarea');
            editArea.className = 'edit-field';
            editArea.value = el.textContent;
            el.style.display = 'none';
            editArea.style.display = 'block';
            el.parentNode.insertBefore(editArea, el);
        });
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
    });

    // 保存按钮事件
    saveBtn?.addEventListener('click', () => {
        const textElements = outlineElement.querySelectorAll('.text');
        const editFields = outlineElement.querySelectorAll('.edit-field');
        textElements.forEach((el, index) => {
            el.textContent = editFields[index].value;
            el.style.display = 'inline';
            editFields[index].remove();
        });
        saveBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';

        // 更新outline对象
        const [charactersText, eventText, contentText] = textElements;
        outline.characters = charactersText.textContent.split(/[、，,]/).map(c => c.trim()).filter(Boolean);
        outline.mainEvent = eventText.textContent;
        outline.content = contentText.textContent;
    });

    // 滚动到新添加的大纲
    outlineElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    
    // 添加淡入动画效果
    outlineElement.style.opacity = '0';
    setTimeout(() => {
        outlineElement.style.transition = 'opacity 0.5s ease-in';
        outlineElement.style.opacity = '1';
    }, 10);
}

// 添加阶段计算函数
function calculatePhaseChapters(totalChapters) {
        const phases = [
            { name: '开端', percentage: 20 },
            { name: '发展', percentage: 50 },
            { name: '高潮', percentage: 20 },
            { name: '结局', percentage: 10 }
        ];

    let remainingChapters = totalChapters;
    const result = [];
    
    phases.forEach((phase, index) => {
        let chapters;
        if (index === phases.length - 1) {
            chapters = remainingChapters; // 最后一个阶段使用所有剩余章节
        } else {
            chapters = Math.max(1, Math.floor(totalChapters * phase.percentage / 100));
            remainingChapters -= chapters;
        }
        
        result.push({
            name: phase.name,
            chapters: chapters
        });
    });
    
    return result;
}

// 添加验证和报告函数
function validateAndReportOutlines(outlines, totalChapters) {
    const emptyOutlines = outlines
        .map((outline, index) => outline ? null : index + 1)
        .filter(index => index !== null);
        
    if (emptyOutlines.length > 0) {
        console.warn(`警告：以下章节的大纲生成失败: ${emptyOutlines.join(', ')}`);
    }
    
    const totalGenerated = outlines.filter(outline => outline).length;
    console.log(`大纲生成完成：共生成 ${totalGenerated}/${totalChapters} 章`);
}

// 添加解析和验证函数
function parseAndValidateOutlines(response, startChapter, batchSize) {
    try {
        const outlines = response.split('---章节分隔符---')
            .map(outline => outline.trim())
            .filter(outline => outline)
            .map(outline => parseOutlineContent(outline));

        // 验证章节编号连续性
        const validOutlines = outlines.filter((outline, index) => {
            if (!outline) return false;
            const expectedChapter = startChapter + index;
            return outline.chapter === expectedChapter;
        });

        // 验证每个大纲的连贯性
        return validOutlines.map((outline, index) => {
            const prevOutline = index > 0 ? validOutlines[index - 1] : null;
            return validateOutlineCoherence(outline, prevOutline) ? outline : null;
        }).filter(outline => outline !== null);

    } catch (error) {
        console.error('解析大纲响应时出错:', error);
        return null;
    }
}

// 修改单章大生成函数
async function generateSingleOutline({ title, theme, mainPlot, characterInfo, worldSetting, phase, chapterNum, totalChapters }) {
    const prompt = `请为小说《${title}》生成第${chapterNum}章的大纲。

基本信息：
- 类型：${theme}
- 主要剧情：${mainPlot}
- 主要人物：${characterInfo}
- 世界观：${worldSetting}
- 当前阶段：${phase}，共${totalChapters}章

请按照以下格式输出：
第${chapterNum}章：[章节标题]
主要人物：[出场人物，用顿号分隔]
核心事件：[关键事件]
详细大纲：[具体内容]`;

    try {
        const response = await callAIAPI([
                {
                    role: "system",
                content: "你是小说策划师，请生成章节大纲。"
                },
                {
                    role: "user",
                content: prompt
            }
        ], 0.7, 2000);

        const outline = parseOutlineContent(response);
        if (!outline || !validateOutline(outline)) {
            throw new Error('大纲生成失败');
        }

        return outline;
    } catch (error) {
        console.error(`生成第${chapterNum}章大纲失败:`, error);
        throw error;
    }
}

// 修改解析大纲内容函数
function parseOutlineContent(content) {
    try {
        // 清理和标准化内容
        content = content.trim().replace(/\r\n/g, '\n');
        
        // 初始化大纲对象
        const outline = {
            chapter: 0,
            title: '',
            characters: [],
            mainEvent: '',
            content: '',
            summary: ''
        };
        
        // 使用正则表达式提取各个部分
        const chapterMatch = content.match(/第(\d+)章：(.+?)(?:\n|$)/);
        if (chapterMatch) {
            outline.chapter = parseInt(chapterMatch[1]);
            outline.title = chapterMatch[2].trim();
        }
        
        const characterMatch = content.match(/主要人物：(.+?)(?:\n|$)/);
        if (characterMatch) {
            outline.characters = characterMatch[1]
                .split(/[、，,]/)
                .map(char => char.trim())
                .filter(char => char.length > 0);
        }
        
        const eventMatch = content.match(/核心事件：(.+?)(?:\n|$)/);
        if (eventMatch) {
            outline.mainEvent = eventMatch[1].trim();
        }
        
        const contentMatch = content.match(/详细大纲：([\s\S]+)$/);
        if (contentMatch) {
            outline.content = contentMatch[1].trim();
        }
        
        // 验证所有必要字段是否存在并有值
        const requiredFields = ['chapter', 'title', 'characters', 'mainEvent', 'content'];
        const missingFields = requiredFields.filter(field => {
            if (field === 'characters') {
                return !outline[field] || outline[field].length === 0;
            }
            return !outline[field] || outline[field].toString().trim() === '';
        });

        if (missingFields.length > 0) {
            console.error('解析后缺少必要字段:', missingFields);
            console.error('原始内容:', content);
            console.error('解析结果:', outline);
            return null;
        }

        // 生成摘要
        outline.summary = `第${outline.chapter}章：${outline.title} - ${outline.mainEvent}`;
        
        return outline;
    } catch (error) {
        console.error('解析大纲内容时出错:', error);
        console.error('原始内容:', content);
        return null;
    }
}

// 修改大纲验证函数
function validateOutline(outline) {
    // 只检查必要字段是否存在且不为空
    return outline 
        && outline.chapter > 0 
        && outline.title.trim() 
        && Array.isArray(outline.characters) 
        && outline.characters.length > 0 
        && outline.mainEvent.trim() 
        && outline.content.trim();
}

// 添加情节连贯性检查函数
function checkEventCoherence(prevEvent, currentEvent) {
    // 检查是否包含关键连接词
    const connectionWords = ['因此', '于是', '随后', '接着', '之后', '由于'];
    const hasConnection = connectionWords.some(word => 
        currentEvent.includes(word));

    // 检查是否有共同的主题词或关键词
    const prevKeywords = extractKeywords(prevEvent);
    const currentKeywords = extractKeywords(currentEvent);
    const hasCommonKeywords = prevKeywords.some(keyword => 
        currentKeywords.includes(keyword));

    return hasConnection || hasCommonKeywords;
}

// 加关键词提取函数
function extractKeywords(text) {
    // 简单的关键词提取实现
    return text.split(/[，。；：！？、]/)
        .map(segment => segment.trim())
        .filter(segment => segment.length >= 2);
}

// 添加阶段特征描述函数
function getPhaseCharacteristics(phase) {
    const characteristics = {
        '开端': `
- 引入主要人物和背景
- 设置基本冲突
- 埋下重要伏笔
- 建立故事基调`,
        '发展': `
- 深化人物关系
- 展开次要情节
- 推进主要冲突
- 强化故事张力`,
        '高潮': `
- 激化核心冲突
- 重要转折点
- 关键抉择时刻
- 情节最强烈处`,
        '结局': `
- 解决主要冲突
- 回应重要伏笔
- 人物情感升华
- 主题深层展现`
    };
    
    return characteristics[phase] || '';
}

// 生��单章大纲
async function generateSingleOutline({ title, theme, mainPlot, characterInfo, worldSetting, phase, chapterNum, totalChapters }) {
    const prompt = `请为小说《${title}》生成第${chapterNum}章的大纲。

基本信息：
- 类型：${theme}
- 主要剧情：${mainPlot}
- 主要人物：${characterInfo}
- 世界观：${worldSetting}
- 当前阶段：${phase}，共${totalChapters}章

请按照以下格式输出：
第${chapterNum}章：[章节标题]
主要人物：[出场人物，用顿号分隔]
核心事件：[关键事件]
详细大纲：[具体内容]`;

    try {
        const response = await callAIAPI([
            {
                role: "system",
                content: "你是小说策划师，请生成章节大纲。"
            },
            {
                role: "user",
                content: prompt
            }
        ], 0.7, 2000);

        const outline = parseOutlineContent(response);
        if (!outline || !validateOutline(outline)) {
            throw new Error('大纲生成失败');
        }

        return outline;
    } catch (error) {
        console.error(`生成第${chapterNum}章大纲失败:`, error);
        throw error;
    }
}

// 验证大纲内容
function validateOutline(outline) {
    // 只检查必要字段是否存在且不为空
    return outline 
        && outline.chapter > 0 
        && outline.title.trim() 
        && Array.isArray(outline.characters) 
        && outline.characters.length > 0 
        && outline.mainEvent.trim() 
        && outline.content.trim();
}

// 辅助函数
function initializeStorylineTracker(storyStructure) {
    try {
        // 解析AI返回的故事结构
        const structureLines = storyStructure.split('\n');
        let currentSection = '';
        
        structureLines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // 识主要部分
            if (line.includes('情节线索')) {
                currentSection = 'plotlines';
            } else if (line.includes('转折点')) {
                currentSection = 'turningPoints';
            
            } else if (line.includes('人物成长')) {
                currentSection = 'characterArcs';
            } else if (line.includes('核心冲突')) {
                currentSection = 'conflicts';
            } else if (line.includes('主题元素')) {
                currentSection = 'themes';
            } else if (line.includes('伏笔')) {
                currentSection = 'foreshadowing';
            } else {
                // 根据当前部分处理内容
                processStructureLine(currentSection, line);
            }
        });
    } catch (error) {
        console.error('解析故事结构时出错:', error);
        throw error;
    }
}

// 处理故事结构的一行
function processStructureLine(section, line) {
    switch (section) {
        case 'plotlines':
            processPlotline(line);
            break;
        case 'turningPoints':
            processTurningPoint(line);
            break;
        case 'characterArcs':
            processCharacterArc(line);
            break;
        case 'conflicts':
            processConflict(line);
            break;
        case 'themes':
            processTheme(line);
            break;
        case 'foreshadowing':
            processForeshadowing(line);
            break;
    }
}

// 处理情节线索
function processPlotline(line) {
    const plotMatch = line.match(/^[•-]\s*(.+?)(?:：|:)?\s*(.+)$/);
    if (plotMatch) {
        const [_, plotName, description] = plotMatch;
        storylineTracker.subPlots.set(plotName.trim(), [{
            chapter: 0, // 初始章节
            content: description.trim(),
            status: 'active'
        }]);
    }
}

// 处理转折点
function processTurningPoint(line) {
    const turnMatch = line.match(/^[•-]\s*(?:第(\d+)章[左右]?[：:])?\s*(.+)$/);
    if (turnMatch) {
        const [_, chapter, event] = turnMatch;
        storylineTracker.addPlotPoint({
            chapter: chapter ? parseInt(chapter) : null,
            event: event.trim(),
            impact: 'major',
            characters: [] // 相关人物将在后续分析中添加
        });
    }
}

// 处理人物成长
function processCharacterArc(line) {
    const arcMatch = line.match(/^[•-]\s*(.+?)(?:：|:)?\s*(.+)$/);
    if (arcMatch) {
        const [_, character, development] = arcMatch;
        storylineTracker.updateCharacterArc(character.trim(), {
            chapter: 0,
            development: development.trim(),
            type: 'initial'
        });
    }
}

// 处理冲突
function processConflict(line) {
    const conflictMatch = line.match(/^[-]\s*(.+)$/);
    if (conflictMatch) {
        storylineTracker.conflicts.push({
            description: conflictMatch[1].trim(),
            startChapter: 0,
            status: 'active',
            involvedCharacters: []
        });
    }
}

// 处理主题
function processTheme(line) {
    const themeMatch = line.match(/^[•-]\s*(.+)$/);
    if (themeMatch) {
        storylineTracker.themes.add(themeMatch[1].trim());
    }
}

// 处理伏笔
function processForeshadowing(line) {
    // 修复正则表达式，确保所有括号都正确配对
    const foreshadowMatch = line.match(/^[•-]\s*(.+?)(?:（|\().*?(?:第(\d+)章)?(?:）|\))?/);
    if (foreshadowMatch) {
        storylineTracker.addForeshadowing({
            chapter: 0,
            content: foreshadowMatch[1].trim(),
            payoffChapter: foreshadowMatch[2] ? parseInt(foreshadowMatch[2]) : null,
            status: 'pending'
        });
    }
}

// 解析和存储大纲
function parseAndStoreOutlines(phaseOutlines, startChapter, count, outlines) {
    try {
        const outlineRegex = /第(\d+)章[：:]([\s\S]+?)(?=第\d+章|$)/g;
        let match;
        
        while ((match = outlineRegex.exec(phaseOutlines)) !== null) {
            const chapterNum = parseInt(match[1]);
            const outlineContent = match[2].trim();
            
            if (chapterNum >= startChapter && chapterNum < startChapter + count) {
                outlines[chapterNum - 1] = outlineContent;
                
                // 分析大纲容，更新故事线追踪器
                analyzeOutlineContent(chapterNum, outlineContent);
            }
        }
    } catch (error) {
        console.error('解析大纲时出错:', error);
        throw error;
    }
}

// 分析大纲内容
function analyzeOutlineContent(chapterNum, content) {
    // 提取关键情节
    extractPlotPoints(chapterNum, content);
    
    // 识别人物展
    identifyCharacterDevelopments(chapterNum, content);
    
    // 检测伏笔和呼应
    detectForeshadowingAndPayoffs(chapterNum, content);
    
    // 更新冲突状态
    updateConflictStatus(chapterNum, content);
}

// 提取键情节点
function extractPlotPoints(chapterNum, content) {
    // 使用关键词和句式模式识别重要情节
    const plotPatterns = [
        /([^，。]+)发生了([^，。]+)/g,
        /([^，。]+)决定([^，。]+)/g,
        /([^，。]+)发现([^，。]+)/g
    ];

    plotPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            storylineTracker.addPlotPoint({
                chapter: chapterNum,
                event: match[0],
                impact: 'normal',
                characters: extractCharactersFromText(match[0])
            });
        }
    });
}

// 识别人物发展
function identifyCharacterDevelopments(chapterNum, content) {
    // 从内容中提取人物名字
    const characters = Array.from(storylineTracker.characterArcs.keys());
    
    characters.forEach(character => {
        if (content.includes(character)) {
            // 分析该人物在本章的发展
            const development = analyzeCharacterInChapter(character, content);
            if (development) {
                storylineTracker.updateCharacterArc(character, {
                    chapter: chapterNum,
                    development: development,
                    type: 'development'
                });
            }
        }
    });
}

// 检测伏笔和呼应
function detectForeshadowingAndPayoffs(chapterNum, content) {
    // 检查是否有新的伏笔
    const potentialSetups = findPotentialSetups(content);
    potentialSetups.forEach(setup => {
        storylineTracker.addForeshadowing({
            chapter: chapterNum,
            content: setup,
            payoffChapter: null,
            status: 'pending'
        });
    });

    // 检查是否有伏笔呼应
    storylineTracker.foreshadowing
        .filter(f => f.status === 'pending')
        .forEach(foreshadowing => {
            if (isPayoff(content, foreshadowing.content)) {
                foreshadowing.payoffChapter = chapterNum;
                foreshadowing.status = 'resolved';
            }
        });
}

// 更新冲突状态
function updateConflictStatus(chapterNum, content) {
    storylineTracker.conflicts.forEach(conflict => {
        if (conflict.status === 'active') {
            // 检查冲突是否在本得到解决
            if (isConflictResolved(content, conflict.description)) {
                conflict.resolutionChapter = chapterNum;
                conflict.status = 'resolved';
            }
            // 检查冲突是否有新的发展
            else {
                const development = findConflictDevelopment(content, conflict.description);
                if (development) {
                    conflict.developments = conflict.developments || [];
                    conflict.developments.push({
                        chapter: chapterNum,
                        content: development
                    });
                }
            }
        }
    });
}

// 更新故事线追踪器
function updateStorylineTracker(currentOutlines) {
    // 分析每个已生成大纲的连贯性
    for (let i = 0; i < currentOutlines.length; i++) {
        if (currentOutlines[i]) {
            analyzeOutlineContent(i + 1, currentOutlines[i]);
        }
    }

    // 检查故事线的完整性
    checkStorylineCompleteness();
    
    // 验证人物弧线的合理性
    validateCharacterArcs();
    
    // 确保主题的一致性
    ensureThematicConsistency();
}

// 辅助函数
function extractCharactersFromText(text) {
    // 从文本中提取人物名字的逻辑
    return Array.from(storylineTracker.characterArcs.keys())
        .filter(character => text.includes(character));
}

function analyzeCharacterInChapter(character, content) {
    // 分析人物在章节中的发变化
    const developmentPatterns = [
        new RegExp(`${character}([^，。]+)感情([^，。]+)`),
        new RegExp(`${character}([^，。]+)决定([^，。]+)`),
        new RegExp(`${character}([^，。]+)发现([^，。]+)`)
    ];

    for (const pattern of developmentPatterns) {
        const match = content.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}

function findPotentialSetups(content) {
    // 识别潜在的伏笔
    const setupPatterns = [
        /不经意[^，。]*([^，。]+)/g,
        /似乎[^，。]*([^，。]+)/g,
        /隐约[^，。]*([^，。]+)/g
    ];

    const setups = [];
    setupPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            setups.push(match[1]);
        }
    });
    return setups;
}

function isPayoff(content, setup) {
    // 检查是否是某个伏笔的呼应
    // 这里可以使用更复杂的义分析
    return content.includes(setup) || 
           content.includes(setup.replace(/不经意|似乎|隐约/g, ''));
}

function isConflictResolved(content, conflict) {
    // 检查冲突是否解决
    const resolutionPatterns = [
        /最终/,
        /解决了/,
        /化解了/,
        /完结了/
    ];

    return resolutionPatterns.some(pattern => 
        pattern.test(content) && content.includes(conflict));
}

function findConflictDevelopment(content, conflict) {
    // 寻找冲突的新发展
    const developmentPatterns = [
        /激化/,
        /升级/,
        /加剧/,
        /恶化/
    ];

    for (const pattern of developmentPatterns) {
        if (pattern.test(content) && content.includes(conflict)) {
            // 提取相关段落
            const sentences = content.split(/[。！？]/);
            return sentences.find(s => s.includes(conflict));
        }
    }
    return null;
}

function checkStorylineCompleteness() {
    // 检查所有故事线是否
    storylineTracker.subPlots.forEach((developments, plotName) => {
        if (developments[developments.length - 1].status === 'active') {
            console.warn(`Warning: Subplot "${plotName}" may be incomplete`);
        }
    });
}

function validateCharacterArcs() {
    // 验证人物弧线的合理性
    storylineTracker.characterArcs.forEach((developments, character) => {
        if (developments.length < 2) {
            console.warn(`Warning: Character "${character}" may lack development`);
        }
    });
}

function ensureThematicConsistency() {
    // 确保主题的一致性
    const themes = Array.from(storylineTracker.themes);
    if (themes.length === 0) {
        console.warn('Warning: No clear themes detected');
    }
}

// 格式化故事进展
function formatStoryProgress(currentChapter) {
    const progress = storylineTracker.mainPlotPoints
        .filter(point => point.chapter < currentChapter)
        .map(point => {
            const characters = point.relatedCharacters.join('、');
            return `第${point.chapter}章：${point.event}${characters ? `（涉及角色：${characters}）` : ''}`;
        })
        .join('\n');
    
    return progress || '故事尚未开始';
}

// 格式化活跃子情节
function formatActiveSubplots(subplots) {
    let result = '';
    subplots.forEach((developments, plotName) => {
        result += `${plotName}：\n`;
        developments.forEach(dev => {
            result += `- 第${dev.chapter}章：${dev.content}\n`;
            if (dev.status === 'active') {
                result += `  当前状态：进行中\n`;
            }
        });
    });
    return result || '暂无活跃的子情节';
}

// 格式化待处理的伏笔
function formatPendingForeshadowing(foreshadowing) {
    return foreshadowing.map(f => 
        `- 第${f.setupChapter}章埋下的伏笔：${f.content}${f.payoffChapter ? `（预计在第${f.payoffChapter}章回应）` : ''}`
    ).join('\n') || '暂无待处理的伏笔';
}

// 格式化人物发展轨迹
function formatCharacterArcs(characterArcs) {
    let result = '';
    characterArcs.forEach((developments, character) => {
        result += `${character}的发展轨迹：\n`;
        developments.forEach(dev => {
            result += `- 第${dev.chapter}章：${dev.development}\n`;
            if (dev.type === 'initial') {
                result += `  初始设定：${dev.development}\n`;
            } else {
                result += `  发展变化：${dev.development}\n`;
            }
        });
    });
    return result || '暂无人物发展记录';
}

// 格式化未解决的冲突
function formatUnresolvedConflicts(conflicts) {
    return conflicts.map(c => {
        let result = `- ${c.description}始于第${c.startChapter}章）\n`;
        if (c.developments && c.developments.length > 0) {
            result += '  发展历程：\n';
            c.developments.forEach(d => {
                result += `  发展 第${d.chapter}章${d.content}\n`;
            });
        }
        return result;
    }).join('\n') || '暂无未解决的冲突';
}

// 验证故事连贯性
function validateStoryCoherence(currentChapter, content) {
    const issues = [];
    
    // 检查人物一致性
    const characterIssues = checkCharacterConsistency(currentChapter, content);
    issues.push(...characterIssues);
    
    // 检查情节连贯性
    const plotIssues = checkPlotContinuity(currentChapter, content);
    issues.push(...plotIssues);
    
    // 检查时间线一性
    const timelineIssues = checkTimelineContinuity(currentChapter, content);
    issues.push(...timelineIssues);
    
    // 检查世界观一致性
    const worldBuildingIssues = checkWorldBuildingConsistency(currentChapter, content);
    issues.push(...worldBuildingIssues);
    
    return issues;
}

// 检查人物一致性
function checkCharacterConsistency(currentChapter, content) {
    const issues = [];
    const characters = Array.from(storylineTracker.characterArcs.keys());
    
    characters.forEach(character => {
        if (content.includes(character)) {
            const previousDevelopments = storylineTracker.characterArcs.get(character)
                .filter(d => d.chapter < currentChapter);
            
            // 检性格表现是否一致
            const personalityIssues = checkPersonalityConsistency(character, content, previousDevelopments);
            issues.push(...personalityIssues);
            
            // 检查能力范围是否合理
            const abilityIssues = checkAbilityConsistency(character, content, previousDevelopments);
            issues.push(...abilityIssues);
            
            // 检查关系网络是否连贯
            const relationshipIssues = checkRelationshipConsistency(character, content, previousDevelopments);
            issues.push(...relationshipIssues);
        }
    });
    
    return issues;
}

// 检查情节连贯性
function checkPlotContinuity(currentChapter, content) {
    const issues = [];
    
    // 检查主线情节的连贯性
    const mainPlotPoints = storylineTracker.mainPlotPoints
        .filter(p => p.chapter < currentChapter);
    
    if (mainPlotPoints.length > 0) {
        const lastPlotPoint = mainPlotPoints[mainPlotPoints.length - 1];
        if (!content.includes(lastPlotPoint.event)) {
            issues.push(`警告：当前章节可能缺少与上一个主要情节点的衔接（${lastPlotPoint.event}）`);
        }
    }
    
    // 检查子情节的发展
    storylineTracker.subPlots.forEach((developments, plotName) => {
        const activeDevelopments = developments.filter(d => 
            d.chapter < currentChapter && d.status === 'active');
        
        if (activeDevelopments.length > 0) {
            const lastDevelopment = activeDevelopments[activeDevelopments.length - 1];
            if (!content.includes(plotName)) {
                issues.push(`警告：活跃的子情节"${plotName}"在本章节中可能被遗漏`);
            }
        }
    });
    
    return issues;
}

// 检查时间线一致性
function checkTimelineContinuity(currentChapter, content) {
    const issues = [];
    const timeMarkers = extractTimeMarkers(content);
    const previousEvents = storylineTracker.mainPlotPoints
        .filter(p => p.chapter < currentChapter)
        .map(p => ({ chapter: p.chapter, time: extractTimeMarkers(p.event) }));
    
    if (timeMarkers.length > 0 && previousEvents.length > 0) {
        const lastEvent = previousEvents[previousEvents.length - 1];
        if (!isTimeSequenceValid(lastEvent.time, timeMarkers)) {
            issues.push('警告：检测到可能存在时间线矛盾');
        }
    }
    
    return issues;
}

// 检世界观一致性
function checkWorldBuildingConsistency(currentChapter, content) {
    const issues = [];
    
    // 提取世界观相关的关键词和规则
    const worldRules = extractWorldRules(content);
    const previousRules = new Set();
    
    // 收集之前章节的世界观规则
    storylineTracker.mainPlotPoints
        .filter(p => p.chapter < currentChapter)
        .forEach(p => {
            const rules = extractWorldRules(p.event);
            rules.forEach(r => previousRules.add(r));
        });
    
    // 检查新内容是否违反已建的则
    worldRules.forEach(rule => {
        if (previousRules.has(rule) && !isRuleConsistent(rule, Array.from(previousRules))) {
            issues.push(`警：可能违反已建立的世界观规则：${rule}`);
        }
    });
    
    return issues;
}

// 辅助函数
function extractTimeMarkers(text) {
    const timePatterns = [
        /([一二三四五六七八九十百千万]+[年月日])/g,
        /([早中晚]间)/g,
        /(黎明|黄昏|夜晚)/g,
        /(\d+[年月日])/g
    ];
    
    const markers = [];
    timePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            markers.push(match[1]);
        }
    });
    return markers;
}

function isTimeSequenceValid(previousTime, currentTime) {
    // 这里需要实现更复杂的时间顺序验证逻辑
    return true; // 临时返回
}

function extractWorldRules(text) {
    // 提取世界观规则的逻辑
    // 这里需要根据体的世观设定来实现
    return []; // 临时返值
}

function isRuleConsistent(rule, previousRules) {
    // 验证规则一致性的逻辑
    // 这里需要根据具体的世界观规则来实现
    return true; // 临时返回值
}

// 更生成章节的函数，加入连性检查
async function generateChaptersInBatches() {
    // 创进度条
    const progressContainer = createProgressBar();
    progressContainer.style.display = 'block';
    
    // 获取章节列表容器
    let chapterList = document.getElementById('chapterList');
    if (!chapterList) {
        chapterList = document.createElement('div');
        chapterList.id = 'chapterList';
        const outputSection = document.querySelector('.output-section');
        if (!outputSection) {
            throw new Error('找不到输出区域容器');
        }
        outputSection.appendChild(chapterList);
    }
    
    // 清空现有内容
    chapterList.innerHTML = '';
    
    try {
        // 获取所有小节内容
        const outlinesList = document.getElementById('chapterOutlinesList');
        const subOutlines = Array.from(outlinesList.querySelectorAll('.sub-outline')).map(sub => ({
            title: sub.querySelector('h4').textContent.trim(),
            characters: sub.querySelector('.info-item:nth-child(1) .value').textContent.trim(),
            mainEvent: sub.querySelector('.info-item:nth-child(2) .value').textContent.trim(),
            content: sub.querySelector('.sub-outline-text').textContent.trim()
        }));

        // 更新总进度显示
        const totalSections = subOutlines.length;
        
        // 逐个处理每个小
        for (let i = 0; i < subOutlines.length; i++) {
            const subOutline = subOutlines[i];
            updateProgress(i + 1, totalSections, `正在生成第 ${i + 1} 个小节，共 ${totalSections} 个小节`);

            // 生成这个小节的小说内容
            const novelContent = await generateSubSectionContent(subOutline, i + 1, totalSections);
            
            // 创建显示元素
            const sectionElement = document.createElement('div');
            sectionElement.className = 'section-content';
            sectionElement.innerHTML = `
                <div class="section-header">
                    <h4>${subOutline.title}</h4>
                </div>
                <div class="section-text">${novelContent}</div>
            `;
            
            // 添加到显示列表
            chapterList.appendChild(sectionElement);
            
            // 滚动到新添加的内容
            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            // 等一小段时间，避免API调用过于频繁
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.error('生成小说内容时出错:', error);
        throw error;
    } finally {
        // 隐藏进度条
        progressContainer.style.display = 'none';
    }
}

// 生成单个小节的小说内容
async function generateSubSectionContent(subOutline, currentSection, totalSections) {
    if (!window.novelGenerator) {
        throw new Error('NovelGenerator 未初始化');
    }
    
    try {
        // 直接使用 novelGenerator 的方法生成内容
        const content = await window.novelGenerator.generateSection(currentSection - 1);
        return content;
    } catch (error) {
        console.error(`生成第${currentSection}节内容时出错:`, error);
        throw error;
    }
}

// 添加新函数：根据子章节生成完整章节
async function generateChapterWithSubsections(chapterNum, totalChapters, subOutlines) {
    try {
        // 获取章节类型
        const chapterType = determineChapterType(chapterNum, totalChapters);
        
        // 构建子章节内容提示
        const subsectionsPrompt = subOutlines.map(sub => 
            `子章节：${sub.title}\n` +
            `主要人物：${sub.characters}\n` +
            `核心事件：${sub.mainEvent}\n` +
            `内容概要：${sub.content.substring(0, 200)}...`
        ).join('\n\n');
        
        // 生成章节内容
        const prompt = `请根据以下子章节信息，创作一个完整、连贯的小说章节。

基本信息：
标题：${document.getElementById('novelTitle').value}
类型：${document.getElementById('novelTheme').value}
写作风格：${document.getElementById('writingStyle').value}
章节类型：${chapterType}
主要剧情：${document.getElementById('mainPlot').value}
主人物：${document.getElementById('characterInfo').value}
世界观设定：${document.getElementById('worldSetting').value}
章节字数：${document.getElementById('chapterLength').value}
创意程度：${document.getElementById('creativity').value}
当前进度：第${chapterNum}章（共${totalChapters}章）

子章节信息：
${subsectionsPrompt}

写作要求：
1. 所有子章节自然地整合为一个完整的章节
2. 保持情节的连贯性和流畅性
3. 加强子章节之间的过渡和联系
4. 统一写作风格和语言表达
5. 突出重要情节和关键场景
6. 深化人物刻画和情感表现
7. 意细节描写和环境氛围
8. 为下一章做好铺垫

请直接输出完整的章节内容，不需要其他说明。`;

        const content = await callAIAPI([
            {
                role: "system",
                content: "你是一个专业的小说写作助手，擅长将多个子章节整合成一个连贯、完整的章节。请确保内容的流畅性、人物塑造的一致性，以及剧情发展的合理性。"
            },
            {
                role: "user",
                content: prompt
            }
        ], 0.7, 4000);
        
        // 验证连贯性
        const issues = validateStoryCoherence(chapterNum, content);
        
        // 如果存在问题，尝试修复
        if (issues.length > 0) {
            return await fixCoherenceIssues(content, issues, chapterNum);
        }
        
        return { content, issues: [] };
    } catch (error) {
        console.error(`生成第${chapterNum}章时出错:`, error);
        throw error;
    }
}

// 确定章节类
function determineChapterType(chapterNum, totalChapters) {
    if (chapterNum === 1) return '开篇';
    if (chapterNum === totalChapters) return '结局';
    
    const highPoint = Math.ceil(totalChapters * 0.7);
    if (chapterNum === highPoint) return '高潮';
    
    const percentage = chapterNum / totalChapters;
    if (percentage <= 0.2) return '铺垫';
    if (percentage <= 0.4) return '发展';
    if (percentage <= 0.6) return '冲突';
    if (percentage <= 0.8) return '转折';
    return '收束';
}

// 修复连贯性问题
async function fixCoherenceIssues(content, issues, chapterNum) {
    // 生成修复提示
    const fixPrompt = generateFixPrompt(content, issues);
    
    // 尝试修复内容
    const fixedContent = await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的小说编辑，擅长修复小说中的连贯性问题。"
        },
        {
            role: "user",
            content: fixPrompt
        }
    ], 0.7, 4000);
    
    // 再验证修复后的内容
    const remainingIssues = validateStoryCoherence(chapterNum, fixedContent);
    
    // 如果仍有问题且尚未达到最大重试次数，递归尝试修复
    if (remainingIssues.length > 0) {
        console.warn(`第${chapterNum}章修复后仍存在问题:`, remainingIssues);
    }
    
    return { content: fixedContent, issues: remainingIssues };
}

    // 生复提示
function generateFixPrompt(content, issues) {
    return `
请修复以下小说内容中的连贯性问题：

原始内容：
${content}

存在问题：
${issues.map(issue => `- ${issue}`).join('\n')}

修复要求：
1. 保持原有内容的核心情节不变
2. 修正所有到的连贯性问题
3. 确保修复后的内容自然流畅
4. 维持人物性格和行为的一致性
5. 保持世界观设定的统一
6. 确保时间线的合理性

请直接输出修复后的内容，不需要其他额外说明。`;
}

// 检查人物性格一致性
function checkPersonalityConsistency(character, content, previousDevelopments) {
    const issues = [];
    
    // 提取人物性格特征
    const personalityTraits = extractPersonalityTraits(previousDevelopments);
    
    // 分析当前内容中的性格表现
    const currentTraits = analyzeCurrentPersonality(character, content);
    
    // 检查是否存在矛盾
    personalityTraits.forEach(trait => {
        if (hasPersonalityConflict(trait, currentTraits)) {
            issues.push(`警告：${character}的性格现可能不一致（${trait.description}）`);
        }
    });
    
    return issues;
}

// 检查能力范围理性
function checkAbilityConsistency(character, content, previousDevelopments) {
    const issues = [];
    
    // 提取确立的能力范
    const establishedAbilities = extractEstablishedAbilities(previousDevelopments);
    
    // 分析当前内容中的能力展现
    const currentAbilities = analyzeCurrentAbilities(character, content);
    
    // 检查是否超出范围
    currentAbilities.forEach(ability => {
        if (isAbilityOutOfRange(ability, establishedAbilities)) {
            issues.push(`警告：${character}的能力表现可能超出已建立的范围（${ability.description}）`);
        }
    });
    
    return issues;
}

    // 检查系网络连贯性
function checkRelationshipConsistency(character, content, previousDevelopments) {
    const issues = [];
    
    // 提取已建立的关系网络
    const establishedRelationships = extractEstablishedRelationships(previousDevelopments);
    
        // 分析当前内容中人物关系
    const currentRelationships = analyzeCurrentRelationships(character, content);
    
    // 检查关系变化是否合理
    currentRelationships.forEach(relationship => {
        if (isRelationshipChangeUnreasonable(relationship, establishedRelationships)) {
                issues.push(`警告${character}与${relationship.target}的关系变化可能缺乏合理铺垫`);
        }
    });
    
    return issues;
}

// 提取人物性格特征
function extractPersonalityTraits(developments) {
    const traits = new Set();
    developments.forEach(dev => {
        // 使用正则表达式提取性格相关的描述
        const personalityMatches = dev.development.match(/性格[^，。]+|[性情]格特点[^，。]+/g);
        if (personalityMatches) {
            personalityMatches.forEach(match => traits.add({
                description: match,
                chapter: dev.chapter
            }));
        }
    });
    return Array.from(traits);
}

// 分析当前性格表现
function analyzeCurrentPersonality(character, content) {
    const traits = [];
        // 提取行为和对中反的性格特征
    const behaviorPatterns = [
        new RegExp(`${character}[^，。]*([愤怒|高兴|悲伤|害怕|犹豫|果断])[^，。]*`),
            new RegExp(`${character}[^，。]*([|脾气])[^，。]*`)
    ];
    
    behaviorPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            traits.push({
                description: match[0],
                type: 'behavior'
            });
        }
    });
    
    return traits;
}

// 检查性格矛盾
function hasPersonalityConflict(establishedTrait, currentTraits) {
    // 定义性格特征的对立关系
    const conflictingTraits = {
        '果断': ['犹豫', '懦弱', '优柔寡断'],
        '谨慎': ['鲁莽', '冲', '冷酷'],   
        '开朗': ['阴郁', '消', '抑郁'],
        '善': ['��恶', '残暴', '冷酷']
    };
    
    // 检查是否存在对立性格表现
    return currentTraits.some(trait => {
        const opposites = conflictingTraits[establishedTrait.description];
        return opposites && opposites.some(opposite => 
            trait.description.includes(opposite));
    });
}

// 提取已确立的能力范围
function extractEstablishedAbilities(developments) {
    const abilities = new Set();
    developments.forEach(dev => {
        //  
        const abilityMatches = dev.development.match(/能力[^，。]+|技能[^，。]+|会[^，。]+/g);
        if (abilityMatches) {
            abilityMatches.forEach(match => abilities.add({
                description: match,
                chapter: dev.chapter
            }));
        }
    });
    return Array.from(abilities);
}

// 分析当前能力展现
function analyzeCurrentAbilities(character, content) {
    const abilities = [];
    // 提取行为中展现的能力
    const abilityPatterns = [
        new RegExp(`${character}[^，。]*([使用|施展|运用])[^，。]*`),
        new RegExp(`${character}[^，。]*([能够|可以])[^，。]*`)
    ];
    
    abilityPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            abilities.push({
                description: match[0],
                type: 'action'
            });
        }
    });
    
    return abilities;
}

    // 检查能力是超出围
function isAbilityOutOfRange(currentAbility, establishedAbilities) {
    // 检查当前能力是否与建立的能力相矛或超出范围
    return !establishedAbilities.some(ability => 
        currentAbility.description.includes(ability.description) ||
        ability.description.includes(currentAbility.description));
}

    // 提取已建立的关系网
function extractEstablishedRelationships(developments) {
    const relationships = new Map();
    developments.forEach(dev => {
        // 提取关系相关的描述
            const relationshipMatches = dev.development.match(/与[^，。]+的关系|对[^，。]+的[度|感]/g);
        if (relationshipMatches) {
            relationshipMatches.forEach(match => {
                const target = match.match(/与(.+?)的|对(.+?)的/)[1];
                if (!relationships.has(target)) {
                    relationships.set(target, []);
                }
                relationships.get(target).push({
                    description: match,
                    chapter: dev.chapter
                });
            });
        }
    });
    return relationships;
}

// 分析当前关系表现
function analyzeCurrentRelationships(character, content) {
    const relationships = [];
        // 提动中展现关
    const relationshipPatterns = [
        new RegExp(`${character}[^，。]*对(.+?)[^，。]*([态度|感情])[^，。]*`),
        new RegExp(`${character}[^，。]*和(.+?)[^，。]*([一起|互相])[^，。]*`)
    ];
    
    relationshipPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            relationships.push({
                target: match[1],
                description: match[0],
                type: 'interaction'
            });
        }
    });
    
    return relationships;
}

// 检查关系变化是否合理
function isRelationshipChangeUnreasonable(currentRelationship, establishedRelationships) {
    const previousRelations = establishedRelationships.get(currentRelationship.target);
    if (!previousRelations) return true; // 之前没有互动过的角色
    
        // 检查关变化是否过于突兀
    const lastRelation = previousRelations[previousRelations.length - 1];
    return isRelationshipChangeTooAbrupt(lastRelation, currentRelationship);
}

    // 检查关系变化是否过于突
function isRelationshipChangeTooAbrupt(previous, current) {
    // 定义关系变化的程度
    const relationshipLevels = {
        '敌对': -2,
        '对立': -1,
        '陌生': 0,
        '友好': 1,
        '亲密': 2
    };
    
    // 分析关系变化程度
    const previousLevel = getRelationshipLevel(previous.description);
    const currentLevel = getRelationshipLevel(current.description);
    
        // 如果关变化超过一个等级，且没有足够的铺垫，则认为是突兀的
    return Math.abs(relationshipLevels[currentLevel] - relationshipLevels[previousLevel]) > 1;
}

// 获取关系等级
function getRelationshipLevel(description) {
    if (description.includes('敌对') || description.includes('仇恨')) return '敌对';
    if (description.includes('对立') || description.includes('不满')) return '对立';
    if (description.includes('生') || description.includes('普通')) return '陌生';
    if (description.includes('友好') || description.includes('和睦')) return '友好';
    if (description.includes('亲密') || description.includes('信任')) return '亲密';
    return '陌生'; // 默认关系
}

// 初始化面
document.addEventListener('DOMContentLoaded', () => {
    // 获取所有按钮元素
    const generateBtn = document.getElementById('generateBtn');
    const saveBtn = document.getElementById('saveBtn');
    const generateOutlinesBtn = document.getElementById('generateOutlinesBtn');
    const generatePlotBtn = document.getElementById('generatePlotBtn');
    const optimizePlotBtn = document.getElementById('optimizePlotBtn');
    const generateCharactersBtn = document.getElementById('generateCharactersBtn');
    const optimizeCharactersBtn = document.getElementById('optimizeCharactersBtn');
    const generateWorldBtn = document.getElementById('generateWorldBtn');
    const optimizeWorldBtn = document.getElementById('optimizeWorldBtn');

    // 获取输入元素
    const novelTitle = document.getElementById('novelTitle');
    const novelTheme = document.getElementById('novelTheme');
    const writingStyle = document.getElementById('writingStyle');
    const totalChapters = document.getElementById('totalChapters');
    const mainPlot = document.getElementById('mainPlot');
    const characterInfo = document.getElementById('characterInfo');
    const worldSetting = document.getElementById('worldSetting');
    const chapterLength = document.getElementById('chapterLength');
    const creativity = document.getElementById('creativity');

    // 初始状态设置
    const buttons = [
        generateBtn, saveBtn, generateOutlinesBtn,
        generatePlotBtn, optimizePlotBtn,
        generateCharactersBtn, optimizeCharactersBtn,
        generateWorldBtn, optimizeWorldBtn
    ];
    
    // 禁用所有按钮，直到API验证成功
    buttons.forEach(btn => {
        if (btn) btn.disabled = true;
    });

    // 生成剧情按钮事件
    generatePlotBtn?.addEventListener('click', async () => {
        if (!validateInputs(['novelTitle', 'novelTheme'])) return;
        
        try {
            generatePlotBtn.disabled = true;
            generatePlotBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
            
            const plot = await generatePlot(novelTitle.value, novelTheme.value);
            mainPlot.value = plot;
            
            // 启用优化按钮
            optimizePlotBtn.disabled = false;
        } catch (error) {
            console.error('生成剧情失败:', error);
            alert('生成剧情失败，请重试');
        } finally {
            generatePlotBtn.disabled = false;
            generatePlotBtn.innerHTML = '<i class="fas fa-magic"></i> AI生成';
        }
    });

    // 生成人物按钮事件
    generateCharactersBtn?.addEventListener('click', async () => {
        if (!validateInputs(['novelTitle', 'novelTheme', 'mainPlot'])) return;
        
        try {
            generateCharactersBtn.disabled = true;
            generateCharactersBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
            
            const characters = await generateCharacters(
                novelTitle.value,
                novelTheme.value,
                mainPlot.value
            );
            characterInfo.value = characters;
            
            // 启用优化按钮
            optimizeCharactersBtn.disabled = false;
        } catch (error) {
            console.error('生成人物失败:', error);
            alert('生成人物失败，请重试');
        } finally {
            generateCharactersBtn.disabled = false;
            generateCharactersBtn.innerHTML = '<i class="fas fa-magic"></i> AI生成';
        }
    });

    // 生成世界观按钮事件
    generateWorldBtn?.addEventListener('click', async () => {
        if (!validateInputs(['novelTitle', 'novelTheme', 'mainPlot'])) return;
        
        try {
            generateWorldBtn.disabled = true;
            generateWorldBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
            
            const world = await generateWorld(
                novelTitle.value,
                novelTheme.value,
                mainPlot.value
            );
            worldSetting.value = world;
            
            // 启用优按钮
            optimizeWorldBtn.disabled = false;
        } catch (error) {
            console.error('生成世界观失败:', error);
            alert('生成世界观失败，请重试');
        } finally {
            generateWorldBtn.disabled = false;
            generateWorldBtn.innerHTML = '<i class="fas fa-magic"></i> AI生成';
        }
    });

    // 生成大纲按钮事件
    generateOutlinesBtn?.addEventListener('click', async () => {
        if (!validateInputs([
            'novelTitle', 'novelTheme', 'mainPlot',
            'characterInfo', 'worldSetting', 'totalChapters'
        ])) return;
        
        try {
            generateOutlinesBtn.disabled = true;
            generateOutlinesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
            
            // 确保进度条容器存在
            let progressContainer = document.querySelector('.progress-container');
            if (!progressContainer) {
                // 如果不存在，创建进度条容器
                progressContainer = document.createElement('div');
                progressContainer.className = 'progress-container';
                progressContainer.innerHTML = `
                    <div class="progress-bar"></div>
                    <div class="progress-text"></div>
                `;
                // 将进度条插入到合适的位置
                const outlinesList = document.getElementById('chapterOutlinesList');
                if (outlinesList) {
                    outlinesList.parentElement.insertBefore(progressContainer, outlinesList);
                }
            }
            
            // 获取进度条和文本元素
            const progressBar = progressContainer.querySelector('.progress-bar');
            const progressText = progressContainer.querySelector('.progress-text');
            
            // 计算阶段
            const phases = calculatePhaseChapters(parseInt(totalChapters.value));
            let startChapter = 1;
            const allOutlines = [];
            
            for (const phase of phases) {
                for (let i = 0; i < phase.chapters; i++) {
                    const chapterNum = startChapter + i;
                    if (progressText) {
                        progressText.textContent = `正在生成第 ${chapterNum} 章大纲，共 ${totalChapters.value} 章`;
                    }
                    if (progressBar) {
                        progressBar.style.width = `${(chapterNum / totalChapters.value) * 100}%`;
        }

        try {
                        const outlines = await generateOutlineBatch({
                            title: novelTitle.value,
                            theme: novelTheme.value,
                            mainPlot: mainPlot.value,
                            characterInfo: characterInfo.value,
                            worldSetting: worldSetting.value,
                            phase: phase.name,
                            startChapter: chapterNum,
                            batchSize: 1,
                            totalChapters: parseInt(totalChapters.value),
                            previousOutlines: allOutlines.slice(-2)
                        });
                        
                        allOutlines.push(...outlines);
        } catch (error) {
                        console.error(`生成第 ${chapterNum} 章大纲失败:`, error);
                        throw error;
                    }
                }
                startChapter += phase.chapters;
            }
            
            // 显示大纲
            displayOutlines(allOutlines);
            
            // 完成后隐藏进度条
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            
            // 启用生小说按钮
            generateBtn.disabled = false;
            
        } catch (error) {
            console.error('生成大纲失败:', error);
            alert('生成大纲失败，请试');
        } finally {
            generateOutlinesBtn.disabled = false;
            generateOutlinesBtn.innerHTML = '<i class="fas fa-magic"></i> 生成大纲完成';
        }
    });

    // 优化按钮事件
    [
        { btn: optimizePlotBtn, type: '剧情', input: mainPlot },
        { btn: optimizeCharactersBtn, type: '人物设定', input: characterInfo },
        { btn: optimizeWorldBtn, type: '世界观', input: worldSetting }
    ].forEach(({ btn, type, input }) => {
        btn?.addEventListener('click', async () => {
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 优化中...';
                
                const optimized = await optimizeContent(input.value, type);
                input.value = optimized;
                
        } catch (error) {
                console.error(`优化${type}失败:`, error);
                alert(`优化${type}失败，请重试`);
        } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-wand-sparkles"></i> 优化';
            }
        });
    });

    // 输入验证函数
    function validateInputs(requiredFields) {
        const fieldNames = {
            novelTitle: '小说标题',
            novelTheme: '主题/类型',
            mainPlot: '主要剧情',
            characterInfo: '主要人物',
            worldSetting: '世界观设定',
            totalChapters: '总章节数',
            writingStyle: '写作风格',
            chapterLength: '章节字数',
            creativity: '创意程度'
        };
        
        for (const field of requiredFields) {
            const element = document.getElementById(field);
            if (!element?.value?.trim()) {
                alert(`请填写${fieldNames[field]}`);
                element?.focus();
            return false;
        }
        }
        return true;
    }

    // 显示大纲函数
    function displayOutlines(outlines) {
        const outlinesList = document.getElementById('chapterOutlinesList');
        if (!outlinesList) {
            console.error('找不到大纲列表容器');
            return;
        }
        
        // 清空现有内容
        outlinesList.innerHTML = '';

        // 遍历并显示每个大纲
        outlines.forEach(outline => {
            // 创建大纲元素
            const outlineElement = document.createElement('div');
            outlineElement.className = 'chapter-outline';
            outlineElement.innerHTML = `
                <div class="outline-header">
                    <h3>第${outline.chapter}章：${outline.title}</h3>
                    <div class="outline-controls">
                        <button class="split-outline-btn">拆</button>
                        <button class="edit-outline-btn">编辑</button>
                        <button class="save-outline-btn" style="display:none">保存</button>
                    </div>
                </div>
                <div class="outline-content">
                    <div class="info-item">
                        <span class="label">主要人物：</span>
                        <span class="text">${outline.characters.join('、')}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">核心事件：</span>
                        <span class="text">${outline.mainEvent}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">详细内容：</span>
                        <span class="text">${outline.content}</span>
                    </div>
                </div>
                <div class="split-preview" style="display:none">
                    <div class="split-preview-content"></div>
                </div>
            `;

            // 添加到列表中
            outlinesList.appendChild(outlineElement);
            
            // 设置大纲控制功能
            setupOutlineControls(outlineElement, outline);
        });
    }

    // 拆分单个大纲
    async function splitOutline(outlineElement, outline, splitCount) {
        try {
            // 初始化章节拆分器
            const splitter = new ChapterSplitter();
            const subChapters = await splitter.initializeSplit(
                outline.content,
                outline.chapter,
                splitCount
            );

            // 显示拆分结果
            const splitPreview = outlineElement.querySelector('.split-preview') || document.createElement('div');
            splitPreview.className = 'split-preview';
            splitPreview.innerHTML = `
                <div class="split-preview-content">
                    ${subChapters.map((chapter, index) => `
                        <div class="sub-outline">
                            <div class="sub-outline-header">
                                <h4>第${chapter.mainChapterNum}-${chapter.subChapterNum}节：${chapter.title}</h4>
                                <div class="sub-outline-actions">
                                    <button class="edit-btn" title="编辑">
                                        <i class="fas fa-edit"></i> 编辑
                                    </button>
                                    <button class="save-btn" title="保存" style="display: none;">
                                        <i class="fas fa-save"></i> 保存
                                    </button>
                                    <button class="cancel-btn" title="取消" style="display: none;">
                                        <i class="fas fa-times"></i> 取消
                                    </button>
                                </div>
                            </div>
                            <div class="sub-outline-info">
                                <div class="info-item">
                                    <span class="label">主要人物：</span>
                                    <span class="value" contenteditable="false">${chapter.characters}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">核心事件：</span>
                                    <span class="value" contenteditable="false">${chapter.mainEvent}</span>
                                </div>
                            </div>
                            <div class="sub-outline-text" contenteditable="false">${chapter.content}</div>
                        </div>
                    `).join('')}
                </div>
            `;

            // 如果splitPreview还没有添加到DOM中，添加它
            if (!outlineElement.querySelector('.split-preview')) {
                outlineElement.appendChild(splitPreview);
            }

            // 为每个子章节添加编辑功能
            splitPreview.querySelectorAll('.sub-outline').forEach(subOutline => {
                const editBtn = subOutline.querySelector('.edit-btn');
                const saveBtn = subOutline.querySelector('.save-btn');
                const cancelBtn = subOutline.querySelector('.cancel-btn');
                const infoItems = subOutline.querySelectorAll('.info-item .value');
                const subOutlineText = subOutline.querySelector('.sub-outline-text');
                
                // 存储原始内容，用于取消编辑
                let originalContent = {
                    characters: infoItems[0]?.textContent || '',
                    mainEvent: infoItems[1]?.textContent || '',
                    content: subOutlineText?.textContent || ''
                };

                // 编辑按钮点击事件
                editBtn.addEventListener('click', () => {
                    // 存储当前内容
                    originalContent = {
                        characters: infoItems[0]?.textContent || '',
                        mainEvent: infoItems[1]?.textContent || '',
                        content: subOutlineText?.textContent || ''
                    };

                    // 启用编辑模式
                    infoItems.forEach(item => item.contentEditable = true);
                    if (subOutlineText) subOutlineText.contentEditable = true;
                    
                    // 切换按钮显示
                    editBtn.style.display = 'none';
                    saveBtn.style.display = 'inline-flex';
                    cancelBtn.style.display = 'inline-flex';
                    
                    // 添加编辑中的视觉提示
                    subOutline.classList.add('editing');
                });

                // 保存按钮点击事件
                saveBtn.addEventListener('click', () => {
                    // 禁用编辑模式
                    infoItems.forEach(item => item.contentEditable = false);
                    if (subOutlineText) subOutlineText.contentEditable = false;
                    
                    // 切换按钮显示
                    editBtn.style.display = 'inline-flex';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                    
                    // 移除编辑中的视觉提示
                    subOutline.classList.remove('editing');
                    
                    // 显示保存成功提示
                    showSaveIndicator(subOutline);
                });

                // 取消按钮点击事件
                cancelBtn.addEventListener('click', () => {
                    // 恢复原始内容
                    infoItems[0].textContent = originalContent.characters;
                    infoItems[1].textContent = originalContent.mainEvent;
                    if (subOutlineText) subOutlineText.textContent = originalContent.content;
                    
                    // 禁用编辑模式
                    infoItems.forEach(item => item.contentEditable = false);
                    if (subOutlineText) subOutlineText.contentEditable = false;
                    
                    // 切换按钮显示
                    editBtn.style.display = 'inline-flex';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                    
                    // 移除编辑中的视觉提示
                    subOutline.classList.remove('editing');
                });
            });

            return subChapters;
            } catch (error) {
            console.error('拆分大纲时出错:', error);
            throw error;
        }
    }

    // 显示保存成功提示
    function showSaveIndicator(subOutline) {
        const saveIndicator = document.createElement('div');
        saveIndicator.className = 'save-indicator';
        saveIndicator.innerHTML = '<i class="fas fa-check"></i> 已保存';
        subOutline.appendChild(saveIndicator);
        
        setTimeout(() => {
            saveIndicator.remove();
        }, 2000);
    }

    // 获取API相关元素
    const aiProvider = document.getElementById('aiProvider');
    const aiModel = document.getElementById('aiModel');
    const apiUrl = document.getElementById('apiUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const verifyKeyBtn = document.getElementById('verifyKeyBtn');
    const toggleApiKey = document.getElementById('toggleApiKey');

    // API密显示切换
    toggleApiKey?.addEventListener('click', () => {
        const type = apiKeyInput.type;
        apiKeyInput.type = type === 'password' ? 'text' : 'password';
        toggleApiKey.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
    });

    // 添加重试函数
    async function verifyWithRetry(baseUrl, model, apiKey, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(baseUrl + '/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: "user",
                                content: "验证API密钥"
                            }
                        ],
                        max_tokens: 10
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
                }

                return true;
            } catch (error) {
                console.warn(`第${i + 1}次验证尝试失败:`, error);
                if (i === maxRetries - 1) {
                    throw new Error(`验证失败: ${error.message}`);
                }
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // 修改验证按钮事件处理
    verifyKeyBtn?.addEventListener('click', async () => {
        const provider = aiProvider.value.trim();
        const model = aiModel.value.trim();
        const baseUrl = apiUrl.value.trim();
        const apiKey = apiKeyInput.value.trim();

        // 验证输入
        if (!provider || !model || !baseUrl || !apiKey) {
            alert('请填写所有必要信息！');
            return;
        }

        try {
            // 更新按钮和状态显示
            verifyKeyBtn.disabled = true;
            verifyKeyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 验证中...';
            apiKeyStatus.textContent = '正在验证...';
            apiKeyStatus.className = 'api-key-status verifying';

            // 使用重试机制验证API密钥
            await verifyWithRetry(baseUrl, model, apiKey);

            // 验证成功
            apiKeyStatus.textContent = '验证成功！';
            apiKeyStatus.className = 'api-key-status success';
                
            // 禁用输入
            aiProvider.disabled = true;
            aiModel.disabled = true;
            apiUrl.disabled = true;
            apiKeyInput.disabled = true;
            verifyKeyBtn.style.display = 'none';
        
            // 保存配置
            globalConfig = {
                provider,
                model,
                baseUrl,
                apiKey
            };
            localStorage.setItem('ai_config', JSON.stringify(globalConfig));
            window.isApiKeyVerified = true;
                
            // 激活主内容区域
            document.querySelectorAll('.input-section button').forEach(btn => {
                btn.disabled = false;
            });
            document.querySelector('.main-content')?.classList.add('active');

            // 验证成功后启用按钮
            const generateButtons = [
                document.getElementById('generateBtn'),
                document.getElementById('generateOutlinesBtn'),
                document.getElementById('generatePlotBtn'),
                document.getElementById('generateCharactersBtn'),
                document.getElementById('generateWorldBtn'),
                document.getElementById('batchSplitBtn')  // 添加一键拆分章节按钮
            ];

            generateButtons.forEach(btn => {
                if (btn) btn.disabled = false;
            });

            } catch (error) {
            console.error('API密钥验证失败:', error);
            let errorMessage = error.message;
            
            // 根据错误类型提供更具体的错误信息
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '连接服务器失败，请检查API地址是否正确，或者网络是否正常';
            } else if (error.message.includes('401')) {
                errorMessage = 'API密钥无效，请检查密钥是否正确';
            } else if (error.message.includes('403')) {
                errorMessage = '没有访问权限，请检查API密钥限';
            }
            
            apiKeyStatus.textContent = `验证失败: ${errorMessage}`;
            apiKeyStatus.className = 'api-key-status error';
            
            // 重置按钮状态
            verifyKeyBtn.disabled = false;
            verifyKeyBtn.innerHTML = '<i class="fas fa-check"></i> 验证密钥';
            
            // 允许重新输入
            aiProvider.disabled = false;
            aiModel.disabled = false;
            apiUrl.disabled = false;
            apiKeyInput.disabled = false;
        }
    });

    // 加载保存的配置
    const savedConfig = localStorage.getItem('ai_config');
    if (savedConfig) {
        try {
            globalConfig = JSON.parse(savedConfig);
            
            // 填充表单
            aiProvider.value = globalConfig.provider;
            aiModel.value = globalConfig.model;
            apiUrl.value = globalConfig.baseUrl;
            apiKeyInput.value = globalConfig.apiKey;
            
            // 自动验证配置
            verifyKeyBtn.click();
        } catch (error) {
            console.error('加载保存的配置失败:', error);
            localStorage.removeItem('ai_config');
            globalConfig = null;
        }
    }

    // 添加一键拆分章节按钮事件
    const batchSplitBtn = document.getElementById('batchSplitBtn');
    batchSplitBtn?.addEventListener('click', async () => {
        try {
            batchSplitBtn.disabled = true;
            batchSplitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 拆分中...';
            
            // 获取所有大纲元素
            const outlineElements = document.querySelectorAll('.chapter-outline');
            const totalOutlines = outlineElements.length;
            
            // 创建进度条
            const progressContainer = createProgressBar();
            progressContainer.style.display = 'block';
            
            // 获取全局拆分数量设置
            const globalSplitCount = document.getElementById('batchSplitCount');
            const splitCount = globalSplitCount ? parseInt(globalSplitCount.value) : 3;
            
            // 逐个拆分大纲
            for (let i = 0; i < outlineElements.length; i++) {
                const outlineElement = outlineElements[i];
                updateProgress(i + 1, totalOutlines, `正在拆分第 ${i + 1} 章，共 ${totalOutlines} 章`);
                
                // 获取大纲数据
                const chapterTitle = outlineElement.querySelector('.outline-header h3').textContent;
                const chapterNum = parseInt(chapterTitle.match(/第(\d+)章/)[1]);
                const content = outlineElement.querySelector('.info-item:last-child .text').textContent;
                
                // 创建outline对象
                const outline = {
                    chapter: chapterNum,
                    content: content
                };
                
                try {
                    // 执行拆分
                    await splitOutline(outlineElement, outline, splitCount);
                    
                    // 显示拆分预览
                    const splitPreview = outlineElement.querySelector('.split-preview');
                    if (splitPreview) {
                        splitPreview.style.display = 'block';
                    }
                } catch (error) {
                    console.error(`拆分第 ${chapterNum} 章时出错:`, error);
                }
                
                // 等待一小段时间，避免API调用过于频繁
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 隐藏进度条
            progressContainer.style.display = 'none';
            
        } catch (error) {
            console.error('批量拆分章节失败:', error);
            alert('批量拆分章节失败，请重试');
        } finally {
            batchSplitBtn.disabled = false;
            batchSplitBtn.innerHTML = '<i class="fas fa-cut"></i> 一键拆分章节';
        }
    });
}); 

// 添加章节拆分处理器
let chapterSplitter = new ChapterSplitter();

// 修改章节元素创建函数，添加拆分功能
function createChapterElement(chapterNum, content) {
    const chapterElement = document.createElement('div');
    chapterElement.className = 'chapter-content';
    chapterElement.innerHTML = `
        <div class="chapter-header">
            <h3>第${chapterNum}章</h3>
            <div class="chapter-actions">
                <button class="split-btn" title="拆分章节"><i class="fas fa-cut"></i></button>
                <button class="edit-btn" title="编辑"><i class="fas fa-edit"></i></button>
                <button class="save-btn" style="display:none" title="保存"><i class="fas fa-save"></i></button>
            </div>
        </div>
        <div class="chapter-text">
            <div class="text-content">${content}</div>
            <textarea class="edit-area" style="display:none">${content}</textarea>
        </div>
        <div class="split-options" style="display:none">
            <div class="split-header">
                <h4>章节拆分</h4>
                <div class="split-controls">
                    <label>拆分数量：</label>
                    <input type="number" class="split-count" min="2" max="10" value="3" />
                    <button class="confirm-split">确认拆分</button>
                    <button class="cancel-split">取消</button>
                </div>
            </div>
            <div class="split-preview"></div>
        </div>
    `;

    // 获取元素引用
    const splitBtn = chapterElement.querySelector('.split-btn');
    const editBtn = chapterElement.querySelector('.edit-btn');
    const saveBtn = chapterElement.querySelector('.save-btn');
    const splitOptions = chapterElement.querySelector('.split-options');
    const confirmSplitBtn = chapterElement.querySelector('.confirm-split');
    const cancelSplitBtn = chapterElement.querySelector('.cancel-split');
    const splitCount = chapterElement.querySelector('.split-count');
    const textContent = chapterElement.querySelector('.text-content');
    const editArea = chapterElement.querySelector('.edit-area');
    const splitPreview = chapterElement.querySelector('.split-preview');

    // 拆分功能
    splitBtn.addEventListener('click', async () => {
        splitOptions.style.display = 'block';
        splitBtn.disabled = true;
        
        try {
            // 显示加载状态
            splitPreview.innerHTML = '<div class="loading">正在生成子节...</div>';
            
            // 初始化拆分
            const subChapters = await chapterSplitter.initializeSplit(
                content,
                chapterNum,
                parseInt(splitCount.value)
            );
            
            // 显示预览
            splitPreview.innerHTML = subChapters.map((chapter, index) => `
                <div class="sub-chapter">
                    <div class="sub-chapter-header">
                        <h4>第${chapterNum}-${index + 1}节：${chapter.title}</h4>
                        <div class="sub-chapter-actions">
                            <button class="edit-sub-chapter"><i class="fas fa-edit"></i></button>
                            <button class="save-sub-chapter" style="display:none"><i class="fas fa-save"></i></button>
                        </div>
                    </div>
                    <div class="sub-chapter-info">
                        <div class="info-item">
                            <span class="label">主要人物：</span>
                            <span class="value">${chapter.characters}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">核心事件：</span>
                            <span class="value">${chapter.mainEvent}</span>
                        </div>
                    </div>
                    <div class="sub-chapter-content">
                        <div class="sub-chapter-text">${chapter.content}</div>
                        <textarea class="sub-chapter-edit" style="display:none">${chapter.content}</textarea>
                    </div>
                </div>
            `).join('');

            // 为每个子章节添加编辑功能
            splitPreview.querySelectorAll('.sub-chapter').forEach((subChapter, index) => {
                const editBtn = subChapter.querySelector('.edit-sub-chapter');
                const saveBtn = subChapter.querySelector('.save-sub-chapter');
                const text = subChapter.querySelector('.sub-chapter-text');
                const edit = subChapter.querySelector('.sub-chapter-edit');

                editBtn.addEventListener('click', () => {
                    text.style.display = 'none';
                    edit.style.display = 'block';
                    editBtn.style.display = 'none';
                    saveBtn.style.display = 'inline-block';
                    
                    // 自动调整文本区域高度
                    edit.style.height = 'auto';
                    edit.style.height = edit.scrollHeight + 'px';
                });

                saveBtn.addEventListener('click', async () => {
                    const newContent = edit.value;
                    
                    // 验证新内容
                    if (chapterSplitter.validateSubChapter({
                        ...chapterSplitter.subChapters[index],
                        content: newContent
                    })) {
                        text.textContent = newContent;
                        chapterSplitter.subChapters[index].content = newContent;
            } else {
                        // 如果验证失败，尝试优化内容
                        const optimizedChapter = await chapterSplitter.optimizeSubChapter({
                            ...chapterSplitter.subChapters[index],
                            content: newContent
                        });
                        
                        text.textContent = optimizedChapter.content;
                        edit.value = optimizedChapter.content;
                        chapterSplitter.subChapters[index] = optimizedChapter;
                    }
                    
                    text.style.display = 'block';
                    edit.style.display = 'none';
                    saveBtn.style.display = 'none';
                    editBtn.style.display = 'inline-block';
                });
            });
        } catch (error) {
            console.error('预览拆分结果时出错:', error);
            splitPreview.innerHTML = '<div class="error">拆分章节时出错，请重试</div>';
        }

        splitBtn.disabled = false;
    });

    // 确认拆分
    confirmSplitBtn.addEventListener('click', () => {
        // 更新章节内容为所有子章节的组合
        const newContent = chapterSplitter.subChapters.map(chapter => 
            `第${chapter.mainChapterNum}-${chapter.subChapterNum}节：${chapter.title}\n` +
            `主要人物：${chapter.characters}\n` +
            `核心事件：${chapter.mainEvent}\n` +
            `详细内容：\n${chapter.content}`
        ).join('\n\n---\n\n');
        
        content = newContent;
        textContent.textContent = content;
        editArea.value = content;
        
        // 隐藏拆分选项
        splitOptions.style.display = 'none';
        splitPreview.innerHTML = '';
    });

    // 取消拆分
    cancelSplitBtn.addEventListener('click', () => {
        splitOptions.style.display = 'none';
        splitPreview.innerHTML = '';
    });

    // 编辑功能
    editBtn.addEventListener('click', () => {
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        textContent.style.display = 'none';
        editArea.style.display = 'block';
        
        // 自动调整文本区域高度
        editArea.style.height = 'auto';
        editArea.style.height = editArea.scrollHeight + 'px';
    });

    // 保存功能
    saveBtn.addEventListener('click', () => {
        content = editArea.value;
        textContent.textContent = content;
        editArea.style.display = 'none';
        textContent.style.display = 'block';
        saveBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
    });

    return chapterElement;
}

// 处理主题选择变化
function handleThemeChange(value) {
    const customThemeInput = document.getElementById('customTheme');
    if (value === 'custom') {
        customThemeInput.style.display = 'block';
        customThemeInput.focus();
        // 监听自定义输入
        customThemeInput.onchange = function() {
            if (this.value.trim()) {
                // 如果输入不为空，更新选择框的值
                const select = document.getElementById('novelTheme');
                const option = document.createElement('option');
                option.value = this.value.trim();
                option.text = this.value.trim();
                select.add(option);
                select.value = this.value.trim();
            }
        };
            } else {
        customThemeInput.style.display = 'none';
    }
}

// 处理写作风格选择变化
function handleStyleChange(value) {
    const customStyleInput = document.getElementById('customStyle');
    if (value === 'custom') {
        customStyleInput.style.display = 'block';
        customStyleInput.focus();
        // 监听自定义输入
        customStyleInput.onchange = function() {
            if (this.value.trim()) {
                // 如果输入不为空，更新选择框的值
                const select = document.getElementById('writingStyle');
                const option = document.createElement('option');
                option.value = this.value.trim();
                option.text = this.value.trim();
                select.add(option);
                select.value = this.value.trim();
            }
        };
    } else {
        customStyleInput.style.display = 'none';
    }
}

// 获取当前选择的主题/类型
function getCurrentTheme() {
    const select = document.getElementById('novelTheme');
    const customInput = document.getElementById('customTheme');
    return select.value === 'custom' ? customInput.value.trim() : select.value;
}

// 获取当前选择的写作风格
function getCurrentStyle() {
    const select = document.getElementById('writingStyle');
    const customInput = document.getElementById('customStyle');
    return select.value === 'custom' ? customInput.value.trim() : select.value;
}

// 章节数快速选择按钮处理
document.addEventListener('DOMContentLoaded', () => {
    const quickSelectButtons = document.querySelectorAll('.quick-select button');
    const totalChaptersInput = document.getElementById('totalChapters');

    quickSelectButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除其他按钮的active类
            quickSelectButtons.forEach(btn => btn.classList.remove('active'));
            // 添加当前按钮的active类
            button.classList.add('active');
            // 设置输入框的值
            const value = button.getAttribute('data-value');
            totalChaptersInput.value = value;
        });
        });
    });

// 数字输入框上下按钮处理
document.addEventListener('DOMContentLoaded', () => {
    const numberInputs = document.querySelectorAll('.number-input');
    
    numberInputs.forEach(container => {
        const input = container.querySelector('input[type="number"]');
        const upButton = container.querySelector('.number-up');
        const downButton = container.querySelector('.number-down');
        
        if (input && upButton && downButton) {
            // 上按钮点击事件
            upButton.addEventListener('click', () => {
                const currentValue = parseInt(input.value) || 0;
                const max = parseInt(input.getAttribute('max')) || Infinity;
                if (currentValue < max) {
                    input.value = currentValue + 1;
                    // 触发input的change事件
                    input.dispatchEvent(new Event('change'));
                }
            });
            
            // 下按钮点击事件
            downButton.addEventListener('click', () => {
                const currentValue = parseInt(input.value) || 0;
                const min = parseInt(input.getAttribute('min')) || 0;
                if (currentValue > min) {
                    input.value = currentValue - 1;
                    // 触发input的change事件
                    input.dispatchEvent(new Event('change'));
                }
            });
            }
        });
    });

// 添加子章节编辑功能
function makeSubChapterEditable(subOutline) {
    const editBtn = subOutline.querySelector('.edit-btn');
    const saveBtn = subOutline.querySelector('.save-btn');
    const cancelBtn = subOutline.querySelector('.cancel-btn');
    const infoItems = subOutline.querySelectorAll('.info-item .value');
    const subOutlineText = subOutline.querySelector('.sub-outline-text');
    
    // 存储原始内容，用于取消编辑
    let originalContent = {
        characters: infoItems[0]?.textContent || '',
        mainEvent: infoItems[1]?.textContent || '',
        content: subOutlineText?.textContent || ''
    };

    // 编辑按钮点击事件
    editBtn.addEventListener('click', () => {
        // 存储当前内容
        originalContent = {
            characters: infoItems[0]?.textContent || '',
            mainEvent: infoItems[1]?.textContent || '',
            content: subOutlineText?.textContent || ''
        };

        // 启用编辑模式
        infoItems.forEach(item => item.contentEditable = true);
        if (subOutlineText) subOutlineText.contentEditable = true;
        
        // 切换按钮显示
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
        
        // 添加编辑中的视觉提示
        subOutline.classList.add('editing');
    });

    // 保存按钮点击事件
    saveBtn.addEventListener('click', () => {
        // 禁用编辑模式
        infoItems.forEach(item => item.contentEditable = false);
        if (subOutlineText) subOutlineText.contentEditable = false;
        
        // 切换按钮显示
        editBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        
        // 移除编辑中的视觉提示
        subOutline.classList.remove('editing');
        
        // 显示保存成功提示
        showSaveIndicator(subOutline);
    });

    // 取消按钮点击事件
    cancelBtn.addEventListener('click', () => {
        // 恢复原始内容
        infoItems[0].textContent = originalContent.characters;
        infoItems[1].textContent = originalContent.mainEvent;
        if (subOutlineText) subOutlineText.textContent = originalContent.content;
        
        // 禁用编辑模式
        infoItems.forEach(item => item.contentEditable = false);
        if (subOutlineText) subOutlineText.contentEditable = false;
        
        // 切换按钮显示
        editBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        
        // 移除编辑中的视觉提示
        subOutline.classList.remove('editing');
    });
}

// 显示保存成功提示
function showSaveIndicator(subOutline) {
    const saveIndicator = document.createElement('div');
    saveIndicator.className = 'save-indicator';
    saveIndicator.innerHTML = '<i class="fas fa-check"></i> 已保存';
    subOutline.appendChild(saveIndicator);
    
    setTimeout(() => {
        saveIndicator.remove();
    }, 2000);
}

// 创建子章节元素
function createSubOutlineElement(subChapter) {
    const subOutlineElement = document.createElement('div');
    subOutlineElement.className = 'sub-outline';
    subOutlineElement.innerHTML = `
        <div class="sub-outline-header">
            <h4>第${subChapter.mainChapterNum}-${subChapter.subChapterNum}节：${subChapter.title}</h4>
            <div class="sub-outline-actions">
                <button class="edit-btn" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="save-btn" title="保存" style="display: none;">
                    <i class="fas fa-save"></i>
                </button>
                <button class="cancel-btn" title="取消" style="display: none;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="sub-outline-info">
            <div class="info-item">
                <span class="label">主要人物：</span>
                <span class="value" contenteditable="false">${subChapter.characters}</span>
            </div>
            <div class="info-item">
                <span class="label">核心事件：</span>
                <span class="value" contenteditable="false">${subChapter.mainEvent}</span>
            </div>
        </div>
        <div class="sub-outline-text" contenteditable="false">${subChapter.content}</div>
    `;

    // 添加编辑功能
    makeSubChapterEditable(subOutlineElement);
    
    return subOutlineElement;
}