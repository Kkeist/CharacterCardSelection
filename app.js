// 🎴 抽卡程序主逻辑 - 深度角色问卷

class CardDrawApp {
  constructor() {
    this.currentCategory = null;
    this.currentQuestion = null; // { categoryName, categoryEmoji, question, hint }
    this.isFlipped = false;
    this.allQuestions = [];
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.buildAllQuestions();
    this.renderCategories();
    this.renderAllQuestionsPreview();
    this.bindEvents();
  }

  cacheElements() {
    this.mainPage = document.getElementById('main-page');
    this.drawPage = document.getElementById('draw-page');
    this.fullPage = document.getElementById('full-page');
    this.categoriesGrid = document.getElementById('categories-grid');
    this.categoryTitle = document.getElementById('category-title');
    this.card = document.getElementById('card');
    this.questionTitle = document.getElementById('question-title');
    this.questionHintBox = document.getElementById('question-hint-box');
    this.hintText = document.getElementById('hint-text');
    this.cardSource = document.getElementById('card-source');
    this.backBtn = document.getElementById('back-btn');
    this.fullBackBtn = document.getElementById('full-back-btn');
    this.redrawBtn = document.getElementById('redraw-btn');
    this.answerBtn = document.getElementById('answer-btn');
    this.randomAllBtn = document.getElementById('random-all-btn');
    this.allQuestionsContent = document.getElementById('all-questions-content');
    this.copyAllBtn = document.getElementById('copy-all-btn');
    this.toast = document.getElementById('toast');
  }

  buildAllQuestions() {
    this.allQuestions = [];
    QUESTIONS_DATA.categories.forEach(cat => {
      cat.questions.forEach(q => {
        const item = typeof q === 'string' ? { question: q, hint: '' } : q;
        this.allQuestions.push({
          category: cat.name,
          emoji: cat.emoji,
          question: item.question,
          hint: item.hint || ''
        });
      });
    });
  }

  renderCategories() {
    const catsHtml = QUESTIONS_DATA.categories.map(cat => `
      <button type="button" class="category-card" data-category-id="${cat.id}">
        <span class="category-emoji">${cat.emoji}</span>
        <span class="category-name">${cat.name}</span>
        <span class="category-count">${cat.questions.length} 个问题</span>
      </button>
    `).join('');

    // 最后一个格子：完整问卷
    const fullCardHtml = `
      <button type="button" class="category-card full-card" id="open-full-btn">
        <span class="category-emoji">📖</span>
        <span class="category-name">完整问卷</span>
        <span class="category-count">查看与复制</span>
      </button>
    `;

    this.categoriesGrid.innerHTML = catsHtml + fullCardHtml;
  }

