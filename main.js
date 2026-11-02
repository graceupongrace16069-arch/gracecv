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

// Mobile menu: a full-screen panel below 760px. While it's open the page
// behind it is inert (no scrolling, no focus) and Escape closes it.
const header = document.querySelector(".site-header");
const menuButton = document.querySelector("[data-menu]");
const narrowScreen = matchMedia("(max-width: 760px)");

if (header && menuButton) {
  const behindMenu = [...document.querySelectorAll("main, .site-footer, [data-to-top]")];
  const setOpen = (open) => {
    header.classList.toggle("is-open", open);
    header.classList.remove("is-hidden");
    menuButton.setAttribute("aria-expanded", String(open));
    root.classList.toggle("menu-open", open);
    behindMenu.forEach((el) => (el.inert = open));
  };
  menuButton.hidden = false;
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    if (open) header.querySelector(".nav a")?.focus();
  });
  header.querySelectorAll(".nav a, .brand").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      menuButton.focus();
    }
  });
  narrowScreen.addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
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

// Scroll animations. Where the browser supports scroll-driven animations,
// styles.css ties every effect to the scroll position, so it plays forward on
// the way down and backward on the way up. Elsewhere, content rises in as it
// enters and resets once it drops back below the fold, so it rises again on
// the next pass down.
const revealItems = document.querySelectorAll(".reveal");
const scrollLinked = !reduceMotion.matches && window.CSS?.supports?.("animation-timeline: view()");

if (scrollLinked) {
  // Nothing to do: styles.css runs the reveals.
} else if ("IntersectionObserver" in window && !reduceMotion.matches) {
  // Set here, not in theme.js, so content is only ever hidden by the script that reveals it.
  root.classList.add("reveal-ready");
  const revealer = new IntersectionObserver(
    (entries) => {
      const arriving = entries.filter((entry) => entry.isIntersecting);
      arriving.forEach((entry, i) => {
        entry.target.style.setProperty("--delay", `${Math.min(i, 4) * 80}ms`);
        entry.target.classList.add("is-in");
      });
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top > 0) entry.target.classList.remove("is-in");
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  revealItems.forEach((item) => revealer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-in"));
}

// About statement: split into words so each one can light up in turn as it
// scrolls past (styles.css drives the timing). Screen readers get the
// sentence once, unsplit.
const statement = document.querySelector("[data-statement]");

if (statement && scrollLinked) {
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  let count = 0;
  statement.childNodes.forEach((node) => {
    const key = node.nodeType === Node.ELEMENT_NODE;
    node.textContent.split(/\s+/).filter(Boolean).forEach((text) => {
      const word = document.createElement("span");
      word.className = key ? "w is-key" : "w";
      word.textContent = text;
      word.style.setProperty("--i", count++);
      visual.append(word, " ");
    });
  });
  const spoken = document.createElement("span");
  spoken.className = "sr-only";
  spoken.textContent = statement.textContent.replace(/\s+/g, " ").trim();
  statement.style.setProperty("--n", count);
  statement.replaceChildren(spoken, visual);
}

// Scroll rhythm: the header slides away while reading down and comes back on
// the way up. Once past the hero, the back-to-top button appears on the way
// up (or at the very end), so neither covers content.
const toTop = document.querySelector("[data-to-top]");
const hero = document.querySelector(".hero");
let heroInView = true;
let lastY = window.scrollY;
let scrollQueued = false;

function onScroll() {
  scrollQueued = false;
  const y = Math.max(0, window.scrollY);
  const delta = y - lastY;
  if (Math.abs(delta) < 6) return;
  lastY = y;
  const goingDown = delta > 0;
  const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 160;
  header?.classList.toggle(
    "is-hidden",
    goingDown && y > 120 && !header.classList.contains("is-open") && !header.contains(document.activeElement)
  );
  toTop?.classList.toggle("is-visible", !heroInView && (!goingDown || atEnd));
}

window.addEventListener(
  "scroll",
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true }
);
header?.addEventListener("focusin", () => header.classList.remove("is-hidden"));

if (toTop && hero && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    heroInView = entry.isIntersecting;
    if (heroInView) toTop.classList.remove("is-visible");
  }).observe(hero);
  toTop.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    document.querySelector(".brand")?.focus({ preventScroll: true });
  });
}

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
