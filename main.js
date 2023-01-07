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
const setStatus = (s) => ($("#status").textContent = statuses[s]);
document.addEventListener("DOMContentLoaded", () => {
    var _a, _b, _c, _d;
    validKey(get("apiKey")) ? navigate("main") : navigate("login");
    if (!get("prompt"))
        set("prompt", startingPrompt);
    $("p#result").textContent =
        get("result") || "(None so far)";
    $("textarea#prompt").value = get("prompt");
    (_a = $("textarea#prompt")) === null || _a === void 0 ? void 0 : _a.addEventListener("change", (e) => {
        set("prompt", e.target.value);
    });
    (_b = $("#run-selection")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", async () => {
        const tab = await getCurrentTab();
        chrome.scripting.executeScript({ target: { tabId: tab.id }, func: getSelectedString }, async function (r) {
            const selection = r[0].result;
            if (!selection)
                return console.error("selection is null");
            setStatus("api");
            const fixed = await runPrompt(selection);
            $("#result").textContent = fixed;
            set("result", fixed);
            setStatus("idle");
        });
    });
    (_c = $("#run-clipboard")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", async () => {
        // TODO: must abstract stuff before implementing this & duplicating everything
        alert("Not implemented yet");
    });
    (_d = $("#api-key")) === null || _d === void 0 ? void 0 : _d.addEventListener("change", (e) => {
        const value = e.target.value;
        if (validKey(value)) {
            set("apiKey", value);
            navigate("main");
        }
    });
});