  renderAllQuestionsPreview() {
    if (!this.allQuestionsContent) return;

    const html = QUESTIONS_DATA.categories.map(cat => {
      const qListHtml = cat.questions.map((q, idx) => {
        const questionText = typeof q === 'object' ? q.question : q;
        const hintText = (typeof q === 'object' && q.hint) ? q.hint : '';
        return `
          <div class="all-q-item">
            <div class="all-q-question">${idx + 1}. ${questionText}</div>
            ${hintText ? `<div class="all-q-hint">💡 提示：${hintText}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="all-cat-block">
          <div class="all-cat-title">${cat.emoji} ${cat.name} (${cat.questions.length})</div>
          <div class="all-q-list">
            ${qListHtml}
          </div>
        </div>
      `;
    }).join('');

    this.allQuestionsContent.innerHTML = html;
  }

  bindEvents() {
    // 分类网格点击代理（包含普通分类和最后一个完整问卷格子）
    this.categoriesGrid.addEventListener('click', (e) => {
      const fullBtn = e.target.closest('#open-full-btn');
      if (fullBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.openFullPage();
        return;
      }

      const card = e.target.closest('.category-card');
      if (card && card.dataset.categoryId) {
        e.preventDefault();
        e.stopPropagation();
        const categoryId = card.dataset.categoryId;
        this.openCategory(categoryId);
      }
    });

    // 随机全部按钮
    this.randomAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.openRandomAll();
    });

    // 完整问卷页面：复制全部按钮
    if (this.copyAllBtn) {
      this.copyAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyAllQuestions();
      });
    }

    // 完整问卷页面：返回按钮
    if (this.fullBackBtn) {
      this.fullBackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.goBackFromFullPage();
      });
    }

    // 抽卡页面：返回按钮
    this.backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.goBack();
    });

    // 抽卡页面：卡片点击翻转
    this.card.addEventListener('click', (e) => {
      e.preventDefault();
      if (!this.isFlipped) {
        this.flipCard();
      }
    });

    // 重新抽取
    this.redrawBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.drawNewCard();
    });

    // 复制当前问题
    this.answerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.copyQuestion();
    });

    // 键盘支持
    document.addEventListener('keydown', (e) => {
      if (this.drawPage.classList.contains('active')) {
        if (e.key === 'Escape') {
          this.goBack();
        } else if (e.key === ' ' || e.key === 'Enter') {
          if (!this.isFlipped) {
            this.flipCard();
          } else {
            this.drawNewCard();
          }
        }
      } else if (this.fullPage && this.fullPage.classList.contains('active')) {
        if (e.key === 'Escape') {
          this.goBackFromFullPage();
        }
      }
    });
  }

  openCategory(categoryId) {
    this.currentCategory = QUESTIONS_DATA.categories.find(c => c.id === categoryId);
    if (!this.currentCategory) return;

    this.categoryTitle.textContent = `${this.currentCategory.emoji} ${this.currentCategory.name}`;
    this.switchToDrawPage();
    this.drawNewCard();
  }

  openRandomAll() {
    this.currentCategory = {
      id: 'all',
      name: '全部问题',
      emoji: '🎲',
      questions: this.allQuestions
    };
    this.categoryTitle.textContent = '🎲 随机全部问题';
    this.switchToDrawPage();
    this.drawNewCard();
  }

  openFullPage() {
    this.mainPage.classList.remove('active');
    if (this.drawPage) this.drawPage.classList.remove('active');
    this.fullPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBackFromFullPage() {
    this.fullPage.classList.remove('active');
    this.mainPage.classList.add('active');
  }

  switchToDrawPage() {
    this.mainPage.classList.remove('active');
    if (this.fullPage) this.fullPage.classList.remove('active');
    this.drawPage.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    this.drawPage.classList.remove('active');
    this.mainPage.classList.add('active');
    this.resetCard();
  }

  drawNewCard() {
    this.resetCard();
    
    const questions = this.currentCategory.questions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    const selected = questions[randomIndex];

    let categoryName = '';
    let categoryEmoji = '';
    let questionText = '';
    let hintText = '';

    if (this.currentCategory.id === 'all') {
      categoryName = selected.category;
      categoryEmoji = selected.emoji;
      questionText = typeof selected === 'object' ? selected.question : selected;
      hintText = (typeof selected === 'object' && selected.hint) ? selected.hint : '';
    } else {
      categoryName = this.currentCategory.name;
      categoryEmoji = this.currentCategory.emoji;
      if (typeof selected === 'object') {
        questionText = selected.question;
        hintText = selected.hint || '';
      } else {
        questionText = selected;
        hintText = '';
      }
    }

    this.currentQuestion = {
      categoryName,
      categoryEmoji,
      question: questionText,
      hint: hintText
    };

    // 填充核心基础问题
    if (this.questionTitle) {
      this.questionTitle.textContent = questionText;
    }

    // 填充提示
    if (this.questionHintBox && this.hintText) {
      if (hintText && hintText.trim()) {
        this.questionHintBox.style.display = 'block';
        this.hintText.textContent = hintText;
      } else {
        this.questionHintBox.style.display = 'none';
      }
    }

    // 底部轻度来源信息（仅在随机全部时显示所属分类，普通分类时不显示）
    if (this.cardSource) {
      if (this.currentCategory.id === 'all') {
        this.cardSource.textContent = `所属分类 · ${categoryEmoji} ${categoryName}`;
      } else {
        this.cardSource.textContent = '';
      }
    }

    // 抽卡轻微动画
    this.card.classList.add('drawing');
    setTimeout(() => {
      this.card.classList.remove('drawing');
    }, 500);
  }

  flipCard() {
    this.isFlipped = true;
    this.card.classList.add('flipped');
  }

  resetCard() {
    this.isFlipped = false;
    this.card.classList.remove('flipped');
  }

  async copyQuestion() {
    if (!this.currentQuestion) return;

    let textToCopy = '';
    if (this.currentCategory.id === 'all') {
      textToCopy += `【${this.currentQuestion.categoryEmoji} ${this.currentQuestion.categoryName}】\n`;
    }
    textToCopy += `问题：${this.currentQuestion.question}`;
    if (this.currentQuestion.hint) {
      textToCopy += `\n提示：${this.currentQuestion.hint}`;
    }

    await this.copyText(textToCopy, '已复制当前问题到剪贴板');
  }

  async copyAllQuestions() {
    let fullText = `# 深度角色问卷\n\n`;
    fullText += `这是一个也许能让你更加深刻探索了解自己，或者深度塑造角色的问卷。\n`;
    fullText += `你可以在其中抽取问题并回答填写，祝你的深度理解之旅顺利！\n\n`;
    fullText += `（全文纯手打，但是因为没有人称可能看起来累累的，请见谅；-；。。）\n\n`;
    fullText += `==============================\n\n`;

    QUESTIONS_DATA.categories.forEach((cat) => {
      fullText += `【${cat.emoji} ${cat.name}】\n`;
      cat.questions.forEach((q, idx) => {
        const questionText = typeof q === 'object' ? q.question : q;
        const hintText = (typeof q === 'object' && q.hint) ? q.hint : '';
        fullText += `${idx + 1}. ${questionText}\n`;
        if (hintText) {
          fullText += `   💡 提示：${hintText}\n`;
        }
      });
      fullText += `\n`;
    });

    await this.copyText(fullText, '已复制全部问卷到剪贴板！');
  }

  async copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(successMessage);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast(successMessage);
    }
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  new CardDrawApp();
});
