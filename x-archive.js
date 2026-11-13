(() => {
  const search = document.querySelector("#archive-search");
  const year = document.querySelector("#archive-year");
  const topic = document.querySelector("#archive-topic");
  const language = document.querySelector("#archive-language");
  const list = document.querySelector("#archive-list");
  const count = document.querySelector("#archive-count");
  const more = document.querySelector("#archive-more");
  const period = document.querySelector("#archive-period");
  const pageSize = 24;
  const kinds = { tweet: "帖子", thread: "串帖" };
  const nonText = new Set(["image", "link", "rule", "quoted"]);
  const dateLabel = (date) => `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;
  const needsTranslation = (text) => /[A-Za-z]/.test(text.replace(/https?:\/\/\S+/g, ""));

  let entries = [];
  let matches = [];
  let shown = 0;
  let lang = "zh";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function externalLink(url, label) {
    const link = element("a", "archive-source", label);
    if (url.startsWith("https://")) link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  // 只显示当前语言：选中文时中文缺失就标注待补，选英文时原文永远在。
  function readingText(part) {
    if (lang === "en") return part.en;
    return part.zh || (!needsTranslation(part.en) ? part.en : "");
  }

  function renderReading(entry) {
    const content = element("div", "archive-reading");
    for (const part of entry.blocks) {
      if (part.kind === "image" && part.url.startsWith("https://")) {
        const link = externalLink(part.url, "");
        const image = element("img", "archive-image");
        image.src = part.url;
        image.alt = "帖子配图";
        image.loading = "lazy";
        link.append(image);
        content.append(link);
      } else if (part.kind === "rule") {
        content.append(element("hr", "archive-break"));
      } else if (part.kind === "quoted") {
        content.append(element("p", "archive-quoted", `引用 ${part.en}`));
      } else if (part.kind === "link") {
        content.append(element("p", "archive-quoted", part.en));
      } else {
        const text = readingText(part);
        const tag = part.kind === "heading" || part.kind === "title" ? "h3" : part.kind === "quote" ? "blockquote" : "p";
        const marker = part.marker ? `${part.marker} ` : part.kind === "bullet" ? "• " : "";
        const row = element("div", "archive-paragraph");
        const body = text ? element(tag, "", marker + text) : element(tag, "archive-pending", "译文待补充");
        if (lang === "en") body.lang = "en";
        row.append(body);
        content.append(row);
      }
    }
    return content;
  }

  function preview(entry) {
    const first = entry.blocks.find((part) => !nonText.has(part.kind));
    if (!first) return "查看帖子配图";
    const text = readingText(first);
    return text || "译文待补充";
  }

  function card(entry) {
    const details = element("details", "archive-card");
    const summary = element("summary", "archive-card-summary");
    const meta = element("span", "archive-meta");
    const date = element("time", "", dateLabel(entry.date));
    date.dateTime = entry.date;
    meta.append(date, element("span", "archive-kind", kinds[entry.kind] || "帖子"));
    for (const label of entry.tags) meta.append(element("span", "archive-tag", label));
    summary.append(meta);
    const text = element("span", "archive-preview", preview(entry));
    if (lang === "en") text.lang = "en";
    summary.append(text);
    details.append(summary);
    details.addEventListener("toggle", () => {
      if (details.open && details.children.length === 1) details.append(renderReading(entry));
    });
    return details;
  }

  function showMore() {
    const next = matches.slice(shown, shown + pageSize);
    list.append(...next.map(card));
    shown += next.length;
    more.hidden = shown >= matches.length;
  }

  function filter() {
    const query = search.value.trim().toLowerCase();
    matches = entries.filter((entry) => (!year.value || entry.date.startsWith(year.value))
      && (!topic.value || entry.tags.includes(topic.value)) && (!query || entry.searchText.includes(query)));
    list.replaceChildren();
    shown = 0;
    count.textContent = matches.length ? `共 ${matches.length} 条` : "没有找到符合条件的帖子。";
    showMore();
  }

  function fillOptions(select, values) {
    for (const value of values) select.add(new Option(value, value));
  }

  function storedLang() {
    try {
      return localStorage.getItem("archive-language") === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  }

  async function load() {
    try {
      const response = await fetch("data/x-archive.json");
      if (!response.ok) throw new Error("Could not load archive data");
      ({ entries } = await response.json());
      for (const entry of entries) {
        entry.searchText = [entry.tags.join(" "), ...entry.blocks.flatMap((part) => [part.en, part.zh || ""])].join("\n").toLowerCase();
      }
      if (entries.length) {
        const last = entries[entries.length - 1];
        period.textContent = `${dateLabel(last.date)} 至 ${dateLabel(entries[0].date)} · 北京时间`;
      }
      lang = storedLang();
      language.value = lang;
      fillOptions(year, new Set(entries.map((entry) => entry.date.slice(0, 4))));
      fillOptions(topic, [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")));
      for (const control of [search, year, topic]) control.addEventListener("input", filter);
      language.addEventListener("change", () => {
        lang = language.value === "en" ? "en" : "zh";
        try {
          localStorage.setItem("archive-language", lang);
        } catch {
          /* 无痕模式下不记住选择 */
        }
        filter();
      });
      more.addEventListener("click", showMore);
      filter();
    } catch {
      count.textContent = "归档暂时无法加载。请通过网站地址打开，或刷新后重试。";
    }
  }

  load();
})();
