const harness = new window.LLMHarness();
const $ = function (id) {
  return document.getElementById(id);
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function render(state) {
  $("stageBadge").textContent = "Stage: " + state.stage;
  const tokens = state.generated
    ? state.generated.split("").map(function (ch) {
        return '<span class="token">' + escapeHtml(ch === " " ? " " : ch) + "</span>";
      }).join("")
    : '<span class="placeholder">Press Step or Run</span>';
  $("output").innerHTML = tokens + (state.running ? '<span class="caret"></span>' : "");

  $("context").innerHTML = state.context
    .map(function (c) {
      return (
        '<div class="context-block ctx-' +
        c.role +
        '"><div class="role">' +
        escapeHtml(c.role) +
        "</div>" +
        escapeHtml(c.text) +
        "</div>"
      );
    })
    .join("");

  $("bars").innerHTML = (state.tops || [])
    .map(function (t, i) {
      const w = Math.max(2, Math.round(t.p * 100));
      return (
        '<div class="bar-row"><span class="bar-label">' +
        escapeHtml(t.char) +
        '</span><div class="bar-track"><div class="bar-fill' +
        (i === 0 ? " top" : "") +
        '" style="width:' +
        w +
        '%"></div></div><span class="bar-pct">' +
        w +
        "%</span></div>"
      );
    })
    .join("");

  $("status").textContent = state.done
    ? "Done"
    : state.running
      ? "Generating…"
      : "Idle \u00b7 " + (state.memoryOn ? "memory on" : "no memory") + " \u00b7 no tools active";
}

harness.onUpdate = render;

document.querySelectorAll("[data-stage]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll("[data-stage]").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    harness.setStage(btn.dataset.stage);
  });
});

$("temp").addEventListener("input", function (e) {
  const t = Number(e.target.value) / 100;
  $("tempVal").textContent = t.toFixed(2);
  harness.setTemp(t);
});

$("stepBtn").addEventListener("click", function () {
  harness.step();
});
$("runBtn").addEventListener("click", function () {
  if (harness.running) harness.stop();
  else harness.run();
});
$("resetBtn").addEventListener("click", function () {
  harness.reset($("prompt").value);
});
$("prompt").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    harness.reset($("prompt").value);
  }
});

harness.reset($("prompt").value);
