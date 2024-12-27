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
        const prompt = `请将以下章节内容拆分成${targetCount}个完整的子章节。这些子章节应该是一个连续的、紧密相关的故事系列。

原始章节内容：
${this.originalChapter.content}

要求：
1. 将原始章节扩展为${targetCount}个完整的子章节
2. 每个子章节都必须包含：
   - 子章节标题
   - 主要人物
   - 核心事件
   - 详细内容
3. 所有子章节必须：
   - 保持情节的连续性和关联性
   - 共同推进原始章节的主要剧情
   - 包含合理的情节递进和转折
   - 展现人物的成长和变化
4. 每个子章节的详细内容必须包含：
   - 场景描写
   - 人物对话
   - 心理活动
   - 情节发展
   - 转折点

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
                    content: `你是一个专业的小说策划师，擅长进行章节拆分和剧情扩展。
当前正在将第${this.originalChapter.chapterNum}章拆分为${targetCount}个子章节。
请确保每个子章节都是一个完整的故事单元，同时与其他子章节紧密关联，共同构成一个连贯的剧情发展。`
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

    // 创建子章节元素
    createSubOutlineElement(subChapter) {
        const subOutlineElement = document.createElement('div');
        subOutlineElement.className = 'sub-outline';
        subOutlineElement.innerHTML = `
            <div class="sub-outline-header">
                <h4>第${subChapter.mainChapterNum}-${subChapter.subChapterNum}节：${subChapter.title}</h4>
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
        this.makeSubChapterEditable(subOutlineElement);
        
        return subOutlineElement;
    }

    // 添加子章节编辑功能
    makeSubChapterEditable(subOutline) {
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
            this.showSaveIndicator(subOutline);
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
    showSaveIndicator(subOutline) {
        const saveIndicator = document.createElement('div');
        saveIndicator.className = 'save-indicator';
        saveIndicator.innerHTML = '<i class="fas fa-check"></i> 已保存';
        subOutline.appendChild(saveIndicator);
        
        setTimeout(() => {
            saveIndicator.remove();
        }, 2000);
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

    // 显示子章节
    displaySubChapters(container) {
        // 清空容器
        container.innerHTML = '';
        
        // 创建子章节列表容器
        const subChaptersList = document.createElement('div');
        subChaptersList.className = 'sub-chapters-list';
        
        // 添加每个子章节
        this.subChapters.forEach(subChapter => {
            const subOutlineElement = this.createSubOutlineElement(subChapter);
            subChaptersList.appendChild(subOutlineElement);
        });
        
        // 将列表添加到容器中
        container.appendChild(subChaptersList);
    }
} 