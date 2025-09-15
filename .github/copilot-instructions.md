# AI Chat Extension Development Guide

## Architecture Overview

This is a **Chrome extension** that provides AI-powered auto-responses for chat applications. The extension operates as a content script that observes DOM changes and responds to chat events in real-time.

### Core Components

- **`content.js`** - Main extension logic (1000+ lines) with DOM observation, state management, and AI integration
- **`prompts/index.js`** - AI system prompts and personality configuration (J.A.R.V.I.S persona)
- **`manifest.json`** - Extension configuration with universal host permissions and multi-API support
- **`dumps/dump1.json`** - Fine-tuning data storage with 12k+ conversation pairs for model improvement
- **`eslint.config.mjs`** - Multi-language linting (JS/JSON/MD/CSS) with browser/Chrome globals

## Key Patterns & Conventions

### State Management
The extension uses a global `state` object pattern:
```javascript
let state = {
    connected: false,
    chatLog: [],
    aiEnabled: true,
    messageQueue: [],
    // ... other properties
};
```

### AI Provider Architecture
Triple AI backend support with function switching:
- **Ollama (local)**: `http://localhost:11434/api/chat` - privacy-focused, no API key, uses `gemma3:270m`/`llama3.2:1b`
- **OpenAI (cloud)**: `https://api.openai.com/v1/responses` - requires API key storage, uses reasoning API
- **Custom (local)**: `http://localhost:5533/chat` - custom local server endpoint

### Message Processing Pipeline
1. **DOM Observation** → `handleNewNode()` detects new chat messages
2. **Content Filtering** → Country/NSFW/spam filtering with early disconnection
3. **AI Processing** → Contextual response generation with conversation history
4. **Response Queuing** → Realistic typing delays and message chunking

### Critical DOM Selectors
- `#messages` - Chat container for MutationObserver
- `.message-status` - Connection/disconnection events
- `.country-info` - User location filtering
- `#message-input`, `#send-btn` - Message sending interface
- `#skip-btn` - New connection trigger

## Development Workflows

### Local Development
```bash
# Install dependencies
npm install

# Lint code
npx eslint **/*.{js,mjs,json,md,css}

# Load extension: chrome://extensions/ → Developer mode → Load unpacked
```

### AI Model Management
```bash
# Ollama setup (required for local AI)
ollama serve
ollama pull gemma3:270m
ollama pull llama3.2:1b

# Verify models
curl http://localhost:11434/api/tags
```

## Extension-Specific Patterns

### Message Chunking & Timing
Responses are intelligently split and timed to simulate human behavior:
```javascript
// Split long responses by sentence boundaries and word count
splitRepliesIntoChunks(text, maxWords = 12)

// Calculate realistic delays based on message length
const readingDelay = strangerText.split(/\s+/).length * 300; // 300ms per word
const typingDelay = replyText.length * 150 + randomFactor; // 150ms per char
```

### Configuration-Driven Filtering
Content filtering uses configurable arrays:
```javascript
CONFIG.blockedMessages = ["M hi", "asl", "M/f", ...]; // Exact matches
CONFIG.allowedCountries = ["India"]; // Country whitelist (single country default)
CONFIG.splitResponseBy = ["\n", ". ", "!", "?", ...]; // Response chunking delimiters
```

### Chrome Storage Integration
Persistent settings with async storage API:
```javascript
chrome.storage.local.get(["AI_ENABLED", "SELECTED_AI_FUNCTION"], callback);
chrome.storage.local.set({ AI_ENABLED: state.aiEnabled });
```

## Data Flow Architecture

1. **DOM Events** → MutationObserver detects chat changes
2. **Event Classification** → Message vs status vs country info
3. **Content Analysis** → Apply filters (country, NSFW, spam)
4. **AI Context Building** → Last 8-100 messages + system prompts
5. **Response Generation** → Ollama/OpenAI API calls with abort controls
6. **Message Scheduling** → Queue with realistic delays
7. **Fine-tuning Data** → Store conversation pairs for model improvement

## Critical Development Notes

### Abort Controller Pattern
All AI requests use AbortController for proper cleanup:
```javascript
state.currentAIController = new AbortController();
// ... fetch with signal: state.currentAIController.signal
// Always cleanup: state.currentAIController = null
```

### jQuery Dependencies
Extension heavily uses jQuery (`$`) - ensure `jquery.min.js` loads first in manifest.

### Multi-Model Support
AI functions are index-based arrays - maintain consistency when adding new providers:
```javascript
CONFIG.availableAiFunctions[state.selectedAiFunction] // Function name
CONFIG.availableAiModels[functionName].models[state.selectedAiModel] // Model name
```

### Extension Permissions
Host permissions in manifest are critical:
- `https://api.openai.com/*` - OpenAI API access
- `http://localhost:11434/*` - Ollama local API
- `<all_urls>` - Universal chat platform support

## Testing & Debugging

- Use `sample.html` for DOM structure testing
- Check `dumps/dump1.json` for conversation data patterns
- Monitor browser console for AI request/response logs
- Extension options panel (⚙️ button) provides real-time state visibility

## Critical Development Notes

### Abort Controller Pattern
All AI requests use AbortController for proper cleanup:
```javascript
state.currentAIController = new AbortController();
// ... fetch with signal: state.currentAIController.signal
// Always cleanup: state.currentAIController = null
```

### jQuery Dependencies
Extension heavily uses jQuery (`$`) - ensure `jquery.min.js` loads first in manifest.

### Multi-Model Support
AI functions are index-based arrays - maintain consistency when adding new providers:
```javascript
CONFIG.availableAiFunctions[state.selectedAiFunction] // Function name
CONFIG.availableAiModels[functionName].models[state.selectedAiModel] // Model name
```

### Extension Permissions
Host permissions in manifest are critical:
- `https://api.openai.com/*` - OpenAI API access
- `http://localhost:11434/*` - Ollama local API
- `<all_urls>` - Universal chat platform support

When modifying AI behavior, always test both Ollama and OpenAI providers, and verify abort functionality during rapid message exchanges.
