// API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 在文件开头添加
let isApiKeyVerified = false;

// 验证API密钥
async function verifyApiKey(apiKey) {
    try {
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
                        role: "system",
                        content: "验证API密钥"
                    },
                    {
                        role: "user",
                        content: "你好"
                    }
                ],
                max_tokens: 10
            })
        });

        if (!response.ok) {
            throw new Error('API密钥无效');
        }

        return true;
    } catch (error) {
        console.error('API密钥验证失败:', error);
        return false;
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
            content: "你是一个专业的小说世界观设计师，擅长创造独特而合理的故事背景。"
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

// 修改分析章节大纲的函数
function analyzeChapterOutline(outline) {
    const subplots = [];
    const outlineInfo = parseChapterOutline(outline);
    
    // 分析剧情发展部分
    if (outlineInfo.plotDevelopment) {
        const plotEvents = outlineInfo.plotDevelopment
            .split(/[。；]/)
            .filter(event => event.trim().length > 0);
        subplots.push(...plotEvents.map(event => ({
            type: '剧情',
            content: event.trim(),
            estimated_length: estimateContentLength(event.trim())
        })));
    }

    // 分析人物刻画部分
    if (outlineInfo.characterPortrayal) {
        const characterEvents = outlineInfo.characterPortrayal
            .split(/[。；]/)
            .filter(event => event.trim().length > 0);
        subplots.push(...characterEvents.map(event => ({
            type: '人物',
            content: event.trim(),
            estimated_length: estimateContentLength(event.trim())
        })));
    }

    // 分析情感推进部分
    if (outlineInfo.emotionalProgress) {
        const emotionalEvents = outlineInfo.emotionalProgress
            .split(/[。；]/)
            .filter(event => event.trim().length > 0);
        subplots.push(...emotionalEvents.map(event => ({
            type: '情感',
            content: event.trim(),
            estimated_length: estimateContentLength(event.trim())
        })));
    }

    // 分析伏笔处理部分
    if (outlineInfo.foreshadowing) {
        const foreshadowingEvents = outlineInfo.foreshadowing
            .split(/[。；]/)
            .filter(event => event.trim().length > 0);
        subplots.push(...foreshadowingEvents.map(event => ({
            type: '伏笔',
            content: event.trim(),
            estimated_length: estimateContentLength(event.trim())
        })));
    }

    // 组织子情节为多个话
    return organizeSubplotsIntoTalks(subplots);
}

// 估算内容可能需要的篇幅
function estimateContentLength(content) {
    // 基础字数（每个情节点至少需要的描写字数）
    const BASE_LENGTH = 500;
    
    // 根据情节复杂度增加字数
    const complexity = content.length * 2;
    
    // 根据是否包含对话、动作等关键词调整字数
    const hasDialogue = /[""].*?[""]/.test(content) || /".*?"/.test(content);
    const hasAction = /[战斗|追逐|冲突|打斗|较量]/.test(content);
    const hasEmotion = /[情感|心理|感受|思考|纠结]/.test(content);
    
    let additionalLength = 0;
    if (hasDialogue) additionalLength += 300;
    if (hasAction) additionalLength += 500;
    if (hasEmotion) additionalLength += 400;
    
    return BASE_LENGTH + complexity + additionalLength;
}

// 将子情节组织为多个话
function organizeSubplotsIntoTalks(subplots) {
    const talks = [];
    let currentTalk = [];
    let currentLength = 0;
    const TARGET_LENGTH = 2000; // 每话的目标字数
    
    for (const subplot of subplots) {
        if (currentLength + subplot.estimated_length > TARGET_LENGTH && currentTalk.length > 0) {
            talks.push([...currentTalk]);
            currentTalk = [];
            currentLength = 0;
        }
        
        currentTalk.push(subplot);
        currentLength += subplot.estimated_length;
    }
    
    if (currentTalk.length > 0) {
        talks.push(currentTalk);
    }
    
    // 确保每个话都有合理的内容��合
    return optimizeTalks(talks);
}

// 优化话的内容组合
function optimizeTalks(talks) {
    return talks.map((talk, index) => {
        // 为每话添加元信息
        return {
            talkNumber: index + 1,
            totalTalks: talks.length,
            subplots: talk,
            focus: determineTalkFocus(talk),
            transitionType: determineTalkTransition(index, talks.length)
        };
    });
}

// 确定本话的重点
function determineTalkFocus(talk) {
    const typeCounts = talk.reduce((acc, subplot) => {
        acc[subplot.type] = (acc[subplot.type] || 0) + 1;
        return acc;
    }, {});
    
    return Object.entries(typeCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
}

// 确定话的过渡类型
function determineTalkTransition(index, total) {
    if (index === 0) return '开始';
    if (index === total - 1) return '结束';
    return '过渡';
}

// 修改生成章节的函数
async function generateChapter(params) {
    const {
        title,
        theme,
        writingStyle,
        mainPlot,
        characterInfo,
        worldSetting,
        chapterLength,
        creativity,
        currentChapter,
        totalChapters,
        chapterOutline,
        previousSummary
    } = params;

    // 分析章节大纲，拆分为多个话
    const talks = analyzeChapterOutline(chapterOutline);
    const chapterContent = [];
    let previousPartSummary = previousSummary;

    // 为每个话生成内容
    for (const talk of talks) {
        const prompt = `
作为一个专业的${theme}小说创作者，请创作第${currentChapter}章第${talk.talkNumber}话的内容：

小说基本信息：
- 标题：${title}
- 类型：${theme}
- 写作风格：${writingStyle}
- 当前进度：第${currentChapter}章 第${talk.talkNumber}话（共${talk.totalTalks}话）
- 总章节数：${totalChapters}章

本话重点：${talk.focus}
本话定位：${talk.transitionType}

本话需要完成的情节：
${talk.subplots.map(subplot => `- ${subplot.type}：${subplot.content}`).join('\n')}

世界观背景：
${worldSetting}

主要人物设定：
${characterInfo}

整体剧情概要：
${mainPlot}

${previousPartSummary ? `前文概要：\n${previousPartSummary}\n` : ''}

创作要求：
1. 严格按照指定的情节展开，确保完整呈现每个情节点
2. 字数控制在2000字左右
3. 采用${writingStyle}的写作风格
4. 注意以下要点：
   - 场景描写要细腻生动
   - 人物对话要自然传神
   - 情感表达要细腻真实
   - 注意承接上下文，保持剧情连贯
   - ${talk.transitionType === '开始' ? '注意开篇引入自���' : 
      talk.transitionType === '结束' ? '注意结尾照应前文' : 
      '注意与前后话的衔接'}
   - 重点展现"${talk.focus}"相关的内容

请直接开始创作小说内容，不需要其他额外说明。`;

        const content = await callDeepseekAPI([
            {
                role: "system",
                content: `你是一个专业的${theme}小说创作者，擅长${writingStyle}风格的写作。你需要严格按照给定的情节要求进行创作，确保内容的连贯性和完整性。`
            },
            {
                role: "user",
                content: prompt
            }
        ], creativity / 100, 2000);

        // 生成本话总结
        previousPartSummary = await generatePartSummary(content, currentChapter, talk.talkNumber);
        
        // 保存本话内容
        chapterContent.push({
            part: talk.talkNumber,
            content: content,
            summary: previousPartSummary,
            focus: talk.focus,
            subplots: talk.subplots
        });
    }

    return chapterContent;
}

// 生成单话总结
async function generatePartSummary(content, chapter, part) {
    const summaryPrompt = `
请总结这一话的主要内容：

章节内容：
${content}

请总结以下方面：
1. 主要情节发展
2. 重要人物表现
3. 关键情感变化
4. 为下一话做好铺垫

要求：
- 突出关键点
- 简明扼要
- 为下一话做好铺垫
- 控制在150字以内`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的文学编辑，擅长提炼和总结故事内容。"
        },
        {
            role: "user",
            content: summaryPrompt
        }
    ], 0.7, 800);
}

