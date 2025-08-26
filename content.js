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

        if (messageLength <= 4) {
            // New Connection Detection - Send "Hi" automatically (only once)
            if ($(this).hasClass("message-status") && text.includes("You are now talking to a random stranger") && !hasGreeted) {
                console.log("New connection detected, sending Hi...");
                setTimeout(() => {
                    if (!hasGreeted) { // Double-check before sending
                        hasGreeted = true; // Mark as greeted right before sending
                        sendMessage("Hi", true);
                    }
                }, 5000); // Small delay to ensure connection is fully established
            }

            // Country Check
            if ($(this).hasClass("country-info")) {
                const country = text.split(" ")[0];
                if (!allowedCountries.includes(country)) {
                    console.log(`Blocked country: ${country}`);
                    triggerNewConnection();
                    return false; // Stop .each()
                }
            }

            // Stranger Message Check
            if ($(this).hasClass("message")) {
                const normalizedText = text
                    .replace(/^Stranger:\s*/i, "")
                    .toLowerCase()
                    .trim();
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

            // Disconnected Message
            if (text.includes("Stranger has disconnected")) {
                console.log(`Stranger disconnected detected. with ${messageLength} messages present.`);
                hasGreeted = false; // Reset greeting flag for next connection
                triggerNewConnection();
                return false;
            }
        } else {
            console.log("Not checking anymore");

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
