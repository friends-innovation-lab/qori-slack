# CivicMind

CivicMind is an AI-powered research assistant for civic tech teams. It automates transcription, summarization, insight tagging, and task generation — while keeping humans in control.

## 🛠️ Setup Instructions

1. Clone and install:
    ```bash
    git clone https://github.com/your-org/civicmind.git
    cd civicmind
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

2. Copy env config:
    ```bash
    cp .env.example .env
    ```

3. Run Slackbot:
    ```bash
    python slackbot/bot.py
    ```

4. Tunnel via ngrok:
    ```bash
    ngrok http 5000
    ```

Test with: `/civicmind ask What are the top usability complaints?`