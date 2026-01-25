// 🎴 抽卡程序主逻辑

class CardDrawApp {
  constructor() {
    this.currentCategory = null;
    this.currentQuestion = null;
    this.isFlipped = false;
    this.allQuestions = [];
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.buildAllQuestions();
    this.renderCategories();
    this.bindEvents();
  }

  cacheElements() {
    this.mainPage = document.getElementById('main-page');
    this.drawPage = document.getElementById('draw-page');
    this.categoriesGrid = document.getElementById('categories-grid');
    this.categoryTitle = document.getElementById('category-title');
    this.card = document.getElementById('card');
    this.questionText = document.getElementById('question-text');
    this.backBtn = document.getElementById('back-btn');
    this.redrawBtn = document.getElementById('redraw-btn');
    this.answerBtn = document.getElementById('answer-btn');
    this.randomAllBtn = document.getElementById('random-all-btn');
    this.toast = document.getElementById('toast');
  }

  buildAllQuestions() {
    // 构建所有问题的扁平数组，用于随机全部
    QUESTIONS_DATA.categories.forEach(cat => {
      cat.questions.forEach(q => {
        this.allQuestions.push({
          category: cat.name,
          emoji: cat.emoji,
          question: q
        });
      });
    });
  }

  renderCategories() {
    const html = QUESTIONS_DATA.categories.map(cat => `
      <button type="button" class="category-card" 
           data-category-id="${cat.id}" 
           style="--category-color: ${cat.color}">
        <span class="category-emoji">${cat.emoji}</span>
        <span class="category-name">${cat.name}</span>
        <span class="category-count">${cat.questions.length} 个问题</span>
      </button>
    `).join('');
    
    this.categoriesGrid.innerHTML = html;
  }

  bindEvents() {
    // 分类卡片点击 - 直接使用click，移动端也能正常工作
    this.categoriesGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.category-card');
      if (card) {
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

    // 返回按钮
    this.backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.goBack();
    });

    // 卡片点击翻转
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

    // 复制问题
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
        } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
          // 已经有默认复制行为
        }
      }
    });
  }

  openCategory(categoryId) {
    this.currentCategory = QUESTIONS_DATA.categories.find(c => c.id === categoryId);
    if (!this.currentCategory) return;

    this.categoryTitle.innerHTML = `${this.currentCategory.emoji} ${this.currentCategory.name}`;
    this.switchToDrawPage();
    this.drawNewCard();
  }

  openRandomAll() {
    this.currentCategory = {
      id: 'all',
      name: '随机全部',
      emoji: '🎲',
      questions: this.allQuestions.map(q => q.question)
    };
    this.categoryTitle.innerHTML = '🎲 随机全部问题';
    this.switchToDrawPage();
    this.drawNewCard();
  }

  switchToDrawPage() {
    this.mainPage.classList.remove('active');
    this.drawPage.classList.add('active');
  }

  goBack() {
    this.drawPage.classList.remove('active');
    this.mainPage.classList.add('active');
    this.resetCard();
  }

  drawNewCard() {
    // 重置卡片状态
    this.resetCard();
    
    // 随机选择问题
    const questions = this.currentCategory.questions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    this.currentQuestion = questions[randomIndex];

    // 如果是"随机全部"模式，获取分类信息
    if (this.currentCategory.id === 'all') {
      const fullQuestion = this.allQuestions.find(q => q.question === this.currentQuestion);
      if (fullQuestion) {
        this.questionText.textContent = `【${fullQuestion.emoji} ${fullQuestion.category}】\n\n${this.currentQuestion}`;
      } else {
        this.questionText.textContent = this.currentQuestion;
      }
    } else {
      this.questionText.textContent = this.currentQuestion;
    }

    // 播放抽卡动画
    this.card.classList.add('drawing');
    setTimeout(() => {
      this.card.classList.remove('drawing');
    }, 800);
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

    let textToCopy = this.currentQuestion;
    
    // 如果是随机全部模式，包含分类信息
    if (this.currentCategory.id === 'all') {
      const fullQuestion = this.allQuestions.find(q => q.question === this.currentQuestion);
      if (fullQuestion) {
        textToCopy = `【${fullQuestion.emoji} ${fullQuestion.category}】\n\n${this.currentQuestion}`;
      }
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      this.showToast('✅ 已复制到剪贴板！');
    } catch (err) {
      // 降级方案：创建临时textarea
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('✅ 已复制到剪贴板！');
    }
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2000);
  }
}

// 🚀 启动应用
document.addEventListener('DOMContentLoaded', () => {
  new CardDrawApp();
});
