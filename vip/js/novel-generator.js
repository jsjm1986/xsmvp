class NovelGenerator {
    constructor() {
        this.currentChapter = 0;
        this.currentSection = 0;
        this.generatedContent = new Map(); // 存储已生成的内容
        this.isGenerating = false;
        this.apiConfig = null;
    }

    // 初始化生成器
    async initialize() {
        // 检查 API 配置
        const savedConfig = localStorage.getItem('ai_config');
        if (!savedConfig) {
            throw new Error('请先完成 API 配置验证');
        }
        this.apiConfig = JSON.parse(savedConfig);

        // 获取所有章节的子章节内容
        const subOutlines = Array.from(document.querySelectorAll('.sub-outline')).map(sub => ({
            title: sub.querySelector('h4').textContent.trim(),
            characters: sub.querySelector('.info-item:nth-child(1) .value').textContent.trim(),
            mainEvent: sub.querySelector('.info-item:nth-child(2) .value').textContent.trim(),
            content: sub.querySelector('.sub-outline-text').textContent.trim()
        }));

        this.totalSections = subOutlines.length;
        this.subOutlines = subOutlines;
        return this.totalSections > 0;
    }

    // 生成进度条
    createProgressBar() {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
            <div class="progress">
                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
            </div>
            <div class="progress-text">准备生成小说内容...</div>
        `;
        
        const outputSection = document.querySelector('.output-section');
        if (outputSection) {
            outputSection.insertBefore(progressContainer, outputSection.firstChild);
        }
        return progressContainer;
    }

    // 更新进度条
    updateProgress(current, total, message) {
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            const progressBar = progressContainer.querySelector('.progress-bar');
            const progressText = progressContainer.querySelector('.progress-text');
            
            if (progressBar) {
                const percentage = Math.round((current / total) * 100);
                progressBar.style.width = `${percentage}%`;
            }
            if (progressText) {
                progressText.textContent = message || `正在生成第 ${current} 节，共 ${total} 节`;
            }
        }
    }

    // 处理生成的内容
    processGeneratedContent(content) {
        // 只做基本的清理，不做额外验证
        return content.trim()
            .replace(/\n{3,}/g, '\n\n')  // 将连续3个以上的换行替换为2个
            .replace(/^[\s\n]+|[\s\n]+$/g, ''); // 清理开头和结尾的空白
    }

    // 验证内容
    validateContent(content) {
        // 检查内容是否存在
        if (!content) {
            console.warn('内容为空');
            return false;
        }

        // 检查段落结构
        const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
        if (paragraphs.length < 5) {  // 降低段落数量要求
            console.warn('段落数量不足:', paragraphs.length);
            return false;
        }

        // 检查是否包含基本的标点符号
        const punctuation = ['。', '，', '"', '"', '！', '？'];
        const hasPunctuation = punctuation.some(p => content.includes(p));
        if (!hasPunctuation) {
            console.warn('缺少基本标点符号');
            return false;
        }
        
        return true;
    }

    // 生成单个小节的内容
    async generateSection(sectionIndex) {
        if (!this.apiConfig) {
            throw new Error('API 配置未初始化');
        }

        const section = this.subOutlines[sectionIndex];
        if (!section) {
            throw new Error(`找不到第${sectionIndex + 1}节的大纲内容`);
        }

        // 获取上一节的内容（如果存在）
        const prevSection = sectionIndex > 0 ? this.subOutlines[sectionIndex - 1] : null;
        const prevContent = prevSection ? this.generatedContent.get(sectionIndex - 1) : null;

        // 获取下一节的大纲（如果存在）
        const nextSection = sectionIndex < this.subOutlines.length - 1 ? this.subOutlines[sectionIndex + 1] : null;

        const prompt = `作为一个专业的小说创作者，请根据以下信息创作一个精彩的小说章节。这是第${sectionIndex + 1}个小节，共${this.totalSections}个小节。

背景信息：
标题：${section.title}
主要人物：${section.characters}
核心事件：${section.mainEvent}
大纲内容：${section.content}

${prevSection ? `上一节信息：
标题：${prevSection.title}
主要人物：${prevSection.characters}
核心事件：${prevSection.mainEvent}
内容概要：${prevContent ? prevContent.substring(0, 200) + '...' : prevSection.content}

` : ''}${nextSection ? `下一节信息：
标题：${nextSection.title}
主要人物：${nextSection.characters}
核心事件：${nextSection.mainEvent}
大纲内容：${nextSection.content}

` : ''}写作要求：
1. 内容连贯性：
   - 与上一节的情节自然衔接
   - 为下一节做好铺垫
   - 保持人物性格和行为的一致性
   - 维持故事节奏的流畅性

2. 场景描写：
   - 运用丰富的感官描写
   - 营造鲜明的场景氛围
   - 突出环境与情节的呼应
   - 渲染故事的情感基调

3. 人物刻画：
   - 生动的对话与互动
   - 细致的动作与表情
   - 深入的心理活动
   - 前后一致的性格特征

4. 写作风格：
   - 语言流畅自然
   - 情节紧凑有序
   - 细节真实生动
   - 感情充沛饱满

5. 写作要求：
   - 根据当前篇章合理使用对话，对话要符合人物性格和身份
   - 根据当前篇章合理使用动作描写，动作描写要符合人物性格和身份
   - 根据当前篇章合理使用心理描写，心理描写要符合人物性格和身份
   - 根据当前篇章合理使用环境描写，环境描写要符合人物性格和身份
   - 根据当前篇章合理多写文字，尽量保持5000字-7000字左右

请直接输出小说内容，不需要其他说明。注意：
1. 确保与上一节的情节和人物表现保持连贯
2. 为下一节的发展做好铺垫
3. 保持人物性格和行为的一致性
4. 维持整体故事的节奏感`;

        try {
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                const response = await this.callAI(prompt);
                const processedContent = this.processGeneratedContent(response);
                
                if (this.validateContent(processedContent)) {
                    // 存储生成的内容
                    this.generatedContent.set(sectionIndex, processedContent);
                    // 更新总字数
                    this.updateTotalWordCount();
                    return processedContent;
                }
                
                console.warn(`第${retryCount + 1}次生成的内容不符合要求，准备重试...`);
                retryCount++;
                
                // 最后一次尝试时增加提醒
                if (retryCount === maxRetries - 1) {
                    prompt += '\n\n特别提醒：请确保生成的内容至少达到4000字。';
                }
                
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
            
            throw new Error('多次尝试后仍未生成符合要求的内容');
        } catch (error) {
            console.error(`生成第${sectionIndex + 1}节内容失败:`, error);
            throw error;
        }
    }

    // 调用AI接口
    async callAI(prompt) {
        if (!this.apiConfig) {
            throw new Error('API 配置未初始化');
        }

        // 构建 API 请求体
        const requestBody = {
            model: this.apiConfig.model || "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: "你是一个专业的小说创作者。请直接输出小说内容，不需要任何额外的说明。"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 8000,  // 确保不超过最大限制
            presence_penalty: 0,
            frequency_penalty: 0,
            top_p: 0.95,
            stream: false
        };

        try {
            console.log('正在调用 API:', this.apiConfig.baseUrl + '/chat/completions');
            const response = await fetch(this.apiConfig.baseUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`
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
                throw new Error(`API调用失败: ${errorText}`);
            }

            const data = await response.json();
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('API响应格式错误:', data);
                throw new Error('API响应格式错误');
            }
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }

    // 更新总字数显示
    updateTotalWordCount() {
        let totalWords = 0;
        this.generatedContent.forEach(content => {
            totalWords += content.replace(/\s+/g, '').length;
        });
        
        const totalInfoElement = document.getElementById('totalInfo');
        if (totalInfoElement) {
            totalInfoElement.textContent = `总字数：${totalWords}`;
        }
        return totalWords;
    }

    // 开始生成小说
    async startGeneration() {
        if (this.isGenerating) return;
        
        try {
            this.isGenerating = true;
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('没有找到可生成的章节内容');
            }

            // 创建进度条
            const progressContainer = this.createProgressBar();
            progressContainer.style.display = 'block';

            // 创建小说内容显示区域
            let novelContent = document.getElementById('novelContent');
            if (!novelContent) {
                novelContent = document.createElement('div');
                novelContent.id = 'novelContent';
                novelContent.className = 'novel-content';
                document.querySelector('.output-section').appendChild(novelContent);
            }

            // 清空现有内容
            novelContent.innerHTML = '';
            this.generatedContent.clear(); // 清空已存储的内容

            // 逐节生成内容
            for (let i = 0; i < this.totalSections; i++) {
                this.updateProgress(i + 1, this.totalSections, `正在生成第 ${i + 1} 节，共 ${this.totalSections} 节`);
                
                try {
                    const sectionContent = await this.generateSection(i);
                    
                    // 创建章节显示元素
                    const sectionElement = document.createElement('div');
                    sectionElement.className = 'chapter-section';
                    sectionElement.innerHTML = `
                        <h3>${this.subOutlines[i].title}</h3>
                        <div class="section-content">${sectionContent.replace(/\n/g, '<br>')}</div>
                    `;
                    
                    novelContent.appendChild(sectionElement);
                    
                    // 存储生成的内容
                    this.generatedContent.set(i, sectionContent);
                    
                    // 更新总字数
                    this.updateTotalWordCount();
                    
                    // 滚动到新内容
                    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    
                } catch (error) {
                    console.error(`生成第 ${i + 1} 节失败:`, error);
                    throw error;
                }
                
                // 添加延迟，避免API调用过于频繁
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // 完成后隐藏进度条
            progressContainer.style.display = 'none';
            
            // 启用保存按钮
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) saveBtn.disabled = false;
            
        } catch (error) {
            console.error('生成小说失败:', error);
            if (error.message.includes('API 配置')) {
                alert('请先完成 API 配置验证');
            } else {
                alert('生成小说失败: ' + error.message);
            }
        } finally {
            this.isGenerating = false;
            // 恢复生成按钮状态
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic"></i> 一键生成小说';
            }
        }
    }

    // 添加保存方法
    async saveNovel() {
        try {
            // 获取小说标题
            const novelTitle = document.getElementById('novelTitle')?.value || '未命名小说';
            
            // 获取基本信息
            const theme = document.getElementById('novelTheme')?.value || '';
            const mainPlot = document.getElementById('mainPlot')?.value || '';
            const characterInfo = document.getElementById('characterInfo')?.value || '';
            const worldSetting = document.getElementById('worldSetting')?.value || '';
            
            // 构建完整内容
            let fullContent = `《${novelTitle}》\n\n`;
            
            // 添加基本信息
            fullContent += `【基本信息】\n`;
            fullContent += `类型：${theme}\n`;
            fullContent += `主要剧情：${mainPlot}\n`;
            fullContent += `主要人物：${characterInfo}\n`;
            fullContent += `世界观设定：${worldSetting}\n\n`;
            
            // 获取大纲内容
            const outlinesList = document.getElementById('chapterOutlinesList');
            if (outlinesList) {
                fullContent += `【章节大纲】\n\n`;
                const outlines = outlinesList.getElementsByClassName('chapter-outline');
                for (const outline of outlines) {
                    const title = outline.querySelector('.outline-header h3')?.textContent || '';
                    const characters = outline.querySelector('.info-item:nth-child(1) .text')?.textContent || '';
                    const mainEvent = outline.querySelector('.info-item:nth-child(2) .text')?.textContent || '';
                    const content = outline.querySelector('.info-item:nth-child(3) .text')?.textContent || '';
                    
                    fullContent += `${title}\n`;
                    fullContent += `主要人物：${characters}\n`;
                    fullContent += `核心事件：${mainEvent}\n`;
                    fullContent += `详细内容：${content}\n\n`;

                    // 检查是否有拆分的子章节
                    const subOutlines = outline.querySelectorAll('.sub-outline');
                    if (subOutlines && subOutlines.length > 0) {
                        fullContent += `【子章节】\n`;
                        subOutlines.forEach((subOutline, index) => {
                            const subTitle = subOutline.querySelector('h4')?.textContent || '';
                            const subCharacters = subOutline.querySelector('.info-item:nth-child(1) .value')?.textContent || '';
                            const subMainEvent = subOutline.querySelector('.info-item:nth-child(2) .value')?.textContent || '';
                            const subContent = subOutline.querySelector('.sub-outline-text')?.textContent || '';

                            fullContent += `${subTitle}\n`;
                            fullContent += `子章节人物：${subCharacters}\n`;
                            fullContent += `子章节事件：${subMainEvent}\n`;
                            fullContent += `子章节内容：${subContent}\n\n`;
                        });
                        fullContent += `\n`;
                    }
                }
            }
            
            // 获取生成的小说内容
            const novelContent = document.getElementById('novelContent');
            if (novelContent) {
                fullContent += `【小说正文】\n\n`;
                const sections = novelContent.getElementsByClassName('chapter-section');
                let hasContent = false;
                
                for (const section of sections) {
                    const title = section.querySelector('h3')?.textContent || '';
                    const content = section.querySelector('.section-content')?.textContent || '';
                    
                    if (content.trim()) {
                        fullContent += `${title}\n\n${content.trim()}\n\n`;
                        hasContent = true;
                    }

                    // 检查是否有生成的子章节内容
                    const subSections = section.getElementsByClassName('sub-section');
                    if (subSections && subSections.length > 0) {
                        for (const subSection of subSections) {
                            const subTitle = subSection.querySelector('h4')?.textContent || '';
                            const subContent = subSection.querySelector('.sub-content')?.textContent || '';
                            
                            if (subContent.trim()) {
                                fullContent += `${subTitle}\n\n${subContent.trim()}\n\n`;
                                hasContent = true;
                            }
                        }
                    }
                }
                
                if (!hasContent) {
                    throw new Error('没有可保存的内容');
                }
            } else {
                throw new Error('没有可保存的内容');
            }
            
            // 添加总字数统计
            const totalWords = this.updateTotalWordCount();
            fullContent += `\n【统计信息】\n总字数：${totalWords}字`;
            
            // 创建并下载文件
            const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = `${novelTitle}.txt`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadLink.href);
            
            return true;
        } catch (error) {
            console.error('保存小说失败:', error);
            alert('保存失败：' + error.message);
            return false;
        }
    }

    // 拆分章节
    async splitChapter(chapterContent, chapterNum, targetCount) {
        try {
            const splitter = new ChapterSplitter();
            const subChapters = await splitter.initializeSplit(chapterContent, chapterNum, targetCount);
            
            // 获取或创建子章节容器
            let subChaptersContainer = document.querySelector('.sub-chapters-container');
            if (!subChaptersContainer) {
                subChaptersContainer = document.createElement('div');
                subChaptersContainer.className = 'sub-chapters-container';
                const outputSection = document.querySelector('.output-section');
                if (!outputSection) {
                    throw new Error('找不到输出区域');
                }
                outputSection.appendChild(subChaptersContainer);
            }
            
            // 清空现有内容
            subChaptersContainer.innerHTML = '';
            
            // 创建子章节列表容器
            const subChaptersList = document.createElement('div');
            subChaptersList.className = 'sub-chapters-list';
            
            // 添加每个子章节
            subChapters.forEach(subChapter => {
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
                
                subChaptersList.appendChild(subOutlineElement);
            });
            
            // 将列表添加到容器中
            subChaptersContainer.appendChild(subChaptersList);
            
            return subChapters;
        } catch (error) {
            console.error('拆分章节时出错:', error);
            throw error;
        }
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
}

// 初始化生成器
document.addEventListener('DOMContentLoaded', () => {
    // 创建全局实例
    window.novelGenerator = new NovelGenerator();
    console.log('NovelGenerator 已初始化');  // 添加日志
    
    // 绑定生成按钮事件
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.onclick = async () => {
            if (!localStorage.getItem('ai_config')) {
                alert('请先完成 API 配置验证');
                return;
            }
            
            try {
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
                
                await window.novelGenerator.startGeneration();
                
            } catch (error) {
                console.error('生成小说失败:', error);
                alert('生成失败: ' + error.message);
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic"></i> 一键生成小说';
            }
        };
    }

    // 绑定保存按钮事件
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                
                await window.novelGenerator.saveNovel();
                
            } catch (error) {
                console.error('保存失败:', error);
                alert('保存失败，请重试');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部';
            }
        };
    }
}); 