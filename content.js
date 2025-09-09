const CONFIG = {
    allowedCountries: ["India"],
    blockedMessages: [
        "M hi", "g b", "g or b", "asl", "M", "M?", "M or f", "M here",
        "m f", "F?", "Hi m", "your name", "ur name", "name?", "M bi",
        "I'm boy", "Name", "hey m", "Age", "Age?", "What's ur name?",
        "What's your name", "M/f", "Ur name", "Horny F?"
    ],
    // aiSystemPrompt: ,
    availableAiFunctions: ["getChatCompletionOllama", "getChatCompletionOpenAi"],
    availableAiModels: {
        "getChatCompletionOllama": {
            prompt: "",
            models: ["gemma3:270m", "llama3.2:1b"],
        },
        "getChatCompletionOpenAi": {
            prompt: "",
            models: ["gpt-5-nano", "gpt-4o", "gpt-4o-mini"],
        }
    },
    splitResponseBy: ["\n", ". ", "!", "?", ",", ";", "thx", "lol", "haha"],
};

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
    messageQueue: [],
    dataForFineTuning: [],
    chatId: "",
    firstAiReplyCompleted: false,
    isTyping: false,
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
                        reasoning: { effort: "low" },
                        input: [
                            ...window.prompts,
                            ...state.chatLog.slice(-8),
                        ],
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
            if (state.currentAIController && state.firstAiReplyCompleted) {
                abortCurrentAIRequest("superseded");
            }
            if (!state.firstAiReplyCompleted) {
                sendTypingIndicator();
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
                            ...window.prompts,
                            ...state.chatLog.slice(-100),
                        ],
                        options: {
                            temperature: 0.3,
                            frequency_penalty: 0.5,
                            presence_penalty: 0.3,
                            num_ctx: 3000,
                        },
                        stream: false,
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

                if (mainMessage.toLowerCase().includes("triggernewconnection")) {
                    mainMessage = "Wel, i gtg, nice talkin to ya!";
                    setTimeout(() => {
                        console.log("[AI] Triggering new connection...");
                        triggerNewConnection();
                    }, 3000);
                }
                state.firstAiReplyCompleted = true;

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
                    initOptionsPanel();
                }
            } catch (error) {
                console.error("Error: " + error);
            }
        }
    };

    await aiFunctions.getOllamaModels();

    function clearMessageQueue() {
        state.messageQueue.forEach(timeoutId => clearTimeout(timeoutId));
        state.messageQueue = [];
    }

    function sendTypingIndicator() {
        let typingInterval = null;

        setInterval(() => {
            if (state.isTyping && !typingInterval && state.connected) {
                // Start simulating typing every 500ms
                typingInterval = setInterval(() => {
                    const input = document.querySelector("#message-input");
                    if (input) {
                        const keydownEvent = new KeyboardEvent("keydown", { key: "a", bubbles: true });
                        input.dispatchEvent(keydownEvent);
                    }
                }, 500);

                if (!state.aiEnabled) {
                    state.isTyping = false;
                }
            } else if (!state.isTyping && typingInterval) {
                // Stop typing simulation
                clearInterval(typingInterval);
                typingInterval = null;

                // Send keyup to indicate release
                const input = document.querySelector("#message-input");
                if (input) {
                    const keyupEvent = new KeyboardEvent("keyup", { key: "a", bubbles: true });
                    input.dispatchEvent(keyupEvent);
                }
            }
        }, 500);
    }


    function newUserConnected() {

        clearMessageQueue();
        if (state.firstAiReplyCompleted) {
            abortCurrentAIRequest("new user connected");
        }

        if (state.chatLog.length > 5) {
            console.log(JSON.parse(JSON.stringify(state.chatLog, null, 2)));
        }

        // save the state.dataForFineTuning into a storage
        saveFineTuningData();

        console.log("New user connected --------------------------------");

        state.connected = true;
        state.hasGreeted = false;
        state.chatLog = [];
        state.dataForFineTuning = [];
        state.chatId = Date.now() + "-" + Math.random().toString(36).substring(2, 8);
        state.isTyping = false;

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
        const normalizedText = text.toLowerCase();

        const wordKeywords = ["horny", "sex", "nude", "boobs", "pussy", "dick", "cock", "anal", "blowjob", "tits", "roleplay", "SpicyChats"];
        const emojiKeywords = ["🍆"];

        const words = normalizedText.split(/\W+/);

        const wordMatch = words.some(word => wordKeywords.includes(word));
        const emojiMatch = emojiKeywords.some(emoji => normalizedText.includes(emoji));

        return wordMatch || emojiMatch;
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
            if (userNSFW && state.aiEnabled && state.chatLog.length <= 30) {
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

        if (state.firstAiReplyCompleted) {
            abortCurrentAIRequest("user disconnected");
        }
        triggerNewConnection();
        console.log("User disconnected --------------------------------");

    }

    function triggerNewConnection() {
        if (state.firstAiReplyCompleted) {
            abortCurrentAIRequest("trigger new connection");
        }
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

    function splitRepliesIntoChunks(text, maxWords = 12) {
        // 1. Detect and preserve abbreviations (e.g., J.A.R.V.I.S, B.Com)
        const abbreviationPattern = /(?:[A-Za-z]\.){2,}[A-Za-z]?|[A-Za-z]\.[A-Za-z]+/g;
        const abbreviations = [];
        let placeholderText = text.replace(abbreviationPattern, (match) => {
            abbreviations.push(match);
            return `[[ABBR_${abbreviations.length - 1}]]`;
        });

        // 2. Split sentences on common boundaries (., !, ?, ;, :, —, –, …)
        const sentencePattern = /[^.!?;:—–…]+[.!?;:—–…]?/g;
        let rawChunks = [];
        let match;
        while ((match = sentencePattern.exec(placeholderText)) !== null) {
            let chunk = match[0].trim();
            if (chunk) rawChunks.push(chunk);
        }

        // 3. Further split long sentences by word limit
        let finalChunks = [];
        for (let chunk of rawChunks) {
            // Restore abbreviations
            chunk = chunk.replace(/\[\[ABBR_(\d+)]]/g, (_, index) => abbreviations[index]);

            let words = chunk.split(/\s+/);
            while (words.length > maxWords) {
                finalChunks.push(words.splice(0, maxWords).join(" ").toLowerCase());
            }
            if (words.length) {
                finalChunks.push(words.join(" ").toLowerCase());
            }
        }

        return finalChunks.length ? finalChunks : [text.toLowerCase()];
    }

    async function maybeReplyToStranger(strangerText) {
        if (state.aiReplyInFlight || !state.aiEnabled) return;
        state.aiReplyInFlight = true;

        state.isTyping = true;

        const timer_start = Date.now();
        const reply = await aiFunctions[CONFIG.availableAiFunctions[state.selectedAiFunction]](strangerText);

        if (reply && state.aiEnabled) {
            state.dataForFineTuning.push({
                instruction: strangerText,
                output: reply,
                timestamp: Date.now(),
                chatId: state.chatId
            });
            const replies = splitRepliesIntoChunks(reply);
            if (replies.length > 0) {
                const timer_end = Date.now();
                const elapsed_time = timer_end - timer_start;
                let totalDelay = -elapsed_time;

                // Initial delay: time for "reading" the stranger's message
                const readingDelay = strangerText.split(/\s+/).length * 300; // 300 ms per word
                totalDelay += readingDelay;

                replies.forEach((replyText) => {
                    // Estimate typing time (150 ms per character, plus a small random factor)
                    const baseTypingTime = replyText.length * 150;
                    const randomFactor = Math.floor(Math.random() * 1000); // up to 1s variation
                    const typingDelay = baseTypingTime + 500 + randomFactor; // 500ms base "thinking pause"

                    totalDelay += typingDelay;

                    console.log(
                        `AI message: ${replyText}`,
                        `Typing Delay: ${(typingDelay / 1000).toFixed(2)}s`,
                        `Elapsed: ${(elapsed_time / 1000).toFixed(2)}s`,
                        `Total Wait: ${(totalDelay / 1000).toFixed(2)}s`
                    );

                    state.messageQueue.push(
                        setTimeout(() => sendMessage(replyText, true), totalDelay)
                    );
                });

                // Mark typing finished after all replies
                setTimeout(() => {
                    state.isTyping = false;
                }, totalDelay);
            }
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

    function saveFineTuningData() {
        if (state.dataForFineTuning.length === 0) {
            return;
        }

        const fineTunedData = JSON.parse(JSON.stringify(state.dataForFineTuning, null, 2));
        console.log(fineTunedData);

        // Get existing data from storage and append new data
        chrome.storage.local.get(["FINE_TUNING_DATA"], (result) => {
            const existingData = result.FINE_TUNING_DATA || [];
            const newData = [...existingData, ...fineTunedData];

            // Save updated data back to storage
            chrome.storage.local.set({
                FINE_TUNING_DATA: newData
            }, () => {
                console.log(`Saved ${fineTunedData.length} new fine-tuning entries. Total entries: ${newData.length}`);
            });
        });
    }

    // Helper function to escape CSV fields
    function escapeCsvField(field) {
        if (field == null) return '';
        const str = String(field);
        // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
        if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    function exportFineTuningData() {
        chrome.storage.local.get(["FINE_TUNING_DATA"], (result) => {
            const data = result.FINE_TUNING_DATA || [];
            if (data.length === 0) {
                alert("No training data available to export.");
                return;
            }


            // Convert to CSV format
            const csvHeader = 'instruction,output,timestamp\n';
            const csvRows = data.map(entry => {
                return [
                    escapeCsvField(entry.instruction),
                    escapeCsvField(entry.output),
                    escapeCsvField(entry.timestamp)
                ].join(',');
            }).join('\n');

            const csvData = csvHeader + csvRows;
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            // Create temporary download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `fine-tuning-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log(`Exported ${data.length} training data entries`);
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
        state.isTyping = false;
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
                        <div>Training Data: <span id="training-data-count" style="color:#10b981;">Loading...</span></div>
                    </div>
                </div>

                <div style="text-align:center;">
                    <button id="trigger-new-connection" style="background:#dc2626;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:11px;margin-right:8px;">Skip Current Chat</button>
                    <button id="export-fine-tuning-data" style="background:#059669;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:11px;">Export Training Data</button>
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

                panel.querySelector("#export-fine-tuning-data").addEventListener("click", () => {
                    exportFineTuningData();
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

                    // Update training data count
                    const trainingDataCount = panel.querySelector("#training-data-count");
                    if (trainingDataCount) {
                        chrome.storage.local.get(["FINE_TUNING_DATA"], (result) => {
                            const data = result.FINE_TUNING_DATA || [];
                            trainingDataCount.textContent = data.length + " entries";
                        });
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
