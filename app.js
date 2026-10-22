const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path + ": HTTP " + response.status);
  return response.json();
}

async function loadText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path + ": HTTP " + response.status);
  return response.text();
}

function articleUrl(article) {
  return "article.html?id=" + encodeURIComponent(article.id);
}

function coverUrl(article) {
  return "covers/" + encodeURIComponent(article.id) + ".jpg";
}

function setupCarousel(track, count, position, previous, next, toggle) {
  const section = track.parentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (count > 1) {
    const firstCardCopy = track.firstElementChild.cloneNode(true);
    firstCardCopy.setAttribute("aria-hidden", "true");
    firstCardCopy.inert = true;
    track.appendChild(firstCardCopy);
  }
  let timer;
  let wrapTimer;
  let manuallyPaused = false;
  let hovering = false;
  let focused = false;
  const rawIndex = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  const currentIndex = () => rawIndex() % count;
  const update = () => {
    position.textContent = String(currentIndex() + 1).padStart(2, "0") + " / " + String(count).padStart(2, "0");
  };
  const resetAtEnd = () => {
    if (rawIndex() === count) track.scrollTo({ left: 0, behavior: "instant" });
  };
  const stop = () => { clearInterval(timer); timer = undefined; };
  const canPlay = () => count > 1 && !manuallyPaused && !hovering && !focused && !document.hidden && !reducedMotion.matches;
  const start = () => {
    stop();
    if (canPlay()) timer = window.setInterval(() => go(1, false), 5000);
  };
  const go = (step, restart = true) => {
    const target = step > 0 && currentIndex() === count - 1 ? count : (currentIndex() + step + count) % count;
    track.scrollTo({ left: target * track.clientWidth, behavior: reducedMotion.matches ? "instant" : "smooth" });
    if (target === count) {
      clearTimeout(wrapTimer);
      wrapTimer = window.setTimeout(resetAtEnd, 900);
    }
    if (restart) start();
  };
  previous.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  toggle.addEventListener("click", () => {
    manuallyPaused = !manuallyPaused;
    toggle.textContent = manuallyPaused ? "▶" : "Ⅱ";
    toggle.setAttribute("aria-label", manuallyPaused ? "继续自动轮播" : "暂停自动轮播");
    toggle.title = toggle.getAttribute("aria-label");
    start();
  });
  section.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") { hovering = true; stop(); }
  });
  section.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") { hovering = false; start(); }
  });
  section.addEventListener("focusin", () => { focused = true; stop(); });
  section.addEventListener("focusout", () => {
    window.setTimeout(() => { focused = section.contains(document.activeElement); start(); }, 0);
  });
  track.addEventListener("pointerdown", stop);
  track.addEventListener("pointerup", start);
  track.addEventListener("scroll", update, { passive: true });
  track.addEventListener("scrollend", resetAtEnd);
  window.addEventListener("resize", update);
  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener("change", start);
  update();
  start();
}

function visiblePublishedArticles(catalog, published) {
  return catalog.articles.filter((article) => published.has(article.id)
    && (!article.duplicateOf || !published.has(article.duplicateOf)));
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

function sourceRow(label, url, text) {
  return '<div class="source-row"><dt>' + escapeHtml(label) + '</dt><dd><a href="' +
    escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) +
    '</a></dd></div>';
}