// 修改显示章节内容的函数
function displayChapter(chapterNum, chapterContent) {
    console.log('显示章节内容:', { chapterNum, chapterContent }); // 调试日志
    
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'chapter';
    
    // 创建章节标题
    const chapterTitle = document.createElement('h3');
    chapterTitle.textContent = `第${chapterNum}章`;
    chapterDiv.appendChild(chapterTitle);
    
    try {
        // 显示每一话的内容
        if (Array.isArray(chapterContent)) {
            console.log('章节内容是数组，包含', chapterContent.length, '话'); // 调试日志
            
            chapterContent.forEach((part, index) => {
                try {
                    console.log(`处理第${index + 1}话:`, part); // 调试日志
                    
                    // 创建话的容器
                    const partDiv = document.createElement('div');
                    partDiv.className = 'chapter-part';
                    
                    // 创建话的标题
                    const partTitle = document.createElement('h4');
                    partTitle.textContent = `第${part.part}话`;
                    partDiv.appendChild(partTitle);
                    
                    // 创建话的内容
                    if (part.content) {
                        const partContent = document.createElement('div');
                        partContent.className = 'chapter-content';
                        partContent.innerHTML = formatContent(part.content);
                        partDiv.appendChild(partContent);
                    } else {
                        console.error('话的内容为空:', part); // 调试日志
                    }
                    
                    // 添加话的总结（如果存在）
                    if (part.summary) {
                        const summaryCont = document.createElement('div');
                        summaryCont.className = 'part-summary';
                        summaryCont.innerHTML = `<strong>本话总结：</strong><p>${part.summary}</p>`;
                        partDiv.appendChild(summaryCont);
                    }
                    
                    // 添加重点和子情节信息（如果存在）
                    if (part.focus || part.subplots) {
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'part-info';
                        
                        if (part.focus) {
                            const focusInfo = document.createElement('p');
                            focusInfo.className = 'part-focus';
                            focusInfo.innerHTML = `<strong>本话重点：</strong>${part.focus}`;
                            infoDiv.appendChild(focusInfo);
                        }
                        
                        if (part.subplots && part.subplots.length > 0) {
                            const subplotsInfo = document.createElement('div');
                            subplotsInfo.className = 'part-subplots';
                            subplotsInfo.innerHTML = `
                                <strong>本话情节：</strong>
                                <ul>
                                    ${part.subplots.map(subplot => 
                                        `<li>${subplot.type}：${subplot.content}</li>`
                                    ).join('')}
                                </ul>`;
                            infoDiv.appendChild(subplotsInfo);
                        }
                        
                        partDiv.appendChild(infoDiv);
                    }
                    
                    chapterDiv.appendChild(partDiv);
                } catch (error) {
                    console.error(`显示第${chapterNum}章第${part?.part}话时出错:`, error);
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = `显示内容时出错：${error.message}`;
                    chapterDiv.appendChild(errorDiv);
                }
            });
        } else {
            console.error('章节内容不是数组:', chapterContent); // 调试日志
            throw new Error('章节内容格式无效');
        }
    } catch (error) {
        console.error(`显示第${chapterNum}章时出错:`, error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `显示内容时出错：${error.message}`;
        chapterDiv.appendChild(errorDiv);
    }
    
    // 添加到章节列表
    const chapterList = document.getElementById('chapterList');
    if (chapterList) {
        chapterList.appendChild(chapterDiv);
    } else {
        console.error('未找到章节列表容器'); // 调试日志
    }
}

// 修改格式化内容的函数
function formatContent(content) {
    if (!content) {
        console.error('内容为空'); // 调试日志
        return '';
    }
    
    if (typeof content !== 'string') {
        console.error('内容不是字符串类型:', typeof content); // 调试日志
        return '';
    }
    
    try {
        // 分段处理
        const paragraphs = content
            .split('\n')
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph);
            
        // 处理每个段落
        const formattedParagraphs = paragraphs.map(paragraph => {
            // 处理对话
            paragraph = paragraph.replace(
                /[""]([^""]+)[""]/g, 
                '<span class="dialogue">"$1"</span>'
            );
            
            // 处理人物名字（假设人物名字后面跟着"："）
            paragraph = paragraph.replace(
                /([^，。；！？\s]+)：/g,
                '<span class="character-name">$1：</span>'
            );
            
            return `<p>${paragraph}</p>`;
        });
        
        return formattedParagraphs.join('');
    } catch (error) {
        console.error('格式化内容时出错:', error); // 调试日志
        return `<p>${content}</p>`;
    }
}

