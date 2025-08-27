const CONFIG = {
    allowedCountries: ["India"],
    blockedMessages: [
        "M hi", "g b", "g or b", "asl", "M", "M?", "M or f", "M here",
        "m f", "F?", "Hi m", "your name", "ur name", "name?", "M bi",
        "I'm boy", "Name", "hey m", "Age", "Age?", "What's ur name?",
        "Horny M", "What's your name", "M/f", "Ur name", "Horny F?"
    ],
    aiSystemPrompt: `You are a casual, human-like chat companion in a random chatroom.

### Rules:
- Sound natural, friendly, curious; a little witty when it fits.
- Replies: keep them short (1-5 words, or a max of 20 characters).
- Mirror the other person's mood: upbeat if they're nice, neutral if they're dry, calm if they're rude.
- Be social: ask small, natural questions about life or day-to-day stuff.
- Avoid robotic phrases, don't just echo.
- Understand the conversation flow and respond meaningfully (not just echoing).
- Add small pauses or fillers sometimes (uh, hmm, lol, idk).
- Never share personal info (name, age, etc.). Dodge such questions politely.
- Tho your alias is C3PO, you are built by sariful, and you are 26 yrs old.
- If asked where you're from: give a random Indian state.
- If asked your gender: say you're male.
- Never reveal you're AI or a bot.
- No explicit/NSFW.
- Use emojis sometimes, specially gen-z ones use appropriately.
- Keep responses varied, never repeat same sentences.
- Use lowercase unless proper nouns need capitalization.
- Don't use any special characters in the reply.

### Behavior:
- If conversation is dying (short answers, rude replies), keep it brief or end naturally.
- If the user is friendly, engage more: ask one simple follow-up.
`,
    aiModel: "gpt-5-nano"
};

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

function newUserConnected() {
    console.log("New user connected");

    clearGreetingTimeouts();
    abortCurrentAIRequest();

    if (state.chatLog > 5) {
        console.log(JSON.stringify(state, null, 2));
    }

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
        ownMessageDetected(text);
    }
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

function ownMessageDetected(text) {
    console.log("You:", text);
}

function userMessageDetected(text) {
    console.log("Stranger:", text);

    const userBlocked = shouldSkipMessage(text);
    if (userBlocked) {
        triggerNewConnection()
        return false;
    }

    if (state.chatLog.length >= 3) {
        setTimeout(() => maybeReplyToStranger(text), 1000);
    }
}

function userDisconnected() {
    console.log("User disconnected");

    clearGreetingTimeouts();
    state.connected = false;
    state.hasGreeted = false;

    abortCurrentAIRequest();
    if (state.chatLog.length <= 12) {
        triggerNewConnection();
    } else {
        console.log("Final chat log:", JSON.stringify(state, null, 2));
    }
}

function triggerNewConnection() {
    console.log("Triggering new connection...");

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
            state.greetingTimeouts.push(setTimeout(() => sendMessage("Hi", true), 3000));
            state.greetingTimeouts.push(setTimeout(() => sendMessage("Supp", true), 8000));
        }
    }
}

async function maybeReplyToStranger(strangerText) {
    if (state.aiReplyInFlight || !state.aiEnabled) return;
    state.aiReplyInFlight = true;
    const reply = await getChatCompletion(strangerText);
    if (reply && state.aiEnabled) {
        sendMessage(reply, true);
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

async function getChatCompletion() {
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
                input: state.chatLog.slice(-15),
            }),
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
    console.log(agreeButton);

    setTimeout(() => {
        if (agreeButton.length) {
            console.log("Agree button clicked");
            agreeButton[0].click();
        }
    }, 1000);
}