function restoreArticleImages(articleId) {
  const english = $("#panel-en");
  const chinese = $("#panel-zh");
  // Two older approved English copies still contain self-promotional blocks.
  // Keep the immutable releases intact; omit those blocks when reading.
  if (articleId === "c8584a33de17") {
    let node = [...english.children].find((item) => item.textContent.startsWith("Before we begin, self-sponsorship"));
    while (node && node.tagName !== "H3") {
      const next = node.nextElementSibling;
      node.remove();
      node = next;
    }
  }
  if (articleId === "2fd39bf36809") {
    for (const node of [...english.children]) {
      if (node.textContent.startsWith("I’ve actually created all of these for you") ||
          node.textContent.startsWith("» You can find all of them here")) node.remove();
      if (node.tagName === "IMG") node.remove();
    }
  }
  const originalImages = [...english.querySelectorAll("img")];
  const candidates = originalImages.map((img, index) => ({ img, index })).filter(({ img }) => {
    try { return new URL(img.src).hostname === "substackcdn.com"; } catch { return false; }
  });
  if (!candidates.length || chinese.querySelector("img")) return;

  // Older Chinese releases may have different paragraph counts. Match numbered
  // sections first, then use the reading depth inside that section.
  const englishNodes = [...english.children];
  const chineseNodes = [...chinese.children];
  const textSize = (node) => node.textContent.trim().length;
  const sectionHeadings = (nodes) => {
    const headings = nodes.map((node, index) => ({ node, index }))
      .filter(({ node }) => /^H[23]$/.test(node.tagName));
    const level = Math.min(...headings.map(({ node }) => Number(node.tagName[1])));
    return headings.filter(({ node }) => Number(node.tagName[1]) === level);
  };
  const enHeadings = sectionHeadings(englishNodes);
  const zhHeadings = sectionHeadings(chineseNodes);
  const chineseNumerals = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  const sectionNumber = (heading) => {
    const value = heading?.textContent.trim() || "";
    const step = value.match(/^(?:Step\s*(\d+)|第([一二三四五六七八九十\d]+)步)/i);
    if (step) return Number(step[1] || chineseNumerals[step[2]] || step[2]);
    const arabic = value.match(/^(\d+)[.、．\s]/);
    if (arabic) return Number(arabic[1]);
    const han = value.match(/^([一二三四五六七八九十])[、.．]/);
    if (han) return chineseNumerals[han[1]];
    const roman = value.match(/^(VII|VIII|VI|IV|III|II|IX|V|I|X)(?:\s|[.、．—–-])/i);
    if (!roman) return null;
    return { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }[roman[1].toUpperCase()];
  };
  const lastFigureAfter = new Map();
  for (const { img, index } of candidates) {
    const imageNodeIndex = englishNodes.findIndex((node) => node.contains(img));
    const enSectionIndex = enHeadings.findLastIndex(({ index: headingIndex }) => headingIndex <= imageNodeIndex);
    const enSection = enHeadings[enSectionIndex];
    const number = sectionNumber(enSection?.node);
    const zhSectionIndex = number == null ? enSectionIndex : zhHeadings.findIndex(({ node }) => sectionNumber(node) === number);
    const zhSection = zhHeadings[zhSectionIndex >= 0 ? zhSectionIndex : enSectionIndex];
    const enStart = enSection ? enSection.index + 1 : 0;
    const enEnd = enHeadings[enSectionIndex + 1]?.index ?? englishNodes.length;
    const zhStart = zhSection ? zhSection.index + 1 : 0;
    const zhEnd = zhHeadings[(zhSectionIndex >= 0 ? zhSectionIndex : enSectionIndex) + 1]?.index ?? chineseNodes.length;
    const enLength = englishNodes.slice(enStart, enEnd).reduce((sum, node) => sum + textSize(node), 0) || 1;
    const enRead = englishNodes.slice(enStart, Math.max(enStart, imageNodeIndex)).reduce((sum, node) => sum + textSize(node), 0);
    const zhLength = chineseNodes.slice(zhStart, zhEnd).reduce((sum, node) => sum + textSize(node), 0);
    const target = (enRead / enLength) * zhLength;
    let read = 0;
    let anchor = chineseNodes[Math.max(0, zhStart - 1)];
    for (const node of chineseNodes.slice(zhStart, zhEnd)) {
      read += textSize(node);
      if (target > 0) anchor = node;
      if (read >= target) break;
    }
    if (!anchor) continue;
    const figure = document.createElement("figure");
    figure.className = "source-figure";
    const copy = document.createElement("img");
    copy.src = img.src;
    copy.alt = img.alt || "Dan Koe 原文插图";
    copy.loading = "lazy";
    copy.decoding = "async";
    figure.appendChild(copy);
    const caption = document.createElement("figcaption");
    caption.textContent = "原文插图";
    figure.appendChild(caption);
    const insertionPoint = lastFigureAfter.get(anchor) || anchor;
    insertionPoint.after(figure);
    lastFigureAfter.set(anchor, figure);
  }
}

