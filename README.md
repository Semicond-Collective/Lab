# Righetto Lab website

A static, responsive website for the Righetto Lab. It is designed to publish directly from the repository root on GitHub Pages, with no build step or dependencies.

## Publish

1. In the GitHub repository, open **Settings > Pages**.
2. Choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. Save. GitHub will show the site URL once deployment finishes.

## Update the site

- Edit `index.html` for research text, people, and contact details.
- Edit `styles.css` for colors, spacing, and layout.
- Replace `assets/optical-table.webp` and `assets/semiconductor-films.webp` with your own images, keeping the same filenames or updating their references in `index.html` and `styles.css`.
- The `assets/mark.svg` logo combines a crystal lattice with a terahertz waveform. It deliberately does not depict a silicon chip.

## Google Scholar publications

For the most reliable sync, set `profile_url` in `scholar-profile.json` to Marcello Righetto's **public** Google Scholar profile URL, for example `https://scholar.google.com/citations?user=YOUR_ID`. Do not substitute a name-search URL: the `user` ID selects the exact profile. If the field is empty, the first sync tries a strict name-and-affiliation lookup and pins the discovered ID only when it finds exactly one match. Google Scholar profiles must be public for visitors and the sync job to see them.

The GitHub Actions workflow `.github/workflows/sync-scholar.yml` refreshes `data/publications.json` each Monday and can also be run manually from the repository's **Actions** tab. It runs automatically when `scholar-profile.json` changes. The importer reads every publication returned by the profile, and the website renders the resulting snapshot. Google Scholar has no official public profile API; automated access can occasionally be blocked or incomplete. A failed refresh leaves the previous snapshot untouched. The site does **not** scrape Scholar in visitors' browsers.

Until the first successful Scholar refresh, the site transparently shows three verified starter publications rather than claiming that they are a complete Scholar record.

If automated refreshes are blocked, sign in to Google Scholar, select all articles in the profile, export as CSV, and run:

```bash
python scripts/sync_scholar.py --csv path/to/scholar-export.csv
```

Commit the updated `data/publications.json` file. The same profile URL must still be configured so links point to the correct Scholar account.

## Choose what visitors see

Open `manage-publications.html` on the live site. **Public** controls whether an entry appears on the publications page; **Home** controls homepage selection. Leave the automatic-home option selected to show the three newest public entries. Click **Prepare settings**, then copy the generated JSON into `publication-settings.json` using the GitHub edit link on that page, and commit it. The website updates after GitHub Pages redeploys.

The complete imported Scholar catalog remains in `data/publications.json`, including items hidden from page display. Visibility settings are presentation controls, not privacy controls; a static site's data file is publicly readable.

The two supplied photographs are AI-generated **illustrative starter images**, not photographs of the Righetto Lab or its equipment. They were generated for this site and may be replaced as original lab photography becomes available. Their image-generation prompts described (1) a technically plausible ultrafast-spectroscopy optical table with calm text space and (2) emerging-semiconductor thin-film samples on glass substrates.

## Content references

Research and affiliation details were checked against the [University of Padova research profile](https://research.unipd.it/cris/rp/rp10786?type=all), [University of Padova departmental listing](https://www.chimica.unipd.it/taxonomy/term/35), and [RSC author biography](https://pmc.ncbi.nlm.nih.gov/articles/PMC12930265/). Daniel Zabotto's email appears in the [University of Padova PhD student list](https://phd.chimica.unipd.it/cdsm/phd-students/cycle-42). No unverified email addresses were added for Maria Francesca Cherchi or Nico Panazzolo. Verify time-sensitive roles, contact details, and publication selection before announcing the site publicly.
