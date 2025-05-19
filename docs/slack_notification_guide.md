# 📬 CivicMind Slack Messaging & Notification Guide

This document outlines what CivicMind pushes to Slack, who receives it, and how teams can customize notifications for insights and summaries.

---

## 🧠 1. Insight Cards (for Researchers, Designers, PMs)

These are AI-generated or researcher-approved snippets of user feedback. Shared in project-specific or design channels.

### Example Slack Message

🧠 **Insight:** Veterans unsure about eligibility criteria  
💬 *“I wasn’t sure if I even qualified.”*  
🔍 Theme: Eligibility / Confusion  
✅ Suggested Action: Add yes/no screener  
📁 Source: `interview_02.txt`  
🔗 [View full summary](https://github.com/org/project/blob/main/summary.md)

---

## 📊 2. Weekly or On-Demand Summary Digest (for Execs, PMs)

These summaries roll up insights by theme, frequency, and actionability. Sent to `#product-leadership`, `#team-updates`, or other configured digest channels.

### Example Slack Message

📊 **Weekly Research Summary: Benefits Navigation**

- ✅ 3 major themes: Eligibility Confusion, Page Overload, Upload Friction  
- 📌 6 quotes extracted, 4 GitHub Issues created  
- 📎 [Full Report (PDF)](https://civicmind.ai/downloads/benefits-summary.pdf)  
- 📊 [Insights Sheet (Google)](https://docs.google.com/sheet/xyz)

🧠 _AI-generated – human-reviewed by @researcher_

---

## 🔔 3. Actionable Alerts and Nudges

Used to remind team members of upcoming deliverables, unreviewed insights, or untagged transcripts.

### PM Example

🔔 2 new research insights tagged `form UX` this week.  
Would you like to generate Jira tasks?  
→ `/civicmind create_tickets from=benefits-nav`

### Researcher Reminder

⏰ Readout for 'Benefits Navigation' is due Friday.  
Run `/civicmind generate_readout` or `/civicmind post_summary`

---

## 🔀 Notification Routing Matrix

| Role         | Slack Channel            | Push Frequency | Content |
|--------------|--------------------------|----------------|---------|
| Researcher   | `#project-benefits-nav`   | Real-time      | Insight cards, summaries |
| Designer     | `#ux`, `#design-review`   | Daily/weekly   | Quotes + linked UI tasks |
| PM           | `#product`, `#delivery`   | Weekly         | Digest summaries, issue suggestions |
| Executive    | `#leadership-digest`      | Weekly         | Research overview summaries |
| Whole Team   | `#research-digests`       | Weekly or per sprint | Top themes, links to PDFs and sheets |

---

## ⚙️ Customization Options

- Set a default digest channel at project creation:
  `/civicmind new_project "Benefits Navigation" channel=#research-digests`

- Change channel for summary posts:
  `/civicmind post_summary to=#product-leadership`

- Limit post frequency by role or tag:
  `/civicmind settings frequency=weekly tags=high-priority only`

---

📂 Save this file to: `/docs/slack_notification_guide.md`