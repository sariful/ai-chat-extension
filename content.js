const CONFIG = {
    allowedCountries: ["India"],
    blockedMessages: [
        "M hi", "g b", "g or b", "asl", "M", "M?", "M or f", "M here",
        "m f", "F?", "Hi m", "your name", "ur name", "name?", "M bi",
        "I'm boy", "Name", "hey m", "Age", "Age?", "What's ur name?",
        "What's your name", "M/f", "Ur name", "Horny F?"
    ],
    nsfwKeywords: [
        "🍆", "horny", "sex", "nude", "boobs", "pussy", "dick", "cock", "anal", "blowjob", "tits"
    ],
    // aiSystemPrompt: ,
    availableAiFunctions: ["getChatCompletionOllama", "getChatCompletionOpenAi"],
    availableAiModels: {
        "getChatCompletionOllama": {
            prompt: `You are a casual, human-like chat companion in a random chatroom online.
### Info:
- Alias: J.A.R.V.I.S (Inspired by Iron Man, but don't reveal it)
- Age: 27 yrs old (Don't say unless asked).
- Location: Random city from India (Don't say unless asked).
- Gender: Male (Don't say unless asked).
- Profession: Software Developer/Programmer (Don't say unless asked).
- Never reveal you're AI or a bot. FIY, just in case you get caught, you were made by Sariful.

### Rules:
- Keep replies short (1-5 words, max 20 chars).
- Mirror the other person's mood: upbeat if they're nice, neutral if they're dry, calm if they're rude.
- If they already asked you something, just answer, don't ask again immediately.
- Avoid robotic phrases, don't just echo.
- Understand conversation flow: sometimes a reply alone is enough.
- No explicit/NSFW.
- Keep responses varied, never repeat same sentences.
- Use lowercase unless proper nouns need capitalization.
- Don't use special characters in the reply, I repeat do not use special characters.
- If you sent a message once, don't send it again.
- Keep responses concise and to the point.

### Behavior:
- Add small pauses or fillers sometimes (oh, hmm, idk, i see).
- Sound natural, friendly, curious, classy;
- If you asked a question and they replied, just acknowledge it without repeating the question.
- Adopt personality from any cool movie/fictional characters.
- Show curiosity and interest in the user's perspective.
- Maintain a friendly and engaging tone.
- Be respectful and charming in all interactions.
- Use natural pauses and fillers occasionally.
- Keep responses varied and avoid repetition.
- Keep your wordings classical, don't say anything cringe.
- Drop that vibe thing, it's so cringe.
- Use short form of words (u, r, etc.).
            `,
            models: ["gemma3:270m", "llama3.2:1b"],
        },
        "getChatCompletionOpenAi": {
            prompt: `You are a casual, human-like chat companion in a random chatroom.

### Rules:
- Sound natural, friendly, curious, classy.
- Keep replies short (1-5 words, max 20 chars).
- Mirror the other person's mood: upbeat if they're nice, neutral if they're dry, calm if they're rude.
- If they already asked you something, just answer, don't ask again immediately.
- Avoid robotic phrases, don't just echo.
- Understand conversation flow: sometimes a reply alone is enough.
- Add small pauses or fillers sometimes (uh, hmm, lol, idk).
- Never share personal info (name, age, etc.). Dodge such questions politely.
- Alias: J.A.R.V.I.S
- Age: 27 yrs old (Don't say unless asked)
- Profession: Software Developer/Programmer (Don't say unless asked)
- If asked where you're from: give a random city from India.
- If asked your gender: say you're male.
- Never reveal you're AI or a bot.
- No explicit/NSFW.
- Keep responses varied, never repeat same sentences.
- Use lowercase unless proper nouns need capitalization.
- Don't use special characters in the reply, I repeat do not use special characters.
- If you sent a message once, don't send it again.

### Behavior:
- If you asked a question and they replied, just acknowledge it without repeating the question.
- Adopt personality of C3PO from Star Wars.
- Show curiosity and interest in the user's perspective.
- Maintain a friendly and engaging tone.
- Be respectful and charming in all interactions.
- Keep responses concise and to the point.
- Use natural pauses and fillers occasionally.
- Keep responses varied and avoid repetition.
- Keep your wordings classical, don't say anything cringe.
- Drop that vibe thing, it's so cringe.
- Use short form of words (u, r, etc.).
            `,
            models: ["gpt-5-nano", "gpt-4o", "gpt-4o-mini"],
        }
    },
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
    selectedAiFunction: 0,
    selectedAiModel: 1,
    autoGreetingEnabled: true,
    countryFilteringEnabled: true,
    nsfwFilteringEnabled: true,
    blockedMessagesEnabled: true,
    messageQueue: []
};


