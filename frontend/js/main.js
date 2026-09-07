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
})();
