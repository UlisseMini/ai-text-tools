"use strict";
/// <reference types="chrome"/>
// TODO(cleanup)
// - Replace typecasting with more typescripty code (fewer casts)
//
// TODO(feat)
// - Keybind to run current transform on {selectred,clipboard} text
// - Settings to auto-overwrite clipboard (I would pick yes, I have a clipboard manager)
// - Multiple tabs of prompts (speculative: inherit from OAI playground?)
// --------- Helpers ---------
const validKey = (k) => k && k.length == 51;
const get = (k) => localStorage.getItem(k);
const set = (k, v) => localStorage.setItem(k, v);
// --------- OpenAI API helpers ---------
function tokensNeeded(prompt) {
    // 1 token = ~4 chars
    return Math.round(prompt.length / 3);
}
// Process some text via the openai api
async function complete(prompt, options) {
    options = Object.assign({
        model: "text-davinci-003",
        prompt: `${prompt}`,
        temperature: 0,
        max_tokens: tokensNeeded(prompt),
    }, options || {});
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
function getSelectedString() {
    var _a;
    return (_a = window.getSelection()) === null || _a === void 0 ? void 0 : _a.toString();
}
async function getClipboardString() {
    return await navigator.clipboard.readText();
}
// --------- UI bullshit ----------
function navigate(view) {
    window.location.hash = view;
}
const startingPrompt = "Fix the grammar, punctuation and formatting in the following text:\n\n${text}\n\nFixed:";
const statuses = {
    idle: "Idle",
    api: "Waiting for API response...",
};
let el;
document.addEventListener("DOMContentLoaded", () => {
    validKey(get("apiKey")) ? navigate("main") : navigate("login");
    if (!get("prompt"))
        set("prompt", startingPrompt);
    // Get elements
    el = {
        result: document.querySelector("p#result"),
        prompt: document.querySelector("textarea#prompt"),
        status: document.querySelector("#status"),
        apiKey: document.querySelector("#api-key"),
        selectionButton: document.querySelector("#run-selection"),
        clipboardButton: document.querySelector("#run-clipboard"),
    };
    // Init elements
    el.result.textContent = get("result") || "(None so far)";
    el.prompt.value = get("prompt") || startingPrompt;
    el.prompt.addEventListener("change", () => {
        set("prompt", el.prompt.value);
    });
    el.selectionButton.addEventListener("click", async () => {
        const tab = await getCurrentTab();
        chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getSelectedString }, async function (r) {
            const selection = r[0].result;
            if (!selection)
                return console.error("selection is null");
            el.status.textContent = statuses.api;
            const fixed = await runPrompt(selection);
            el.result.textContent = fixed;
            set("result", fixed);
            el.status.textContent = statuses.idle;
        });
    });
    el.clipboardButton.addEventListener("click", async () => {
        // TODO: must abstract stuff before implementing this & duplicating everything
        alert("Not implemented yet");
    });
    el.apiKey.addEventListener("change", () => {
        if (validKey(el.apiKey.value)) {
            set("apiKey", el.apiKey.value);
            navigate("main");
        }
    });
});
