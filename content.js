// === Configuration ===
const allowedCountries = ["India"];
const blockedMessages = ["M", "M or f", "M here", "F?"];

function triggerNewConnection() {
    const newConnectBtn = $("#skip-btn");
    console.log("Triggering new connection...");
    if (newConnectBtn.length) {
        newConnectBtn[0].click(); // Trigger native click
        newConnectBtn[0].click(); // Trigger native click
    }
}

function checkMessages() {
    const messages = $(
        "#messages .message, #messages .message-status, #messages .country-info"
    );

    messages.each(function () {
        const text = $(this).text().trim();

        // 1. Country Check
        if ($(this).hasClass("country-info")) {
            const country = text.split(" ")[0];
            if (!allowedCountries.includes(country)) {
                console.log(`Blocked country: ${country}`);
                triggerNewConnection();
                return false; // Stop .each()
            }
        }

        // 2. Stranger Message Check
        if ($(this).hasClass("message")) {
            for (const blockedMessage of blockedMessages) {
                const blockedMessageFull = blockedMessage.toLowerCase().trim();

                const normalizedText = text.replace(/^Stranger:\s*/i, "");
                if (normalizedText.toLowerCase() == blockedMessageFull) {
                    console.log(`Blocked message: ${normalizedText}`);
                    triggerNewConnection();
                    return false;
                }
            }
        }

        // 3. Disconnected Message
        if (text.includes("Stranger has disconnected")) {
            console.log("Stranger disconnected detected.");
            triggerNewConnection();
            return false;
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
}
