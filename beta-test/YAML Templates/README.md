# 🧠 CivicMind YAML Template Library

Welcome to the CivicMind template system — a structured, AI-powered way to accelerate research, synthesis, and sharing directly from Slack.

These YAML files define how CivicMind interprets user input, prompts the AI, and returns structured outputs for your research operations.

---

## 🧩 What Are YAML Templates?

Each YAML file represents a **research tool or task**, like:

- Interview summaries
- Affinity mapping
- Persona generation
- Journey maps
- Quote extraction
- Executive summaries
- Insight reports
- Usability issue logging
- Design opportunities
- Jobs-to-be-done
- Outcome tracking
- Slide deck outlines
- Stakeholder summaries
- Thematic synthesis
- Survey Synthesis

---

## 📦 Folder Structure

```text
civicmind_templates/
│
├─ interview_summary.yaml
├─ affinity_mapping.yaml
├─ persona_generator.yaml
├─ journey_mapping.yaml
├─ quote_extraction.yaml
├─ executive_summary.yaml
├─ jobs_to_be_done.yaml
├─ thematic_synthesis.yaml
├─ insights_report.yaml
├─ usability_issues_extractor.yaml
├─ stakeholder_summary.yaml
├─ design_opportunity_generator.yaml
├─ outcome_tracker.yaml
└─ topline_slide_generator.yaml
└─ survey_synthesis.yaml
```

---

## 🔧 YAML Template Anatomy

Each YAML file contains:

```yaml
id: internal_id
label: Human-friendly name with emoji
description: What this template does
input_type: text | file
input_processing: summarize_if_long (optional)
batch_mode: true (optional)
batch_delimiter: "---" (optional)

prompt: |
  The instructions given to the AI. Can include formatting rules, constraints, tone, etc.

output_format: |
  A structured Markdown-style output that AI should return
```

---

## 🤖 How It Works in Slack

1. 🔁 Researcher runs a command like:
   ```
   /civicmind summarize_interview
   ```
2. 🧠 CivicMind uses the corresponding YAML file (`interview_summary.yaml`)
3. ✨ The AI processes your input based on the prompt + output_format
4. 📄 The result is posted in your Slack thread **and** saved to GitHub

---

## 🔍 When to Use Each Template

| Template                        | Use When...                                               |
|--------------------------------|------------------------------------------------------------|
| `interview_summary.yaml`       | You have raw transcripts to summarize                      |
| `affinity_mapping.yaml`        | You want to group quotes or observations into themes       |
| `persona_generator.yaml`       | You want to generate draft personas from research          |
| `journey_mapping.yaml`         | You need a text-based journey map (up to 9 steps)          |
| `quote_extraction.yaml`        | You want to extract key quotes + sentiment tags            |
| `executive_summary.yaml`       | You need a polished 3-paragraph synthesis                  |
| `jobs_to_be_done.yaml`         | You’re mapping goals and barriers                         |
| `thematic_synthesis.yaml`      | You want to aggregate themes across many interviews        |
| `insights_report.yaml`         | You want a report/slide outline from a Slack summary       |
| `usability_issues_extractor.yaml`| You’re logging usability issues with structure            |
| `stakeholder_summary.yaml`     | You want a TL;DR for busy stakeholders                     |
| `design_opportunity_generator.yaml`| You want “How Might We” prompts from insights          |
| `outcome_tracker.yaml`         | You want to turn insights into tasks and owners            |
| `topline_slide_generator.yaml` | You want a 6-slide formatted deck summary                  |
| `survey_synthesis.yaml`        | You want to extract insights from open-ended survey responses       |

---

## ✨ Tips for Use

- Use plain text — CivicMind works best when input is simple and clear
- For long notes, CivicMind may summarize first before analysis (`summarize_if_long`)
- For multiple interviews, use `---` to separate them in batch mode
- Output will appear in Slack as Markdown and get stored in your project’s GitHub folder

---

## 📌 Got Feedback?

Let the CivicMind team know if you'd like to customize a template or create a new one!
