# 🔍 DIAGNOSTIC OUTPUT - Variable Check

**Generated:** October 19, 2025

---

## Variables Received from Slack/Database:

### Research Topic Variables:
- **what_are_you_researching:** ""
- **research_focus:** "We're testing the VA Health and Benefits mobile app navigation and information architecture to identify usability barriers that prevent veterans from efficiently completing common tasks. The current app has a 4.2/10 user satisfaction rating with 45% task abandonment rate. Veterans frequently use search to find basic features, indicating poor information architecture. We need to understand navigation pain points and mental models to inform the Q1 2026 mobile app redesign and improve veteran access to essential health and benefits services."

### Questions Variables:
- **specific_questions:** ""
- **research_questions:** "How do veterans organize health and benefits information in their mental models? Which navigation patterns (bottom tabs vs hamburger menu) enable faster task completion? What are the critical barriers preventing veterans from finding key features like prescription refills, appointment scheduling, and benefits status? How do accessibility needs (screen readers, large text, motor impairments) affect navigation success? Where do veterans expect to find specific functions within the app structure? What causes veterans to abandon tasks mid-completion and resort to phone support instead?"

### Participant Variables:
- **who_are_your_participants:** ""
- **participants:** "Veterans who actively use the VA mobile app at least 2-3 times monthly for health and benefits management. Mixed demographics including age ranges 25-65+, various service branches, and different geographic locations (urban/suburban/rural). Technology comfort levels from basic to advanced. Minimum 50% of participants must use assistive technologies (VoiceOver, TalkBack, large text settings) or have documented accessibility needs (vision, motor, cognitive). Include both iOS and Android users to account for platform differences in navigation patterns and accessibility implementation."

### Other Variables:
- **testing_url:** "https://staging.va.gov/housing/apply"
- **session_length:** ""

---

## Analysis:

**Which variables have values?**
{% if what_are_you_researching %}✅ what_are_you_researching has a value{% else %}❌ what_are_you_researching is EMPTY{% endif %}
{% if research_focus %}✅ research_focus has a value{% else %}❌ research_focus is EMPTY{% endif %}
{% if specific_questions %}✅ specific_questions has a value{% else %}❌ specific_questions is EMPTY{% endif %}
{% if research_questions %}✅ research_questions has a value{% else %}❌ research_questions is EMPTY{% endif %}
{% if who_are_your_participants %}✅ who_are_your_participants has a value{% else %}❌ who_are_your_participants is EMPTY{% endif %}
{% if participants %}✅ participants has a value{% else %}❌ participants is EMPTY{% endif %}
{% if testing_url %}✅ testing_url has a value{% else %}❌ testing_url is EMPTY{% endif %}
{% if session_length %}✅ session_length has a value{% else %}❌ session_length is EMPTY{% endif %}

---

## Instructions:

Run this diagnostic YAML first with the same Slack form inputs.
The output will show us exactly which variable names your system is using.
Then we can update the production YAML to match.