// 解析章节大纲内容
function parseChapterOutline(outline) {
    const outlineInfo = {
        coreEvent: '',
        plotDevelopment: '',
        characterPortrayal: '',
        emotionalProgress: '',
        foreshadowing: '',
        rhythm: ''
    };

    try {
        // 提取章节标题中的核心事件
        const titleMatch = outline.match(/第\d+章：(.+?)(?:\n|$)/);
        if (titleMatch) {
            outlineInfo.coreEvent = titleMatch[1].trim();
        }

        // 提取各部分内容
        const sections = {
            '剧情发展：': 'plotDevelopment',
            '人物刻画：': 'characterPortrayal',
            '情感推进：': 'emotionalProgress',
            '伏笔处理：': 'foreshadowing',
            '节奏把控：': 'rhythm'
        };

        Object.entries(sections).forEach(([key, field]) => {
            const regex = new RegExp(`${key}([^\\n]+(?:\\n(?!-).*)*)`);
            const match = outline.match(regex);
            if (match) {
                outlineInfo[field] = match[1].trim();
            }
        });

        // 如果有任何部分为空，使用默认值
        Object.entries(outlineInfo).forEach(([key, value]) => {
            if (!value) {
                outlineInfo[key] = '按照整体剧情发展推进';
            }
        });

    } catch (error) {
        console.error('解析大纲内容时出错:', error);
        // 使用默认值
        Object.keys(outlineInfo).forEach(key => {
            outlineInfo[key] = '按照整体剧情发展推进';
        });
    }

    return outlineInfo;
}

// 修改生成章节的批处理函数
async function generateChaptersInBatches(totalChapters) {
    let previousSummary = '';

    for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
        try {
            updateProgress((chapterNum - 1) * 100 / totalChapters);
            currentProgress.textContent = `正在生成第 ${chapterNum} 章，共 ${totalChapters} 章`;

            const params = {
                title: novelTitle.value,
                theme: novelTheme.value,
                writingStyle: writingStyle.value,
                mainPlot: mainPlot.value,
                characterInfo: characterInfo.value,
                worldSetting: worldSetting.value,
                chapterLength: parseInt(chapterLength.value),
                creativity: parseInt(creativity.value),
                currentChapter: chapterNum,
                totalChapters: totalChapters,
                chapterOutline: getChapterOutline(chapterNum),
                previousSummary: previousSummary
            };

            const content = await generateChapter(params);
            
            // 生成本章总结
            previousSummary = await generateChapterSummary(content, chapterNum);

            // 保存和显示内容
            novelContent[chapterNum - 1] = {
                chapter: chapterNum,
                content: content
            };
            displayChapter(chapterNum, content);

            // 等待一小段时间，避免API调用过于频繁
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`生成第${chapterNum}章时出错:`, error);
            throw error;
        }
    }
}

// 生成章节总结
async function generateChapterSummary(content, chapterNum) {
    const summaryPrompt = `
请总结这一章的主要内容：

章节内容：
${content}

请总结以下方面：
1. 主要情节发展
2. 重要人物表现
3. 关键情感变化
4. 重要伏笔设置或回收
5. 对后续章节的影响

要求：
- 突出关键点
- 简明扼要
- 为下一章做好铺垫
- 控制在200字以内`;

    return await callDeepseekAPI([
        {
            role: "system",
            content: "你是一个专业的文学编辑，擅长提炼和总结故事内容。"
        },
        {
            role: "user",
            content: summaryPrompt
        }
    ], 0.7, 1000);
}

