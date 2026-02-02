# Frequently Asked Questions

Common questions about using Qori.

---

## General

### What is Qori?

Qori is an AI-powered research operations platform for VA UX research teams. It runs in Slack and helps researchers plan studies, manage participants, document sessions, analyze data, and generate reports.

### Who can use Qori?

Qori is available to VA UX research team members with access to the Qori Slack workspace.

### Is Qori free?

Qori is provided to VA research teams at no cost.

### Where does Qori store my data?

All outputs are stored in GitHub repositories. Qori doesn't store data outside of your designated GitHub repos.

---

## Commands & Features

### How do I see all available commands?

Type `/qori` in any Slack channel.

### Can I use Qori in DMs?

Yes, you can run most Qori commands in direct messages. Some commands that need channel context may require a regular channel.

### What's the difference between Research Brief and Research Plan?

- **Research Brief** is a quick 1-page overview for stakeholder alignment
- **Research Plan** is a comprehensive document with methodology, timeline, risks, etc.

Start with a brief for quick alignment, then create a full plan for execution.

### Can I edit outputs after they're generated?

Yes! All outputs are saved to GitHub as Markdown files. You can edit them directly in GitHub or clone the repo locally.

### How many participants can I track?

There's no hard limit. Qori can handle studies with 100+ participants, though most VA studies have 5-15.

---

## AI & Privacy

### What AI does Qori use?

Qori uses Claude (Anthropic) and GPT-4 (OpenAI) for different features. The specific model depends on the task.

### Is my data used to train AI models?

No. Qori uses API access that doesn't include training on your data.

### Does Qori store PII?

Qori is designed to minimize PII exposure:
- Use participant IDs (P001) instead of names
- Redaction is built into processing workflows
- No PII is stored in Qori's own systems

### Can I use participant names?

We recommend using participant IDs for privacy. If you must use names, use first name + last initial (e.g., "Alex M.").

---

## Session Notes

### What should I include in session notes?

Include:
- Direct quotes (in quotation marks)
- Timestamps for key moments
- Task outcomes (completed/failed)
- Emotional reactions
- Technical issues
- Accessibility observations

### How long after a session can I submit notes?

Submit as soon as possible while memories are fresh. The system accepts notes for sessions within 7 days.

### Can multiple observers submit notes for the same session?

Yes! Each observer can submit their own notes. They'll be saved with their name and timestamp.

---

## Participant Outreach

### What message types are available?

1. Initial recruitment - First contact
2. Session confirmation - Confirm scheduled session
3. Session reminder - 24-48 hour reminder
4. Rescheduling request - Need to change times
5. Follow-up - Gentle check-in
6. Thank you - Post-session appreciation

### Can I customize the emails?

Yes. The generated emails are starting points. Copy and edit them as needed before sending.

### Does Qori send emails automatically?

No. Qori generates the email content, but you copy and send it yourself through your email client.

---

## Synthesis & Analysis

### How many sessions do I need for synthesis?

Minimum 3-5 sessions recommended. More sessions = richer synthesis, but diminishing returns after 10-12.

### What synthesis types should I use?

| If you want to... | Use |
|------------------|-----|
| Find themes | Affinity Mapping |
| Understand user flow | Journey Mapping |
| Create user archetypes | Persona Generator |
| Identify goals | Jobs to Be Done |
| Map service delivery | Service Blueprint |
| Get design ideas | Design Opportunities |
| Track bugs | Usability Issues |

### Can I run multiple synthesis types?

Yes! Run as many as useful for your research. Each creates a separate output.

---

## GitHub Integration

### Where are my files saved?

Files are saved to your study's GitHub repository in organized folders:
- `00-requests/` - Research requests
- `01-planning/` - Plans, briefs, guides
- `02-participants/` - Tracker, outreach
- `03-fieldwork/` - Session notes
- `04-analysis/` - Analysis outputs
- `05-findings/` - Synthesis, reports

### How do I access my GitHub repo?

Check your Slack DM from Qori - it includes a link to the file. You can also browse directly at github.com/[your-org]/[study-name].

### What if I can't access the repo?

Ask your team lead to add you to the GitHub organization, or request access in #qori-support.

---

## Troubleshooting

### Why didn't my modal open?

See [Troubleshooting Guide](troubleshooting.md) > Modal Issues

### Where did my output go?

Check your Slack DMs for a confirmation message with the file link. If not there, ask Sam: `/qori-sam where did my research plan go?`

### Something went wrong - now what?

1. Wait 1 minute and try again
2. Ask Sam: `/qori-sam [describe your issue]`
3. Post in #qori-support

---

## Getting Help

### How do I contact support?

- **Quick questions:** `/qori-sam [your question]`
- **General help:** Post in #qori-support
- **Bug reports:** Post in #qori-bugs or tell Sam to escalate

### Can I request new features?

Yes! Share feature ideas in #qori-support or with Sam. We prioritize based on researcher needs.

### Where can I give feedback?

- Tell Sam: `/qori-sam I have feedback about...`
- Post in #qori-support
- Talk to your research lead

---

## Best Practices

### What makes a good research plan input?

- Be specific about your product area
- Clearly state the decision you're trying to inform
- Describe your target participants precisely
- Choose realistic timeline options

### How can I get better AI outputs?

1. Provide clear, specific inputs
2. Use complete sentences
3. Include context the AI needs
4. Review and edit outputs
5. Report issues so we can improve

### What shouldn't I use Qori for?

- Sensitive personnel matters
- Classified information
- Non-research content
- Personal projects
