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

  const POSTS_KEY = 'haneul-blog-posts';
  const categoryNames = { development: '개발', design: '디자인', life: '일상' };
  const loadPosts = () => {
    try {
      const posts = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]');
      return Array.isArray(posts) ? posts.filter((post) =>
        post && typeof post.id === 'string' && typeof post.title === 'string'
        && typeof post.content === 'string') : [];
    } catch {
      return [];
    }
  };

  const renderInline = (parent, source) => {
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|!?\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    let position = 0;
    for (const match of source.matchAll(pattern)) {
      parent.append(document.createTextNode(source.slice(position, match.index)));
      const value = match[0];
      if (value.startsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = value.slice(2, -2);
        parent.append(strong);
      } else if (value.startsWith('*')) {
        const emphasis = document.createElement('em');
        emphasis.textContent = value.slice(1, -1);
        parent.append(emphasis);
      } else {
        const image = value.startsWith('!');
        const opening = image ? 2 : 1;
        const split = value.indexOf('](');
        const label = value.slice(opening, split);
        const url = value.slice(split + 2, -1);
        const element = document.createElement(image ? 'img' : 'a');
        if (image) {
          element.alt = label;
          element.src = url;
          element.loading = 'lazy';
        } else {
          element.textContent = label;
          element.href = url;
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
        }
        parent.append(element);
      }
      position = match.index + value.length;
    }
    parent.append(document.createTextNode(source.slice(position)));
  };

  const renderPostBody = (container, content) => {
    container.replaceChildren();
    let list = null;
    content.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) { list = null; return; }
      const heading = line.startsWith('## ');
      const quote = line.startsWith('> ');
      const item = line.startsWith('- ');
      if (item) {
        if (!list) {
          list = document.createElement('ul');
          container.append(list);
        }
      } else {
        list = null;
      }
      const element = document.createElement(heading ? 'h2' : quote ? 'blockquote' : item ? 'li' : 'p');
      renderInline(element, line.slice(heading || quote || item ? 2 : 0));
      (item ? list : container).append(element);
    });
  };

  const postGrid = document.querySelector('#post-grid');
  if (postGrid) {
    loadPosts().reverse().forEach((post) => {
      const card = document.createElement('article');
      card.className = 'post-card';
      card.dataset.category = categoryNames[post.category] ? post.category : 'life';
      const link = `post-detail.html?id=${encodeURIComponent(post.id)}`;
      const thumbnail = document.createElement('a');
      thumbnail.className = 'post-thumb coral';
      thumbnail.href = link;
      const label = document.createElement('b');
      label.textContent = categoryNames[post.category] || '새 글';
      thumbnail.append(label);
      const meta = document.createElement('div');
      meta.className = 'post-meta';
      const category = document.createElement('span');
      category.textContent = categoryNames[post.category] || '일상';
      const date = document.createElement('time');
      date.textContent = new Date(post.updatedAt || post.createdAt).toLocaleDateString('ko-KR');
      meta.append(category, date);
      const heading = document.createElement('h3');
      const titleLink = document.createElement('a');
      titleLink.href = link;
      titleLink.textContent = post.title;
      heading.append(titleLink);
      const excerpt = document.createElement('p');
      excerpt.textContent = post.content.replace(/[#*>\[\]()]/g, '').slice(0, 90);
      card.append(thumbnail, meta, heading, excerpt);
      postGrid.prepend(card);
    });
  }

  const postId = new URLSearchParams(window.location.search).get('id');
  const detailMain = document.querySelector('#main');
  if (postId && detailMain && window.location.pathname.endsWith('post-detail.html')) {
    const post = loadPosts().find((entry) => entry.id === postId);
    if (!post) {
      document.title = '글을 찾을 수 없습니다 | HANEUL.LOG';
      detailMain.innerHTML = '<div class="container saved-post-missing"><h1>글을 찾을 수 없습니다.</h1><a href="index.html">← 모든 글</a></div>';
    } else {
      document.title = `${post.title} | HANEUL.LOG`;
      detailMain.innerHTML = '<article class="saved-post"><header class="article-hero"><div class="article-heading"><a class="back-link" href="index.html">← 모든 글</a><div class="post-meta"><span class="saved-category"></span><time class="saved-date"></time></div><h1 class="saved-title"></h1></div></header><div class="container article-layout"><div class="article-body saved-body"></div></div></article>';
      detailMain.querySelector('.saved-category').textContent = categoryNames[post.category] || '일상';
      detailMain.querySelector('.saved-date').textContent = new Date(post.updatedAt || post.createdAt).toLocaleDateString('ko-KR');
      detailMain.querySelector('.saved-title').textContent = post.title;
      renderPostBody(detailMain.querySelector('.saved-body'), post.content);
      if (post.tags) {
        const tags = document.createElement('div');
        tags.className = 'article-tags';
        post.tags.split(',').map((tag) => tag.trim()).filter(Boolean).forEach((tag) => {
          const label = document.createElement('span');
          label.textContent = `#${tag.replace(/^#/, '')}`;
          tags.append(label);
        });
        detailMain.querySelector('.saved-body').append(tags);
      }
    }
  }

  const myPostList = document.querySelector('#my-post-list');
  if (myPostList) {
    const emptyMessage = document.querySelector('#my-post-empty');
    const statusMessage = document.querySelector('#my-post-status');
    const renderMyPosts = () => {
      const posts = loadPosts();
      myPostList.replaceChildren();
      if (emptyMessage) emptyMessage.hidden = posts.length > 0;
      posts.forEach((post) => {
        const item = document.createElement('article');
        item.className = 'my-post-item';
        const info = document.createElement('div');
        const meta = document.createElement('div');
        meta.className = 'post-meta';
        const category = document.createElement('span');
        category.textContent = categoryNames[post.category] || '일상';
        const date = document.createElement('time');
        date.textContent = new Date(post.updatedAt || post.createdAt).toLocaleDateString('ko-KR');
        meta.append(category, date);
        const heading = document.createElement('h3');
        const title = document.createElement('a');
        title.href = `post-detail.html?id=${encodeURIComponent(post.id)}`;
        title.textContent = post.title;
        heading.append(title);
        const excerpt = document.createElement('p');
        excerpt.textContent = post.content.replace(/[#*>\[\]()]/g, '').slice(0, 120);
        info.append(meta, heading, excerpt);
        const actions = document.createElement('div');
        actions.className = 'my-post-actions';
        const readLink = document.createElement('a');
        readLink.href = title.href;
        readLink.textContent = '읽기';
        const editLink = document.createElement('a');
        editLink.href = `post-write.html?edit=${encodeURIComponent(post.id)}`;
        editLink.textContent = '수정';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-post';
        deleteButton.textContent = '삭제';
        deleteButton.addEventListener('click', () => {
          if (!window.confirm(`“${post.title}” 글을 삭제할까요?`)) return;
          try {
            localStorage.setItem(POSTS_KEY, JSON.stringify(loadPosts().filter((entry) => entry.id !== post.id)));
            localStorage.removeItem(`haneul-blog-edit-draft-${post.id}`);
            renderMyPosts();
            if (statusMessage) statusMessage.textContent = '글을 삭제했습니다.';
          } catch {
            if (statusMessage) statusMessage.textContent = '삭제에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.';
          }
        });
        actions.append(readLink, editLink, deleteButton);
        item.append(info, actions);
        myPostList.append(item);
      });
    };
    renderMyPosts();
  }

  // Blog post search and category filtering
  const searchInput = document.querySelector('#post-search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const postCards = [...document.querySelectorAll('.post-card')];
  const emptyState = document.querySelector('#empty-state');
  let activeFilter = 'all';

  filterButtons.forEach((button) => {
    const count = button.dataset.filter === 'all' ? postCards.length
      : postCards.filter((card) => card.dataset.category === button.dataset.filter).length;
    const counter = button.querySelector('span');
    if (counter) counter.textContent = count;
  });

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

  const clearAuthToken = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const showAuthActions = (isLoggedIn) => {
    const loginLink = document.querySelector('.login-link');
    const signupLink = document.querySelector('.signup-link');
    const logoutButton = document.querySelector('.logout-button');
    const profileLink = document.querySelector('.account-profile-link');
    if (loginLink) loginLink.hidden = isLoggedIn;
    if (signupLink) signupLink.hidden = isLoggedIn;
    if (logoutButton) logoutButton.hidden = !isLoggedIn;
    if (profileLink) profileLink.hidden = !isLoggedIn;
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
          showAuthActions(true);
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
    if (!token || !document.querySelector('.header-actions')) return;

    try {
      const result = await authRequest({ action: 'session', token });
      if (!result.ok) throw new Error(result.message);
      showAuthActions(true);
    } catch {
      clearAuthToken();
      showAuthActions(false);
    }
  };

  refreshAuthUI();

  document.querySelector('.logout-button')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const token = getAuthToken();
    button.disabled = true;
    try {
      if (token) await authRequest({ action: 'logout', token });
    } catch {
      // Clear the browser session even if the server cannot be reached.
    } finally {
      clearAuthToken();
      showAuthActions(false);
      button.disabled = false;
    }
  });

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
  const editorCategory = document.querySelector('#editor-category');
  const editorDate = document.querySelector('#editor-date');
  const titleCount = document.querySelector('#title-count');
  const draftStatus = document.querySelector('.draft-status');
  const publishPanel = document.querySelector('.publish-panel');
  const preview = document.querySelector('.editor-preview');
  const editorPane = document.querySelector('.editor-pane');
  const editId = new URLSearchParams(window.location.search).get('edit');
  const isEditing = editId !== null;
  const draftKey = isEditing ? `haneul-blog-edit-draft-${editId}` : 'haneul-blog-draft';
  const editingPost = isEditing ? loadPosts().find((post) => post.id === editId) : null;

  if (editorDate) editorDate.textContent = new Date().toLocaleDateString('ko-KR');

  const updateTitle = () => {
    if (titleCount && editorTitle) titleCount.textContent = editorTitle.value.length;
  };
  editorTitle?.addEventListener('input', updateTitle);

  const setDraftMessage = (text) => {
    if (draftStatus) draftStatus.textContent = text;
  };
  document.querySelector('.save-draft')?.addEventListener('click', () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        title: editorTitle.value, content: editorContent.value,
        tags: editorTags.value, category: editorCategory.value
      }));
      setDraftMessage('임시저장됨');
    } catch {
      setDraftMessage('임시저장에 실패했습니다');
    }
  });

  if (editorTitle) {
    if (isEditing && !editingPost) {
      setDraftMessage('수정할 글을 찾을 수 없습니다. 프로필에서 다시 선택해 주세요.');
      document.querySelector('.save-draft').disabled = true;
      document.querySelector('.publish-button').disabled = true;
      document.querySelector('.publish-final').disabled = true;
    } else if (editingPost) {
      editorTitle.value = editingPost.title;
      editorContent.value = editingPost.content;
      editorTags.value = editingPost.tags || '';
      editorCategory.value = editingPost.category || '';
      document.title = `글 수정 | ${editingPost.title}`;
      setDraftMessage('글 수정 중');
      document.querySelector('.publish-button').textContent = '수정 저장';
      document.querySelector('.publish-final').textContent = '수정 저장하고 글 보기 →';
    }
    try {
      const draft = isEditing && !editingPost ? null : JSON.parse(localStorage.getItem(draftKey));
      if (draft) {
        editorTitle.value = draft.title || '';
        editorContent.value = draft.content || '';
        editorTags.value = draft.tags || '';
        editorCategory.value = draft.category || '';
        setDraftMessage(isEditing ? '수정 중인 임시저장 글' : '임시저장 글');
      }
    } catch { localStorage.removeItem(draftKey); }
    updateTitle();
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
      renderPostBody(preview.querySelector('.preview-body'), editorContent.value || '내용을 입력하면 이곳에서 미리 볼 수 있습니다.');
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
    if (isEditing && !editingPost) return;
    if (!editorTitle.value.trim() || !editorContent.value.trim()) {
      setDraftMessage('제목과 내용을 입력해 주세요');
      togglePublishPanel(false);
      return;
    }
    if (!editorCategory.value) {
      setDraftMessage('카테고리를 선택해 주세요');
      togglePublishPanel(false);
      editorCategory.focus();
      return;
    }
    const posts = loadPosts();
    const currentPost = isEditing ? posts.find((entry) => entry.id === editId) : null;
    if (isEditing && !currentPost) {
      setDraftMessage('글이 삭제되어 수정 내용을 저장할 수 없습니다.');
      togglePublishPanel(false);
      return;
    }
    const post = {
      id: isEditing ? editId : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: editorTitle.value.trim(),
      content: editorContent.value.trim(),
      tags: editorTags.value.trim(),
      category: editorCategory.value,
      createdAt: currentPost?.createdAt || new Date().toISOString(),
      ...(isEditing ? { updatedAt: new Date().toISOString() } : {})
    };
    try {
      const nextPosts = isEditing ? posts.map((entry) => entry.id === editId ? post : entry) : [post, ...posts];
      localStorage.setItem(POSTS_KEY, JSON.stringify(nextPosts));
      localStorage.removeItem(draftKey);
      window.location.href = `post-detail.html?id=${encodeURIComponent(post.id)}`;
    } catch {
      setDraftMessage('글 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요');
      togglePublishPanel(false);
    }
  });
})();
