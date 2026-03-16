#### Model Capabilities

# Voice Overview

xAI offers two voice APIs: the **Text to Speech API** for converting text into spoken audio, and the **Voice Agent API** for real-time, interactive voice conversations with Grok.

## Text to Speech API

Convert text into spoken audio with a single API call. Choose from multiple voices, add inline speech tags for expressive delivery, and output in formats ranging from high-fidelity MP3 to telephony-optimized μ-law.

**Endpoint:** `POST https://api.x.ai/v1/tts`

**Use Cases:**

* Narration for audiobooks, articles, and documentation
* Dynamic audio content for apps and games
* Voiceovers for videos and presentations
* Accessibility - read content aloud for users with visual impairments

[Documentation →](/developers/model-capabilities/audio/text-to-speech)

## Voice Agent API

Build real-time voice applications with the Grok Voice Agent API. Create interactive voice conversations with Grok models via WebSocket for voice assistants, phone agents, and interactive voice applications.

**WebSocket Endpoint:** `wss://api.x.ai/v1/realtime`

The Voice Agent API is only available in `us-east-1` region.

**Use Cases:**

* Voice assistants for web and mobile
* AI-powered phone systems with Twilio
* Real-time customer support
* Interactive Voice Response (IVR) systems

[Documentation →](/developers/model-capabilities/audio/voice-agent)

### Enterprise Ready

Optimized for enterprise use cases across Customer Support, Medical, Legal, Finance, Insurance, and more.

* **Telephony** - Connect to platforms like Twilio, Vonage, and other SIP providers
* **Tool Calling** - CRMs, calendars, ticketing systems, databases, and custom APIs
* **Multilingual** - Serve global customers in their native language with natural accents
* **Low Latency** - Real-time responses for natural, human-like conversations
* **Accuracy** - Precise transcription and understanding of critical information:
  * Industry-specific terminology including medical, legal, and financial vocabulary
  * Email addresses, dates, and alphanumeric codes
  * Names, addresses, and phone numbers

### Tool Calling

Extend your voice agent's capabilities with powerful built-in tools that execute during conversations:

* **Web Search** - Real-time internet search for current information, news, and facts
* **X Search** - Search posts, trends, and discussions from X
* **Collections** - RAG-powered search over your uploaded documents and knowledge bases
* **Custom Functions** - Define your own tools with JSON schemas for booking, lookups, calculations, and more

Tools are called automatically based on conversation context. Your voice agent can search the web, query your documents, and execute custom business logic - all while maintaining a natural conversation flow.

## Shared Capabilities

The following capabilities apply to both the Text to Speech API and the Voice Agent API.

### Voices

Choose from 5 distinct voices, each with unique characteristics suited to different applications:

| Voice | Type | Tone | Description | Sample |
|-------|------|------|-------------|:------:|
| **`Eve`** | Female | Energetic, upbeat | Default voice, engaging and enthusiastic |  |
| **`Ara`** | Female | Warm, friendly | Balanced and conversational |  |
| **`Rex`** | Male | Confident, clear | Professional and articulate, ideal for business |  |
| **`Sal`** | Neutral | Smooth, balanced | Versatile voice suitable for various contexts |  |
| **`Leo`** | Male | Authoritative, strong | Decisive and commanding, suitable for instructional content |  |

### Multilingual

Both APIs support 20 languages with natural pronunciation and culturally-aware speech rhythms. The model automatically detects the input language, or you can specify a BCP-47 language code explicitly (e.g. `en`, `zh`, `pt-BR`) for consistent results.

| Language | Language Code |
|----------|---------------|
| English | `en` |
| Arabic (Egypt) | `ar-EG` |
| Arabic (Saudi Arabia) | `ar-SA` |
| Arabic (United Arab Emirates) | `ar-AE` |
| Bengali | `bn` |
| Chinese (Simplified) | `zh` |
| French | `fr` |
| German | `de` |
| Hindi | `hi` |
| Indonesian | `id` |
| Italian | `it` |
| Japanese | `ja` |
| Korean | `ko` |
| Portuguese (Brazil) | `pt-BR` |
| Portuguese (Portugal) | `pt-PT` |
| Russian | `ru` |
| Spanish (Mexico) | `es-MX` |
| Spanish (Spain) | `es-ES` |
| Turkish | `tr` |
| Vietnamese | `vi` |

The model is also capable of generating speech in additional languages beyond those listed above, with varying degrees of accuracy.

### Audio Formats

Support for multiple audio formats and sample rates to match your application's requirements:

* **MP3** - Compressed audio, wide compatibility (TTS API)
* **WAV** - Lossless audio for editing and post-production (TTS API)
* **PCM (Linear16)** - High-quality audio with configurable sample rates (8kHz-48kHz)
* **G.711 μ-law** - Optimized for telephony applications
* **G.711 A-law** - Standard for international telephony

### Example Applications

Complete working examples are available demonstrating various voice integration patterns:

#### Web Voice Agent

Real-time voice chat in the browser with React frontend and Python/Node.js backends.

**Architecture:**

```
Browser (React) ←WebSocket→ Backend (FastAPI/Express) ←WebSocket→ xAI API
```

**Features:**

* Real-time audio streaming
* Visual transcript display
* Debug console for development
* Interchangeable backends

[GitHub →](https://github.com/xai-org/xai-cookbook/tree/main/voice-examples/agent/web)

#### Phone Voice Agent (Twilio)

AI-powered phone system using Twilio integration.

**Architecture:**

```
Phone Call ←SIP→ Twilio ←WebSocket→ Node.js Server ←WebSocket→ xAI API
```

**Features:**

* Phone call integration
* Real-time voice processing
* Function/tool calling support
* Production-ready architecture

[GitHub →](https://github.com/xai-org/xai-cookbook/tree/main/voice-examples/agent/telephony)

#### WebRTC Voice Agent

The Grok Voice Agent API uses WebSocket connections. Direct WebRTC connections are not available currently.

You can use a WebRTC server to connect the client to a server that then connects to the Grok Voice Agent API.

**Architecture:**

```
Browser (React) ←WebRTC→ Backend (Express) ←WebSocket→ xAI API
```

**Features:**

* Real-time audio streaming
* Visual transcript display
* Debug console for development
* WebRTC backend handles all WebSocket connections to xAI API

[GitHub →](https://github.com/xai-org/xai-cookbook/tree/main/voice-examples/agent/webrtc)

### Third Party Integrations

Build voice agents using popular third-party frameworks and platforms that integrate with the Grok Voice Agent API.

**LiveKit**

Build real-time voice agents using LiveKit's open-source framework with native Grok Voice Agent API integration and WebRTC Support.

[Docs →](https://docs.livekit.io/agents/integrations/xai/) | [GitHub →](https://github.com/livekit/agents/tree/main/livekit-plugins/livekit-plugins-xai)

**Voximplant**

Build real-time voice agents using Voximplant's open-source framework with native Grok Voice Agent API integration and SIP Support.

[Docs →](https://voximplant.com/products/grok-client) | [GitHub →](https://github.com/voximplant/grok-voice-agent-example)

**Pipecat**

Build real-time voice agents using Pipecat's open-source framework with native Grok Voice Agent API integration and advanced conversation management.

[Docs →](https://docs.pipecat.ai/server/services/s2s/grok) | [GitHub →](https://github.com/pipecat-ai/pipecat/blob/main/examples/foundational/51-grok-realtime.py)
