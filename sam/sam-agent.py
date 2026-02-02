"""
Sam - Qori Support Agent
A friendly AI assistant for the Qori research operations platform.
Handles questions, config updates, diagnostics, and escalations.
"""

import os
import json
import yaml
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# Anthropic SDK for Claude
from anthropic import Anthropic

# Slack SDK
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('sam')


class SamAgent:
    """
    Sam is Qori's support agent.

    Capabilities:
    - Answer questions about Qori features
    - Update configuration files (with confirmation)
    - Diagnose issues with modals/prompts
    - Escalate to human team members
    """

    def __init__(self, config_path: str = "config/sam-config.yaml"):
        """Initialize Sam with configuration."""
        self.config = self._load_config(config_path)
        self.client = Anthropic()
        self.slack_client = WebClient(token=os.environ.get("SLACK_BOT_TOKEN"))

        # Conversation state
        self.conversation_history: List[Dict[str, str]] = []
        self.context: Dict[str, Any] = {}

        # Paths
        self.base_path = Path(__file__).parent.parent
        self.docs_path = self.base_path / "docs" / "help"
        self.config_prompts_path = self.base_path / "config" / "prompts"
        self.config_modals_path = self.base_path / "config" / "modals"

        logger.info("Sam initialized successfully")

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load Sam's configuration from YAML."""
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)

    def _build_system_prompt(self) -> str:
        """Build the system prompt for Claude."""
        docs_summary = self._get_docs_summary()

        return f"""You are Sam, a friendly and knowledgeable support assistant for Qori,
a research operations platform for VA UX research teams.

{self.config['llm_config']['system_prompt']}

Available Qori Commands:
- /qori - Show all commands
- /qori-request - Stakeholder submits research request
- /qori-plan - Create study plan, guides, upload research
- /qori-participants - Add or update participants
- /qori-outreach - Generate participant messages
- /qori-observe - Request to observe a session
- /qori-notes - Observer documents session
- /qori-analyze - Analyze session data
- /qori-synthesis - Cross-session synthesis
- /qori-report - Generate stakeholder report

Documentation Summary:
{docs_summary}

When users ask about making changes to configuration files, always:
1. Explain what the change will do
2. Show the specific modification
3. Ask for confirmation before proceeding
4. Never modify sam-config.yaml (your own config)

If you cannot help with something, offer to escalate to the team."""

    def _get_docs_summary(self) -> str:
        """Get a summary of available documentation."""
        summary_parts = []

        if self.docs_path.exists():
            for doc in self.docs_path.glob("*.md"):
                summary_parts.append(f"- {doc.stem}: {doc.name}")

        return "\n".join(summary_parts) if summary_parts else "No documentation files found."

    def _detect_intent(self, message: str) -> str:
        """Detect the user's intent from their message."""
        message_lower = message.lower()

        for intent in self.config.get('intents', []):
            for pattern in intent.get('patterns', []):
                if pattern in message_lower:
                    return intent['action']

        return 'answer_questions'  # Default intent

    def _load_relevant_docs(self, query: str) -> str:
        """Load documentation relevant to the user's query."""
        relevant_content = []
        keywords = query.lower().split()

        # Search through docs
        for doc_path in self.docs_path.glob("*.md"):
            try:
                content = doc_path.read_text()
                # Simple relevance check - could be improved with embeddings
                if any(kw in content.lower() for kw in keywords):
                    relevant_content.append(f"## From {doc_path.name}:\n{content[:2000]}")
            except Exception as e:
                logger.warning(f"Error reading {doc_path}: {e}")

        return "\n\n".join(relevant_content[:3])  # Limit to top 3 docs

    def _load_workflow_info(self, workflow_name: str) -> Optional[Dict[str, Any]]:
        """Load information about a specific workflow."""
        yaml_path = self.config_prompts_path / f"{workflow_name}.yaml"

        if yaml_path.exists():
            with open(yaml_path, 'r') as f:
                return yaml.safe_load(f)

        return None

    async def chat(self, user_message: str, user_id: str = None) -> str:
        """
        Main chat interface for Sam.

        Args:
            user_message: The user's message
            user_id: Optional Slack user ID

        Returns:
            Sam's response
        """
        # Detect intent
        intent = self._detect_intent(user_message)
        logger.info(f"Detected intent: {intent}")

        # Add context based on intent
        context = ""
        if intent == 'answer_questions':
            context = self._load_relevant_docs(user_message)

        # Build messages
        messages = [
            *self.conversation_history,
            {
                "role": "user",
                "content": f"{user_message}\n\nRelevant context:\n{context}" if context else user_message
            }
        ]

        # Call Claude
        try:
            response = self.client.messages.create(
                model=self.config['llm_config']['model'],
                max_tokens=self.config['llm_config']['max_tokens'],
                system=self._build_system_prompt(),
                messages=messages
            )

            assistant_message = response.content[0].text

            # Update conversation history
            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append({"role": "assistant", "content": assistant_message})

            # Trim history if too long
            max_history = self.config['conversation']['context_window'] * 2
            if len(self.conversation_history) > max_history:
                self.conversation_history = self.conversation_history[-max_history:]

            # Log interaction
            self._log_interaction(user_id, user_message, assistant_message, intent)

            return assistant_message

        except Exception as e:
            logger.error(f"Error calling Claude: {e}")
            return "I'm having trouble right now. Let me connect you with the team."

    def diagnose_issue(self, issue_type: str, details: str = None) -> Dict[str, Any]:
        """
        Run diagnostic checks on Qori configuration.

        Args:
            issue_type: Type of issue (modal_validation, yaml_validation, etc.)
            details: Additional details about the issue

        Returns:
            Diagnostic results
        """
        results = {
            "status": "unknown",
            "checks": [],
            "issues": [],
            "recommendations": []
        }

        if issue_type == "modal_validation":
            results = self._validate_modals()
        elif issue_type == "yaml_validation":
            results = self._validate_yaml_files()
        elif issue_type == "reference_check":
            results = self._check_references()

        return results

    def _validate_modals(self) -> Dict[str, Any]:
        """Validate all Slack modal JSON files."""
        results = {"status": "ok", "checks": [], "issues": []}

        for modal_path in self.config_modals_path.rglob("*.json"):
            try:
                with open(modal_path, 'r') as f:
                    json.load(f)
                results["checks"].append(f"  {modal_path.name}: Valid JSON")
            except json.JSONDecodeError as e:
                results["status"] = "error"
                results["issues"].append(f"  {modal_path.name}: Invalid JSON - {e}")

        return results

    def _validate_yaml_files(self) -> Dict[str, Any]:
        """Validate all YAML prompt files."""
        results = {"status": "ok", "checks": [], "issues": []}

        for yaml_path in self.config_prompts_path.glob("*.yaml"):
            try:
                with open(yaml_path, 'r') as f:
                    yaml.safe_load(f)
                results["checks"].append(f"  {yaml_path.name}: Valid YAML")
            except yaml.YAMLError as e:
                results["status"] = "error"
                results["issues"].append(f"  {yaml_path.name}: Invalid YAML - {e}")

        return results

    def _check_references(self) -> Dict[str, Any]:
        """Check for broken references between config files."""
        results = {"status": "ok", "checks": [], "issues": []}

        # Load command mapping
        mapping_path = self.base_path / "config" / "command-mapping.json"
        if mapping_path.exists():
            with open(mapping_path, 'r') as f:
                mapping = json.load(f)

            # Check each command's references
            for cmd, config in mapping.get("commands", {}).items():
                if config.get("modal"):
                    modal_path = self.config_modals_path / config["modal"]
                    if not modal_path.exists():
                        results["status"] = "warning"
                        results["issues"].append(f"Missing modal: {config['modal']} (referenced by {cmd})")

                if config.get("prompt"):
                    prompt_path = self.config_prompts_path / config["prompt"]
                    if not prompt_path.exists():
                        results["status"] = "warning"
                        results["issues"].append(f"Missing prompt: {config['prompt']} (referenced by {cmd})")

        return results

    async def update_config(
        self,
        file_path: str,
        changes: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Update a configuration file (with confirmation).

        Args:
            file_path: Path to the config file
            changes: Dictionary of changes to make
            user_id: User requesting the change (for audit)

        Returns:
            Result of the update operation
        """
        full_path = self.base_path / file_path

        # Security check
        if "sam-config.yaml" in file_path:
            return {"status": "error", "message": "Cannot modify Sam's own configuration."}

        # Check if path is allowed
        allowed = False
        for allowed_pattern in self.config['capabilities']['update_config']['allowed_paths']:
            if re.match(allowed_pattern.replace("*", ".*"), file_path):
                allowed = True
                break

        if not allowed:
            return {"status": "error", "message": f"Path {file_path} is not in the allowed update list."}

        # Load current content
        try:
            with open(full_path, 'r') as f:
                if file_path.endswith('.yaml'):
                    current = yaml.safe_load(f)
                else:
                    current = json.load(f)
        except FileNotFoundError:
            return {"status": "error", "message": f"File not found: {file_path}"}

        # Apply changes
        updated = {**current, **changes}

        # Save with backup
        backup_path = full_path.with_suffix(full_path.suffix + '.backup')
        with open(backup_path, 'w') as f:
            if file_path.endswith('.yaml'):
                yaml.dump(current, f)
            else:
                json.dump(current, f, indent=2)

        with open(full_path, 'w') as f:
            if file_path.endswith('.yaml'):
                yaml.dump(updated, f, default_flow_style=False)
            else:
                json.dump(updated, f, indent=2)

        # Log the change
        self._log_config_change(user_id, file_path, changes)

        return {
            "status": "success",
            "message": f"Updated {file_path}",
            "backup": str(backup_path)
        }

    async def escalate(
        self,
        user_id: str,
        summary: str,
        priority: str = "normal",
        channel: str = "qori-support"
    ) -> Dict[str, Any]:
        """
        Escalate an issue to the human team.

        Args:
            user_id: User requesting escalation
            summary: Summary of the issue
            priority: Priority level (low, normal, high, urgent)
            channel: Channel to escalate to

        Returns:
            Escalation result
        """
        # Build escalation message
        timestamp = datetime.now().isoformat()

        escalation_blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"  Support Escalation [{priority.upper()}]"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*From:* <@{user_id}>"},
                    {"type": "mrkdwn", "text": f"*Time:* {timestamp}"},
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Summary:*\n{summary}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Conversation Context:*\n{self._get_conversation_summary()}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Claim"},
                        "action_id": "escalation_claim",
                        "style": "primary"
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Resolve"},
                        "action_id": "escalation_resolve"
                    }
                ]
            }
        ]

        try:
            # Find channel ID
            channel_config = next(
                (c for c in self.config['capabilities']['escalate_to_team']['escalation_channels']
                 if c['id'] == channel),
                None
            )

            if not channel_config:
                return {"status": "error", "message": f"Unknown channel: {channel}"}

            result = self.slack_client.chat_postMessage(
                channel=channel_config['name'],
                blocks=escalation_blocks,
                text=f"Support escalation from <@{user_id}>: {summary}"
            )

            return {
                "status": "success",
                "message": self.config['responses']['escalation_created'].format(
                    channel=channel_config['name'],
                    summary=summary,
                    priority=priority
                ),
                "thread_ts": result['ts']
            }

        except SlackApiError as e:
            logger.error(f"Slack API error: {e}")
            return {"status": "error", "message": "Failed to create escalation. Please contact the team directly."}

    def _get_conversation_summary(self) -> str:
        """Get a summary of the recent conversation for escalation context."""
        if not self.conversation_history:
            return "No conversation history."

        # Get last 3 exchanges
        recent = self.conversation_history[-6:]
        summary_parts = []

        for msg in recent:
            role = "User" if msg["role"] == "user" else "Sam"
            content = msg["content"][:200] + "..." if len(msg["content"]) > 200 else msg["content"]
            summary_parts.append(f"**{role}:** {content}")

        return "\n".join(summary_parts)

    def _log_interaction(
        self,
        user_id: Optional[str],
        user_message: str,
        sam_response: str,
        intent: str
    ):
        """Log an interaction for analytics."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "intent": intent,
            "user_message_length": len(user_message),
            "response_length": len(sam_response)
        }

        log_path = self.base_path / "logs" / "sam-conversations.log"
        log_path.parent.mkdir(exist_ok=True)

        with open(log_path, 'a') as f:
            f.write(json.dumps(log_entry) + "\n")

    def _log_config_change(
        self,
        user_id: str,
        file_path: str,
        changes: Dict[str, Any]
    ):
        """Log a configuration change for audit."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "file_path": file_path,
            "changes": changes
        }

        log_path = self.base_path / "logs" / "sam-changes.log"
        log_path.parent.mkdir(exist_ok=True)

        with open(log_path, 'a') as f:
            f.write(json.dumps(log_entry) + "\n")

    def reset_conversation(self):
        """Reset the conversation history."""
        self.conversation_history = []
        self.context = {}
        logger.info("Conversation reset")


# Slack event handlers for integration
class SamSlackHandler:
    """Handle Slack events for Sam."""

    def __init__(self, sam: SamAgent):
        self.sam = sam

    async def handle_message(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming Slack message."""
        user_id = event.get("user")
        text = event.get("text", "")
        channel = event.get("channel")

        # Remove bot mention if present
        text = re.sub(r'<@\w+>\s*', '', text).strip()

        # Get response from Sam
        response = await self.sam.chat(text, user_id)

        return {
            "channel": channel,
            "text": response,
            "user": user_id
        }

    async def handle_slash_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle the /qori-sam slash command."""
        user_id = command.get("user_id")
        text = command.get("text", "").strip()

        if not text:
            # Show greeting
            return {
                "response_type": "ephemeral",
                "text": self.sam.config['personality']['greeting']
            }

        # Process the message
        response = await self.sam.chat(text, user_id)

        return {
            "response_type": "ephemeral",
            "text": response
        }


# CLI interface for testing
if __name__ == "__main__":
    import asyncio

    async def main():
        sam = SamAgent()

        print("=" * 50)
        print("Sam - Qori Support Agent")
        print("Type 'quit' to exit, 'reset' to clear history")
        print("=" * 50)
        print()
        print(sam.config['personality']['greeting'])
        print()

        while True:
            try:
                user_input = input("You: ").strip()

                if user_input.lower() == 'quit':
                    print("Goodbye!")
                    break
                elif user_input.lower() == 'reset':
                    sam.reset_conversation()
                    print("Conversation reset.\n")
                    continue
                elif not user_input:
                    continue

                response = await sam.chat(user_input)
                print(f"\nSam: {response}\n")

            except KeyboardInterrupt:
                print("\nGoodbye!")
                break

    asyncio.run(main())
