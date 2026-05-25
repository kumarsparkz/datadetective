# 🔍 DataDetective — AI Chart Forensics

**Catch misleading data visualizations with AI-powered forensic analysis — running locally on your machine.**

DataDetective uses Google's [Gemma 4](https://ai.google.dev/gemma) multimodal AI via [Ollama](https://ollama.com) to analyze charts and graphs for misleading visualization techniques, extract data, and rate chart integrity. **Your data never leaves your device.**

## ✨ Features

- 🖥️ **Runs 100% locally** — Gemma 4 via Ollama, no cloud needed, full privacy
- 📊 **Upload any chart** — Drag-and-drop bar charts, line graphs, pie charts, infographics, and more
- 🚩 **Detect manipulation** — Identifies truncated axes, cherry-picked data, misleading 3D effects, missing context, and 12+ deception techniques
- 🎯 **Trust Score** — Animated integrity gauge (0-100) with detailed verdict
- 📋 **Data Extraction** — Approximate values pulled from the visualization into a structured table
- 💡 **Improvement Suggestions** — Actionable recommendations for more honest charting
- 🧠 **Transparent Reasoning** — See Gemma 4's thinking process
- 🔒 **Privacy-first** — Your data never leaves your machine
- 📱 **Responsive** — Works on desktop and mobile

## 🚀 Quick Start

### 1. Install Ollama
```bash
# macOS
brew install ollama
# Or download from https://ollama.com
```

### 2. Download Gemma 4
```bash
# Recommended: 26B MoE (only 3.8B active params — fast + smart)
ollama pull gemma4:26b

# Or smaller: 4B for lighter hardware
ollama pull gemma4:e4b
```

### 3. Start Ollama
```bash
ollama serve
```

### 4. Open DataDetective
```bash
# Serve locally (needed for Ollama CORS)
cd gemma-challenge
python3 -m http.server 8080
# Open http://localhost:8080
```

### 5. Analyze charts!
Upload any chart image or try the built-in misleading chart samples.

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **HTML5** | Semantic structure |
| **CSS3** | Glassmorphism design with custom properties |
| **Vanilla JS** | Zero dependencies, clean architecture |
| **Gemma 4 via Ollama** | Local multimodal AI inference |
| **Canvas API** | Sample chart generation |

## 🧠 How It Uses Gemma 4

### Local-First Architecture
Gemma 4 runs **locally on your machine via Ollama**. The app auto-detects Ollama, lists available Gemma 4 models, and sends analysis requests to `localhost:11434`. No API keys needed, no cloud dependency, complete privacy.

### Multimodal Vision
Charts are sent as images to Gemma 4's native multimodal model, which understands visual elements like axes, labels, proportions, and data points directly from the image.

### Structured JSON Output
The system prompt instructs Gemma 4 to return analysis as structured JSON, enabling clean parsing and rich UI rendering of results including trust scores, red flags with severity levels, extracted data, and improvement suggestions.

### Why Gemma 4?
- **Open weights** — Runs locally, no vendor lock-in, Apache 2.0 license
- **Multimodal** — Native image understanding without a separate vision encoder
- **MoE Efficiency** — 26B model has only 3.8B active params per forward pass
- **Privacy** — Your charts and data never leave your machine

## 📁 Project Structure

```
gemma-challenge/
├── index.html          # Main application page
├── css/
│   └── style.css       # Design system with glassmorphism
├── js/
│   └── app.js          # Core logic, Ollama + Cloud API integration
├── README.md           # This file
└── LICENSE             # MIT License
```

## 📊 Sample Misleading Charts

Three built-in Canvas-generated samples:

1. **📉 Truncated Y-Axis** — Y-axis starts at 95 instead of 0, making 5% growth look dramatic
2. **🍒 Cherry-Picked Data** — Shows only an upward 5-month window of an overall declining year
3. **🥧 Misleading Pie Chart** — 3D pie where percentages sum to 108%, with exploded hero slice

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

## 🙏 Credits

- Built with [Gemma 4](https://ai.google.dev/gemma) by Google DeepMind
- Local inference via [Ollama](https://ollama.com)
- Created for the [DEV.to Gemma 4 Challenge](https://dev.to/challenges/google-gemma-2026-05-06)
# datadetective
