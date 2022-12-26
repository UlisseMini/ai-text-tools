const validKey = (k) => k && k.length == 51;
function $(x) {
  return document.getElementById(x);
}

const get = (k) => localStorage.getItem(k);
const set = (k, v) => localStorage.setItem(k, v);

// Process some text via the openai api
async function complete(prompt) {
  const resp = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt: `${prompt}`,
      temperature: 0,
      max_tokens: 200,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${get("apiKey")}`,
    },
  });
  const j = await resp.json();
  // TODO: Use finish_reason to decide on extending length?
  return j["choices"][0]["text"];
}

// Fix grammar in text using a call to the openai API
async function fixGrammar(text) {
  const prompt = `Fix the grammar, punctuation and formatting in the following text:\n\n${text}\n\nFixed:`;
  const result = await complete(prompt);
  return result;
}

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const loggedIn = document.getElementById("logged-in");
  $("fix-grammar").addEventListener("click", async () => {
    const tab = await getCurrentTab();
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      },
      async function (r) {
        const selection = r[0].result;
        if (!selection) return console.error("selection is null");

        console.log(selection);
        const fixed = await fixGrammar(selection);
        console.log(fixed);
        $("result").textContent = fixed;
      }
    );
  });

  async function onLoggedIn() {
    apiKeyInput.style.display = "none";
    loggedIn.style.display = "block";
  }

  if (validKey(get("apiKey"))) {
    onLoggedIn();
  }

  apiKeyInput.addEventListener("change", (e) => {
    if (validKey(e.target.value)) {
      set("apiKey", e.target.value);
      onLoggedIn();
    }
  });
});
