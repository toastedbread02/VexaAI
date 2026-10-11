(() => {
  const HISTORY_KEY = 'vexa.web.conversations.v1';
  const MAX_HISTORY = 24;
  const MIN_THINK_MS = 3000;
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    sidebar: $('#sidebar'),
    backdrop: $('#sidebar-backdrop'),
    mobileMenu: $('#mobile-menu'),
    mobileMenuOpen: $('#mobile-menu-open'),
    newChat: $('#new-chat'),
    list: $('#conversation-list'),
    count: $('#history-count'),
    title: $('#topbar-title'),
    connectionStatus: $('#connection-status'),
    connectionDot: $('#connection-dot'),
    welcome: $('#welcome'),
    messages: $('#messages'),
    thinking: $('#thinking'),
    thinkingCaption: $('#thinking-caption'),
    form: $('#composer'),
    input: $('#message-input'),
    send: $('#send-button'),
    charCount: $('#char-count'),
    toast: $('#toast'),
    about: $('#about-dialog'),
    aboutButtonTop: $('#about-button-top'),
  };

  let conversations = loadConversations();
  let activeId = null;
  let isThinking = false;
  let toastTimer;

  function loadConversations() {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.messages))
        .slice(0, MAX_HISTORY);
    } catch {
      return [];
    }
  }

  function saveConversations() {
    conversations = conversations.slice(0, MAX_HISTORY);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
    } catch {
      showToast('Browser storage is full. Older conversations may not be saved.');
    }
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function escapeTitle(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 34 ? `${clean.slice(0, 34).trimEnd()}…` : clean;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
  }

  function activeConversation() {
    return conversations.find((item) => item.id === activeId) || null;
  }

  function setActiveTitle(title) {
    elements.title.textContent = title || 'New conversation';
  }

  function renderHistory() {
    elements.list.replaceChildren();
    const sorted = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    elements.count.textContent = String(sorted.length);
    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'Your conversations will find a home here.';
      elements.list.append(empty);
      return;
    }

    for (const conversation of sorted) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `history-item${conversation.id === activeId ? ' active' : ''}`;
      button.setAttribute('aria-current', conversation.id === activeId ? 'page' : 'false');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 18 18');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 3.5h12v9H8l-3.5 2v-2H3zM6 6.5h6M6 9h4');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-width', '1.2');
      icon.append(path);
      const title = document.createElement('span');
      title.className = 'history-title';
      title.textContent = conversation.title || 'New conversation';
      button.append(icon, title);
      button.addEventListener('click', () => openConversation(conversation.id));
      elements.list.append(button);
    }
  }

  function appendMessage(message, { scroll = false } = {}) {
    const row = document.createElement('article');
    row.className = `message-row ${message.role === 'user' ? 'user' : 'assistant'}`;
    const avatar = document.createElement(message.role === 'assistant' ? 'img' : 'span');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    if (message.role === 'assistant') {
      avatar.src = 'assets/vexa-mark.svg';
      avatar.alt = '';
    } else {
      avatar.textContent = 'Y';
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('strong');
    name.textContent = message.role === 'user' ? 'You' : 'Vexa';
    meta.append(name);
    if (message.role === 'assistant' && message.source) {
      const source = document.createElement('span');
      source.className = `message-source${message.source === 'model' ? ' model' : ''}`;
      source.textContent = message.source === 'local' ? 'Local answer' : 'Model response';
      meta.append(source);
    }
    const time = document.createElement('time');
    time.className = 'message-time';
    time.dateTime = new Date(message.createdAt || Date.now()).toISOString();
    time.textContent = formatTime(message.createdAt || Date.now());
    meta.append(time);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.text;
    content.append(meta, bubble);

    if (message.role === 'assistant') {
      const tools = document.createElement('div');
      tools.className = 'message-tools';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'tool-button';
      copy.setAttribute('aria-label', 'Copy response');
      copy.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="9" rx="1.2"/><path d="M10.5 5.5V3a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1H5"/></svg><span>Copy</span>';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message.text);
          showToast('Copied to clipboard');
        } catch {
          showToast('Could not access the clipboard in this browser');
        }
      });
      tools.append(copy);
      content.append(tools);
    }

    row.append(avatar, content);
    elements.messages.append(row);
    if (scroll) requestAnimationFrame(() => row.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  }

  function renderConversation(conversation) {
    elements.messages.replaceChildren();
    const hasMessages = Boolean(conversation?.messages?.length);
    elements.welcome.hidden = hasMessages;
    setActiveTitle(conversation?.title || 'New conversation');
    if (hasMessages) conversation.messages.forEach((message) => appendMessage(message));
    renderHistory();
    if (hasMessages) requestAnimationFrame(() => elements.messages.lastElementChild?.scrollIntoView({ block: 'end' }));
  }

  function openConversation(id) {
    activeId = id;
    renderConversation(activeConversation());
    closeMobileMenu();
    elements.input.focus({ preventScroll: true });
  }

  function startNewConversation() {
    if (isThinking) return;
    activeId = null;
    renderConversation(null);
    closeMobileMenu();
    elements.input.value = '';
    updateComposer();
    elements.input.focus({ preventScroll: true });
  }

  function showToast(text) {
    elements.toast.textContent = text;
    elements.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('visible'), 2400);
  }

  function updateComposer() {
    const length = elements.input.value.length;
    elements.charCount.textContent = `${length} / 1000`;
    elements.input.style.height = 'auto';
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 150)}px`;
    elements.send.disabled = isThinking || !elements.input.value.trim();
  }

  async function checkConnection() {
    try {
      const response = await fetch('/status', { cache: 'no-store' });
      if (!response.ok || !(await response.json()).online) throw new Error('Vexa server is unavailable');
      elements.connectionStatus.textContent = 'Local server connected';
      elements.connectionDot.classList.remove('offline');
      elements.connectionDot.title = 'Local server connected';
      elements.connectionDot.setAttribute('aria-label', 'Local server connected');
    } catch {
      elements.connectionStatus.textContent = 'Preview · no chat server';
      elements.connectionDot.classList.add('offline');
      elements.connectionDot.title = 'Chat server not connected';
      elements.connectionDot.setAttribute('aria-label', 'Chat server not connected');
    }
  }

  function setThinking(visible) {
    elements.thinking.classList.toggle('visible', visible);
    elements.thinking.setAttribute('aria-hidden', String(!visible));
    elements.send.disabled = visible || !elements.input.value.trim();
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function setThinkingCaption(index) {
    const captions = ['Reading your message', 'Putting together a response', 'Almost there'];
    elements.thinkingCaption.textContent = captions[Math.min(index, captions.length - 1)];
  }

  async function sendMessage(rawText = elements.input.value) {
    const text = rawText.trim();
    if (!text || isThinking) return;
    let conversation = activeConversation();
    if (!conversation) {
      conversation = { id: makeId(), title: escapeTitle(text), messages: [], updatedAt: Date.now() };
      conversations.unshift(conversation);
      activeId = conversation.id;
    }
    if (conversation.messages.length === 0) conversation.title = escapeTitle(text);
    const userMessage = { role: 'user', text, createdAt: Date.now() };
    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();
    saveConversations();
    elements.input.value = '';
    updateComposer();
    elements.welcome.hidden = true;
    setActiveTitle(conversation.title);
    appendMessage(userMessage, { scroll: true });
    renderHistory();

    isThinking = true;
    setThinkingCaption(0);
    setThinking(true);
    const startedAt = performance.now();
    const captionTimer = window.setInterval(() => {
      setThinkingCaption(Math.floor((performance.now() - startedAt) / 950));
    }, 900);

    const request = fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, max_tokens: 80, temperature: 0.8, top_k: 30, top_p: 0.92 }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Vexa returned ${response.status}.`);
      return response.json();
    });
    const [result] = await Promise.allSettled([request, delay(Math.max(0, MIN_THINK_MS - (performance.now() - startedAt)))]);
    window.clearInterval(captionTimer);
    isThinking = false;
    setThinking(false);

    let assistantMessage;
    if (result.status === 'fulfilled' && typeof result.value.response === 'string') {
      assistantMessage = {
        role: 'assistant', text: result.value.response,
        source: result.value.source === 'local' ? 'local' : 'model', createdAt: Date.now(),
      };
    } else {
      assistantMessage = {
        role: 'assistant',
        text: 'The site is open, but Vexa’s chat server is not connected. Run the local Vexa server or connect a hosted chat backend, then try again.',
        source: 'local', createdAt: Date.now(),
      };
      showToast(result.status === 'rejected' ? result.reason.message : 'The local server returned an empty response.');
    }
    // The active thread may have changed while the request was pending only if
    // another browser action bypasses the disabled composer, so update by id.
    const savedConversation = conversations.find((item) => item.id === conversation.id);
    if (savedConversation) {
      savedConversation.messages.push(assistantMessage);
      savedConversation.updatedAt = Date.now();
      saveConversations();
    }
    if (activeId === conversation.id) {
      appendMessage(assistantMessage, { scroll: true });
      renderHistory();
      elements.input.focus({ preventScroll: true });
    }
  }

  function openMobileMenu() {
    elements.sidebar.classList.add('open');
    elements.backdrop.classList.add('visible');
    elements.mobileMenu.setAttribute('aria-expanded', 'true');
    elements.mobileMenuOpen.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    elements.sidebar.classList.remove('open');
    elements.backdrop.classList.remove('visible');
    elements.mobileMenu.setAttribute('aria-expanded', 'false');
    elements.mobileMenuOpen.setAttribute('aria-expanded', 'false');
  }

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage().catch((error) => {
      isThinking = false;
      setThinking(false);
      showToast(error.message || 'Something went wrong.');
    });
  });
  elements.input.addEventListener('input', updateComposer);
  elements.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });
  elements.newChat.addEventListener('click', startNewConversation);
  elements.mobileMenu.addEventListener('click', () => {
    if (elements.sidebar.classList.contains('open')) closeMobileMenu(); else openMobileMenu();
  });
  elements.mobileMenuOpen.addEventListener('click', openMobileMenu);
  elements.backdrop.addEventListener('click', closeMobileMenu);
  document.querySelectorAll('.suggestion-card').forEach((card) => {
    card.addEventListener('click', () => sendMessage(card.dataset.prompt).catch((error) => showToast(error.message)));
  });
  $('#about-button').addEventListener('click', () => elements.about.showModal());
  elements.aboutButtonTop.addEventListener('click', () => elements.about.showModal());
  $('#dialog-close').addEventListener('click', () => elements.about.close());
  $('#dialog-done').addEventListener('click', () => elements.about.close());
  elements.about.addEventListener('click', (event) => {
    if (event.target === elements.about) elements.about.close();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      startNewConversation();
    }
    if (event.key === 'Escape') closeMobileMenu();
  });

  const latest = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (latest) {
    activeId = latest.id;
    renderConversation(latest);
  } else {
    renderHistory();
  }
  updateComposer();
  checkConnection();
})();
