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
  $("stageBadge").textContent =
    (state.source === "live" ? "LIVE \u00b7 " : "MOCK \u00b7 ") + state.stage;
  const tokens = state.tokens.length
    ? state.tokens
        .map(function (tok) {
          return '<span class="token">' + escapeHtml(tok) + "</span>";
        })
        .join("")
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

  if (state.source === "live" && !state.tops.length) {
    $("bars").innerHTML =
      '<div class="note">Groq does not return logprobs. Live mode shows streamed tokens. Use Mock to see a candidate distribution.</div>';
  } else {
    $("bars").innerHTML = (state.tops || [])
      .map(function (t, i) {
        const w = Math.max(2, Math.round(t.p * 100));
        const label = t.tok.length > 18 ? t.tok.slice(0, 16) + "\u2026" : t.tok;
        return (
          '<div class="bar-row"><span class="bar-label" title="' +
          escapeHtml(t.tok) +
          '">' +
          escapeHtml(label) +
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
  }

  let status = state.error
    ? "Error: " + state.error
    : state.done
      ? "Done"
      : state.running
        ? state.source === "live"
          ? "Streaming from Groq\u2026"
          : "Generating\u2026"
        : "Idle \u00b7 " + state.source + " \u00b7 " + (state.memoryOn ? "memory on" : "no memory");
  $("status").textContent = status;
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

document.querySelectorAll("[data-source]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll("[data-source]").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    harness.setSource(btn.dataset.source);
  });
});

$("temp").addEventListener("input", function (e) {
  const t = Number(e.target.value) / 100;
  $("tempVal").textContent = t.toFixed(2);
  harness.setTemp(t);
});

$("model").addEventListener("change", function (e) {
  harness.setModel(e.target.value);
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
