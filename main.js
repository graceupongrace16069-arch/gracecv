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
  const behindMenu = [...document.querySelectorAll("main, .site-footer, [data-to-top], .mobile-bar")];
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

// Scroll motion, the same as on the Olive International Schools site. Set
// here, not in theme.js, so content is only ever hidden by the script that
// reveals it.
const motion = !reduceMotion.matches && "IntersectionObserver" in window;
if (motion) root.classList.add("js-motion");

// Headings are split into words so they can rise in one after another.
// Screen readers get the text once, unsplit. A word inside an element
// (the accent <strong> in the About statement) keeps that element around it.
function splitWords(el) {
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  let i = 0;
  el.childNodes.forEach((node) => {
    const shell = node.nodeType === Node.ELEMENT_NODE ? node : null;
    node.textContent.split(/\s+/).filter(Boolean).forEach((text) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      const word = shell ? shell.cloneNode(false) : inner;
      word.textContent = text;
      if (shell) inner.append(word);
      inner.style.setProperty("--i", i++);
      outer.className = "w";
      outer.append(inner);
      visual.append(outer, " ");
    });
  });
  const spoken = document.createElement("span");
  spoken.className = "sr-only";
  spoken.textContent = el.textContent.replace(/\s+/g, " ").trim();
  el.replaceChildren(spoken, visual);
}

if (motion) {
  document.querySelectorAll("main h2:not(.section-index), .statement, .case-copy h3, .footer-word > span").forEach((heading) => {
    splitWords(heading);
    if (!heading.closest(".reveal")) heading.classList.add("reveal");
  });
}

// Arrival: blocks rise in as they enter the screen and leave again when
// scrolled past, coming back from whichever direction the visitor scrolls.
const revealItems = document.querySelectorAll(".reveal");

if (motion) {
  const revealer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add("is-in");
        } else {
          el.classList.remove("is-in");
          el.dataset.from = entry.boundingClientRect.top < 0 ? "above" : "below";
        }
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
  );
  revealItems.forEach((el) => {
    // Neighbours arrive one after another rather than as a single block
    const siblings = [...el.parentElement.children].filter((sibling) => sibling.classList.contains("reveal"));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${Math.min(index, 4) * 90}ms`;
    revealer.observe(el);
  });
} else {
  revealItems.forEach((el) => el.classList.add("is-in"));
}

// Scroll engine: tells each moving element where it sits on the screen
// (--p, from 1 entering at the bottom to -1 leaving at the top, and --d, how
// far a line has been drawn). Values glide towards their targets with a little
// inertia, so movement stays smooth with a mouse wheel, a trackpad or a finger,
// and plays backwards when scrolling up. Section rules are measured as lines
// at the section's top edge, so they draw as that edge crosses the screen.
if (motion) {
  const heroEl = document.querySelector(".hero");
  const ease = matchMedia("(max-width: 760px)").matches ? 0.16 : 0.1;
  const tracked = [...document.querySelectorAll(".section-head, .marquee, .timeline, .section")].map((el) => ({
    el,
    line: el.classList.contains("section"),
    top: 0,
    h: 0,
    p: null,
    d: null,
    lp: null,
  }));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const docTop = (el) => {
    let top = 0;
    for (; el; el = el.offsetParent) top += el.offsetTop;
    return top;
  };
  const measure = () => {
    tracked.forEach((t) => {
      t.top = docTop(t.el);
      t.h = t.line ? 0 : t.el.offsetHeight;
    });
  };
  let heroCur = null;
  let scrollCur = null;
  let running = false;

  const frame = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    let moving = false;
    for (const t of tracked) {
      const top = t.top - y;
      if (top + t.h < -vh * 0.6 || top > vh * 1.6) continue;
      const target = clamp((top + t.h / 2 - vh / 2) / (vh / 2 + t.h / 2), -1, 1);
      if (t.p === null) t.p = target;
      const diff = target - t.p;
      if (Math.abs(diff) > 0.0004) {
        t.p += diff * ease;
        moving = true;
      } else {
        t.p = target;
      }
      const d = clamp((1 - t.p) * 1.35, 0, 1);
      if (t.lp === null || Math.abs(t.p - t.lp) > 0.0002) {
        t.el.style.setProperty("--p", t.p.toFixed(4));
        t.lp = t.p;
      }
      if (t.d === null || Math.abs(d - t.d) > 0.0002) {
        t.el.style.setProperty("--d", d.toFixed(4));
        t.d = d;
      }
    }
    if (heroEl) {
      const hs = Math.min(y, heroEl.offsetHeight);
      if (heroCur === null) heroCur = hs;
      if (Math.abs(hs - heroCur) > 0.3) {
        heroCur += (hs - heroCur) * ease * 1.4;
        moving = true;
      } else {
        heroCur = hs;
      }
      heroEl.style.setProperty("--hs", `${heroCur.toFixed(1)}px`);
      heroEl.style.setProperty("--hs-n", Math.min(heroCur / 300, 1).toFixed(3));
    }
    if (header) {
      const max = document.documentElement.scrollHeight - vh;
      const s = max > 0 ? y / max : 0;
      if (scrollCur === null) scrollCur = s;
      if (Math.abs(s - scrollCur) > 0.0005) {
        scrollCur += (s - scrollCur) * 0.2;
        moving = true;
      } else {
        scrollCur = s;
      }
      header.style.setProperty("--scroll", scrollCur.toFixed(4));
    }
    if (moving) requestAnimationFrame(frame);
    else running = false;
  };

  const kick = () => {
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  };
  const remeasure = () => {
    measure();
    kick();
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  document.fonts?.ready.then(remeasure);
  // Demos change height as they're used (steps, data tables), which moves everything below
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.body);
  measure();
  running = true;
  frame();
}

// Code that runs past the edge on narrow screens fades out there until it's
// scrolled to the end. Demos add code blocks later, so new ones are picked up too.
const watchCode = (code) => {
  if (code.dataset.fade !== undefined) return;
  code.dataset.fade = "";
  const update = () => code.classList.toggle("is-clipped", code.scrollLeft + code.clientWidth < code.scrollWidth - 2);
  code.addEventListener("scroll", update, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(update).observe(code);
  update();
};

document.querySelectorAll(".code").forEach(watchCode);
if ("MutationObserver" in window) {
  new MutationObserver(() => document.querySelectorAll(".code").forEach(watchCode)).observe(document.querySelector("main"), {
    childList: true,
    subtree: true,
  });
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
