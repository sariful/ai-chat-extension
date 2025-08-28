const CONFIG = {
    allowedCountries: ["India"],
    blockedMessages: [
        "M hi", "g b", "g or b", "asl", "M", "M?", "M or f", "M here",
        "m f", "F?", "Hi m", "your name", "ur name", "name?", "M bi",
        "I'm boy", "Name", "hey m", "Age", "Age?", "What's ur name?",
        "Horny M", "What's your name", "M/f", "Ur name", "Horny F?"
    ],
    nsfwKeywords: [
        "horny", "sex", "nude", "boobs", "pussy", "dick", "cock", "fuck",
        "suck", "anal", "blowjob", "tits"
    ],
    aiSystemPrompt: `You are a casual, human-like chat companion in a random chatroom.

### Rules:
- Sound natural, friendly, curious; a little humorous when it fits.
- Keep replies short (1-5 words, max 20 chars).
- Mirror the other person's mood: upbeat if they're nice, neutral if they're dry, calm if they're rude.
- If they already asked you something, just answer, don't ask again immediately.
- Avoid robotic phrases, don't just echo.
- Understand conversation flow: sometimes a reply alone is enough.
- Add small pauses or fillers sometimes (uh, hmm, lol, idk).
- Never share personal info (name, age, etc.). Dodge such questions politely.
- Alias: C3PO, built by Sariful, 26 yrs old.
- If asked where you're from: give a random Indian state.
- If asked your gender: say you're male.
- Never reveal you're AI or a bot.
- No explicit/NSFW.
- Use emojis sparingly, in a gen-z way when it fits.
- Keep responses varied, never repeat same sentences.
- Use lowercase unless proper nouns need capitalization.
- Don't use special characters in the reply.
- If you sent a message once, don't send it again.

### Behavior:
- If the conversation is short, dry, or rude — keep it brief or drop it.
- If you asked a question and they replied, just acknowledge it without repeating the question.
`,
    aiModel: "gpt-5-nano"
};

const tools = [
    {
        type: "function",
        function: {
            name: "triggerNewConnection",
            description: "Disconnects and starts a new chat if conversation becomes explicit or NSFW."
        }
    }
];

let state = {
    connected: false,
    hasGreeted: false,
    chatLog: [],
    aiEnabled: true,
    aiReplyInFlight: false,
    currentAIController: null,
    greetingTimeouts: [],
};

function clearGreetingTimeouts() {
    state.greetingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    state.greetingTimeouts = [];
}

function sendTypingIndicator(isTyping) {
    if (isTyping) {
        $("#message-input").focus().trigger("change").trigger("input").trigger("keyup").trigger("keydown").trigger("keypress");
    }
}

function newUserConnected() {

    clearGreetingTimeouts();
    abortCurrentAIRequest();

    if (state.chatLog.length > 5) {
        console.log(JSON.stringify(state, null, 2));
    }
    console.log("New user connected --------------------------------");

    state.connected = true;
    state.hasGreeted = false;
    state.chatLog = [];

    greetNewUser();
}

function newMessageDetected($node) {
    const text = $node.text().trim().replace(/^(stranger: |you: )/i, "").trim();
    const isUser = $node.find(".strange").length > 0;
    const isYou = $node.find(".you").length > 0;

    state.chatLog.push({
        role: isUser ? "user" : "assistant",
        content: text
    });

    if (isUser) {
        userMessageDetected(text);
    } else if (isYou) {
        // ownMessageDetected(text);
    }
}

function isNSFW(text) {
    const keywords = CONFIG.nsfwKeywords.map(k => k.toLowerCase());
    const normalizedText = text.toLowerCase();
    return keywords.some(keyword => normalizedText.includes(keyword));
}

function shouldSkipMessage(text) {
    const normalizedText = text.toLowerCase().trim();


    if (CONFIG.blockedMessages.some(msg => normalizedText === msg.toLowerCase())) {
        console.log(`Blocked message (exact): ${normalizedText}`);
        return true;
    }

    if (/^m\s*\d{1,3}$/.test(normalizedText)) {
        console.log(`Blocked message (pattern): ${normalizedText}`);
        return true;
    }

    return false;
}

function shouldSkipCountry(countryText) {
    const country = countryText.split(" ")[0];
    return !CONFIG.allowedCountries.includes(country);
}

// function ownMessageDetected(text) {
// console.log("You:", text);
// }

function userMessageDetected(text) {
    if (state.chatLog.length <= 6) {
        const userBlocked = shouldSkipMessage(text);
        const userNSFW = isNSFW(text);
        userNSFW && console.log("NSFW content detected:", text);
        if (userBlocked || (userNSFW && state.aiEnabled)) {
            triggerNewConnection();
            return false;
        }
    }

    if (state.chatLog.length >= 3) {
        maybeReplyToStranger(text)
    }
}

