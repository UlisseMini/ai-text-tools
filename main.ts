/// <reference types="chrome"/>

// TODO(cleanup)
// - Replace typecasting with more typescripty code (fewer casts)
//
// TODO(feat)
// - Keybind to run current transform on {selectred,clipboard} text
// - Settings to auto-overwrite clipboard (I would pick yes, I have a clipboard manager)
// - Multiple tabs of prompts (speculative: inherit from OAI playground?)

// --------- Helpers ---------

const validKey = (k: string | null) => k && k.length == 51;
function $(x: string): HTMLElement | null {
  return document.querySelector(x);
}

const get = (k: string) => localStorage.getItem(k);
const set = (k: string, v: string) => localStorage.setItem(k, v);

// --------- OpenAI API helpers ---------

function tokensNeeded(prompt: string) {
  // 1 token = ~4 chars
  return Math.round(prompt.length / 3);
}

// Process some text via the openai api
async function complete(prompt: string, options?: object) {
  options = Object.assign(
    {
      model: "text-davinci-003",
      prompt: `${prompt}`,
      temperature: 0,
      max_tokens: tokensNeeded(prompt),
    },
    options || {}
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

async function runPrompt(text: string) {
  const prompt = ($("#prompt") as HTMLInputElement).value.replaceAll(
    "${text}",
    text
  );
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

function getSelectedString(): string | undefined {
  return window.getSelection()?.toString();
}
async function getClipboardString(): Promise<string | undefined> {
  return await navigator.clipboard.readText();
}

// --------- UI bullshit ----------

function navigate(view: string) {
  window.location.hash = view;
}

const startingPrompt =
  "Fix the grammar, punctuation and formatting in the following text:\n\n${text}\n\nFixed:";

const statuses: { [k: string]: string } = {
  idle: "Idle",
  api: "Waiting for API response...",
};
const setStatus = (s: string) =>
  (($("#status") as HTMLSpanElement).textContent = statuses[s]);

document.addEventListener("DOMContentLoaded", () => {
  validKey(get("apiKey")) ? navigate("main") : navigate("login");
  if (!get("prompt")) set("prompt", startingPrompt);

  ($("p#result") as HTMLParagraphElement).textContent =
    get("result") || "(None so far)";
  ($("textarea#prompt") as HTMLTextAreaElement).value = get("prompt")!;
  $("textarea#prompt")?.addEventListener("change", (e) => {
    set("prompt", (e.target as HTMLTextAreaElement).value);
  });

  $("#run-selection")?.addEventListener("click", async () => {
    const tab = await getCurrentTab();
    chrome.scripting.executeScript(
      { target: { tabId: tab.id! }, func: getSelectedString },
      async function (r: any) {
        const selection = r[0].result;
        if (!selection) return console.error("selection is null");

        setStatus("api");
        const fixed = await runPrompt(selection);
        ($("#result") as HTMLInputElement).textContent = fixed;
        set("result", fixed);
        setStatus("idle");
      }
    );
  });

  $("#run-clipboard")?.addEventListener("click", async () => {
    // TODO: must abstract stuff before implementing this & duplicating everything
    alert("Not implemented yet");
  });

  $("#api-key")?.addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (validKey(value)) {
      set("apiKey", value);
      navigate("main");
    }
  });
});
