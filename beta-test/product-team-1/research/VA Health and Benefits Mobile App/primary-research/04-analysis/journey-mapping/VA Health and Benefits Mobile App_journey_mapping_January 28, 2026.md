# 🧭 Journey Map: VA Health and Benefits Mobile App

> **Generated:** January 28, 2026 | **Data:** PT001, PT002, PT003

---

## Overview

| Priority | Pain Point | Opportunity |
|:--------:|------------|-------------|
| 🔴 | Extreme loading times blocking basic tasks — PT003 | Implement low-bandwidth optimization with progress indicators |
| 🔴 | Unlabeled interactive elements — PT001 | Conduct accessibility audit and fix all button labels |
| 🟡 | Search function nearly unusable — PT002 | Redesign search with prominent placement and relevant results |

---

## 🗺️ Journey Stages

### 1️⃣ App Launch

**What happens:** User opens VA app and encounters initial loading screen before accessing main navigation.

**📱 Touchpoints:** Home screen → VA app icon → Loading screen → Main dashboard

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "This is pretty typical for this app. Everything takes forever to load." — PT003 |

**🔴 Pain Points:**
- Loading screens take 45+ seconds consistently — PT003
- Rural connectivity causes timeout warnings — PT003

**✅ Success looks like:** App loads main dashboard within 10 seconds on slow connections

**💡 Opportunity:** Add skeleton loading screens with progress indicators for low-bandwidth users

**👥 Owner:** `Engineering` — Performance optimization requires backend and mobile development expertise

<br>

### 2️⃣ Navigation Discovery

**What happens:** User explores main navigation to locate desired functionality like claims, appointments, or messaging.

**📱 Touchpoints:** Main menu → Health/Benefits/Payments/Profile tabs → Secondary navigation

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." — PT002 |

**🔴 Pain Points:**
- Duplicate navigation options create decision paralysis — PT002
- Search icon hidden and difficult to discover — PT002
- Important functions buried in deep menu hierarchies — PT001

**✅ Success looks like:** Users locate primary functions within 3 taps from main screen

**💡 Opportunity:** Audit navigation labels to eliminate duplicates and improve discoverability

**👥 Owner:** `Design` — Information architecture and navigation patterns need UX redesign

<br>

### 3️⃣ Task Execution

**What happens:** User attempts to complete specific tasks like updating contact info, checking claim status, or scheduling appointments.

**📱 Touchpoints:** Task-specific screens → Form fields → Action buttons → VoiceOver screen reader

| Emotion | Quote |
|:-------:|-------|
| 😠 Frustrated | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." — PT001 |

**🔴 Pain Points:**
- Multiple unlabeled buttons announced as "Button" by VoiceOver — PT001
- Edit buttons positioned at bottom of screens, nearly missed — PT001
- Unable to locate completed claim status information — PT003

**✅ Success looks like:** All interactive elements have descriptive labels and standard placement

**💡 Opportunity:** Implement comprehensive button labeling and standardize action button placement

**👥 Owner:** `Accessibility` — Screen reader compatibility requires specialized accessibility expertise

<br>

### 4️⃣ Information Seeking

**What happens:** User searches for specific information or tries to understand benefit details and claim statuses.

**📱 Touchpoints:** Search function → Benefits section → Claims status → Information displays

| Emotion | Quote |
|:-------:|-------|
| 😞 Disappointed | "Just generic articles about travel pay, not the actual form I need to submit." — PT002 |

**🔴 Pain Points:**
- Search results provide irrelevant generic articles instead of actionable forms — PT002
- Benefits information too high-level, lacking actionable details — PT002
- System shows "No active claims" instead of historical information — PT003

**✅ Success looks like:** Search returns relevant forms and tools within top 3 results

**💡 Opportunity:** Enhance search algorithm to prioritize actionable content over generic articles

**👥 Owner:** `Content` — Search relevance and information architecture requires content strategy expertise

<br>

### 5️⃣ Communication

**What happens:** User attempts to send messages to care team or communicate with VA staff about questions or issues.

**📱 Touchpoints:** Messaging interface → Category selection → Message composition → Send confirmation

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002 |

**🔴 Pain Points:**
- Messaging system creates unnecessary categorical barriers — PT002
- Categories don't match user mental models for simple questions — PT002
- Slow loading at each step of messaging process — PT003

**✅ Success looks like:** Direct doctor communication option bypasses category selection for simple questions

**💡 Opportunity:** Add "Quick Question" option that bypasses complex category system

**👥 Owner:** `Product` — Messaging workflow changes require product strategy and user flow redesign

<br>

### 6️⃣ Task Completion

**What happens:** User completes or abandons tasks, often falling back to phone support when digital systems fail.

**📱 Touchpoints:** Confirmation screens → Phone support fallback → Task abandonment

| Emotion | Quote |
|:-------:|-------|
| 😔 Resigned | "By the time this app loads what I need, I could have talked to a person and gotten my answer." — PT003 |

**🔴 Pain Points:**
- Users abandon search and resort to phone support — PT002
- Task completion times extended by performance issues — PT003
- Connection drops cause concerns about losing form data — PT003

**✅ Success looks like:** 80% of common tasks completed without phone support fallback

**💡 Opportunity:** Add offline functionality for basic information and form data persistence

**👥 Owner:** `Engineering` — Offline capabilities and data persistence require mobile development expertise

<br>

---

## 🎯 Recommendations

> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| Priority | Opportunity | Stage | Owner | Effort |
|:--------:|-------------|-------|-------|:------:|
| 🔴 | Implement low-bandwidth optimization with progress indicators | App Launch | `Engineering` | 🔵🔵🔵 |
| 🔴 | Conduct accessibility audit and fix all button labels | Task Execution | `Accessibility` | 🔵🔵⚪ |
| 🟡 | Redesign search with prominent placement and relevant results | Information Seeking | `Content` | 🔵🔵⚪ |
| 🟡 | Add "Quick Question" messaging option bypassing categories | Communication | `Product` | 🔵🔵⚪ |
| 🟢 | Audit navigation labels to eliminate duplicates | Navigation Discovery | `Design` | 🔵⚪⚪ |
| 🟢 | Add offline functionality for basic information | Task Completion | `Engineering` | 🔵🔵🔵 |

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | How can we prioritize performance optimization for rural users without impacting urban user experience? | Engineering + Product |
| 2 | What's the fastest path to fix critical accessibility violations while planning comprehensive audit? | Accessibility + Design |
| 3 | Should we implement quick messaging bypass as temporary fix or redesign entire category system? | Product + Content |

<br>

---

## 📚 Methodology

<details>
<summary><strong>Framework & References</strong></summary>

**Framework:** Experience Journey Mapping

**Approach:** Stage-by-stage analysis of user actions, emotions, pain points, and opportunities from qualitative research data.

**Data Sources:** PT001 (Marine veteran with VoiceOver), PT002 (Navy veteran, regular user), PT003 (Army veteran, rural Alabama)

### References

This analysis follows established journey mapping methods:

- **Adaptive Path** — Pioneers of journey mapping methodology
- **Nielsen Norman Group** — Stage-based emotion mapping framework
- **Service Design Thinking** — Stickdorn & Schneider, touchpoint analysis
- **Mapping Experiences** — Jim Kalbach, O'Reilly Media

</details>

---

*Generated by Qori • AI-assisted journey mapping from user research data*
