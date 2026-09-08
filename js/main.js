(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const menuLabel = menuButton?.querySelector('.sr-only');
  const navList = document.querySelector('.nav-list');
  const navLinks = [...document.querySelectorAll('.nav-list a')];
  const themeButton = document.querySelector('.theme-toggle');
  const themeIcon = document.querySelector('.theme-icon');
  const year = document.querySelector('#current-year');
  const sections = [...document.querySelectorAll('main section[id]')];
  const sectionLinks = navLinks.filter((link) => link.getAttribute('href')?.startsWith('#'));

  const setMenu = (isOpen) => {
    if (!menuButton || !navList) return;
    menuButton.setAttribute('aria-expanded', String(isOpen));
    navList.classList.toggle('open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
    if (menuLabel) menuLabel.textContent = isOpen ? '메뉴 닫기' : '메뉴 열기';
  };

  menuButton?.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  navLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  const preferredTheme = localStorage.getItem('profile-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === 'dark';
    if (themeIcon) themeIcon.textContent = isDark ? '☀' : '☾';
    if (themeButton) themeButton.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
  };

  setTheme(preferredTheme);
  themeButton?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('profile-theme', nextTheme);
  });

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach((link) => {
        const isCurrent = link.getAttribute('href') === `#${entry.target.id}`;
        if (isCurrent) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-35% 0px -55%', threshold: 0 });

  if (sectionLinks.length) sections.forEach((section) => sectionObserver.observe(section));

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 12), { passive: true });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) setMenu(false);
  });

  if (year) year.textContent = new Date().getFullYear();

  // Blog post search and category filtering
  const searchInput = document.querySelector('#post-search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const postCards = [...document.querySelectorAll('.post-card')];
  const emptyState = document.querySelector('#empty-state');
  let activeFilter = 'all';

  const filterPosts = () => {
    const query = searchInput?.value.trim().toLocaleLowerCase('ko') || '';
    let visibleCount = 0;
    postCards.forEach((card) => {
      const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
      const matchesQuery = card.textContent.toLocaleLowerCase('ko').includes(query);
      card.hidden = !(matchesCategory && matchesQuery);
      if (!card.hidden) visibleCount += 1;
    });
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  };

  searchInput?.addEventListener('input', filterPosts);
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    filterPosts();
  }));

  // Prototype forms: validate in the browser and show completion feedback.
  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const message = form.querySelector('.form-message');
      if (message) message.textContent = '구독 신청이 완료되었습니다. 감사합니다!';
      form.reset();
    });
  });

  const AUTH_API_URL = 'https://script.google.com/macros/s/AKfycbwtiglFioGQ8MI2VExRYlS3PMBFtXHbVGGwZlI-Nn-gBdg0Q3o2jC0dTrFMRQ65Hdo5EA/exec';
  const TOKEN_KEY = 'haneul-auth-token';

  const authRequest = async (payload) => {
    const response = await fetch(AUTH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('인증 서버에 연결할 수 없습니다.');
    return response.json();
  };

  const getAuthToken = () => (
    sessionStorage.getItem(TOKEN_KEY)
    || localStorage.getItem(TOKEN_KEY)
  );

  const saveAuthToken = (token, remember) => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
  };

  document.querySelectorAll('[data-auth-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = form.querySelector('.form-message');
      const submitButton = form.querySelector('[type="submit"]');

      if (!form.checkValidity()) {
        form.reportValidity();
        if (message) message.textContent = '입력한 정보를 다시 확인해 주세요.';
        return;
      }

      const fields = new FormData(form);
      const isSignup = Boolean(form.querySelector('[name="name"]'));
      const remember = fields.get('remember') === 'on';
      const payload = {
        action: isSignup ? 'signup' : 'login',
        email: fields.get('email'),
        password: fields.get('password')
      };
      if (isSignup) payload.name = fields.get('name');
      else payload.remember = remember;

      if (submitButton) submitButton.disabled = true;
      if (message) message.textContent = '처리 중입니다...';

      try {
        const result = await authRequest(payload);
        if (!result.ok) throw new Error(result.message);

        if (message) message.textContent = result.message;
        if (isSignup) {
          window.setTimeout(() => {
            window.location.href = 'login.html?registered=1';
          }, 700);
        } else {
          saveAuthToken(result.token, remember);
          window.setTimeout(() => {
            window.location.href = 'index.html';
          }, 500);
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message || '요청 처리에 실패했습니다.';
        }
        if (submitButton) submitButton.disabled = false;
      }
    });
  });

  const registered = new URLSearchParams(window.location.search)
    .get('registered');
  if (registered === '1') {
    const loginMessage = document.querySelector(
      '.auth-form .form-message'
    );
    if (loginMessage) {
      loginMessage.textContent = '회원가입이 완료되었습니다. 로그인해 주세요.';
    }
  }

  const refreshAuthUI = async () => {
    const token = getAuthToken();
    const loginLink = document.querySelector('.login-link');
    if (!token || !loginLink) return;

    try {
      const result = await authRequest({ action: 'session', token });
      if (!result.ok) throw new Error(result.message);
      loginLink.textContent = result.user.name + '님';
      loginLink.href = 'profile.html';
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  refreshAuthUI();

  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? '숨기기' : '보기';
    });
  });

  const shareButton = document.querySelector('.share-button');
  shareButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      shareButton.textContent = '복사됨 ✓';
    } catch {
      shareButton.textContent = '주소창의 링크를 복사해 주세요';
    }
  });

  // Writing screen interactions
  const editorMain = document.querySelector('.editor-main');
  const editorTitle = document.querySelector('#editor-title');
  const editorContent = document.querySelector('#editor-content');
  const editorTags = document.querySelector('#editor-tags');
  const titleCount = document.querySelector('#title-count');
  const draftStatus = document.querySelector('.draft-status');
  const publishPanel = document.querySelector('.publish-panel');
  const preview = document.querySelector('.editor-preview');
  const editorPane = document.querySelector('.editor-pane');

  const updateTitle = () => {
    if (titleCount && editorTitle) titleCount.textContent = editorTitle.value.length;
  };
  editorTitle?.addEventListener('input', updateTitle);

  const setDraftMessage = (text) => {
    if (draftStatus) draftStatus.textContent = text;
  };
  document.querySelector('.save-draft')?.addEventListener('click', () => {
    localStorage.setItem('haneul-blog-draft', JSON.stringify({
      title: editorTitle?.value || '', content: editorContent?.value || '', tags: editorTags?.value || ''
    }));
    setDraftMessage('방금 저장됨');
  });

  if (editorTitle) {
    try {
      const draft = JSON.parse(localStorage.getItem('haneul-blog-draft'));
      if (draft) {
        editorTitle.value = draft.title || '';
        editorContent.value = draft.content || '';
        editorTags.value = draft.tags || '';
        setDraftMessage('임시저장 글');
        updateTitle();
      }
    } catch { localStorage.removeItem('haneul-blog-draft'); }
  }

  document.querySelectorAll('.editor-toolbar [data-format]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!editorContent) return;
      const marks = { h2: '## ', bold: '**굵은 글씨**', italic: '*기울임*', quote: '> ', list: '- ', link: '[링크 이름](https://)', image: '![이미지 설명](이미지 주소)' };
      const text = marks[button.dataset.format] || '';
      const start = editorContent.selectionStart;
      editorContent.setRangeText(text, start, editorContent.selectionEnd, 'end');
      editorContent.focus();
    });
  });

  document.querySelector('.preview-toggle')?.addEventListener('click', (event) => {
    const showing = !preview.hidden;
    preview.hidden = showing;
    editorPane.hidden = !showing;
    if (!showing) {
      preview.querySelector('h1').textContent = editorTitle.value || '제목을 입력하세요';
      preview.querySelector('.preview-body').textContent = editorContent.value || '내용을 입력하면 이곳에서 미리 볼 수 있습니다.';
    }
    event.currentTarget.textContent = showing ? '미리보기' : '편집하기';
  });

  const togglePublishPanel = (open) => {
    publishPanel?.classList.toggle('open', open);
    editorMain?.classList.toggle('panel-visible', open);
  };
  document.querySelector('.publish-button')?.addEventListener('click', () => togglePublishPanel(true));
  document.querySelector('.panel-close')?.addEventListener('click', () => togglePublishPanel(false));
  document.querySelector('.publish-final')?.addEventListener('click', () => {
    if (!editorTitle?.value.trim() || !editorContent?.value.trim()) {
      setDraftMessage('제목과 내용을 입력해 주세요');
      togglePublishPanel(false);
      return;
    }
    setDraftMessage('발행 완료 (데모)');
    togglePublishPanel(false);
  });
})();