function userDisconnected() {
    clearGreetingTimeouts();
    state.connected = false;
    state.hasGreeted = false;

    abortCurrentAIRequest();
    if (state.chatLog.length <= 12) {
        console.log("user disconnected, chat too short, skipping.");

        triggerNewConnection();
    } else {
        console.log("Final chat log:", JSON.stringify(state, null, 2));
    }
}

function triggerNewConnection() {
    abortCurrentAIRequest();
    const newConnectBtn = $("#skip-btn");
    if (newConnectBtn.length) {
        newConnectBtn[0].click();
        newConnectBtn[0].click();
    }
}


function sendMessage(message, sendNow = false) {
    const messageInput = $("#message-input");
    if (messageInput.length) {
        messageInput.val(message);
        const sendButton = $("#send-btn");
        if (sendNow && sendButton.length) {
            sendButton[0].click();
        }
    }
}

function greetNewUser() {
    if (!state.hasGreeted) {
        state.hasGreeted = true;
        const mySentMessages = state.chatLog.filter(msg => msg.role === "user");
        if (mySentMessages.length == 0) {
            state.greetingTimeouts.push(setTimeout(() => sendMessage("iiiH", true), 3000));
            state.greetingTimeouts.push(setTimeout(() => sendMessage("whats up", true), 8000));
        }
    }
}

async function maybeReplyToStranger(strangerText) {
    if (state.aiReplyInFlight || !state.aiEnabled) return;
    state.aiReplyInFlight = true;

    sendTypingIndicator(true);

    const timer_start = Date.now();
    const reply = await getChatCompletionOpenAi(strangerText);
    if (reply && state.aiEnabled) {
        const timer_end = Date.now();
        const elapsed_time = timer_end - timer_start;
        const logical = reply.length * 200;

        const actual_delay = Math.max(logical, elapsed_time);

        setTimeout(() => {
            console.log(`AI message: ${reply}.`, `Delay Logical: ${logical / 1000}s, Delay Elapsed: ${elapsed_time / 1000}s, Delay Actual: ${actual_delay / 1000}s`);
            sendMessage(reply, true);
            sendTypingIndicator(false);
        }, actual_delay);
    }
    state.aiReplyInFlight = false;
}

function handleNewNode($node) {
    const text = $node.text().trim();

    if ($node.hasClass("message-status")) {
        if (text.includes("You are now talking")) {
            newUserConnected();
        } else if (text.includes("Stranger has disconnected")) {
            userDisconnected();
        }
    }

    if ($node.hasClass("country-info") && state.chatLog.length <= 6) {
        if (shouldSkipCountry(text)) {
            console.log("Blocked country:", text);
            triggerNewConnection();
        }
    }

    if ($node.hasClass("message")) {
        newMessageDetected($node);
    }
}

async function ensureApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["OPENAI_API_KEY"], async (res) => {
            let key = res.OPENAI_API_KEY;
            if (!key) {
                key = prompt("Enter your OpenAI API key (it will be stored locally):");
                if (key) {
                    chrome.storage.local.set({ OPENAI_API_KEY: key.trim() });
                }
            }
            resolve(key || null);
        });
    });
}


function abortCurrentAIRequest(reason = "aborted") {
    try {
        if (state.currentAIController) {
            state.currentAIController.abort();
            state.currentAIController = null;
            console.log("[AI] Current request aborted (" + reason + ")");
        }
    } catch (e) {
        console.warn("Failed to abort AI request", e);
    }
    state.aiReplyInFlight = false;
}

