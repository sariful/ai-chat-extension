// === Configuration ===
const allowedCountries = ["India"];
const blockedMessages = [
    "M",
    "M or f",
    "M here",
    "F?",
    "Hi m",
    "your name",
    "ur name",
    "name?",
    "M bi",
    "I'm boy",
    "Name"
];

// === OpenAI / ChatGPT Auto Reply Configuration ===
// The API key is NOT stored in code. On first run, user is prompted and key saved to chrome.storage.local.
// You can reset by running: chrome.storage.local.remove('OPENAI_API_KEY') from DevTools console.
const AI_SYSTEM_PROMPT = `You are a friendly, concise chat companion, only chat, in a random text chat.
Rules:
- be funny, sarcastic, humorous.
- Keep each reply under 2-5 words strictly unless you have something to explain in length, then keep it maximum 15.
- make yourself look as human as possible.
- Since this is a chat, people will use short form like wby, wyd, wdym or others, please understand that.
- You can also use short forms in the reply to make the conversation feel more natural and short.
- If asked for personal info, deflect kindly.
- Avoid explicit content.
- if someone asks if you are AI, deflect politely.
- if someone aks if you are F or M (F stands for female and M stands for male) in that case, if the other person is male say female otherwise male.
- every response should be lowercase
`;

// Conversation state tracking
let conversationHistory = [
    { role: "developer", content: AI_SYSTEM_PROMPT }
];
const processedStrangerMessages = new Set();
let aiReplyInFlight = false;
let aiEnabled = true; // runtime flag (persisted in storage)

// === AI Enable/Disable Toggle ===
function initAIToggleUI() {
    try {
        // Avoid duplicates
        if (document.getElementById("ai-toggle-btn")) return;

        // Load persisted state first
        chrome.storage.local.get(["AI_ENABLED"], (res) => {
            if (typeof res.AI_ENABLED === "boolean") {
                aiEnabled = res.AI_ENABLED;
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
                    aiEnabled = !aiEnabled;
                    chrome.storage.local.set({ AI_ENABLED: aiEnabled });
                    updateButtonAppearance(btn);
                });
            }
            updateButtonAppearance(btn);
        }

        function updateButtonAppearance(btn) {
            btn.textContent = aiEnabled ? "AI: ON" : "AI: OFF";
            btn.style.cssText = `
                position:fixed;top:10px;right:10px;z-index:2147483647;cursor:pointer;
                padding:6px 10px;border:1px solid #222;border-radius:6px;font:12px/1.2 sans-serif;
                background:${aiEnabled ? '#16a34a' : '#dc2626'};color:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);
                opacity:0.85;transition:all .2s ease;letter-spacing:.5px;
            `;
            btn.onmouseenter = () => { btn.style.opacity = '1'; };
            btn.onmouseleave = () => { btn.style.opacity = '0.85'; };
            btn.title = aiEnabled ? "Click to disable AI auto-replies" : "Click to enable AI auto-replies";
        }
    } catch (e) {
        console.warn("Failed to init AI toggle UI", e);
    }
}

// Initialize toggle ASAP (DOM may already be ready in MV3)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAIToggleUI);
} else {
    initAIToggleUI();
}

// Fetch / ensure API key
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

async function getChatCompletion(userMessage) {
    const apiKey = await ensureApiKey();
    if (!apiKey) {
        console.warn("No OpenAI API key set; skipping AI reply.");
        return null;
    }

    conversationHistory.push({ role: "user", content: userMessage });
    // Trim history (keep system + last 10 messages)
    if (conversationHistory.length > 10) {
        const system = conversationHistory[0];
        conversationHistory = [system, ...conversationHistory.slice(-9)];
    }

    try {
        // --- Typing indicator start ---
        startTypingIndicator();
        const resp = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-5-nano",
                input: conversationHistory,
            }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            console.error("OpenAI error", resp.status, txt);
            stopTypingIndicator();
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

        if (aiMsg) {
            conversationHistory.push({ role: "assistant", content: aiMsg });
        }
        stopTypingIndicator();
        return aiMsg || null;
    } catch (e) {
        console.error("Fetch to OpenAI failed", e);
        stopTypingIndicator();
        return null;
    }
}

// === Typing Indicator Helpers ===
let typingIndicatorInterval = null;
function startTypingIndicator() {
    try {
        if (typingIndicatorInterval) return; // already running
        const input = $("#message-input");
        if (!input.length) return;
        let dots = "";
        input.data("__origVal", input.val());
        typingIndicatorInterval = setInterval(() => {
            dots = dots.length < 3 ? dots + "." : "";
            input.val("typing" + dots);
            // Trigger events so the site (if it listens) treats it like real typing
            input.trigger("input").trigger("change").trigger("keypress");
        }, 550);
    } catch (e) {
        console.warn("Failed to start typing indicator", e);
    }
}

function stopTypingIndicator(preserveText = false) {
    try {
        if (typingIndicatorInterval) {
            clearInterval(typingIndicatorInterval);
            typingIndicatorInterval = null;
        }
        const input = $("#message-input");
        if (!input.length) return;
        if (!preserveText) {
            input.val("");
        }
        input.removeData("__origVal");
        input.trigger("input").trigger("change").trigger("keypress");
    } catch (e) {
        console.warn("Failed to stop typing indicator", e);
    }
}