// 修改生成章节大纲的函数
async function generateChapterOutlines(title, theme, mainPlot, characterInfo, worldSetting, totalChapters, updateProgress) {
    try {
        // 生成整体规划
        const storyMainlinePrompt = `
作为专业的小说策划师，请为这部小说设计完整的故事主线：

小说标题：${title}
类型：${theme}
总章节数：${totalChapters}章

主要剧情：
${mainPlot}

主要人物：
${characterInfo}

世界观：
${worldSetting}

请设计以下内容：
1. 主线剧情发展路线
2. 每个主要人物的个人成长线
3. 核心感情线索发展
4. 重要矛盾冲突点
5. 关键伏笔安排

输出格式：
1. 主线剧情：[详细说明]
2. 人物成长：[每个主要人物的发展轨迹]
3. 感情线索：[主要感情线的发展过程]
4. 冲突设计：[主要矛盾点和冲突升级过程]
5. 伏笔布局：[重要伏笔的设置和回收计划]`;

        updateProgress('正在设计故事主线...', 5);
        const storyMainline = await callDeepseekAPI([
            {
                role: "system",
                content: "你是一个专业的小说策划师，擅长设计宏大而严谨的故事框架。"
            },
            {
                role: "user",
                content: storyMainlinePrompt
            }
        ], 0.7, 3000);

        // 生成故事结构
        const storyStructurePrompt = `
基于以下故事主线，设计详细的章节结构：

${storyMainline}

总章节数：${totalChapters}章

请设计以下内容：
1. 故事分阶段规划（5个阶段）：
   - 开篇引子（10%）：[具体规划]
   - 矛盾铺垫（20%）：[具体规划]
   - 冲突升级（30%）：[具体规划]
   - 高潮爆发（30%）：[具体规划]
   - 结局收尾（10%）：[具体规划]

2. 每个阶段的关键节点：
   - 重要事件安排
   - 人���关系发展
   - 情感线索推进
   - 伏笔设置/回收

3. 转折点设计：
   - 第一转折点（约25%处）
   - 中点危机（约50%处）
   - 第二转折点（约75%处）
   - 结局转折（约90%处）

请详细说明每个阶段的具体内容和目标。`;

        updateProgress('正在规划故事结构...', 10);
        const storyStructure = await callDeepseekAPI([
            {
                role: "system",
                content: "你是一个专业的故事结构设计师，擅长规划小说的整体架构和节奏。"
            },
            {
                role: "user",
                content: storyStructurePrompt
            }
        ], 0.7, 3000);

        // 初始化数据结构
        const outlines = new Array(totalChapters);
        let previousSummary = '';
        let characterArcs = new Map();
        let emotionalArcs = new Map();
        let plotThreads = new Map();

        // 逐章生成大纲
        for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
            updateProgress(`正在生成第 ${chapterNum} 章大纲...`, 10 + (chapterNum * 90 / totalChapters));

            // 计算当前章节在故事中的位置和阶段
            const storyProgress = chapterNum / totalChapters;
            let storyPhase = '';
            let phaseGoals = '';
            
            if (storyProgress <= 0.1) {
                storyPhase = '开篇引子';
                phaseGoals = '建立世界观、引入主要人物、埋下初始伏笔';
            } else if (storyProgress <= 0.3) {
                storyPhase = '矛盾铺垫';
                phaseGoals = '深化人物关系、展示核心冲突、强化情感纽带';
            } else if (storyProgress <= 0.6) {
                storyPhase = '冲突升级';
                phaseGoals = '激化矛盾、推进情节、加深人物羁绊';
            } else if (storyProgress <= 0.9) {
                storyPhase = '高潮爆发';
                phaseGoals = '冲突决战、情感升华、伏笔回收';
            } else {
                storyPhase = '结局收尾';
                phaseGoals = '圆满收场、人物蜕变、主题升华';
            }

            const chapterPrompt = `
作为专业的小说策划师，请为这部小说的第${chapterNum}章设计详细大纲：

小说信息：
- 标题：${title}
- 类型：${theme}
- 当前章节：第${chapterNum}章（共${totalChapters}章）
- 所处阶段：${storyPhase}
- 阶段目标：${phaseGoals}

故事主线：
${storyMainline}

故事结构：
${storyStructure}

前文发展：
${previousSummary}

人物发展追踪：
${Array.from(characterArcs.entries()).map(([char, arc]) => `${char}：${arc}`).join('\n')}

情感线索追踪：
${Array.from(emotionalArcs.entries()).map(([relation, arc]) => `${relation}：${arc}`).join('\n')}

剧情线索追踪：
${Array.from(plotThreads.entries()).map(([thread, status]) => `${thread}：${status}`).join('\n')}

要求：
1. 本章大纲必须包含以下部分：
   - 核心事件：本章的主要情节
   - 人物刻画：重点人物的行动和心理
   - 情感推进：重要感情线的发展
   - 伏笔处理：设置或回收的伏笔
   - 节奏把控：本章在整体节奏中的作用

2. 确保以下要素：
   - 与前文节的自然衔接
   - 人物性格和行为的合理性
   - 情感线索持续发展
   - 伏笔的合理铺设和回收

3. 体现当前阶段特点：
   - 符合${storyPhase}阶段的特征
   - 推动相应的剧情发展
   - 突出阶段性的人物成长
   - 处理相应的情感转折

请按以下格式输出：
第${chapterNum}章：[核心事件名称]
- 剧情发展：[详细内容]
- 人物刻画：[重点人物的行动和心理]
- 情感推进：[情感线索的发展]
- 伏笔处理：[设置/回收的伏笔]
- 节奏把控：[本章在整体节奏中的作用]`;

            // 生成本章大纲
            let chapterOutline = await callDeepseekAPI([
                {
                    role: "system",
                    content: "你是一个专业的小说策划师，擅长设计章节大纲和把控故事节奏。"
                },
                {
                    role: "user",
                    content: chapterPrompt
                }
            ], 0.8, 2000);

            // 验证和格式化大纲内容
            chapterOutline = validateAndFormatContent(chapterOutline, 'chapter_outline');

            // 更新追踪信息
            const characterUpdates = extractCharacterDevelopment(chapterOutline);
            characterArcs = updateCharacterArcs(characterArcs, characterUpdates);

            const emotionalUpdates = extractEmotionalDevelopment(chapterOutline);
            emotionalArcs = updateEmotionalArcs(emotionalArcs, emotionalUpdates);

            const plotUpdates = extractPlotThreads(chapterOutline);
            plotThreads = updatePlotThreads(plotThreads, plotUpdates);

            // 生成本章总结
            const summaryPrompt = `
请总结第${chapterNum}章的发展：

章节内容：
${chapterOutline}

请总结以下方面：
1. 主要情节推进
2. 重要人物变化
3. 情感线索发展
4. 伏笔设置/回收情况
5. 为下一章做的铺垫

要求：
- 突出关键发展和转折
- 说明人物的重要变化
- 点明情感线索的推进
- 标注重要的伏笔
- 控制在200字以内`;

            previousSummary = await callDeepseekAPI([
                {
                    role: "system",
                    content: "你是一个专业的故事梳理专家，擅长提炼和总结故事发展脉络。"
                },
                {
                    role: "user",
                    content: summaryPrompt
                }
            ], 0.7, 1000);

            // 存储本章大纲
            outlines[chapterNum - 1] = chapterOutline;

            // 等待一小段时间，避免API调用过于频繁
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return outlines;
    } catch (error) {
        console.error('生成大纲时出错:', error);
        throw error;
    }
}

// 添加内容验证和格式化函数
function validateAndFormatContent(content, type) {
    if (!content || typeof content !== 'string') {
        throw new Error(`${type}内容无效`);
    }

    // 移除多余的空行和空格
    content = content.trim().replace(/\n{3,}/g, '\n\n');

    switch (type) {
        case 'chapter_outline':
            return validateAndFormatChapterOutline(content);
        case 'character_development':
            return validateAndFormatCharacterDevelopment(content);
        case 'emotional_development':
            return validateAndFormatEmotionalDevelopment(content);
        case 'plot_thread':
            return validateAndFormatPlotThread(content);
        default:
            return content;
    }
}

// 验证和格式化章节大纲
function validateAndFormatChapterOutline(content) {
    // 检查是否包含必要的部分
    const requiredSections = [
        '剧情发展：',
        '人物刻画：',
        '情感推进：',
        '伏笔处理：',
        '节奏把控：'
    ];

    const missingParts = requiredSections.filter(section => !content.includes(section));
    if (missingParts.length > 0) {
        // 如果少部分，动补充
        let formattedContent = content;
        missingParts.forEach(part => {
            if (!formattedContent.includes(part)) {
                formattedContent += `\n- ${part}待补充`;
            }
        });
        return formattedContent;
    }

    return content;
}

// 验证和格式化人物发展信息
function validateAndFormatCharacterDevelopment(content) {
    const lines = content.split('\n');
    const formattedLines = lines.map(line => {
        if (line.includes('：')) {
            return line;
        }
        // 如果行中包含人物名但没有格式化，添加格式
        const match = line.match(/^([^，。：]+)/);
        if (match) {
            return `${match[1]}：${line.slice(match[1].length)}`;
        }
        return line;
    });
    return formattedLines.join('\n');
}