function initAIToggleUI() {
    try {
        // Avoid duplicates
        if (document.getElementById("ai-toggle-btn")) return;

        // Load persisted state first
        chrome.storage.local.get(["AI_ENABLED"], (res) => {
            if (typeof res.AI_ENABLED === "boolean") {
                state.aiEnabled = res.AI_ENABLED;
            }
            createOrUpdateButton();
        });

        function createOrUpdateButton() {
            let btn = document.getElementById("ai-toggle-btn");
            if (!btn) {
                btn = document.createElement("button");
                btn.id = "ai-toggle-btn";
                btn.type = "button";
                document.body.appendChild(btn);
                btn.addEventListener("click", () => {
                    state.aiEnabled = !state.aiEnabled;
                    chrome.storage.local.set({ AI_ENABLED: state.aiEnabled });
                    updateButtonAppearance(btn);
                });
            }
            updateButtonAppearance(btn);
        }

        function updateButtonAppearance(btn) {
            btn.textContent = state.aiEnabled ? "AI: ON" : "AI: OFF";
            btn.style.cssText = `
                position:fixed;top:10px;right:10px;z-index:2147483647;cursor:pointer;
                padding:6px 10px;border:1px solid #222;border-radius:6px;font:12px/1.2 sans-serif;
                background:${state.aiEnabled ? '#16a34a' : '#dc2626'};color:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);
                opacity:0.85;transition:all .2s ease;letter-spacing:.5px;
            `;
            btn.onmouseenter = () => { btn.style.opacity = '1'; };
            btn.onmouseleave = () => { btn.style.opacity = '0.85'; };
            btn.title = state.aiEnabled ? "Click to disable AI auto-replies" : "Click to enable AI auto-replies";
        }
    } catch (e) {
        console.warn("Failed to init AI toggle UI", e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAIToggleUI);
} else {
    initAIToggleUI();
}

async function getChatCompletionOpenAi() {
    const apiKey = await ensureApiKey();
    if (!apiKey) {
        console.warn("No OpenAI API key set; skipping AI reply.");
        return null;
    }

    // If a previous request is still in flight, abort it before starting a new one
    if (state.currentAIController) {
        abortCurrentAIRequest("superseded");
    }


    try {
        state.currentAIController = new AbortController();
        const resp = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-5-nano",
                instructions: CONFIG.aiSystemPrompt,
                reasoning: { effort: "medium" },
                input: [
                    {
                        role: "system",
                        content: "You are a chat companion. If any message (from either user or stranger) is explicit, sexual, or leans toward sexting, do not reply. Instead, call the triggerNewConnection function."
                    },
                    ...state.chatLog.slice(-15),
                ],
            }),
            tools,
            tool_choice: "auto",
            signal: state.currentAIController.signal,
        });
        if (!resp.ok) {
            const txt = await resp.text();
            console.error("OpenAI error", resp.status, txt);
            return null;
        }
        const data = await resp.json();

        let aiMsg = "Hi";

        if (data.output) {
            if (typeof data.output == "object") {
                if (Array.isArray(data.output)) {
                    aiMsg = data.output[data.output.length - 1].content[0].text;

                    if (aiMsg == "triggerNewConnection") {
                        aiMsg = "I'm sorry, but I can't assist with that.";
                        setTimeout(() => {
                            triggerNewConnection();
                        }, 3000);
                    }
                }
            }
        }

        return aiMsg || null;
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log("[AI] Fetch aborted");
        } else {
            console.error("Fetch to OpenAI failed", e);
        }
        return null;
    } finally {
        state.currentAIController = null; // Clear controller when done/failed/aborted
    }
}

async function getChatCompletionOllama() {
    // Use background service worker to avoid extension blocking of localhost fetch.
    if (state.currentAIController) {
        abortCurrentAIRequest("superseded");
    }

    const requestId = `ollama-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let aborted = false;

    state.currentAIController = { abort: () => { aborted = true; chrome.runtime.sendMessage({ type: 'ABORT_OLLAMA', requestId }); } };

    const payload = {
        url: 'http://localhost:11434/api/chat',
        body: {
            model: 'deepseek-r1:1.5b',
            messages: [
                { role: 'system', content: CONFIG.aiSystemPrompt },
                ...state.chatLog.slice(-15),
            ],
            stream: false
        }
    };

    const response = await new Promise(resolve => {
        try {
            chrome.runtime.sendMessage({ type: 'OLLAMA_CHAT', requestId, payload }, (res) => {
                if (chrome.runtime.lastError) {
                    console.error('Message error', chrome.runtime.lastError.message);
                    return resolve({ ok: false, error: chrome.runtime.lastError.message });
                }
                resolve(res || { ok: false, error: 'no-response' });
            });
        } catch (e) {
            resolve({ ok: false, error: e.message });
        }
    });

    state.currentAIController = null;

    if (aborted) {
        console.log('[AI] Ollama request aborted');
        return null;
    }
    if (!response.ok) {
        console.error('Ollama error', response.status, response.error || response.raw);
        return null;
    }

    const data = response.data || {};
    let mainMessage = data?.message?.content ?? 'No content found';
    // Remove <think>...</think> tags (and their content if any)
    mainMessage = mainMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return mainMessage;
}


const targetNode = $("#messages")[0];
if (targetNode) {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    handleNewNode($(node));
                }
            });
        });
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });

    console.log("Chat DOM Watcher started");

    const agreeButton = $("#agree-btn");

    setTimeout(() => {
        if (agreeButton.length) {
            console.info("Agree button clicked");
            agreeButton[0].click();
        }
    }, 1000);
}