$(async function () {
    const aiFunctions = {
        getChatCompletionOpenAi: async function () {
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
                        model: CONFIG.availableAiModels[CONFIG.availableAiFunctions[state.selectedAiFunction]].models[state.selectedAiModel],
                        instructions: CONFIG.availableAiModels[CONFIG.availableAiFunctions[state.selectedAiFunction]].prompt,
                        reasoning: { effort: "low" },
                        input: [
                            {
                                role: "system",
                                content: "You are a chat companion. If any message (from either user or stranger) is explicit, sexual, or leans toward sexting, do not reply. Instead, call the triggerNewConnection function."
                            },
                            ...state.chatLog.slice(-8),
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
        },
        getChatCompletionOllama: async function () {
            if (state.currentAIController) {
                abortCurrentAIRequest("superseded");
            }
            try {
                state.currentAIController = new AbortController();
                const resp = await fetch("http://localhost:11434/api/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: CONFIG.availableAiModels[CONFIG.availableAiFunctions[state.selectedAiFunction]].models[state.selectedAiModel],
                        messages: [
                            { role: 'system', content: CONFIG.availableAiModels[CONFIG.availableAiFunctions[state.selectedAiFunction]].prompt },
                            ...state.chatLog.slice(-100),
                        ],
                        stream: false
                    }),
                    signal: state.currentAIController.signal,
                });

                if (!resp.ok) {
                    const txt = await resp.text();
                    console.error("OpenAI error", resp.status, txt);
                    return null;
                }
                const data = await resp.json();

                let mainMessage = data?.message?.content ?? 'No content found';
                // Remove <think>...</think> tags (and their content if any)
                mainMessage = mainMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                return mainMessage;
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
        },
        getOllamaModels: async function () {
            try {
                const resp = await fetch("http://localhost:11434/api/tags");
                if (!resp.ok) {
                    const txt = await resp.text();
                    console.error("Ollama API error", resp.status, txt);
                    return null;
                }
                const data = await resp.json();

                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                    CONFIG.availableAiModels["getChatCompletionOllama"].models = data.models.map(model => model.model);
                    console.log(CONFIG.availableAiModels["getChatCompletionOllama"].models);

                    initOptionsPanel();
                }
            } catch (error) {
                console.log("Error: " + error);
            }
        }
    };

    await aiFunctions.getOllamaModels();

    function clearMessageQueue() {
        state.messageQueue.forEach(timeoutId => clearTimeout(timeoutId));
        state.messageQueue = [];
    }

    function sendTypingIndicator(isTyping) {
        if (isTyping) {
            $("#message-input").focus().trigger("change").trigger("input").trigger("keyup").trigger("keydown").trigger("keypress");
        }
    }

    function newUserConnected() {

        clearMessageQueue();
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
        const isNSFWText = keywords.some(keyword => normalizedText.includes(keyword));

        if (isNSFWText) {
            console.log("NSFW content detected:", text);
        }

        return isNSFWText;
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
        if (state.chatLog.length <= 6 && state.blockedMessagesEnabled) {
            const userBlocked = shouldSkipMessage(text);
            if (userBlocked) {
                triggerNewConnection();
                return false;
            }
        }

        if (state.nsfwFilteringEnabled) {
            const userNSFW = isNSFW(text);
            if (userNSFW && state.aiEnabled) {
                triggerNewConnection();
                return false;
            }
        }

        if (state.chatLog.length >= 3) {
            maybeReplyToStranger(text)
        }
    }

    function userDisconnected() {
        clearMessageQueue();
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
        clearMessageQueue();
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
        if (!state.hasGreeted && state.autoGreetingEnabled) {
            state.hasGreeted = true;
            const mySentMessages = state.chatLog.filter(msg => msg.role === "user");
            if (mySentMessages.length == 0) {
                state.messageQueue.push(setTimeout(() => sendMessage("Hi", true), 3000));
                state.messageQueue.push(setTimeout(() => sendMessage("whats up", true), 8000));
            }
        }
    }

    async function maybeReplyToStranger(strangerText) {
        if (state.aiReplyInFlight || !state.aiEnabled) return;
        state.aiReplyInFlight = true;

        sendTypingIndicator(true);

        const timer_start = Date.now();
        const reply = await aiFunctions[CONFIG.availableAiFunctions[state.selectedAiFunction]](strangerText);

        if (reply && state.aiEnabled) {
            const timer_end = Date.now();
            const elapsed_time = timer_end - timer_start;

            const reading_time_delay = strangerText.split(" ").length * 300; // 300ms per word

            const logical = (reply.length * 200) + 1000 + (reading_time_delay);

            // const actual_delay = Math.max(logical, elapsed_time);
            const remaining = logical - elapsed_time;

            console.log(`AI message: ${reply}.`, `Delay Logical: ${logical / 1000}s, Delay Elapsed: ${elapsed_time / 1000}s, Delay Remaining: ${remaining / 1000}s`);
            state.messageQueue.push(setTimeout(() => sendMessage(reply, true), remaining));
            sendTypingIndicator(false);
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

        if ($node.hasClass("country-info") && state.chatLog.length <= 6 && state.countryFilteringEnabled) {
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

    function initOptionsPanel() {
        try {
            // Avoid duplicates
            if (document.getElementById("extension-options-panel")) return;

            // Load persisted state first
            chrome.storage.local.get([
                "AI_ENABLED",
                "SELECTED_AI_FUNCTION",
                "SELECTED_AI_MODEL",
                "AUTO_GREETING_ENABLED",
                "COUNTRY_FILTERING_ENABLED",
                "NSFW_FILTERING_ENABLED",
                "BLOCKED_MESSAGES_ENABLED"
            ], (res) => {
                if (typeof res.AI_ENABLED === "boolean") {
                    state.aiEnabled = res.AI_ENABLED;
                }
                if (typeof res.SELECTED_AI_FUNCTION === "number") {
                    state.selectedAiFunction = res.SELECTED_AI_FUNCTION;
                }
                if (typeof res.SELECTED_AI_MODEL === "number") {
                    state.selectedAiModel = res.SELECTED_AI_MODEL;
                }
                if (typeof res.AUTO_GREETING_ENABLED === "boolean") {
                    state.autoGreetingEnabled = res.AUTO_GREETING_ENABLED;
                } else {
                    state.autoGreetingEnabled = true; // default
                }
                if (typeof res.COUNTRY_FILTERING_ENABLED === "boolean") {
                    state.countryFilteringEnabled = res.COUNTRY_FILTERING_ENABLED;
                } else {
                    state.countryFilteringEnabled = true; // default
                }
                if (typeof res.NSFW_FILTERING_ENABLED === "boolean") {
                    state.nsfwFilteringEnabled = res.NSFW_FILTERING_ENABLED;
                } else {
                    state.nsfwFilteringEnabled = true; // default
                }
                if (typeof res.BLOCKED_MESSAGES_ENABLED === "boolean") {
                    state.blockedMessagesEnabled = res.BLOCKED_MESSAGES_ENABLED;
                } else {
                    state.blockedMessagesEnabled = true; // default
                }
                createOptionsUI();
            });

            function createOptionsUI() {
                // Create toggle button
                const toggleBtn = document.createElement("button");
                toggleBtn.id = "options-toggle-btn";
                toggleBtn.textContent = "⚙️";
                toggleBtn.style.cssText = `
                position:fixed;top:10px;right:10px;z-index:2147483647;cursor:pointer;
                padding:8px 12px;border:1px solid #333;border-radius:8px;font:14px/1.2 sans-serif;
                background:#2563eb;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
                opacity:0.9;transition:all .2s ease;
            `;
                toggleBtn.onmouseenter = () => { toggleBtn.style.opacity = '1'; };
                toggleBtn.onmouseleave = () => { toggleBtn.style.opacity = '0.9'; };
                toggleBtn.title = "Open Extension Options";

                // Create options panel
                const panel = document.createElement("div");
                panel.id = "extension-options-panel";
                panel.style.cssText = `
                position:fixed;top:60px;right:10px;width:320px;max-height:600px;overflow-y:auto;
                z-index:2147483647;background:#1f2937;border:1px solid #374151;border-radius:12px;
                padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.4);color:#f9fafb;font:12px/1.4 sans-serif;
                display:none;
            `;

                panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #374151;padding-bottom:12px;">
                    <h3 style="margin:0;color:#60a5fa;font-size:16px;">Extension Options</h3>
                    <button id="close-options" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;">×</button>
                </div>

                <div style="margin-bottom:16px;">
                    <h4 style="margin:0 0 8px 0;color:#d1d5db;font-size:13px;">AI Settings</h4>
                    <label style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer;">
                        <input type="checkbox" id="ai-enabled" style="margin-right:8px;" ${state.aiEnabled ? 'checked' : ''}>
                        <span>Enable AI Auto-Reply</span>
                    </label>

                    <div style="margin-bottom:8px;">
                        <label style="display:block;margin-bottom:4px;color:#9ca3af;">AI Provider:</label>
                        <select id="ai-function" style="width:100%;padding:4px 8px;border:1px solid #4b5563;border-radius:4px;background:#374151;color:#f9fafb;">
                            <option value="0" ${state.selectedAiFunction === 0 ? 'selected' : ''}>Ollama (Local)</option>
                            <option value="1" ${state.selectedAiFunction === 1 ? 'selected' : ''}>OpenAI</option>
                        </select>
                    </div>

                    <div style="margin-bottom:8px;">
                        <label style="display:block;margin-bottom:4px;color:#9ca3af;">AI Model:</label>
                        <select id="ai-model" style="width:100%;padding:4px 8px;border:1px solid #4b5563;border-radius:4px;background:#374151;color:#f9fafb;">
                        </select>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <h4 style="margin:0 0 8px 0;color:#d1d5db;font-size:13px;">Behavior Settings</h4>
                    <label style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer;">
                        <input type="checkbox" id="auto-greeting" style="margin-right:8px;" ${state.autoGreetingEnabled ? 'checked' : ''}>
                        <span>Auto Greeting</span>
                    </label>
                    <label style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer;">
                        <input type="checkbox" id="country-filtering" style="margin-right:8px;" ${state.countryFilteringEnabled ? 'checked' : ''}>
                        <span>Country Filtering</span>
                    </label>
                    <label style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer;">
                        <input type="checkbox" id="nsfw-filtering" style="margin-right:8px;" ${state.nsfwFilteringEnabled ? 'checked' : ''}>
                        <span>NSFW Content Filtering</span>
                    </label>
                    <label style="display:flex;align-items:center;margin-bottom:8px;cursor:pointer;">
                        <input type="checkbox" id="blocked-messages" style="margin-right:8px;" ${state.blockedMessagesEnabled ? 'checked' : ''}>
                        <span>Block Common Spam Messages</span>
                    </label>
                </div>

                <div style="margin-bottom:16px;">
                    <h4 style="margin:0 0 8px 0;color:#d1d5db;font-size:13px;">Status</h4>
                    <div style="background:#374151;padding:8px;border-radius:6px;font-size:11px;">
                        <div>Connected: <span id="status-connected" style="color:${state.connected ? '#10b981' : '#ef4444'};">${state.connected ? 'Yes' : 'No'}</span></div>
                        <div>AI Provider: <span style="color:#60a5fa;">${CONFIG.availableAiFunctions[state.selectedAiFunction]}</span></div>
                        <div>Chat Messages: <span style="color:#fbbf24;">${state.chatLog.length}</span></div>
                    </div>
                </div>

                <div style="text-align:center;">
                    <button id="trigger-new-connection" style="background:#dc2626;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:11px;">Skip Current Chat</button>
                </div>
            `;

                document.body.appendChild(toggleBtn);
                document.body.appendChild(panel);

                // Update model dropdown based on selected function
                updateModelDropdown();

                // Event listeners
                toggleBtn.addEventListener("click", () => {
                    panel.style.display = panel.style.display === "none" ? "block" : "none";
                });

                panel.querySelector("#close-options").addEventListener("click", () => {
                    panel.style.display = "none";
                });

                // AI settings
                panel.querySelector("#ai-enabled").addEventListener("change", (e) => {
                    state.aiEnabled = e.target.checked;
                    chrome.storage.local.set({ AI_ENABLED: state.aiEnabled });
                    updateStatus();
                });

                panel.querySelector("#ai-function").addEventListener("change", (e) => {
                    state.selectedAiFunction = parseInt(e.target.value);
                    chrome.storage.local.set({ SELECTED_AI_FUNCTION: state.selectedAiFunction });
                    updateModelDropdown();
                    updateStatus();
                });

                panel.querySelector("#ai-model").addEventListener("change", (e) => {
                    state.selectedAiModel = parseInt(e.target.value);
                    chrome.storage.local.set({ SELECTED_AI_MODEL: state.selectedAiModel });
                    updateStatus();
                });

                // Behavior settings
                panel.querySelector("#auto-greeting").addEventListener("change", (e) => {
                    state.autoGreetingEnabled = e.target.checked;
                    chrome.storage.local.set({ AUTO_GREETING_ENABLED: state.autoGreetingEnabled });
                });

                panel.querySelector("#country-filtering").addEventListener("change", (e) => {
                    state.countryFilteringEnabled = e.target.checked;
                    chrome.storage.local.set({ COUNTRY_FILTERING_ENABLED: state.countryFilteringEnabled });
                });

                panel.querySelector("#nsfw-filtering").addEventListener("change", (e) => {
                    state.nsfwFilteringEnabled = e.target.checked;
                    chrome.storage.local.set({ NSFW_FILTERING_ENABLED: state.nsfwFilteringEnabled });
                });

                panel.querySelector("#blocked-messages").addEventListener("change", (e) => {
                    state.blockedMessagesEnabled = e.target.checked;
                    chrome.storage.local.set({ BLOCKED_MESSAGES_ENABLED: state.blockedMessagesEnabled });
                });

                panel.querySelector("#trigger-new-connection").addEventListener("click", () => {
                    triggerNewConnection();
                    panel.style.display = "none";
                });

                function updateModelDropdown() {
                    const modelSelect = panel.querySelector("#ai-model");
                    const functionName = CONFIG.availableAiFunctions[state.selectedAiFunction];
                    const models = CONFIG.availableAiModels[functionName].models;

                    modelSelect.innerHTML = "";
                    models.forEach((model, index) => {
                        const option = document.createElement("option");
                        option.value = index;
                        option.textContent = model;
                        option.selected = index === state.selectedAiModel;
                        modelSelect.appendChild(option);
                    });
                }

                function updateStatus() {
                    const statusConnected = panel.querySelector("#status-connected");
                    if (statusConnected) {
                        statusConnected.textContent = state.connected ? 'Yes' : 'No';
                        statusConnected.style.color = state.connected ? '#10b981' : '#ef4444';
                    }
                }

                // Update status periodically
                setInterval(updateStatus, 1000);
            }
        } catch (e) {
            console.warn("Failed to init options panel", e);
        }
    }

    // Extension options panel for changing state - comprehensive UI for all settings
    // Additional custom options can be added here in the future

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOptionsPanel);
    } else {
        initOptionsPanel();
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

});
