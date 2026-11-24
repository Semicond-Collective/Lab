// Renders the News list on the home page and the News & gallery page from data/news.json.
const homeNews = document.getElementById('home-news');
const allNews = document.getElementById('all-news');
const newsGallery = document.getElementById('news-gallery');
const HOME_LIMIT = 6;

if (homeNews || allNews || newsGallery) {
  fetch('data/news.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('News data is unavailable.');
      return response.json();
    })
    .then((data) => {
      const items = sortedNews(data.items || []);
      renderHome(items);
      renderAll(items);
      renderGallery(items);
      scrollToHash();
    })
    .catch(() => {
      [homeNews, allNews, newsGallery].forEach((container) => container && showNewsMessage(container, 'News could not be loaded right now.'));
    });
}

function sortedNews(items) {
  // Newest first; items from the same month keep their order in the file.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => String(b.item.date).localeCompare(String(a.item.date)) || a.index - b.index)
    .map(({ item }) => item);
}

function formatDate(date) {
  const [year, month] = String(date || '').split('-');
  return month ? `${month}/${year}` : year || '';
}

function safeImageFile(file) {
  // Only plain file names inside assets/news/ are allowed.
  return /^[A-Za-z0-9._-]+$/.test(file || '') ? `assets/news/${file}` : null;
}

function safeLink(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function imagesOf(item) {
  return (item.images || [])
    .map((image) => ({ src: safeImageFile(image.file), caption: image.caption || item.title }))
    .filter((image) => image.src);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function showNewsMessage(container, message) {
  container.replaceChildren(el(container.tagName === 'OL' || container.tagName === 'UL' ? 'li' : 'p', 'publication-message', message));
}

function titleNode(item) {
  const link = item.link && safeLink(item.link);
  if (!link) return el('strong', 'news-title', item.title);
  const anchor = el('a', 'news-title', item.title);
  anchor.href = link;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function renderHome(items) {
  if (!homeNews) return;
  if (!items.length) {
    showNewsMessage(homeNews, 'News will appear here soon.');
    return;
  }
  homeNews.replaceChildren(...items.slice(0, HOME_LIMIT).map((item) => {
    const row = el('li', 'news-item');
    const body = el('div', 'news-body');
    body.append(titleNode(item));
    if (item.text) body.append(el('p', 'news-text', item.text));
    row.append(el('span', 'news-date', formatDate(item.date)), body);
    const photos = imagesOf(item);
    if (photos.length) {
      const link = el('a', 'news-photos', `Photos (${photos.length})`);
      link.href = `news.html#${encodeURIComponent(item.id)}`;
      row.append(link);
    } else {
      row.append(el('span', 'news-photos news-photos-empty'));
    }
    return row;
  }));
}

function figureFor(image, item, withSource) {
  const figure = el('figure', 'gallery-item');
  const link = el('a');
  link.href = image.src;
  link.target = '_blank';
  link.rel = 'noopener';
  const img = el('img');
  img.src = image.src;
  img.alt = image.caption;
  img.loading = 'lazy';
  link.append(img);
  const caption = el('figcaption', null, image.caption);
  if (withSource) {
    const source = el('a', 'gallery-source', `${formatDate(item.date)} · ${item.title}`);
    source.href = `#${encodeURIComponent(item.id)}`;
    caption.append(source);
  }
  figure.append(link, caption);
  return figure;
}

function renderAll(items) {
  if (!allNews) return;
  if (!items.length) {
    showNewsMessage(allNews, 'News will appear here soon.');
    return;
  }
  allNews.replaceChildren(...items.map((item) => {
    const article = el('article', 'news-entry');
    article.id = item.id;
    const body = el('div', 'news-body');
    body.append(titleNode(item));
    if (item.text) body.append(el('p', 'news-text', item.text));
    const photos = imagesOf(item);
    if (photos.length) {
      const strip = el('div', 'news-photo-strip');
      strip.append(...photos.map((image) => figureFor(image, item, false)));
      body.append(strip);
    }
    article.append(el('span', 'news-date', formatDate(item.date)), body);
    return article;
  }));
}

function renderGallery(items) {
  if (!newsGallery) return;
  const figures = items.flatMap((item) => imagesOf(item).map((image) => figureFor(image, item, true)));
  if (!figures.length) {
    showNewsMessage(newsGallery, 'Photos will be added here soon.');
    return;
  }
  newsGallery.replaceChildren(...figures);
}

function scrollToHash() {
  if (!window.location.hash) return;
  const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (target) {
    target.classList.add('news-entry-highlight');
    target.scrollIntoView({ block: 'start' });
  }
}