// 验证和格式化情感发展信息
function validateAndFormatEmotionalDevelopment(content) {
    const lines = content.split('\n');
    const formattedLines = lines.map(line => {
        if (line.includes('：')) {
            return line;
        }
        // 如果行中包含关系描述但没有格式化，添加格式
        const match = line.match(/^([^，。：]+和[^，。：]+)/);
        if (match) {
            return `${match[1]}：${line.slice(match[1].length)}`;
        }
        return line;
    });
    return formattedLines.join('\n');
}

// 验证和格式化剧情线索
function validateAndFormatPlotThread(content) {
    const lines = content.split('\n');
    const formattedLines = lines.map(line => {
        if (line.includes('：')) {
            return line;
        }
        // 如果行中包含剧情描述但没有格式化，添加格式
        const match = line.match(/^([^，。：]+线索|[^，。：]+事件)/);
        if (match) {
            return `${match[1]}：${line.slice(match[1].length)}`;
        }
        return line;
    });
    return formattedLines.join('\n');
}

// 修改提取函数，添加验证和格式化
function extractCharacterDevelopment(content) {
    const characterInfo = new Map();
    try {
        // 格式化内容
        content = validateAndFormatContent(content, 'character_development');
        
        const regex = /人物刻画：([\s\S]*?)(?=\n-|$)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const development = match[1].trim();
            development.split(/[,，]/).forEach(item => {
                const parts = item.split('：').map(s => s.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    characterInfo.set(parts[0], parts[1]);
                } else if (parts.length === 1 && parts[0]) {
                    // 处理没有明确分隔的情况
                    const subMatch = parts[0].match(/^([^，。]+)([，。].*)/);
                    if (subMatch) {
                        characterInfo.set(subMatch[1].trim(), subMatch[2].trim());
                    }
                }
            });
        }
    } catch (error) {
        console.error('处理人物发展信息时出错:', error);
    }
    return characterInfo;
}

// 修改情感线索提取函数
function extractEmotionalDevelopment(content) {
    const emotionalInfo = new Map();
    try {
        // 格式化内容
        content = validateAndFormatContent(content, 'emotional_development');
        
        const regex = /情感推进：([\s\S]*?)(?=\n-|$)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const development = match[1].trim();
            development.split(/[,，]/).forEach(item => {
                const parts = item.split('：').map(s => s.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    emotionalInfo.set(parts[0], parts[1]);
                } else if (parts.length === 1 && parts[0]) {
                    // 处理没有明确分隔的情况
                    const subMatch = parts[0].match(/^([^，。]+)([，。].*)/);
                    if (subMatch) {
                        emotionalInfo.set(subMatch[1].trim(), subMatch[2].trim());
                    }
                }
            });
        }
    } catch (error) {
        console.error('处理情感发展信息时出错:', error);
    }
    return emotionalInfo;
}

// 修改剧情线索提取函数
function extractPlotThreads(content) {
    const plotInfo = new Map();
    try {
        // 格式化内容
        content = validateAndFormatContent(content, 'plot_thread');
        
        const regex = /剧情发展：([\s\S]*?)(?=\n-|$)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const development = match[1].trim();
            development.split(/[,，]/).forEach(item => {
                const parts = item.split('：').map(s => s.trim());
                if (parts.length === 2 && parts[0] && parts[1]) {
                    plotInfo.set(parts[0], parts[1]);
                } else if (parts.length === 1 && parts[0]) {
                    // 处理没有明确分隔的情况
                    const subMatch = parts[0].match(/^([^，。]+)([，。].*)/);
                    if (subMatch) {
                        plotInfo.set(subMatch[1].trim(), subMatch[2].trim());
                    }
                }
            });
        }
    } catch (error) {
        console.error('处理剧情线索时出错:', error);
    }
    return plotInfo;
}

// 修改更新函数，添加内容验证
function updateCharacterArcs(currentArcs, updates) {
    if (!(updates instanceof Map)) {
        console.error('人物发展更新数据格式错误');
        return currentArcs;
    }
    
    updates.forEach((value, key) => {
        if (!key || !value) return;
        
        const current = currentArcs.get(key) || [];
        if (Array.isArray(current)) {
            // 验证新值不重复
            if (!current.includes(value)) {
                current.push(value);
            }
        } else {
            currentArcs.set(key, [current, value]);
        }
    });
    return currentArcs;
}

function updateEmotionalArcs(currentArcs, updates) {
    if (!(updates instanceof Map)) {
        console.error('情感发展更新数据格式错误');
        return currentArcs;
    }
    
    updates.forEach((value, key) => {
        if (!key || !value) return;
        
        const current = currentArcs.get(key) || [];
        if (Array.isArray(current)) {
            // 验证新值不重复
            if (!current.includes(value)) {
                current.push(value);
            }
        } else {
            currentArcs.set(key, [current, value]);
        }
    });
    return currentArcs;
}