async function maybeReplyToStranger(strangerText) {
    if (aiReplyInFlight) return; // avoid overlapping
    if (!aiEnabled) return; // AI disabled
    aiReplyInFlight = true;
    const reply = await getChatCompletion(strangerText);
    if (reply && aiEnabled) { // re-check enabled before sending
        // Small natural delay 1.5-3.5s
        sendMessage(reply, true);
        aiReplyInFlight = false;
    } else {
        aiReplyInFlight = false;
    }
}

// Flag to track if we've already greeted in the current conversation
let hasGreeted = false;

function triggerNewConnection() {
    const newConnectBtn = $("#skip-btn");
    console.log("Triggering new connection...");
    if (newConnectBtn.length) {
        newConnectBtn[0].click(); // Trigger native click
        newConnectBtn[0].click(); // Trigger native click
    }
    // Reset greeting flag for new connection
    hasGreeted = false;
    // Reset AI conversation state
    conversationHistory = [{ role: "system", content: AI_SYSTEM_PROMPT }];
    processedStrangerMessages.clear();
    aiReplyInFlight = false;
}

function sendMessage(message, sendNow = false) {
    console.log("new connected, sending hi");

    const messageInput = $("#message-input");
    if (messageInput.length) {
        messageInput.val(message);
        const sendButton = $("#send-btn");

        if (sendNow && sendButton.length) {
            sendButton[0].click(); // Trigger native click
        }
    }
}

function checkMessages() {
    const messages = $(
        "#messages .message, #messages .message-status, #messages .country-info"
    );
    const messageLength = $("#messages .message").length;

    messages.each(function () {
        const text = $(this).text().trim();

        // // New Connection Detection - Send "Hi" automatically (only once)
        // if ($(this).hasClass("message-status") && text.includes("You are now talking to a random stranger") && !hasGreeted) {
        //     console.log("New connection detected, sending Hi...");
        //     setTimeout(() => {
        //         if (!hasGreeted) { // Double-check before sending
        //             hasGreeted = true; // Mark as greeted right before sending
        //             sendMessage("Hi", true);
        //         }
        //     }, 5000); // Small delay to ensure connection is fully established
        // }

        if (messageLength <= 4) {
            // Country Check
            if ($(this).hasClass("country-info")) {
                const country = text.split(" ")[0];
                if (!allowedCountries.includes(country)) {
                    console.log(`Blocked country: ${country}`);
                    triggerNewConnection();
                    return false; // Stop .each()
                }
            }
        }

        // Stranger Message Check
        if ($(this).hasClass("message")) {
            const originalText = text;
            const normalizedText = originalText
                .replace(/^Stranger:\s*/i, "")
                .toLowerCase()
                .trim();

            if (messageLength <= 4) {
                // Block exact matches
                const blockedCondition = blockedMessages.some((blockedMessage) => {
                    return normalizedText === blockedMessage.toLowerCase().trim();
                });
                if (blockedCondition) {
                    console.log(`Blocked message: ${normalizedText}`);
                    triggerNewConnection();
                    return false;
                }
                // Block 'M' followed by optional space and numbers (e.g., 'M20', 'M 20')
                if (/^m\s*\d{1,3}$/.test(normalizedText)) {
                    console.log(`Blocked message (pattern): ${normalizedText}`);
                    triggerNewConnection();
                    return false;
                }
            }

            // Capture manual user messages into history so AI has context
            if (/^You:/i.test(originalText)) {
                const youMsg = originalText.replace(/^You:\s*/i, "").trim();
                if (youMsg) {
                    conversationHistory.push({ role: "assistant", content: youMsg });
                }
            }
            // AI Auto Reply (only for new Stranger messages not yet processed)
            if (/^Stranger:/i.test(originalText) && !processedStrangerMessages.has(originalText)) {
                processedStrangerMessages.add(originalText);
                const cleanStranger = originalText.replace(/^Stranger:\s*/i, "").trim();
                if (cleanStranger.length > 0) {
                    setTimeout(() => {
                        maybeReplyToStranger(cleanStranger);
                    }, 1000);
                }
            }
        }

        if (messageLength <= 10) {
            // Disconnected Message
            if (text.includes("Stranger has disconnected")) {
                console.log(`Stranger disconnected detected. with ${messageLength} messages present.`);
                hasGreeted = false; // Reset greeting flag for next connection
                triggerNewConnection();
                return false;
            }
        }
    });
}

// === MutationObserver ===
const targetNode = $("#message-area")[0];
if (targetNode) {
    const observer = new MutationObserver(() => {
        checkMessages();
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    console.log("DOM Watcher started with jQuery");

    // 4. Auto agree
    const agreeButton = $("#agree-btn");
    console.log(agreeButton);

    setTimeout(() => {
        if (agreeButton.length) {
            console.log("Auto Agreed");

            agreeButton[0].click(); // Trigger native click
        }
    }, 1000);
}
