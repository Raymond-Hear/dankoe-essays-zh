(function () {
  const storageKey = "dan-koe-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch (_) {}
  let followsSystem = saved !== "light" && saved !== "dark";
  const setTheme = (theme) => { document.documentElement.dataset.theme = theme; };
  setTheme(followsSystem ? (media.matches ? "dark" : "light") : saved);

  media.addEventListener?.("change", (event) => {
    if (!followsSystem) return;
    setTheme(event.matches ? "dark" : "light");
    updateThemeButtons();
  });

  function updateThemeButtons() {
    const dark = document.documentElement.dataset.theme === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", dark ? "切换到日间模式" : "切换到夜间模式");
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "切换到日间模式" : "切换到夜间模式";
      button.querySelector(".theme-symbol").textContent = dark ? "☀" : "☾";
      button.querySelector(".theme-text").textContent = dark ? "日间" : "夜间";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateThemeButtons();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        followsSystem = false;
        setTheme(next);
        try { localStorage.setItem(storageKey, next); } catch (_) {}
        updateThemeButtons();
      });
    });

    const topButton = document.querySelector("[data-back-to-top]");
    const dock = document.querySelector("[data-contact-dock]");
    const card = document.querySelector("[data-contact-card]");
    const triggers = document.querySelectorAll("[data-contact-toggle]");

    if (dock && card) {
      let closeTimer = 0;
      const hoverable = window.matchMedia("(hover: hover)");
      const apply = (open) => {
        dock.classList.toggle("is-open", open);
        card.setAttribute("aria-hidden", String(!open));
        triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", String(open)));
      };
      const openDock = () => {
        window.clearTimeout(closeTimer);
        apply(true);
      };
      const closeDock = () => {
        window.clearTimeout(closeTimer);
        apply(false);
      };
      const closeLater = () => {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => apply(false), 170);
      };
      dock.addEventListener("pointerenter", () => { if (hoverable.matches) openDock(); });
      dock.addEventListener("pointerleave", () => { if (hoverable.matches) closeLater(); });
      dock.addEventListener("focusin", (event) => {
        if (event.target.matches(":focus-visible")) openDock();
      });
      dock.addEventListener("focusout", (event) => {
        if (!dock.contains(event.relatedTarget)) closeLater();
      });
      triggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (dock.classList.contains("is-open")) closeDock();
          else openDock();
        });
      });
      document.addEventListener("click", (event) => {
        if (!dock.contains(event.target)) closeDock();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDock();
      });
    }

    if (!topButton) return;
    let scheduled = false;
    const updateTopButton = () => {
      topButton.hidden = window.scrollY < 180;
      if (dock) dock.classList.toggle("is-flush", topButton.hidden);
      scheduled = false;
    };
    window.addEventListener("scroll", () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(updateTopButton);
      }
    }, { passive: true });
    topButton.addEventListener("click", () => window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    }));
    updateTopButton();
  });
})();
