# Grace Nganga — Data Analyst Portfolio

Personal portfolio for Grace Nganga, a data analyst working with SQL, Python, Power BI and Excel.

**Live site:** https://gracecv.vercel.app

## Features

- **Editorial design.** Type-led layout in Geist and Geist Mono on a warm paper background, ink-black buttons, one
  blue accent and hairline rules. No gradients, glows or glass effects.
- **Case studies with live demos.** Each project has a Goal / Approach / Deliverable summary and an interactive demo
  built on clearly labeled sample data:
  - a filterable KPI dashboard (period and region filters, stat tiles with year-on-year change)
  - a Holt-Winters demand forecast with an 80% interval and a backtest view (MAPE, bias, interval coverage)
  - a pipeline walkthrough with the SQL, Python and DAX behind each stage
  - an "Eat That Frog" prioritizer that applies the 80/20 rule and ABCDE method from Brian Tracy's book to a task
    list (credited and linked to the publisher; the book itself is not part of the site)
- **"How I work" walkthrough.** Nine messy sample rows go through clean → define metrics → visualize →
  validate & recommend. Every number is computed live from those rows.
- **CV on demand.** "Save CV as PDF" prints the page through a dedicated print stylesheet as a clean two-page CV.
- **Recruiter-friendly first screen:** location, live local time, email, toolkit.
- **Scroll motion (the same engine as the Olive International Schools site):** blocks rise in as they arrive and
  leave again when scrolled past, coming back from whichever direction you scroll; headings rise word by word; the
  hero lifts away in layers, heading blocks drift, the word band travels sideways and section rules draw themselves
  across the page. Every value glides with a little inertia, so it plays smoothly forwards and backwards with a
  wheel, a trackpad or a finger, in every browser. Distances are smaller on phones, and it all switches off with
  reduced motion.
- **Built for phones:** a bottom bar with Call, WhatsApp and Email always in thumb reach, a full-screen menu, a
  header that hides while reading and returns on scroll-up, a compact profile hero, edge-to-edge demos, labels
  stacked above text, 44px tap targets throughout, 16px form text (no iOS zoom), code blocks that fade at the edge
  when they scroll sideways, tap-to-read chart tooltips, a 36 KB portrait on small screens, and no sideways scrolling
  down to 320px.
- Light and dark themes (follows the system, with a toggle that remembers the choice).
- Accessible: semantic landmarks, skip link, keyboard-operable tabs and charts (arrow keys), a data-table view for every
  chart, screen-reader announcements, WCAG AA contrast, colorblind-checked chart colors, reduced-motion support.
- Fast: no frameworks, no build step, no chart library; charts are hand-drawn SVG.
- Link previews (Open Graph image), structured data for search engines, and security headers (CSP) in `vercel.json`.

## Project structure

```
gracecv/
├── index.html            # The portfolio page
├── styles.css            # All styles (theme tokens at the top, print CV at the bottom)
├── theme.js              # Applies the saved theme before first paint
├── main.js               # Theme toggle, mobile menu, nav highlight, scroll motion engine, back to top, CV print, clock, copy-email
├── demos.js              # Interactive demos: sample data, forecasting model, SVG charts
├── 404.html              # Not-found page
├── favicon.svg
├── apple-touch-icon.png
├── images/
│   ├── about/1.jpg       # Profile photo
│   └── og.jpg            # 1200×630 social preview image
├── robots.txt
├── sitemap.xml
└── vercel.json           # Clean URLs, security and cache headers
```

## Updating content

### Finish a case study with real results

Each project in `index.html` is one `<article class="case">` in the Work section. A comment above the section
explains the steps:

1. **Add the result.** Uncomment the `Result` row in the project's `<dl class="case-meta">` and write the outcome,
   ideally with a number (for example "Cut monthly reporting from 2 days to 2 hours"). This is what hiring managers
   look for first.
2. **Add links.** Uncomment the `project-links` block and paste the GitHub repo and write-up URLs.
3. **Optional: show the real dashboard.** Either add a screenshot, or embed a Power BI "Publish to web" report.
   An embed needs `frame-src https://app.powerbi.com` added to the Content-Security-Policy in `vercel.json`.

The demos are deliberately labeled "sample data". Keep that label on anything that isn't real project data.

### Add work experience

An `EXPERIENCE` template is commented out at the end of the About section. Uncomment it and add one `<li>` per role.

### Use a ready-made CV file instead of the print version

Save the CV as `grace-nganga-cv.pdf` in the project root and swap the "Save CV as PDF" button in the hero for the
commented-out download link next to it.

### Update the "Last updated" date

Change the date in the footer of `index.html` and `<lastmod>` in `sitemap.xml` whenever the content changes.

## Running locally

Open `index.html` in a browser. To test with the production security headers, serve the folder with any static
server (for example `npx serve .`).

## Deployment

Pushing to the connected GitHub repository deploys automatically on Vercel.

## Contact

- **Email:** gracenganga0742@gmail.com
- **LinkedIn:** [Grace Nganga](https://www.linkedin.com/in/grace-nganga-359063379)
- **GitHub:** [@graceupongrace16069-arch](https://github.com/graceupongrace16069-arch)

© 2026 Grace Nganga. All rights reserved.