function initHome(catalog, contentIndex, editorial, featured) {
  const published = new Set(contentIndex.published || []);
  const articles = visiblePublishedArticles(catalog, published);
  const count = $("#articleCount");
  const list = $("#articleList");
  const input = $("#searchInput");
  const tagBar = $("#topicFilters");
  const yearSelect = $("#yearFilter");
  const sortSelect = $("#sortOrder");
  let selectedTopic = "";
  let featuredOnly = false;

  const featuredArticles = Object.keys(featured).map((id) => articles.find((article) => article.id === id)).filter(Boolean);
  const featuredSection = $("#featured");
  if (featuredArticles.length) {
    featuredSection.hidden = false;
    const track = $("#featuredTrack");
    track.innerHTML = featuredArticles.map((article, index) =>
      '<article class="featured-card"><a class="featured-cover" href="' + articleUrl(article) + '">' +
      '<img src="' + coverUrl(article) + '" alt="" loading="' + (index === 0 ? 'eager' : 'lazy') + '" width="1200" height="675"></a>' +
      '<div class="featured-copy"><time class="featured-number" datetime="' + escapeHtml(article.date || '') + '">' + escapeHtml(article.date || '') + '</time>' +
      '<h3><a href="' + articleUrl(article) + '">' + escapeHtml(article.zhTitle || article.title) + '</a></h3>' +
      '<p class="featured-summary">' + escapeHtml(editorial[article.id]?.summary || '') + '</p>' +
      '<a class="featured-read" href="' + articleUrl(article) + '">阅读文章 <span aria-hidden="true">→</span></a></div></article>'
    ).join("");
    setupCarousel(track, featuredArticles.length, $("#featuredPosition"),
      $("#featuredPrev"), $("#featuredNext"), $("#featuredToggle"));
  }

  const topics = [...new Set(articles.flatMap((article) => article.topics || []))];
  const years = [...new Set(articles.map((article) => (article.date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  tagBar.innerHTML = ['<button type="button" data-topic="" aria-pressed="true">全部</button>',
    ...(articles.some((article) => featured[article.id]) ? ['<button type="button" data-featured="true" aria-pressed="false">重点推荐</button>'] : []),
    ...topics.map((topic) => '<button type="button" data-topic="' + escapeHtml(topic) + '" aria-pressed="false">' + escapeHtml(topic) + '</button>')].join("");
  yearSelect.innerHTML = '<option value="">全部年份</option>' + years.map((year) => '<option value="' + escapeHtml(year) + '">' + escapeHtml(year) + ' 年</option>').join("");

  function render() {
    const terms = normalizeSearch(input.value).split(/\s+/).filter(Boolean);
    const matches = articles.filter((article) => {
      const searchable = normalizeSearch([article.title, article.zhTitle || "", editorial[article.id]?.summary || "",
        ...(article.topics || []), ...(article.alternateSources || []).map((source) => source.title)].join(" "));
      const words = searchable.split(/\s+/);
      return terms.every((term) => term === "ai" ? words.includes(term) : searchable.includes(term))
        && (!featuredOnly || Boolean(featured[article.id]))
        && (!selectedTopic || (article.topics || []).includes(selectedTopic))
        && (!yearSelect.value || (article.date || "").startsWith(yearSelect.value));
    }).sort((a, b) => sortSelect.value === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    count.textContent = matches.length === articles.length ? articles.length + " 篇可读" : matches.length + " / " + articles.length + " 篇";
    list.innerHTML = matches.length ? matches.map((article) =>
      '<article class="article-card">' +
      '<a class="card-cover" href="' + articleUrl(article) + ((contentIndex.media || {})[article.id]?.videoId ? '#listen' : '') +
      '" aria-label="' + escapeHtml((contentIndex.media || {})[article.id]?.videoId ? '查看视频：' : '阅读：') + escapeHtml(article.zhTitle || article.title) + '">' +
      '<img src="' + coverUrl(article) + '" alt="" loading="lazy" width="1200" height="675"></a>' +
      '<div class="card-copy"><div class="card-meta"><time datetime="' + escapeHtml(article.date || "") + '">' + escapeHtml(article.date || "") + '</time>' +
      (featured[article.id] ? '<span class="featured-label">★ 重点推荐</span>' : '') + '</div>' +
      '<h3><a href="' + articleUrl(article) + '">' + escapeHtml(article.zhTitle || article.title) + '</a></h3>' +
      '<p class="card-summary">' + escapeHtml(editorial[article.id]?.summary || "") + '</p>' +
      '<div class="card-bottom"><div class="card-topics">' + (article.topics || []).map((topic) => '<span>' + escapeHtml(topic) + '</span>').join("") +
      '</div><a class="card-read" href="' + articleUrl(article) + '">阅读 <span aria-hidden="true">↗</span></a></div></div></article>'
    ).join("") : '<p class="empty-state">没有找到匹配的文章。</p>';
  }
  input.addEventListener("input", render);
  yearSelect.addEventListener("change", render);
  sortSelect.addEventListener("change", render);
  tagBar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic], button[data-featured]");
    if (!button) return;
    featuredOnly = button.dataset.featured === "true";
    selectedTopic = featuredOnly ? "" : button.dataset.topic;
    tagBar.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  });
  $("#featuredFilter")?.addEventListener("click", () => {
    const button = tagBar.querySelector('button[data-featured="true"]');
    button?.click();
    $("#articles").scrollIntoView({ behavior: "smooth", block: "start" });
    input.focus({ preventScroll: true });
  });
  render();
}

function renderMedia(article) {
  const target = $("#readerMedia");
  let audio = null;
  let spotifyFrame = null;
  let audioToggle = null;
  let videoButton = null;
  const videoSrc = (seconds = 0) => {
    // 用 www.youtube.com 而不是 youtube-nocookie.com，并且带上 origin：
    // 浏览器已登录 YouTube 时，nocookie 域内拿不到会话 Cookie，YouTube 无法确认身份，
    // 点播放就返回「Sign in to confirm you're not a bot」。换成 www.youtube.com + origin 才认得出人。
    // iframe 只在点击封面后创建，属于真实用户手势，autoplay 是合法的。
    const url = new URL("https://www.youtube.com/embed/" + encodeURIComponent(article.videoId));
    url.searchParams.set("rel", "0");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("autoplay", "1");
    if (location.origin && location.origin !== "null") url.searchParams.set("origin", location.origin);
    if (seconds) url.searchParams.set("start", String(seconds));
    return url.toString();
  };
  function playVideo(seconds = 0) {
    const frame = document.createElement("iframe");
    frame.className = "video-frame";
    frame.src = videoSrc(seconds);
    frame.title = article.title + " · 视频";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    target.querySelector(".video-cover, .video-frame")?.replaceWith(frame);
    if (!target.querySelector(".video-fallback")) {
      const fallback = document.createElement("a");
      fallback.className = "video-fallback";
      fallback.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(article.videoId);
      fallback.target = "_blank";
      fallback.rel = "noopener noreferrer";
      fallback.textContent = "播放器打不开？到 YouTube 上看";
      frame.after(fallback);
    }
    audio?.pause();
  }
  function showNativeAudio() {
    if (!spotifyFrame || !audio) return;
    spotifyFrame.replaceWith(audio);
    spotifyFrame = null;
    audioToggle.textContent = "换用 Spotify 播放";
  }
  if (article.videoId) {
    const label = document.createElement("p");
    label.className = "media-label";
    label.textContent = "视频";
    target.appendChild(label);
    videoButton = document.createElement("button");
    videoButton.className = "video-cover";
    videoButton.type = "button";
    videoButton.innerHTML = '<span class="video-play-symbol" aria-hidden="true">▶</span><span>播放视频</span>';
    videoButton.style.backgroundImage = 'linear-gradient(rgb(20 28 25 / 12%), rgb(20 28 25 / 42%)), url("' + coverUrl(article) + '")';
    videoButton.addEventListener("click", () => playVideo());
    target.appendChild(videoButton);
  }
  if (article.spotifyEpisodeId || article.audioUrl) {
    const label = document.createElement("p");
    label.className = "media-label";
    label.textContent = "音频";
    target.appendChild(label);
  }
  if (article.audioUrl) {
    audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = article.audioUrl;
    target.appendChild(audio);
    if (article.spotifyEpisodeId) {
      audioToggle = document.createElement("button");
      audioToggle.className = "audio-alternative";
      audioToggle.type = "button";
      audioToggle.textContent = "换用 Spotify 播放";
      audioToggle.addEventListener("click", () => {
        if (spotifyFrame) {
          showNativeAudio();
        } else {
          audio.pause();
          spotifyFrame = document.createElement("iframe");
          spotifyFrame.className = "audio-frame";
          spotifyFrame.src = "https://open.spotify.com/embed/episode/" + encodeURIComponent(article.spotifyEpisodeId);
          spotifyFrame.title = article.title + " · Spotify 音频";
          spotifyFrame.loading = "lazy";
          spotifyFrame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
          audio.replaceWith(spotifyFrame);
          audioToggle.textContent = "换用原始音频";
        }
      });
      target.appendChild(audioToggle);
    }
  } else if (article.spotifyEpisodeId) {
    const frame = document.createElement("iframe");
    frame.className = "audio-frame";
    frame.src = "https://open.spotify.com/embed/episode/" + encodeURIComponent(article.spotifyEpisodeId);
    frame.title = article.title + " · 音频";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    target.appendChild(frame);
  }
  if (Array.isArray(article.chapters) && article.chapters.length) {
    const nav = document.createElement("nav");
    nav.className = "media-chapters";
    nav.setAttribute("aria-label", "音视频时间轴");
    const title = document.createElement("p");
    title.className = "media-label";
    title.textContent = "播客时间轴 · 点击跳转音频";
    nav.appendChild(title);
    const list = document.createElement("ol");
    article.chapters.forEach((chapter) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = '<time>' + formatTime(chapter.time) + '</time><span>' + escapeHtml(chapter.title) + '</span>';
      button.addEventListener("click", () => {
        if (audio) {
          const playingVideo = target.querySelector(".video-frame");
          if (playingVideo && videoButton) playingVideo.replaceWith(videoButton);
          showNativeAudio();
          if (audio.readyState >= 1) audio.currentTime = chapter.time;
          else audio.addEventListener("loadedmetadata", () => { audio.currentTime = chapter.time; }, { once: true });
          audio.play().catch(() => {});
        }
      });
      item.appendChild(button);
      list.appendChild(item);
    });
    nav.appendChild(list);
    target.appendChild(nav);
  }
}

async function initArticle(catalog, contentIndex, editorial, featured, guides) {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const published = new Set(contentIndex.published || []);
  const article = catalog.articles.find((entry) => entry.id === id);
  if (!article || !published.has(id)) {
    $("#readerContent").innerHTML = '<p class="empty-state">这篇文章尚未发布，请从首页选择已发布的文章。</p>';
    return;
  }
  const revision = (contentIndex.releases || {})[id];
  const base = revision ? "content/releases/" + encodeURIComponent(id) + "/" + encodeURIComponent(revision) + "/" : "content/";
  const [english, chinese] = await Promise.all([
    loadText(revision ? base + "en.html" : base + "en/" + encodeURIComponent(id) + ".html"),
    loadText(revision ? base + "zh.html" : base + "zh/" + encodeURIComponent(id) + ".html"),
  ]);
  const media = { ...article, ...((contentIndex.media || {})[id] || {}) };
  const summary = editorial[id]?.summary || "";
  const guide = guides[id]?.sourceRevision === revision && Array.isArray(guides[id]?.cards)
    && guides[id].cards.length > 1 ? guides[id] : null;
  const hasMedia = Boolean(media.videoId || media.audioUrl || media.spotifyEpisodeId);
  const feeds = contentIndex.feeds || {};
  const available = visiblePublishedArticles(catalog, published);
  const navigationId = article.duplicateOf && published.has(article.duplicateOf) ? article.duplicateOf : id;
  const position = available.findIndex((entry) => entry.id === navigationId);
  const previous = available[position - 1];
  const next = available[position + 1];
  const pagerLink = (entry, label) => entry ? '<a href="' + articleUrl(entry) +
    '"><span>' + label + '</span><strong>' + escapeHtml(entry.zhTitle || entry.title) + '</strong></a>' : '<span></span>';
  const sources = [sourceRow("文章", article.url, "Dan Koe 文章原址")];
  for (const source of article.alternateSources || []) sources.push(sourceRow("同文另一来源", source.url, source.title));
  if (editorial[id]?.sourceCoverUrl) sources.push(sourceRow("封面", editorial[id].sourceCoverUrl, "Dan Koe 原文配图"));
  if (media.videoId) sources.push(sourceRow("视频", "https://www.youtube.com/watch?v=" + encodeURIComponent(media.videoId), "YouTube 原视频"));
  if (media.audioUrl) sources.push(sourceRow("音频", media.audioUrl, "The Koe Cast 原始 MP3"));
  if (feeds.podcast && media.audioUrl) sources.push(sourceRow("播客 RSS", feeds.podcast, "The Koe Cast 节目源"));
  if (feeds.articles) sources.push(sourceRow("文章 RSS", feeds.articles, "Dan Koe 文章源"));
  if (media.chapterSourceUrl) sources.push(sourceRow("章节时间", media.chapterSourceUrl, "播客章节来源"));
  document.title = (article.zhTitle || article.title) + " · Dan Koe 中文阅读";
  $("#readerContent").innerHTML =
    '<article class="reader-grid"><header class="article-head"><p class="eyebrow">DAN KOE · ' + escapeHtml(article.date || "") +
    (featured[id] ? ' · ★ 重点推荐' : '') + '</p>' +
    '<img class="article-head-cover" src="' + coverUrl(article) + '" alt="Dan Koe 原文封面" width="1200" height="675">' +
    '<h1>' + escapeHtml(article.zhTitle || article.title) + '</h1>' +
    '<p class="original-title" lang="en">' + escapeHtml(article.title) + '</p>' +
    '<p class="article-summary">' + escapeHtml(summary) + '</p>' +
    (hasMedia ? '<a class="listen-link" href="#listen">' + (media.videoId ? '看视频 / 听音频' : '收听音频') + ' <span aria-hidden="true">↗</span></a>' : '') + '</header>' +
    (guide ? '<section class="reader-guide" aria-labelledby="guideTitle"><div class="guide-heading"><h2 id="guideTitle">先读这篇</h2><div class="guide-actions"><span id="guidePosition">01 / ' + String(guide.cards.length).padStart(2, '0') + '</span><button id="guideToggle" class="carousel-toggle" type="button" aria-label="暂停自动轮播" title="暂停自动轮播">Ⅱ</button><button id="guidePrev" type="button" aria-label="上一个要点">←</button><button id="guideNext" type="button" aria-label="下一个要点">→</button></div></div><div id="guideTrack" class="guide-track" aria-label="文章要点">' +
      guide.cards.map((card, index) => '<article class="guide-card"><span class="guide-number">要点 ' + String(index + 1).padStart(2, '0') + '</span><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.text) + '</p><a href="#section-zh-' + Number(card.heading) + '">读这一节 <span aria-hidden="true">→</span></a></article>').join('') + '</div></section>' : '') +
    (hasMedia ? '<details id="listen" class="media-drawer"><summary>' + (media.videoId ? '观看与收听' : '收听音频') + '<span>播放器 <span aria-hidden="true">↓</span></span></summary><div id="readerMedia" class="reader-media"></div></details>' : '') +
    '<div class="language-tabs" role="tablist" aria-label="阅读语言">' +
    '<button type="button" role="tab" id="tab-zh" aria-controls="panel-zh" data-lang="zh">中文精读</button>' +
    '<button type="button" role="tab" id="tab-en" aria-controls="panel-en" data-lang="en">英文文稿</button></div>' +
    '<aside id="readerToc" class="reader-toc" aria-label="文章目录" hidden></aside>' +
    '<div class="reader-panels"><div id="panel-zh" class="language-panel article-body" role="tabpanel" aria-labelledby="tab-zh" lang="zh-CN">' + chinese + '</div>' +
    '<div id="panel-en" class="language-panel article-body" role="tabpanel" aria-labelledby="tab-en" lang="en">' +
    english + '</div></div>' +
    '<section class="source-card" aria-labelledby="sourceTitle"><h2 id="sourceTitle">来源与链接</h2><dl>' + sources.join("") + '</dl></section>' +
    '<nav class="article-pagination" aria-label="上一篇与下一篇">' + pagerLink(previous, "上一篇") + pagerLink(next, "下一篇") + '</nav></article>';
  restoreArticleImages(id);
  if (hasMedia) {
    renderMedia(media);
    function revealMedia() {
      if (location.hash !== "#listen") return;
      $("#listen").open = true;
      requestAnimationFrame(() => $("#listen").scrollIntoView({ block: "start" }));
    }
    revealMedia();
    $(".listen-link")?.addEventListener("click", () => { $("#listen").open = true; });
    window.addEventListener("hashchange", revealMedia);
  }
  const buttons = [...document.querySelectorAll(".language-tabs button")];
  function renderToc(language) {
    const toc = $("#readerToc");
    const headings = [...$("#panel-" + language).querySelectorAll("h2, h3")];
    toc.hidden = headings.length < 2;
    if (toc.hidden) return;
    toc.innerHTML = '<div class="toc-inner"><p>目录</p><ol>' + headings.map((heading, index) => {
      heading.id = "section-" + language + "-" + (index + 1);
      return '<li class="toc-level-' + heading.tagName.toLowerCase() + '"><a href="#' + heading.id + '"><span>' +
        String(index + 1).padStart(2, "0") + '</span>' + escapeHtml(heading.textContent.trim()) + '</a></li>';
    }).join("") + '</ol></div>';
  }
  function selectLanguage(language) {
    buttons.forEach((button) => {
      const active = button.dataset.lang === language;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $("#panel-zh").hidden = language !== "zh";
    $("#panel-en").hidden = language !== "en";
    renderToc(language);
    const url = new URL(location.href);
    if (language === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    history.replaceState(null, "", url);
  }
  buttons.forEach((button) => button.addEventListener("click", () => selectLanguage(button.dataset.lang)));
  selectLanguage(new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh");
  if (guide) {
    const track = $("#guideTrack");
    setupCarousel(track, guide.cards.length, $("#guidePosition"),
      $("#guidePrev"), $("#guideNext"), $("#guideToggle"));
    track.querySelectorAll('a[href^="#section-zh-"]').forEach((link) => link.addEventListener("click", () => selectLanguage("zh")));
  }
}

async function boot() {
  try {
    const [catalog, contentIndex, editorial, featured, guides] = await Promise.all([
      loadJson("data/catalog.json"), loadJson("content/index.json"), loadJson("data/editorial.json"),
      loadJson("data/featured.json"), loadJson("data/guides.json"),
    ]);
    if (document.body.dataset.page === "home") initHome(catalog, contentIndex, editorial, featured);
    else await initArticle(catalog, contentIndex, editorial, featured, guides);
  } catch (error) {
    const target = document.body.dataset.page === "home" ? $("#articleList") : $("#readerContent");
    target.innerHTML = '<p class="empty-state">正文暂时无法读取，请稍后再试。</p>';
    console.error(error);
  }
}

boot();
