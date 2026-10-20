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

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

function sourceRow(label, url, text) {
  return '<div class="source-row"><dt>' + escapeHtml(label) + '</dt><dd><a href="' +
    escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) +
    '</a></dd></div>';
}

function initHome(catalog, contentIndex, editorial) {
  const published = new Set(contentIndex.published || []);
  const articles = catalog.articles.filter((article) => published.has(article.id));
  const count = $("#articleCount");
  const list = $("#articleList");
  const input = $("#searchInput");
  const tagBar = $("#topicFilters");
  const yearSelect = $("#yearFilter");
  const sortSelect = $("#sortOrder");
  let selectedTopic = "";

  const topics = [...new Set(articles.flatMap((article) => article.topics || []))];
  const years = [...new Set(articles.map((article) => (article.date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  tagBar.innerHTML = ['<button type="button" data-topic="" aria-pressed="true">全部</button>',
    ...topics.map((topic) => '<button type="button" data-topic="' + escapeHtml(topic) + '" aria-pressed="false">' + escapeHtml(topic) + '</button>')].join("");
  yearSelect.innerHTML = '<option value="">全部年份</option>' + years.map((year) => '<option value="' + escapeHtml(year) + '">' + escapeHtml(year) + ' 年</option>').join("");

  function render() {
    const terms = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = articles.filter((article) => {
      const searchable = [article.title, article.zhTitle || "", editorial[article.id]?.summary || "", ...(article.topics || [])].join(" ").toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term))
        && (!selectedTopic || (article.topics || []).includes(selectedTopic))
        && (!yearSelect.value || (article.date || "").startsWith(yearSelect.value));
    }).sort((a, b) => sortSelect.value === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    count.textContent = matches.length === articles.length ? articles.length + " 篇可读" : matches.length + " / " + articles.length + " 篇";
    list.innerHTML = matches.length ? matches.map((article) =>
      '<article class="article-card">' +
      '<a class="card-cover" href="' + articleUrl(article) + ((contentIndex.media || {})[article.id]?.videoId ? '#listen' : '') +
      '" aria-label="' + escapeHtml((contentIndex.media || {})[article.id]?.videoId ? '查看视频：' : '阅读：') + escapeHtml(article.zhTitle || article.title) + '">' +
      '<img src="' + coverUrl(article) + '" alt="" loading="lazy" width="1200" height="675"></a>' +
      '<div class="card-copy"><div class="card-meta"><time datetime="' + escapeHtml(article.date || "") + '">' + escapeHtml(article.date || "") + '</time></div>' +
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
    const button = event.target.closest("button[data-topic]");
    if (!button) return;
    selectedTopic = button.dataset.topic;
    tagBar.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
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
    const url = new URL("https://www.youtube-nocookie.com/embed/" + encodeURIComponent(article.videoId));
    url.searchParams.set("autoplay", "1");
    if (seconds) url.searchParams.set("start", String(seconds));
    return url.toString();
  };
  function playVideo(seconds = 0) {
    const frame = document.createElement("iframe");
    frame.className = "video-frame";
    frame.src = videoSrc(seconds);
    frame.title = article.title + " · 视频";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    target.querySelector(".video-cover, .video-frame")?.replaceWith(frame);
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

async function initArticle(catalog, contentIndex, editorial) {
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
  const hasMedia = Boolean(media.videoId || media.audioUrl || media.spotifyEpisodeId);
  const feeds = contentIndex.feeds || {};
  const available = catalog.articles.filter((entry) => published.has(entry.id));
  const position = available.findIndex((entry) => entry.id === id);
  const previous = available[position - 1];
  const next = available[position + 1];
  const pagerLink = (entry, label) => entry ? '<a href="' + articleUrl(entry) +
    '"><span>' + label + '</span><strong>' + escapeHtml(entry.zhTitle || entry.title) + '</strong></a>' : '<span></span>';
  const sources = [sourceRow("文章", article.url, "Dan Koe 文章原址")];
  if (editorial[id]?.sourceCoverUrl) sources.push(sourceRow("封面", editorial[id].sourceCoverUrl, "Dan Koe 原文配图"));
  if (media.videoId) sources.push(sourceRow("视频", "https://www.youtube.com/watch?v=" + encodeURIComponent(media.videoId), "YouTube 原视频"));
  if (media.audioUrl) sources.push(sourceRow("音频", media.audioUrl, "The Koe Cast 原始 MP3"));
  if (feeds.podcast && media.audioUrl) sources.push(sourceRow("播客 RSS", feeds.podcast, "The Koe Cast 节目源"));
  if (feeds.articles) sources.push(sourceRow("文章 RSS", feeds.articles, "Dan Koe 文章源"));
  if (media.chapterSourceUrl) sources.push(sourceRow("章节时间", media.chapterSourceUrl, "播客章节来源"));
  document.title = (article.zhTitle || article.title) + " · Dan Koe 中文阅读";
  $("#readerContent").innerHTML =
    '<article class="reader-grid"><header class="article-head"><p class="eyebrow">DAN KOE · ' + escapeHtml(article.date || "") + '</p>' +
    '<img class="article-head-cover" src="' + coverUrl(article) + '" alt="Dan Koe 原文封面" width="1200" height="675">' +
    '<h1>' + escapeHtml(article.zhTitle || article.title) + '</h1>' +
    '<p class="original-title" lang="en">' + escapeHtml(article.title) + '</p>' +
    '<p class="article-summary">' + escapeHtml(summary) + '</p>' +
    (hasMedia ? '<a class="listen-link" href="#listen">' + (media.videoId ? '看视频 / 听音频' : '收听音频') + ' <span aria-hidden="true">↗</span></a>' : '') + '</header>' +
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
}

async function boot() {
  try {
    const [catalog, contentIndex, editorial] = await Promise.all([
      loadJson("data/catalog.json"), loadJson("content/index.json"), loadJson("data/editorial.json"),
    ]);
    if (document.body.dataset.page === "home") initHome(catalog, contentIndex, editorial);
    else await initArticle(catalog, contentIndex, editorial);
  } catch (error) {
    const target = document.body.dataset.page === "home" ? $("#articleList") : $("#readerContent");
    target.innerHTML = '<p class="empty-state">正文暂时无法读取，请稍后再试。</p>';
    console.error(error);
  }
}

boot();
