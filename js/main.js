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

  const AUTH_API_URL = 'https://script.google.com/macros/s/AKfycbyU-5pr9SeWqOSN7A1hw6m063KfSTmIKETzdjqIBRkjpHPO4gPsPwtRuGT6U8B2oA83KQ/exec';
  const TOKEN_KEY = 'haneul-auth-token';
  const USER_KEY = 'haneul-auth-user';
  const VERIFIED_KEY = 'haneul-auth-verified';
  const REMOTE_POSTS_KEY = 'haneul-remote-posts';
  const POSTS_CACHE_MS = 60 * 1000;
  const SESSION_CACHE_MS = 5 * 60 * 1000;
  const readCache = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeCache = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be full. */ }
  };
  const readSessionCache = (key) => {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeSessionCache = (key, value) => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be full. */ }
  };
  const cachedRemotePosts = readCache(REMOTE_POSTS_KEY);
  const getRemotePosts = () => Array.isArray(cachedRemotePosts?.posts) ? cachedRemotePosts.posts : [];
  const updateRemotePosts = (posts) => writeCache(REMOTE_POSTS_KEY, { posts, savedAt: Date.now() });
  const invalidateRemotePosts = () => localStorage.removeItem(REMOTE_POSTS_KEY);
  const authRequest = async (payload) => {
    const response = await fetch(AUTH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('서버에 연결할 수 없습니다.');
    return response.json();
  };
  const postsRequest = async (payload) => {
    const result = await authRequest(payload);
    if (!result.ok) {
      const error = new Error(result.message || '글 요청에 실패했습니다.');
      error.code = result.code;
      throw error;
    }
    return result;
  };
  const getAuthToken = () => (
    sessionStorage.getItem(TOKEN_KEY)
    || localStorage.getItem(TOKEN_KEY)
  );

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

  const savedPosts = loadPosts();
  const postGrid = document.querySelector('#post-grid');
  const featured = document.querySelector('#featured-post');
  const renderListing = (posts) => {
    if (!postGrid) return;
    postGrid.replaceChildren();
    posts.forEach((post) => {
      const card = document.createElement('article');
      card.className = 'post-card';
      card.dataset.category = categoryNames[post.category] ? post.category : 'life';
      card.dataset.search = `${post.title} ${post.content} ${post.tags || ''}`.toLocaleLowerCase('ko');
      const link = `post-detail.html?id=${encodeURIComponent(post.id)}`;
      const thumbnail = document.createElement('a');
      thumbnail.className = `post-thumb ${post.category === 'design' ? 'blue' : post.category === 'life' ? 'sand' : 'coral'}`;
      thumbnail.href = link;
      const label = document.createElement('b');
      label.textContent = categoryNames[post.category] || '새 글';
      thumbnail.append(label);
      if (post.localOnly) {
        const localLabel = document.createElement('small');
        localLabel.textContent = '이 브라우저';
        thumbnail.append(localLabel);
      }
      const meta = document.createElement('div');
      meta.className = 'post-meta';
      const category = document.createElement('span');
      category.textContent = categoryNames[post.category] || '일상';
      const date = document.createElement('time');
      date.textContent = new Date(post.updatedAt || post.createdAt).toLocaleDateString('ko-KR');
      date.dateTime = post.updatedAt || post.createdAt;
      meta.append(category, date);
      const heading = document.createElement('h3');
      const titleLink = document.createElement('a');
      titleLink.href = link;
      titleLink.textContent = post.title;
      heading.append(titleLink);
      const excerpt = document.createElement('p');
      excerpt.textContent = post.content.replace(/[#*>\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
      card.append(thumbnail, meta, heading, excerpt);
      postGrid.append(card);
    });
    if (featured) {
      featured.hidden = posts.length === 0;
      if (posts.length) {
        const latest = posts[0];
        const link = `post-detail.html?id=${encodeURIComponent(latest.id)}`;
        featured.querySelector('.featured-category').textContent = categoryNames[latest.category] || '일상';
        const date = featured.querySelector('.featured-date');
        date.textContent = new Date(latest.updatedAt || latest.createdAt).toLocaleDateString('ko-KR');
        date.dateTime = latest.updatedAt || latest.createdAt;
        const title = featured.querySelector('.featured-title');
        title.textContent = latest.title;
        title.href = link;
        featured.querySelector('.featured-excerpt').textContent = latest.content.replace(/[#*>\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 170);
        featured.querySelector('.featured-visual').href = link;
        featured.querySelector('.featured-read').href = link;
      }
    }
  };
  const mergePosts = (remote) => {
    const local = loadPosts().filter((post) => !remote.some((item) => item.id === post.id))
      .map((post) => ({ ...post, localOnly: true }));
    return [...remote, ...local].sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt)));
  };
  renderListing(mergePosts(getRemotePosts()));

  const postId = new URLSearchParams(window.location.search).get('id');
  const detailMain = document.querySelector('#main');
  const renderDetail = (post) => {
    if (!detailMain) return;
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
  };
  if (detailMain && window.location.pathname.endsWith('post-detail.html')) {
    const localPost = savedPosts.find((entry) => entry.id === postId);
    const cachedPost = getRemotePosts().find((entry) => entry.id === postId);
    if (localPost || !postId) renderDetail(localPost);
    else {
      if (cachedPost) renderDetail(cachedPost);
      else detailMain.innerHTML = '<div class="container saved-post-missing"><p>글을 불러오는 중입니다...</p></div>';
      postsRequest({ action: 'posts_get', id: postId })
        .then((result) => renderDetail(result.post))
        .catch((error) => {
          if (error.code === 'POST_NOT_FOUND' || error.code === 'INVALID_ACTION') {
            renderDetail(null);
          } else if (!cachedPost) {
            detailMain.innerHTML = '<div class="container saved-post-missing"><h1>글을 불러오지 못했습니다.</h1><a href="index.html">← 모든 글</a></div>';
          }
        });
    }
  }

  const myPostList = document.querySelector('#my-post-list');
  if (myPostList) {
    const emptyMessage = document.querySelector('#my-post-empty');
    const statusMessage = document.querySelector('#my-post-status');
    let remoteMine = [];
    const renderMyPosts = () => {
      const localPosts = loadPosts().filter((post) =>
        !remoteMine.some((remote) => remote.id === post.id))
        .map((post) => ({ ...post, localOnly: true }));
      const posts = [...remoteMine, ...localPosts].sort((left, right) =>
        String(right.createdAt).localeCompare(String(left.createdAt)));
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
        if (post.localOnly) {
          const localLabel = document.createElement('span');
          localLabel.textContent = '이 브라우저';
          meta.append(localLabel);
        }
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
        deleteButton.addEventListener('click', async () => {
          if (!window.confirm(`“${post.title}” 글을 삭제할까요?`)) return;
          deleteButton.disabled = true;
          try {
            if (post.localOnly) {
              localStorage.setItem(POSTS_KEY, JSON.stringify(loadPosts().filter((entry) => entry.id !== post.id)));
            } else {
              await postsRequest({ action: 'posts_delete', id: post.id, token: getAuthToken() });
              remoteMine = remoteMine.filter((entry) => entry.id !== post.id);
              invalidateRemotePosts();
              sessionStorage.removeItem(`haneul-my-posts-${getAuthToken().slice(0, 16)}`);
            }
            localStorage.removeItem(`haneul-blog-edit-draft-${post.id}`);
            renderMyPosts();
            if (statusMessage) statusMessage.textContent = '글을 삭제했습니다.';
          } catch (error) {
            if (statusMessage) statusMessage.textContent = error.message || '글 삭제에 실패했습니다.';
          } finally {
            deleteButton.disabled = false;
          }
        });
        actions.append(readLink, editLink, deleteButton);
        item.append(info, actions);
        myPostList.append(item);
      });
    };
    renderMyPosts();
    const token = getAuthToken();
    if (token) {
      const cachedMine = readSessionCache(`haneul-my-posts-${token.slice(0, 16)}`);
      if (cachedMine?.posts) {
        remoteMine = cachedMine.posts;
        renderMyPosts();
      }
      postsRequest({ action: 'posts_mine', token }).then((result) => {
        remoteMine = result.posts.map((post) => ({ ...post, localOnly: false }));
        writeSessionCache(`haneul-my-posts-${token.slice(0, 16)}`, { posts: remoteMine });
        renderMyPosts();
      }).catch((error) => {
        if (error.code === 'UNAUTHORIZED') {
          sessionStorage.removeItem(`haneul-my-posts-${token.slice(0, 16)}`);
          remoteMine = [];
          renderMyPosts();
        }
        if (error.code !== 'INVALID_ACTION' && statusMessage) {
          statusMessage.textContent = '서버에 저장된 글을 불러오지 못했습니다.';
        }
      });
    }
  }

  // Blog post search and category filtering
  const searchInput = document.querySelector('#post-search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const emptyState = document.querySelector('#empty-state');
  let activeFilter = 'all';

  const updateFilterCounts = () => {
    const cards = [...document.querySelectorAll('.post-card')];
    filterButtons.forEach((button) => {
      const count = button.dataset.filter === 'all' ? cards.length
        : cards.filter((card) => card.dataset.category === button.dataset.filter).length;
      const counter = button.querySelector('span');
      if (counter) counter.textContent = count;
    });
  };

  const filterPosts = () => {
    const cards = [...document.querySelectorAll('.post-card')];
    const query = searchInput?.value.trim().toLocaleLowerCase('ko') || '';
    let visibleCount = 0;
    cards.forEach((card) => {
      const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
      const matchesQuery = card.dataset.search.includes(query);
      card.hidden = !(matchesCategory && matchesQuery);
      if (!card.hidden) visibleCount += 1;
    });
    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
      emptyState.textContent = cards.length
        ? '검색 결과가 없습니다.'
        : '아직 작성한 글이 없습니다. 새 글을 작성해 보세요.';
    }
  };

  searchInput?.addEventListener('input', filterPosts);
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    filterPosts();
  }));
  if (postGrid) {
    updateFilterCounts();
    filterPosts();
    const refreshPosts = () => postsRequest({ action: 'posts_list' }).then((result) => {
      const remote = result.posts.map((post) => ({ ...post, localOnly: false }));
      updateRemotePosts(remote);
      renderListing(mergePosts(remote));
      updateFilterCounts();
      filterPosts();
    }).catch((error) => {
      if (error.code !== 'INVALID_ACTION' && emptyState && !savedPosts.length && !getRemotePosts().length) {
        emptyState.textContent = '서버 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }
    });
    if (!cachedRemotePosts || Date.now() - cachedRemotePosts.savedAt > POSTS_CACHE_MS) refreshPosts();
  }

  const saveAuthToken = (token, remember) => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
  };

  const clearAuthToken = () => {
    const token = getAuthToken();
    if (token) sessionStorage.removeItem(`haneul-my-posts-${token.slice(0, 16)}`);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(VERIFIED_KEY);
  };

  const showProfile = (user) => {
    const name = document.querySelector('#profile-name');
    const email = document.querySelector('#profile-email');
    if (name) name.textContent = user?.name || '내 프로필';
    if (email) email.textContent = user?.email || '로그인하면 계정 정보를 확인할 수 있습니다.';
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
          window.location.href = 'login.html?registered=1';
        } else {
          saveAuthToken(result.token, remember);
          if (result.user) writeSessionCache(USER_KEY, result.user);
          writeSessionCache(VERIFIED_KEY, { token: result.token, checkedAt: Date.now(), expiresAt: result.expiresAt });
          showAuthActions(true);
          window.location.href = 'index.html';
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
    if (!document.querySelector('.header-actions') && !document.querySelector('#profile-name')) return;
    if (!token) { showProfile(null); return; }
    showAuthActions(true);
    showProfile(readSessionCache(USER_KEY));
    const verified = readSessionCache(VERIFIED_KEY);
    if (verified?.token === token && Date.now() - verified.checkedAt < SESSION_CACHE_MS
      && Date.now() < Date.parse(verified.expiresAt)) return;

    try {
      const result = await authRequest({ action: 'session', token });
      if (!result.ok) {
        clearAuthToken();
        showAuthActions(false);
        showProfile(null);
        return;
      }
      writeSessionCache(USER_KEY, result.user);
      writeSessionCache(VERIFIED_KEY, { token, checkedAt: Date.now(), expiresAt: result.expiresAt });
      showAuthActions(true);
      showProfile(result.user);
    } catch {
      // A failed network request does not prove the session is invalid.
      // Keep the local session until the server confirms expiration.
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
      showProfile(null);
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
  const storageNote = document.querySelector('#storage-note');
  const preview = document.querySelector('.editor-preview');
  const editorPane = document.querySelector('.editor-pane');
  const editId = new URLSearchParams(window.location.search).get('edit');
  const isEditing = editId !== null;
  const draftKey = isEditing ? `haneul-blog-edit-draft-${editId}` : 'haneul-blog-draft';
  let editingPost = isEditing ? loadPosts().find((post) => post.id === editId) : null;
  if (editingPost) editingPost = { ...editingPost, localOnly: true };

  if (editorDate) editorDate.textContent = new Date().toLocaleDateString('ko-KR');

  const updateTitle = () => {
    if (titleCount && editorTitle) titleCount.textContent = editorTitle.value.length;
  };
  editorTitle?.addEventListener('input', updateTitle);

  const setDraftMessage = (text) => {
    if (draftStatus) draftStatus.textContent = text;
  };
  const saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = null;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        title: editorTitle.value, content: editorContent.value,
        tags: editorTags.value, category: editorCategory.value
      }));
      setDraftMessage('임시저장됨');
    } catch {
      setDraftMessage('임시저장에 실패했습니다');
    }
  };
  document.querySelector('.save-draft')?.addEventListener('click', saveDraft);
  let draftTimer;
  [editorTitle, editorContent, editorTags, editorCategory].filter(Boolean).forEach((field) => {
    field.addEventListener('input', () => {
      setDraftMessage('저장 중...');
      clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 700);
    });
    field.addEventListener('change', () => {
      clearTimeout(draftTimer);
      saveDraft();
    });
  });
  if (editorTitle) window.addEventListener('pagehide', () => {
    if (draftTimer) saveDraft();
  });

  const setEditorDisabled = (disabled) => {
    ['.save-draft', '.publish-button', '.publish-final'].forEach((selector) => {
      const button = document.querySelector(selector);
      if (button) button.disabled = disabled;
    });
  };
  const restoreDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (draft) {
        editorTitle.value = draft.title || '';
        editorContent.value = draft.content || '';
        editorTags.value = draft.tags || '';
        editorCategory.value = draft.category || '';
        setDraftMessage(isEditing ? '수정 중인 임시저장 글' : '임시저장 글');
      }
    } catch { localStorage.removeItem(draftKey); }
    updateTitle();
  };
  const fillEditorPost = (post) => {
    editingPost = post;
    editorTitle.value = post.title;
    editorContent.value = post.content;
    editorTags.value = post.tags || '';
    editorCategory.value = post.category || '';
    document.title = `글 수정 | ${post.title}`;
    setDraftMessage('글 수정 중');
    document.querySelector('.publish-button').textContent = '수정 저장';
    document.querySelector('.publish-final').textContent = '수정 저장하고 글 보기 →';
    if (storageNote) storageNote.textContent = post.localOnly
      ? '수정한 글은 이 브라우저에 저장됩니다.' : '수정한 글은 서버에 저장됩니다.';
    restoreDraft();
    setEditorDisabled(false);
  };
  if (editorTitle) {
    if (!isEditing) {
      restoreDraft();
      if (getAuthToken() && storageNote) storageNote.textContent = '글을 저장하면 서버에 저장되어 다른 기기에서도 볼 수 있습니다.';
    } else if (editingPost) {
      fillEditorPost(editingPost);
    } else {
      setEditorDisabled(true);
      setDraftMessage('글을 불러오는 중입니다...');
      postsRequest({ action: 'posts_get', id: editId }).then((result) => {
        fillEditorPost({ ...result.post, localOnly: false });
      }).catch((error) => {
        setDraftMessage(error.code === 'POST_NOT_FOUND'
          ? '수정할 글을 찾을 수 없습니다. 프로필에서 다시 선택해 주세요.'
          : '서버 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      });
    }
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
  document.querySelector('.publish-final')?.addEventListener('click', async (event) => {
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
    const fields = {
      title: editorTitle.value.trim(),
      content: editorContent.value.trim(),
      tags: editorTags.value.trim(),
      category: editorCategory.value
    };
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (isEditing && !editingPost.localOnly) {
        const result = await postsRequest({
          action: 'posts_update', id: editId, token: getAuthToken(), ...fields
        });
        invalidateRemotePosts();
        sessionStorage.removeItem(`haneul-my-posts-${getAuthToken().slice(0, 16)}`);
        clearTimeout(draftTimer);
        draftTimer = null;
        localStorage.removeItem(draftKey);
        window.location.href = `post-detail.html?id=${encodeURIComponent(result.post.id)}`;
        return;
      }
      if (!isEditing && getAuthToken()) {
        try {
          const result = await postsRequest({
            action: 'posts_create', token: getAuthToken(), ...fields
          });
          invalidateRemotePosts();
          sessionStorage.removeItem(`haneul-my-posts-${getAuthToken().slice(0, 16)}`);
          clearTimeout(draftTimer);
          draftTimer = null;
          localStorage.removeItem(draftKey);
          window.location.href = `post-detail.html?id=${encodeURIComponent(result.post.id)}`;
          return;
        } catch (error) {
          if (error.code !== 'INVALID_ACTION') throw error;
        }
      }
      const posts = loadPosts();
      const currentPost = isEditing ? posts.find((entry) => entry.id === editId) : null;
      if (isEditing && !currentPost) {
        throw new Error('글이 삭제되어 수정 내용을 저장할 수 없습니다.');
      }
      const post = {
        id: isEditing ? editId : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ...fields,
        createdAt: currentPost?.createdAt || new Date().toISOString(),
        ...(isEditing ? { updatedAt: new Date().toISOString() } : {})
      };
      const nextPosts = isEditing ? posts.map((entry) => entry.id === editId ? post : entry) : [post, ...posts];
      localStorage.setItem(POSTS_KEY, JSON.stringify(nextPosts));
      clearTimeout(draftTimer);
      draftTimer = null;
      localStorage.removeItem(draftKey);
      window.location.href = `post-detail.html?id=${encodeURIComponent(post.id)}`;
    } catch (error) {
      setDraftMessage(error.message || '글 저장에 실패했습니다.');
      togglePublishPanel(false);
      button.disabled = false;
    }
  });
})();
