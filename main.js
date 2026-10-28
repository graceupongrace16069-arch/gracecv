const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Theme toggle: remembers the visitor's choice, otherwise follows the system.
const themeToggle = document.querySelector("[data-theme-toggle]");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : systemDark.matches);

function syncTheme() {
  const dark = isDark();
  themeToggle.setAttribute("aria-pressed", String(dark));
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.content = dark ? "#0e0e0d" : "#f7f6f3";
  });
}

if (themeToggle) {
  themeToggle.hidden = false;
  syncTheme();
  systemDark.addEventListener("change", syncTheme);

  themeToggle.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      syncTheme();
    };
    if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(apply);
    else apply();
    try {
      localStorage.setItem("theme", next);
    } catch {}
  });
}

// Mobile menu (the nav collapses below 760px).
const header = document.querySelector(".site-header");
const menuButton = document.querySelector("[data-menu]");

if (header && menuButton) {
  const setOpen = (open) => {
    header.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  };
  menuButton.hidden = false;
  menuButton.addEventListener("click", () => setOpen(menuButton.getAttribute("aria-expanded") !== "true"));
  header.querySelectorAll(".nav a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      menuButton.focus();
    }
  });
}

// Highlight the nav link for the section currently in view.
const navLinks = new Map(
  [...document.querySelectorAll('.nav a[href^="#"]')].map((link) => [link.getAttribute("href").slice(1), link])
);

if ("IntersectionObserver" in window && navLinks.size) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navLinks.forEach((link) => link.removeAttribute("aria-current"));
        navLinks.get(entry.target.id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
}

// "Save CV as PDF": the print stylesheet turns the page into a CV.
document.querySelectorAll("[data-print]").forEach((button) => {
  button.hidden = false;
  button.addEventListener("click", () => window.print());
});

// Local time in Nairobi, for recruiters in other time zones.
const clock = document.querySelector("[data-clock]");

if (clock) {
  try {
    const format = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" });
    const tick = () => {
      const now = new Date();
      clock.textContent = format.format(now);
      clock.dateTime = now.toISOString();
    };
    tick();
    setInterval(tick, 30000);
    clock.closest("[data-clock-row]").hidden = false;
  } catch {}
}

// Copy-email button, shown only where the Clipboard API is available.
const copyButton = document.querySelector("[data-copy]");
const copyStatus = document.querySelector(".copy-status");

if (copyButton && navigator.clipboard && window.isSecureContext) {
  const label = copyButton.querySelector("span");
  let resetTimer;
  copyButton.hidden = false;

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      label.textContent = "Copied";
      copyStatus.textContent = "Email address copied to clipboard";
    } catch {
      label.textContent = "Copy failed";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      label.textContent = "Copy email";
      copyStatus.textContent = "";
    }, 2000);
  });
}

// Content rises in once as it enters the viewport. Siblings that arrive
// together are staggered slightly; nothing ever fades back out.
const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !reduceMotion.matches) {
  // Set here, not in theme.js, so content is only ever hidden by the script that reveals it.
  root.classList.add("reveal-ready");
  const revealer = new IntersectionObserver(
    (entries) => {
      const arriving = entries.filter((entry) => entry.isIntersecting);
      arriving.forEach((entry, i) => {
        entry.target.style.setProperty("--delay", `${Math.min(i, 4) * 80}ms`);
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  revealItems.forEach((item) => revealer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-in"));
}

// Back-to-top button, shown once the hero is out of view.
const toTop = document.querySelector("[data-to-top]");
const hero = document.querySelector(".hero");

if (toTop && hero && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => toTop.classList.toggle("is-visible", !entry.isIntersecting)).observe(hero);
  toTop.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    document.querySelector(".brand")?.focus({ preventScroll: true });
  });
}

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
