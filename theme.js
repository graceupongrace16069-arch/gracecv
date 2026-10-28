// Runs before first paint: flag that JavaScript is on and apply a saved theme
// choice, so the page never flashes the wrong theme.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch (e) {}
})();
