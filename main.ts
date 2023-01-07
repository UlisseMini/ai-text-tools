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
  const prompt = el.prompt.value.replaceAll("${text}", text);
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

// All elements used for view
type ElementsView = {
  result: HTMLParagraphElement;
  prompt: HTMLTextAreaElement;
  status: HTMLSpanElement;
  apiKey: HTMLInputElement;
  selectionButton: HTMLButtonElement;
  clipboardButton: HTMLButtonElement;
};

let el: ElementsView;

document.addEventListener("DOMContentLoaded", () => {
  validKey(get("apiKey")) ? navigate("main") : navigate("login");
  if (!get("prompt")) set("prompt", startingPrompt);

  // Get elements
  el = {
    result: document.querySelector("p#result"),
    prompt: document.querySelector("textarea#prompt"),
    status: document.querySelector("#status"),
    apiKey: document.querySelector("#api-key"),
    selectionButton: document.querySelector("#run-selection"),
    clipboardButton: document.querySelector("#run-clipboard"),
  } as ElementsView;

  // Init elements
  el.result.textContent = get("result") || "(None so far)";
  el.prompt.value = get("prompt") || startingPrompt;

  el.prompt.addEventListener("change", () => {
    set("prompt", el.prompt.value);
  });

  const doTransform = async (text: string) => {
    el.status.textContent = statuses.api;
    const fixed = await runPrompt(text);
    el.result.textContent = fixed;
    set("result", fixed);
    el.status.textContent = statuses.idle;
  };

  el.selectionButton.addEventListener("click", async () => {
    const tab = await getCurrentTab();
    chrome.scripting.executeScript(
      { target: { tabId: tab.id! }, func: getSelectedString },
      async function (r: any) {
        const selection = r[0].result;
        if (!selection) return console.error("selection is null");
        doTransform(selection);
      }
    );
  });

  el.clipboardButton.addEventListener("click", () => {
    // FIXME: Pending promise forever
    console.log("getting clipboard...");
    navigator.clipboard.readText().then(
      function (text) {
        console.log("Text from clipboard: ", text);
      },
      function (error) {
        console.error("Error reading text from clipboard: ", error);
      }
    );
  });

  el.apiKey.addEventListener("change", () => {
    if (validKey(el.apiKey.value)) {
      set("apiKey", el.apiKey.value);
      navigate("main");
    }
  });
});