function updatePlotThreads(currentThreads, updates) {
    if (!(updates instanceof Map)) {
        console.error('剧情线索更新数据格式错误');
        return currentThreads;
    }
    
    updates.forEach((value, key) => {
        if (!key || !value) return;
        
        const current = currentThreads.get(key) || [];
        if (Array.isArray(current)) {
            // 验证新值不重复
            if (!current.includes(value)) {
                current.push(value);
            }
        } else {
            currentThreads.set(key, [current, value]);
        }
    });
    return currentThreads;
}

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    const generateBtn = document.getElementById('generateBtn');
    const saveBtn = document.getElementById('saveBtn');
    const generateOutlinesBtn = document.getElementById('generateOutlinesBtn');
    const novelTitle = document.getElementById('novelTitle');
    const novelTheme = document.getElementById('novelTheme');
    const writingStyle = document.getElementById('writingStyle');
    const totalChapters = document.getElementById('totalChapters');
    const mainPlot = document.getElementById('mainPlot');
    const characterInfo = document.getElementById('characterInfo');
    const worldSetting = document.getElementById('worldSetting');
    const chapterLength = document.getElementById('chapterLength');
    const creativity = document.getElementById('creativity');
    const creativityValue = document.getElementById('creativityValue');
    const chapterOutlinesList = document.getElementById('chapterOutlinesList');
    const chapterList = document.getElementById('chapterList');
    const loading = document.querySelector('.loading');
    const progress = document.querySelector('.progress');
    const currentProgress = document.getElementById('currentProgress');
    const totalInfo = document.getElementById('totalInfo');
    const generatePlotBtn = document.getElementById('generatePlotBtn');
    const optimizePlotBtn = document.getElementById('optimizePlotBtn');
    const generateCharactersBtn = document.getElementById('generateCharactersBtn');
    const optimizeCharactersBtn = document.getElementById('optimizeCharactersBtn');
    const generateWorldBtn = document.getElementById('generateWorldBtn');
    const optimizeWorldBtn = document.getElementById('optimizeWorldBtn');

    let novelContent = [];
    let chapterOutlines = [];
    let generationStatus = new Map();
    
    // 更新创意度显示
    creativity.addEventListener('input', (e) => {
        creativityValue.textContent = e.target.value;
    });

    // 监听章节数变化，更新大纲输入框
    totalChapters.addEventListener('change', () => {
        updateOutlineInputs();
    });

    // 自动生成大纲按钮点击事件
    generateOutlinesBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!validateBasicInputs()) return;

        try {
            // 显示加载状态
            loading.style.display = 'block';
            setButtonLoading(generateOutlinesBtn, true);

            // 更新进度的函数
            const updateProgress = (message, percentage) => {
                currentProgress.textContent = message;
                progress.style.width = `${percentage}%`;
            };

            // 生成大纲
            const outlines = await generateChapterOutlines(
                novelTitle.value,
                novelTheme.value,
                mainPlot.value,
                characterInfo.value,
                worldSetting.value,
                parseInt(totalChapters.value),
                updateProgress
            );

            // 确保大纲列表已经创建
            if (chapterOutlinesList.children.length === 0) {
                updateOutlineInputs();
            }

            // 更���大纲输入框
            outlines.forEach((outline, index) => {
                const chapterNum = index + 1;
                const textarea = document.querySelector(`textarea[data-chapter="${chapterNum}"]`);
                if (textarea) {
                    // 格式化大纲内容
                    let formattedOutline = outline;
                    if (!formattedOutline.startsWith('第')) {
                        formattedOutline = `第${chapterNum}章：\n${formattedOutline}`;
                    }
                    textarea.value = formattedOutline;
                    
                    // 自动调整文本框高度
                    textarea.style.height = 'auto';
                    textarea.style.height = textarea.scrollHeight + 'px';
                } else {
                    console.error(`未找到章节 ${chapterNum} 的文本框`);
                }
            });

            // 完成提示
            updateProgress('大纲生成完成！', 100);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 滚动到大纲区域
            chapterOutlinesList.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('生成大纲时出错:', error);
            alert('生成大纲时发生错误：' + error.message);
        } finally {
            loading.style.display = 'none';
            setButtonLoading(generateOutlinesBtn, false);
        }
    });

    // API密钥相关元素
    const apiKeyInput = document.getElementById('apiKey');
    const verifyKeyBtn = document.getElementById('verifyKeyBtn');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const toggleApiKey = document.getElementById('toggleApiKey');

    // API密钥显示切换
    toggleApiKey.addEventListener('click', () => {
        const type = apiKeyInput.type;
        apiKeyInput.type = type === 'password' ? 'text' : 'password';
        toggleApiKey.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
    });

    // 生成剧情按钮点击事件
    generatePlotBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!novelTitle.value || !novelTheme.value) {
            alert('请先填写小说标题和类型！');
            return;
        }

        try {
            setButtonLoading(generatePlotBtn, true);
            const content = await generatePlot(novelTitle.value, novelTheme.value);
            mainPlot.value = content;
        } catch (error) {
            alert('生成剧情时发生错误：' + error.message);
        } finally {
            setButtonLoading(generatePlotBtn, false);
        }
    });

    // 生成人物设定按钮点击事件
    generateCharactersBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!validateBasicPlot()) return;

        try {
            setButtonLoading(generateCharactersBtn, true);
            const content = await generateCharacters(
                novelTitle.value,
                novelTheme.value,
                mainPlot.value
            );
            characterInfo.value = content;
        } catch (error) {
            alert('生成人物设定时发生错误：' + error.message);
        } finally {
            setButtonLoading(generateCharactersBtn, false);
        }
    });

    // 生成世界观设定按钮点击事件
    generateWorldBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!validateBasicPlot()) return;

        try {
            setButtonLoading(generateWorldBtn, true);
            const content = await generateWorld(
                novelTitle.value,
                novelTheme.value,
                mainPlot.value
            );
            worldSetting.value = content;
        } catch (error) {
            alert('生成世界观设定时发生错误：' + error.message);
        } finally {
            setButtonLoading(generateWorldBtn, false);
        }
    });

    // 优化剧情按钮点击事件
    optimizePlotBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!mainPlot.value.trim()) {
            alert('请先填写或生成主要剧情！');
            return;
        }

        try {
            setButtonLoading(optimizePlotBtn, true);
            const content = await optimizeContent(mainPlot.value, '剧情');
            mainPlot.value = content;
        } catch (error) {
            alert('优化剧情时发生错误：' + error.message);
        } finally {
            setButtonLoading(optimizePlotBtn, false);
        }
    });

    // 优化人物设定按钮点击事件
    optimizeCharactersBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!characterInfo.value.trim()) {
            alert('请先填写或生成人物设定！');
            return;
        }

        try {
            setButtonLoading(optimizeCharactersBtn, true);
            const content = await optimizeContent(characterInfo.value, '人物设定');
            characterInfo.value = content;
        } catch (error) {
            alert('优化人物设定时发生错误：' + error.message);
        } finally {
            setButtonLoading(optimizeCharactersBtn, false);
        }
    });

    // 优化世界观设定按钮点击事件
    optimizeWorldBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!worldSetting.value.trim()) {
            alert('请先填写或生成世界观设定！');
            return;
        }

        try {
            setButtonLoading(optimizeWorldBtn, true);
            const content = await optimizeContent(worldSetting.value, '世界观设定');
            worldSetting.value = content;
        } catch (error) {
            alert('优化世界观设定时发生错误：' + error.message);
        } finally {
            setButtonLoading(optimizeWorldBtn, false);
        }
    });

    // 生成小说按钮点击事件
    generateBtn.addEventListener('click', async () => {
        if (!validateApiKey()) return;
        if (!validateAllInputs()) return;

        try {
            loading.style.display = 'block';
            generateBtn.disabled = true;
            chapterList.innerHTML = '';
            novelContent = [];
            let totalWords = 0;

            const chapters = parseInt(totalChapters.value);
            await generateChaptersInBatches(chapters);

            saveBtn.disabled = false;
            totalInfo.textContent = `总字数：${calculateTotalWords()}`;
        } catch (error) {
            alert('生成小说时发生错误：' + error.message);
        } finally {
            loading.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    // 保存按钮点击事件
    saveBtn.addEventListener('click', () => {
        const fullContent = formatNovelForSaving();
        downloadNovel(fullContent);
    });

    // 工具函数
    function updateOutlineInputs() {
        const count = parseInt(totalChapters.value);
        chapterOutlinesList.innerHTML = '';
        chapterOutlines = [];

        for (let i = 1; i <= count; i++) {
            const outlineItem = createOutlineInput(i);
            chapterOutlinesList.appendChild(outlineItem);
        }
    }

    function createOutlineInput(chapterNum) {
        const div = document.createElement('div');
        div.className = 'chapter-outline-item';
        
        const header = document.createElement('div');
        header.className = 'chapter-outline-header';
        
        const title = document.createElement('div');
        title.className = 'chapter-outline-title';
        title.textContent = `第${chapterNum}章大纲`;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'chapter-outline-textarea';
        textarea.placeholder = `请输入第${chapterNum}章的具体情节安排\n建议包含：\n- 剧情发展\n- 人物刻画\n- 情感推进\n- 伏笔处理\n- 节奏把控`;
        textarea.dataset.chapter = chapterNum;
        
        // 添加自动调整高度
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        
        header.appendChild(title);
        div.appendChild(header);
        div.appendChild(textarea);
        
        return div;
    }

    async function generateChaptersInBatches(totalChapters) {
        const batchSize = 3;
        const batches = Math.ceil(totalChapters / batchSize);
        let completedChapters = 0;

        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const start = batchIndex * batchSize + 1;
            const end = Math.min(start + batchSize - 1, totalChapters);
            const batchPromises = [];

            for (let chapter = start; chapter <= end; chapter++) {
                batchPromises.push(generateChapterWithRetry(chapter, totalChapters));
            }

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach((result, index) => {
                if (result) {
                    const chapterNum = start + index;
                    novelContent[chapterNum - 1] = {
                        chapter: chapterNum,
                        content: result.content
                    };
                    displayChapter(chapterNum, result.content);
                    completedChapters++;
                }
            });

            updateProgress((completedChapters / totalChapters) * 100);
            currentProgress.textContent = `正在生成第 ${completedChapters} 章，共 ${totalChapters} 章`;
        }
    }

    async function generateChapterWithRetry(chapterNum, totalChapters, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const params = {
                    title: novelTitle.value,
                    theme: novelTheme.value,
                    writingStyle: writingStyle.value,
                    mainPlot: mainPlot.value,
                    characterInfo: characterInfo.value,
                    worldSetting: worldSetting.value,
                    chapterLength: parseInt(chapterLength.value),
                    creativity: parseInt(creativity.value),
                    currentChapter: chapterNum,
                    totalChapters: totalChapters,
                    chapterOutline: getChapterOutline(chapterNum),
                    previousSummary: getPreviousChaptersSummary(chapterNum)
                };

                const content = await generateChapter(params);
                
                // 验证返回的内容
                if (!content || !Array.isArray(content)) {
                    throw new Error('生成的内容格式无效');
                }

                // 验证每一话的内容
                for (const part of content) {
                    if (!validatePartContent(part)) {
                        throw new Error('生成的分话内容无效');
                    }
                }

                return { content };
            } catch (error) {
                console.error(`第${chapterNum}章生成尝试${attempt}失败:`, error);
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw new Error(`第${chapterNum}章生成失败（已重试${maxRetries}次）：${error.message}`);
                }
                
                // 指数退避等待
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
    }

    // 验证分话内容
    function validatePartContent(part) {
        // 检查必要的字段
        if (!part || typeof part !== 'object') return false;
        if (!('part' in part) || !('content' in part)) return false;
        
        // 检查内容是否为字符串且不为空
        if (typeof part.content !== 'string' || part.content.trim().length === 0) return false;
        
        // 检查内容长度（至少100个字符）
        if (part.content.length < 100) return false;
        
        // 检查是否包含基本的故事元素（对话、描写等）
        const hasDialogue = /[""].*?[""]/.test(part.content) || /".*?"/.test(part.content);
        const hasDescription = /[，。；！？]/.test(part.content);
        
        return hasDialogue || hasDescription;
    }

    function getChapterOutline(chapterNum) {
        const textarea = document.querySelector(`textarea[data-chapter="${chapterNum}"]`);
        return textarea ? textarea.value : '';
    }

    function getPreviousChaptersSummary(currentChapter) {
        if (currentChapter === 1) return '';
        
        return novelContent
            .slice(0, currentChapter - 1)
            .map((chapter, index) => `第${index + 1}章：${summarizeContent(chapter.content)}`)
            .join('\n\n');
    }

    function summarizeContent(content) {
        // 简单的内容摘要逻辑
        return content.slice(0, 200) + '...';
    }

    function validateBasicInputs() {
        if (!novelTitle.value) {
            alert('请输入小说标题！');
            return false;
        }
        if (!mainPlot.value) {
            alert('请输入主要剧情！');
            return false;
        }
        if (!characterInfo.value) {
            alert('请输入人物设定！');
            return false;
        }
        if (!worldSetting.value) {
            alert('请输入世界观设定！');
            return false;
        }
        return true;
    }

    function validateAllInputs() {
        if (!validateBasicInputs()) return false;
        
        const chapterCount = parseInt(totalChapters.value);
        if (!chapterCount || chapterCount < 1 || chapterCount > 50) {
            alert('章节数必须在1-50章之间！');
            return false;
        }
        
        const outlines = Array.from(document.querySelectorAll('.chapter-outline-textarea'));
        const emptyOutlines = outlines.filter(outline => !outline.value.trim());
        
        if (emptyOutlines.length > 0) {
            alert('请填写所有章节的大纲！');
            return false;
        }
        
        return true;
    }

    function formatNovelForSaving() {
        let content = `《${novelTitle.value}》\n\n`;
        
        // 添加基本信息
        content += `【基本信息】\n`;
        content += `类型：${novelTheme.value}\n`;
        content += `写作风格：${writingStyle.value}\n\n`;
        
        // 添加主要设定
        content += `【主要剧情】\n${mainPlot.value}\n\n`;
        content += `【人物设定】\n${characterInfo.value}\n\n`;
        content += `【世界观设定】\n${worldSetting.value}\n\n`;
        
        // 添加正文内容
        content += `【正文】\n\n`;
        
        // 处理每一章的内容
        novelContent.forEach(chapter => {
            if (chapter && chapter.content && Array.isArray(chapter.content)) {
                // 添加章节标题
                content += `第${chapter.chapter}章\n\n`;
                
                // 处理每一话的内容
                chapter.content.forEach(part => {
                    if (part && part.content) {
                        content += `第${part.part}话\n`;
                        content += `${part.content}\n\n`;
                        
                        // 可选：添加每话的总结
                        if (part.summary) {
                            content += `本话总结：${part.summary}\n\n`;
                        }
                    }
                });
                
                content += '\n'; // 章节之间添加额外空行
            }
        });
        
        return content;
    }

    function downloadNovel(content) {
        try {
            console.log('准备下载的内容:', content); // 调试日志
            
            if (!content || content.trim().length === 0) {
                throw new Error('没有可保存的内容');
            }
            
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${novelTitle.value || '小说'}_完整版.txt`;
            
            // 添加到文档中并触发点击
            document.body.appendChild(a);
            a.click();
            
            // 清理
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('下载完成'); // 调试日志
        } catch (error) {
            console.error('下载小说时出错:', error);
            alert('保存小说时出错：' + error.message);
        }
    }

    function calculateTotalWords() {
        let total = 0;
        novelContent.forEach(chapter => {
            if (chapter && chapter.content && Array.isArray(chapter.content)) {
                chapter.content.forEach(part => {
                    if (part && part.content) {
                        total += part.content.length;
                    }
                });
            }
        });
        return total;
    }

    function updateProgress(percentage) {
        progress.style.width = `${percentage}%`;
    }

    // 工具函数
    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    function validateBasicPlot() {
        if (!novelTitle.value || !novelTheme.value) {
            alert('请先填写小说标题和类型！');
            return false;
        }
        if (!mainPlot.value.trim()) {
            alert('请先填写或生成主要剧情！');
            return false;
        }
        return true;
    }

    // 修改validateApiKey函数
    function validateApiKey() {
        if (!isApiKeyVerified) {
            alert('请先验证API密钥！');
            return false;
        }
        return true;
    }

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'content-overlay';
    overlay.innerHTML = '<div class="content-overlay-message">请先验证API密钥</div>';
    document.body.appendChild(overlay);

    // 获取主内容区域
    const mainContent = document.querySelector('main');
    mainContent.classList.add('main-content');

    // API密钥验证成功后的处理
    function handleApiKeySuccess() {
        isApiKeyVerified = true;
        apiKeyStatus.textContent = '验证成功！';
        apiKeyStatus.className = 'api-key-status success';
        apiKeyInput.disabled = true;
        verifyKeyBtn.style.display = 'none';
        
        // 移除遮罩层效果，激活主内容区域
        overlay.style.background = 'transparent';
        overlay.style.backdropFilter = 'none';
        mainContent.classList.add('active');
        
        // 保存API密钥到localStorage
        localStorage.setItem('deepseek_api_key', apiKeyInput.value);
    }

    // API密钥验证失败后的处理
    function handleApiKeyError() {
        isApiKeyVerified = false;
        apiKeyStatus.textContent = 'API密钥无效！';
        apiKeyStatus.className = 'api-key-status error';
        apiKeyInput.value = '';
        
        // 显示遮罩层，禁用主内容区域
        overlay.style.background = 'rgba(0, 0, 0, 0.8)';
        overlay.style.backdropFilter = 'blur(5px)';
        mainContent.classList.remove('active');
    }

    // API密钥验证按钮点击事件
    verifyKeyBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('请输入API密钥');
            return;
        }

        try {
            verifyKeyBtn.disabled = true;
            verifyKeyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 验证中...';
            apiKeyStatus.textContent = '正在验证...';
            apiKeyStatus.className = 'api-key-status verifying';

            const isValid = await verifyApiKey(apiKey);

            if (isValid) {
                handleApiKeySuccess();
            } else {
                throw new Error('API密钥无效');
            }
        } catch (error) {
            handleApiKeyError();
        } finally {
            verifyKeyBtn.disabled = false;
            verifyKeyBtn.innerHTML = '<i class="fas fa-check"></i> 验证密钥';
        }
    });

    // 检查localStorage中是否有保存的API密钥
    const savedApiKey = localStorage.getItem('deepseek_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        verifyKeyBtn.click(); // 自动验证保存的密钥
    }

    // 初始化
    updateOutlineInputs();

    // 章节数输入控制
    const numberUp = document.querySelector('.number-up');
    const numberDown = document.querySelector('.number-down');
    const quickSelectButtons = document.querySelectorAll('.quick-select button');

    // 快速选择按钮点击��件
    quickSelectButtons.forEach(button => {
        button.addEventListener('click', () => {
            const value = parseInt(button.dataset.value);
            totalChapters.value = value;
            totalChapters.dispatchEvent(new Event('change'));
            
            // 更新按钮状态
            quickSelectButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // 手动输入时更新按钮状态
    totalChapters.addEventListener('input', () => {
        let value = parseInt(totalChapters.value) || 0;
        if (value < 1) {
            totalChapters.value = 1;
        } else if (value > 200) {
            totalChapters.value = 200;
        }
        
        // 更新快速选择按钮状态
        quickSelectButtons.forEach(btn => {
            if (parseInt(btn.dataset.value) === parseInt(totalChapters.value)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    });

    numberUp.addEventListener('click', () => {
        const currentValue = parseInt(totalChapters.value) || 0;
        if (currentValue < 200) {
            totalChapters.value = currentValue + 1;
            totalChapters.dispatchEvent(new Event('change'));
        }
    });

    numberDown.addEventListener('click', () => {
        const currentValue = parseInt(totalChapters.value) || 0;
        if (currentValue > 1) {
            totalChapters.value = currentValue - 1;
            totalChapters.dispatchEvent(new Event('change'));
        }
    });
}); 