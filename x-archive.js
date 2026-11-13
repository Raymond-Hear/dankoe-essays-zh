(() => {
  const search = document.querySelector("#archive-search");
  const year = document.querySelector("#archive-year");
  const topic = document.querySelector("#archive-topic");
  const list = document.querySelector("#archive-list");
  const count = document.querySelector("#archive-count");
  const more = document.querySelector("#archive-more");
  const period = document.querySelector("#archive-period");
  const pageSize = 24;
  const kinds = { tweet: "帖子", thread: "串帖", article: "长文" };
  const nonText = new Set(["image", "link", "rule", "quoted"]);
  const dateLabel = (date) => `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;
  const needsTranslation = (text) => /[A-Za-z]/.test(text.replace(/https?:\/\/\S+/g, ""));

  let entries = [];
  let matches = [];
  let shown = 0;

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

  function renderReading(entry) {
    const content = element("div", "archive-reading");
    const bilingual = entry.blocks.some((part) => part.zh);
    const translatable = entry.blocks.some((part) => !nonText.has(part.kind) && needsTranslation(part.en));
    const heading = element("div", "archive-languages");
    if (bilingual) {
      heading.append(element("span", "", "中文"), element("span", "", "English"));
    } else if (translatable) {
      heading.append(element("span", "", "英文原文"), element("span", "", "中文翻译待完成"));
    } else {
      heading.append(element("span", "", "原帖内容"));
    }
    if (bilingual) heading.classList.add("is-bilingual");
    content.append(heading);

    for (const part of entry.blocks) {
      if (part.kind === "image" && part.url.startsWith("https://")) {
        const link = externalLink(part.url, "");
        const image = element("img", "archive-image");
        image.src = part.url;
        image.alt = "X 原文配图";
        image.loading = "lazy";
        link.append(image);
        content.append(link);
      } else if (part.kind === "link") {
        content.append(externalLink(part.url, part.en || "打开原帖附件"));
      } else if (part.kind === "rule") {
        content.append(element("hr", "archive-break"));
      } else if (part.kind === "quoted") {
        content.append(element("p", "archive-quoted", `引用 ${part.en}`));
      } else {
        const row = element("div", "archive-paragraph");
        const tag = part.kind === "heading" || part.kind === "title" ? "h3" : part.kind === "quote" ? "blockquote" : "p";
        const marker = part.marker ? `${part.marker} ` : part.kind === "bullet" ? "• " : "";
        if (bilingual) {
          row.classList.add("is-bilingual");
          const translated = part.zh || (!needsTranslation(part.en) ? part.en : "");
          row.append(element(tag, translated ? "" : "archive-pending", translated ? marker + translated : "译文待补充"));
        }
        const english = element(tag, "", marker + part.en);
        english.lang = "en";
        row.append(english);
        content.append(row);
      }
    }
    content.append(externalLink(entry.url, "在 X 查看原文 ↗"));
    return content;
  }

  function card(entry) {
    const details = element("details", "archive-card");
    const summary = element("summary", "archive-card-summary");
    const meta = element("span", "archive-meta");
    const date = element("time", "", dateLabel(entry.date));
    date.dateTime = entry.date;
    meta.append(date, element("span", "archive-kind", kinds[entry.kind]));
    for (const label of entry.tags) meta.append(element("span", "archive-tag", label));
    summary.append(meta);
    const first = entry.blocks.find((part) => !nonText.has(part.kind));
    const preview = element("span", "archive-preview", first?.zh || first?.en || "查看帖子附件");
    if (first && !first.zh) preview.lang = "en";
    summary.append(preview);
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
      fillOptions(year, new Set(entries.map((entry) => entry.date.slice(0, 4))));
      fillOptions(topic, [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")));
      for (const control of [search, year, topic]) control.addEventListener("input", filter);
      more.addEventListener("click", showMore);
      filter();
    } catch {
      count.textContent = "归档暂时无法加载。请通过网站地址打开，或刷新后重试。";
    }
  }

  load();
})();
