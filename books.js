fetch("api/private/books", { cache: "no-store" })
  .then((response) => response.ok ? response.json() : null)
  .then((data) => {
    if (!data || !Array.isArray(data.books)) return;
    const ready = new Set(data.books.filter((book) => book.sections > 0).map((book) => book.id));
    document.querySelectorAll("[data-private-book]").forEach((link) => {
      link.hidden = !ready.has(link.dataset.privateBook);
    });
  })
  .catch(() => {});
