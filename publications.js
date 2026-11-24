const publicationList = document.getElementById('all-publications');
const homePublicationList = document.getElementById('home-publications');
const managerList = document.getElementById('manager-publications');

const publicationCache = Promise.all([
  fetch('data/publications.json', { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error('Publication data is unavailable.');
    return response.json();
  }),
  fetch('publication-settings.json', { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error('Publication settings are unavailable.');
    return response.json();
  })
]);

function sortedPublications(publications) {
  return [...publications].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || a.title.localeCompare(b.title));
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function publicationElement(publication) {
  const link = document.createElement('a');
  link.className = 'publication';
  link.href = safeUrl(publication.url) || 'https://scholar.google.com/';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const year = document.createElement('span');
  year.className = 'pub-year';
  year.textContent = publication.year || 'n.d.';

  const body = document.createElement('span');
  body.className = 'pub-body';
  const title = document.createElement('strong');
  title.textContent = publication.title;
  const meta = document.createElement('span');
  meta.className = 'pub-meta';
  meta.textContent = [publication.authors, publication.venue].filter(Boolean).join(' \u00b7 ');
  body.append(title, meta);

  const arrow = document.createElement('span');
  arrow.className = 'pub-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '\u2197';
  link.append(year, body, arrow);
  return link;
}

function showMessage(container, message) {
  container.replaceChildren();
  const paragraph = document.createElement('p');
  paragraph.className = 'publication-message';
  paragraph.textContent = message;
  container.append(paragraph);
}

function publicPublications(data, settings) {
  const hidden = new Set(settings.hidden || []);
  return sortedPublications(data.publications).filter((publication) => !hidden.has(publication.id));
}

function renderHome(data, settings) {
  if (!homePublicationList) return;
  const visible = publicPublications(data, settings);
  const featured = settings.featured === null
    ? visible.slice(0, 3)
    : (settings.featured || []).map((id) => visible.find((publication) => publication.id === id)).filter(Boolean);
  if (!featured.length) {
    showMessage(homePublicationList, 'Selected publications will appear here soon.');
    return;
  }
  homePublicationList.replaceChildren(...featured.map(publicationElement));
}

function renderArchive(data, settings) {
  if (!publicationList) return;
  const visible = publicPublications(data, settings);
  const search = document.getElementById('publication-search');
  const yearSelect = document.getElementById('publication-year');
  const status = document.getElementById('publication-status');
  const count = document.getElementById('publication-count');
  const sourceLink = document.getElementById('scholar-profile-link');

  if (data.source === 'Google Scholar') {
    const date = data.synced_at ? new Date(data.synced_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    status.textContent = `Google Scholar profile${date ? ` \u00b7 updated ${date}` : ''}`;
    if (safeUrl(data.profile_url)) {
      sourceLink.href = data.profile_url;
      sourceLink.firstChild.textContent = 'View Google Scholar profile ';
    }
  } else {
    status.textContent = 'Initial selection shown. Full Google Scholar sync is pending.';
  }

  const years = [...new Set(visible.map((publication) => String(publication.year || '')).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });

  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = visible.filter((publication) => {
      const text = [publication.title, publication.authors, publication.venue].join(' ').toLocaleLowerCase();
      return (!query || text.includes(query)) && (yearSelect.value === 'all' || String(publication.year) === yearSelect.value);
    });
    count.textContent = `${filtered.length} of ${visible.length} publications`;
    if (filtered.length) publicationList.replaceChildren(...filtered.map(publicationElement));
    else showMessage(publicationList, visible.length ? 'No publications match these filters.' : 'No publications are currently displayed.');
  }

  search.addEventListener('input', update);
  yearSelect.addEventListener('change', update);
  update();
}

function renderManager(data, settings) {
  if (!managerList) return;
  const status = document.getElementById('manager-status');
  const automatic = document.getElementById('automatic-featured');
  const output = document.getElementById('settings-output');
  const download = document.getElementById('download-settings');
  const copy = document.getElementById('copy-settings');
  const hidden = new Set(settings.hidden || []);
  const featured = new Set(settings.featured || []);
  const publications = sortedPublications(data.publications);
  automatic.checked = settings.featured === null;
  status.textContent = `${publications.length} records in the local catalog${data.source === 'Google Scholar' ? ' \u00b7 Google Scholar synced' : ' \u00b7 full Scholar sync pending'}`;

  publications.forEach((publication) => {
    const row = document.createElement('tr');
    row.dataset.publicationId = publication.id;
    const year = document.createElement('td');
    year.textContent = publication.year || 'n.d.';
    const title = document.createElement('th');
    title.scope = 'row';
    title.textContent = publication.title;
    const publicCell = document.createElement('td');
    const publicBox = document.createElement('input');
    publicBox.type = 'checkbox';
    publicBox.className = 'public-toggle';
    publicBox.checked = !hidden.has(publication.id);
    publicBox.setAttribute('aria-label', `Show ${publication.title} on the public site`);
    publicCell.append(publicBox);
    const homeCell = document.createElement('td');
    const homeBox = document.createElement('input');
    homeBox.type = 'checkbox';
    homeBox.className = 'home-toggle';
    homeBox.checked = featured.has(publication.id);
    homeBox.disabled = automatic.checked || !publicBox.checked;
    homeBox.setAttribute('aria-label', `Feature ${publication.title} on the homepage`);
    homeCell.append(homeBox);
    publicBox.addEventListener('change', () => {
      homeBox.disabled = automatic.checked || !publicBox.checked;
      if (!publicBox.checked) homeBox.checked = false;
    });
    row.append(year, title, publicCell, homeCell);
    managerList.append(row);
  });

  automatic.addEventListener('change', () => {
    managerList.querySelectorAll('tr').forEach((row) => {
      row.querySelector('.home-toggle').disabled = automatic.checked || !row.querySelector('.public-toggle').checked;
    });
  });

  document.getElementById('prepare-settings').addEventListener('click', () => {
    const rows = [...managerList.querySelectorAll('tr')];
    const next = {
      hidden: rows.filter((row) => !row.querySelector('.public-toggle').checked).map((row) => row.dataset.publicationId),
      featured: automatic.checked ? null : rows.filter((row) => row.querySelector('.home-toggle').checked && row.querySelector('.public-toggle').checked).map((row) => row.dataset.publicationId)
    };
    output.value = `${JSON.stringify(next, null, 2)}\n`;
    output.hidden = false;
    copy.disabled = false;
    download.disabled = false;
  });

  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(output.value);
    copy.textContent = 'Copied';
  });

  download.addEventListener('click', () => {
    const blob = new Blob([output.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'publication-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

publicationCache.then(([data, settings]) => {
  if (!Array.isArray(data.publications)) throw new Error('Publication data has an invalid format.');
  renderHome(data, settings);
  renderArchive(data, settings);
  renderManager(data, settings);
}).catch(() => {
  if (homePublicationList) showMessage(homePublicationList, 'Publications are temporarily unavailable.');
  if (publicationList) showMessage(publicationList, 'Publications are temporarily unavailable. Please try again later.');
  if (managerList) document.getElementById('manager-status').textContent = 'Publication data could not be loaded.';
});
