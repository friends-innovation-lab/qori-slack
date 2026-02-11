# 🧭 Journey Map: 2027 VA Health and Benefits Mobile App Navigation Study

> **Generated:** February 11, 2026 | **Data:** PT001, PT002, PT003

---

## Overview

| Priority | Pain Point | Opportunity |
|:--------:|------------|-------------|
| 🔴 | Unlabeled buttons block task completion — PT001 | Add descriptive accessibility labels to all interactive elements |
| 🔴 | Claims status buried in navigation — PT002 | Elevate claims status to customizable home screen widget |
| 🟡 | Session timeout disrupts active use — PT003 | Extend timeout duration and implement draft saving |

---

## 🗺️ Journey Stages

### 1️⃣ App Entry

**What happens:** User opens VA app and authenticates to access their health and benefits information.

**📱 Touchpoints:** App icon → Login screen → Biometric authentication → Home screen

| Emotion | Quote |
|:-------:|-------|
| 😊 Satisfied | "I like that I can use my fingerprint to log in. Much easier than typing passwords." — PT003 |

**🔴 Pain Points:**
- Session timeout occurs too frequently during active use — PT003, 00:15:00
- Authentication required multiple times per session — PT003, 00:45:00

**✅ Success looks like:** Biometric login completes in under 3 seconds with session lasting 2+ hours of active use

**💡 Opportunity:** Extend session timeout duration for active users and add session warning notifications

**👥 Owner:** `Engineering` — Handles authentication logic and session management

<br>

### 2️⃣ Home Screen Navigation

**What happens:** User reviews home screen content and navigates to their primary task areas.

**📱 Touchpoints:** Home screen widgets → Main navigation tabs → Menu sections

| Emotion | Quote |
|:-------:|-------|
| 😊 Pleased | "I like that my appointments are right on the home screen. That's what I check most." — PT002 |

**🔴 Pain Points:**
- Daily-use features like claims status require 5 taps to access — PT002
- Important information not visible on home screen despite frequent use — PT002

**✅ Success looks like:** Most-used features accessible within 2 taps from home screen with customizable widget options

**💡 Opportunity:** Add customizable home screen widgets for claims status and other frequently accessed information

**👥 Owner:** `Design` — Responsible for information architecture and home screen layout

<br>

### 3️⃣ Feature Discovery

**What happens:** User searches for specific features or navigates through menu hierarchies to find needed functionality.

**📱 Touchpoints:** Search function → Menu navigation → Category sections (Health, Benefits, Profile)

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful." — PT002 |

**🔴 Pain Points:**
- Search function fails to return relevant results for common queries — PT002
- Menu structure doesn't match user mental models — PT002, 00:03:00
- Deep navigation hierarchies difficult with screen readers — PT001

**✅ Success looks like:** Search returns relevant results within 3 seconds and navigation depth limited to 3 levels maximum

**💡 Opportunity:** Redesign search to include contextual results and add navigation landmarks for screen readers

**👥 Owner:** `Engineering` — Search functionality requires backend improvements and accessibility implementation

<br>

### 4️⃣ Task Execution

**What happens:** User attempts to complete specific tasks like checking claims, scheduling appointments, or managing prescriptions.

**📱 Touchpoints:** Task-specific interfaces → Form inputs → Action buttons → Confirmation screens

| Emotion | Quote |
|:-------:|-------|
| 😤 Blocked | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." — PT001 |

**🔴 Pain Points:**
- Unlabeled buttons prevent task completion for screen reader users — PT001, 00:12:00
- Touch targets too small for users with motor difficulties — PT003
- Technical jargon creates confusion about status and next steps — PT002, 00:22:00

**✅ Success looks like:** All interactive elements have descriptive labels, touch targets meet 44px minimum, and plain language explains all statuses

**💡 Opportunity:** Implement comprehensive accessibility audit and replace technical jargon with plain language explanations

**👥 Owner:** `Accessibility` — Critical accessibility violations require immediate remediation

<br>

### 5️⃣ Information Review

**What happens:** User reviews results, status updates, or detailed information related to their completed tasks.

**📱 Touchpoints:** Status displays → Detail screens → Information cards → Loading states

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "I don't understand what 'Evidence gathering' means. Is that good or bad?" — PT002 |

**🔴 Pain Points:**
- Status terminology unclear and creates anxiety — PT002
- Text scaling inconsistent across interface elements — PT003, 00:08:00
- Loading times exceed user expectations — PT003

**✅ Success looks like:** All status updates use plain language with clear next steps, text scales consistently, and loading completes under 5 seconds

**💡 Opportunity:** Replace technical jargon with plain language and implement consistent text scaling standards

**👥 Owner:** `Content` — Plain language implementation and consistent messaging across all status updates

<br>

### 6️⃣ Task Completion

**What happens:** User completes their intended task and exits or continues to additional tasks.

**📱 Touchpoints:** Confirmation screens → Success messages → Navigation to next task → App exit

| Emotion | Quote |
|:-------:|-------|
| 😊 Satisfied | "This section actually works pretty well - I can understand what each section contains." — PT001 |

**🔴 Pain Points:**
- Critical interface elements hidden at bottom of screens — PT001, 00:42:00
- Task interruption from session timeouts — PT003, 00:45:00

**✅ Success looks like:** Important actions visible without scrolling, tasks complete without interruption, clear success confirmation provided

**💡 Opportunity:** Relocate critical buttons to discoverable positions and implement draft saving for interrupted tasks

**👥 Owner:** `Design` — Interface element placement and user flow optimization

<br>

---

## 🎯 Recommendations

> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| Priority | Opportunity | Stage | Owner | Effort |
|:--------:|-------------|-------|-------|:------:|
| 🔴 | Add descriptive accessibility labels to all interactive elements | Task Execution | `Accessibility` | 🔵🔵⚪ |
| 🔴 | Add customizable home screen widgets for claims status | Home Screen Navigation | `Design` | 🔵🔵🔵 |
| 🟡 | Replace technical jargon with plain language explanations | Information Review | `Content` | 🔵🔵⚪ |
| 🟡 | Implement consistent text scaling across all UI elements | Information Review | `Engineering` | 🔵🔵⚪ |
| 🟢 | Extend session timeout duration and add draft saving | App Entry | `Engineering` | 🔵🔵⚪ |

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | Should claims status widget be default for all users or opt-in based on usage patterns? | `Design + Product` |
| 2 | What's the feasibility timeline for comprehensive accessibility audit and remediation? | `Accessibility + Engineering` |
| 3 | How can we prioritize plain language implementation across different content areas? | `Content + Policy` |

<br>

---

## 📚 Methodology

<details>
<summary><strong>Framework & References</strong></summary>

**Framework:** Experience Journey Mapping

**Approach:** Stage-by-stage analysis of user actions, emotions, pain points, and opportunities from qualitative research data.

**Data Sources:** PT001 (Marine veteran with vision loss using VoiceOver), PT002 (Army veteran, daily app user), PT003 (Navy veteran with age-related vision decline)

### References

This analysis follows established journey mapping methods:

- **Adaptive Path** — Pioneers of journey mapping methodology
- **Nielsen Norman Group** — Stage-based emotion mapping framework
- **Service Design Thinking** — Stickdorn & Schneider, touchpoint analysis
- **Mapping Experiences** — Jim Kalbach, O'Reilly Media

</details>

---

*Generated by Qori • AI-assisted journey mapping from user research data*
