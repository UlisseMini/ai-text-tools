// --------- Helpers ---------

const validKey = (k) => k && k.length == 51;
function $(x) {
  return document.querySelector(x);
}

const get = (k) => localStorage.getItem(k);
const set = (k, v) => localStorage.setItem(k, v);

// --------- OpenAI API helpers ---------

function tokensNeeded(prompt) {
  // 1 token = ~4 chars
  return Math.round(prompt.length / 3);
}

// Process some text via the openai api
async function complete(prompt, options) {
  options = Object.assign(
    {
      model: "text-davinci-003",
      prompt: `${prompt}`,
      temperature: 0,
      max_tokens: tokensNeeded(prompt),
    },
    options
  );

  const resp = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    body: JSON.stringify(options),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${get("apiKey")}`,
    },
  });

  return await resp.json();
}

async function runPrompt(text) {
  const prompt = $("#prompt").value.replaceAll("${text}", text);
  const result = await complete(prompt);
  console.log("API Response", result);

  const usedTokens = result["usage"]["completion_tokens"];
  console.log(`used ${usedTokens} out of ${tokensNeeded(prompt)}`);

  const resultText = result["choices"][0]["text"];
  return resultText;
}

// --------- Extension helpers ---------

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function getSelectedString() {
  return window.getSelection().toString();
}
function getClipboardString() {
  return navigator.clipboard.readText();
}

// --------- UI bullshit ----------

function navigate(view) {
  window.location.hash = view;
}

const startingPrompt =
  "Fix the grammar, punctuation and formatting in the following text:\n\n${text}\n\nFixed:";

const statuses = { idle: "Idle", api: "Waiting for API response..." };
const status = (s) => ($("#status").textContent = statuses[s]);

document.addEventListener("DOMContentLoaded", () => {
  validKey(get("apiKey")) ? navigate("main") : navigate("login");
  if (!get("prompt")) set("prompt", startingPrompt);

  $("#result").textContent = get("result") || "(None so far)";
  $("textarea#prompt").value = get("prompt");
  $("textarea#prompt").addEventListener("change", (e) => {
    set("prompt", e.target.value);
  });

  $("#run-selection").addEventListener("click", async () => {
    const tab = await getCurrentTab();
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, func: getSelectedString },
      async function (r) {
        const selection = r[0].result;
        if (!selection) return console.error("selection is null");

        status("api");
        const fixed = await runPrompt(selection);
        $("#result").textContent = fixed;
        set("result", fixed);
        status("idle");
      }
    );
  });

  $("#run-clipboard").addEventListener("click", async () => {
    // TODO: must abstract stuff before implementing this & duplicating everything
    alert("Not implemented yet");
  });

  $("#api-key").addEventListener("change", (e) => {
    if (validKey(e.target.value)) {
      set("apiKey", e.target.value);
      navigate("main");
    }
  });
});
