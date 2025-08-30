# AI Chat Extension (Chatter)

An intelligent Chrome extension that provides automated AI-powered responses in chat applications. The extension can detect messages, filter inappropriate content, and generate contextual responses using either OpenAI's GPT models or local Ollama models.

## 🚀 Features

- **AI-Powered Auto-Replies**: Automatically respond to messages using OpenAI GPT or local Ollama models
- **Content Filtering**: Blocks inappropriate messages and NSFW content
- **Country Filtering**: Only engages with users from specified countries (configurable)
- **Smart Conversation Flow**: Maintains chat context and responds appropriately
- **Typing Indicators**: Simulates natural typing patterns
- **Toggle Control**: Easy on/off switch for AI functionality
- **Multiple AI Backends**: Supports both OpenAI API and local Ollama models

## 📋 Prerequisites

- Google Chrome browser
- Node.js (for development/linting)
- Ollama (for local AI models) - *Installation instructions below*
- OpenAI API key (optional, for GPT models)

## 🛠️ Installation

### Step 1: Install Ollama (Local AI Models)

#### For Linux (Ubuntu/Debian):
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve
```

#### For macOS:
```bash
# Install using Homebrew
brew install ollama

# Or download from https://ollama.com/download/mac
# Start Ollama
ollama serve
```

#### For Windows:
1. Download the installer from [https://ollama.com/download/windows](https://ollama.com/download/windows)
2. Run the installer
3. Ollama will start automatically

### Step 2: Download AI Models

After installing Ollama, download the required models:

```bash
# Download the lightweight Gemma model (recommended for chat)
ollama pull gemma3:270m

# Download Llama model (alternative option)
ollama pull llama3.2:1b

# Verify models are installed
ollama list
```

### Step 3: Install the Chrome Extension

1. **Download/Clone the Extension**:
   ```bash
   git clone https://github.com/sariful/ai-chat-extension.git
   cd ai-chat-extension
   ```

2. **Install Dependencies** (optional, for development):
   ```bash
   npm install
   ```

3. **Load Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the extension folder (`ai-chat-extension`)
   - The extension should now appear in your extensions list

## ⚙️ Configuration

### AI Model Configuration

The extension comes pre-configured with two AI backends:

1. **Ollama (Local)** - Default, privacy-focused
   - Models: `gemma3:270m`, `llama3.2:1b`
   - No API key required
   - Runs locally on your machine

2. **OpenAI (Cloud)** - Requires API key
   - Models: `gpt-4o`, `gpt-4o-mini`, `gpt-5-nano`
   - Higher quality responses
   - Requires internet connection

### Setting up OpenAI (Optional)

If you want to use OpenAI models:

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. When first using the extension, you'll be prompted to enter your API key
3. The key will be stored locally in your browser

### Customizing Settings

Edit `content.js` to modify:

- **Allowed Countries**:
  ```javascript
  allowedCountries: ["India", "USA", "UK"] // Add your preferred countries
  ```

- **Blocked Messages**: Add phrases to automatically skip
  ```javascript
  blockedMessages: ["spam", "inappropriate content"]
  ```

- **AI Prompts**: Customize the AI personality and response style

## 🎯 Usage

1. **Navigate to a Chat Website**: The extension works on most chat platforms
2. **Enable AI**: Click the "AI: ON/OFF" button in the top-right corner
3. **Start Chatting**: The extension will automatically:
   - Greet new connections
   - Respond to incoming messages
   - Filter inappropriate content
   - Maintain conversation context

### Controls

- **AI Toggle Button**: Fixed position button (top-right) to enable/disable AI
- **Automatic Greeting**: Sends initial messages when connecting to new users
- **Smart Timing**: Calculates realistic response delays based on message length

## 🔧 Troubleshooting

### Ollama Issues

**Ollama not responding:**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Restart Ollama
pkill ollama
ollama serve

# Check Ollama status
curl http://localhost:11434/api/tags
```

**Model not found:**
```bash
# List installed models
ollama list

# Pull missing model
ollama pull gemma3:270m
```

### Extension Issues

**Extension not loading:**
- Ensure Developer mode is enabled in Chrome
- Check for JavaScript errors in Chrome DevTools
- Verify all files are present in the extension directory

**AI not responding:**
- Check if Ollama is running (`http://localhost:11434`)
- Verify the AI toggle button shows "AI: ON"
- Check browser console for error messages

**OpenAI errors:**
- Verify your API key is valid
- Check your OpenAI account has available credits
- Ensure internet connection is stable

## 📁 File Structure

```
ai-chat-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main extension logic
├── jquery.min.js         # jQuery library
├── sample.html           # Test file
├── package.json          # Node.js dependencies
├── eslint.config.mjs     # ESLint configuration
└── icons/
    └── icon.svg          # Extension icon
```

## 🔒 Privacy & Security

- **Local Processing**: When using Ollama, all AI processing happens locally
- **Data Storage**: Only API keys are stored locally in Chrome storage
- **No Data Collection**: The extension doesn't send data to external servers (except OpenAI if using their API)
- **Content Filtering**: Automatically blocks and disconnects from inappropriate content

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run ESLint: `npm run lint`
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Open Chrome DevTools and check for console errors
3. Verify Ollama is running: `curl http://localhost:11434/api/tags`
4. Create an issue on GitHub with error details

## 🔄 Updates

To update the extension:
1. Pull the latest changes: `git pull origin master`
2. Reload the extension in Chrome: Go to `chrome://extensions/` and click the reload button

---

**Note**: This extension is designed for educational and personal use. Please ensure compliance with the terms of service of any chat platforms you use it with.
