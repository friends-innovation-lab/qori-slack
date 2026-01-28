# 🧭 Journey Map: VA Health and Benefits Mobile App

> **Generated:** January 28, 2026 | **Data:** PT001, PT002, PT003

---

## Overview

| Priority | Pain Point | Opportunity |
|:--------:|------------|-------------|
| 🔴 | Extreme loading times blocking basic tasks — PT003 | Implement low-bandwidth optimization with progress indicators |
| 🔴 | Unlabeled interactive elements preventing screen reader usage — PT001 | Conduct accessibility audit and fix all button labels |
| 🟡 | Search function nearly unusable due to poor discoverability — PT002 | Redesign search with prominent placement and relevant results |

---

## 🗺️ Journey Stages

### 1️⃣ App Launch

**What happens:** User opens VA mobile app and waits for initial loading and authentication to complete.

**📱 Touchpoints:** Home screen loading, authentication screens, main navigation menu

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "This is pretty typical for this app. Everything takes forever to load." — PT003 |

**🔴 Pain Points:**
- Loading screens take 45+ seconds consistently — PT003
- Multiple timeout warnings due to slow connections — PT003

**✅ Success looks like:** App loads within 10 seconds with progress indicator showing loading status

**💡 Opportunity:** Add skeleton loading screens and optimize for low-bandwidth connections

**👥 Owner:** `Engineering` — Performance optimization requires backend and mobile development expertise

<br>

### 2️⃣ Navigation Discovery

**What happens:** User explores main navigation structure to locate desired functionality or information.

**📱 Touchpoints:** Main menu tabs (Health, Benefits, Payments, Profile), search functionality

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." — PT002 |

**🔴 Pain Points:**
- Search icon hidden and difficult to discover — PT002
- Duplicate navigation options create decision paralysis — PT002
- Unlabeled buttons announced only as "Button" by screen readers — PT001

**✅ Success looks like:** Users locate desired section within 3 taps without confusion about navigation labels

**💡 Opportunity:** Audit navigation labels for clarity and eliminate duplicate options

**👥 Owner:** `Design` — Information architecture and navigation patterns need design system updates

<br>

### 3️⃣ Task Execution

**What happens:** User attempts to complete specific tasks like checking claims, updating information, or managing prescriptions.

**📱 Touchpoints:** Form fields, action buttons, status displays, edit controls

| Emotion | Quote |
|:-------:|-------|
| 😠 Frustrated | "I shouldn't have to guess what buttons do. That's basic accessibility." — PT001 |

**🔴 Pain Points:**
- Edit buttons too small and positioned at bottom of screens — PT001, PT003
- Benefits information too basic, lacking actionable details — PT002
- Unable to locate completed claim status information — PT003

**✅ Success looks like:** Primary action buttons visible without scrolling, properly labeled for screen readers

**💡 Opportunity:** Standardize button placement and implement comprehensive accessibility labels

**👥 Owner:** `Accessibility` — Critical accessibility violations require specialized remediation expertise

<br>

### 4️⃣ Information Seeking

**What happens:** User searches for specific information or tries to understand system status and available options.

**📱 Touchpoints:** Search results, help content, status displays, informational sections

| Emotion | Quote |
|:-------:|-------|
| 😞 Resigned | "The search is hard to find and the results aren't great. I'd probably give up and call someone instead." — PT002 |

**🔴 Pain Points:**
- Search results provide generic articles instead of actionable forms — PT002
- System shows "No active claims" when user expects historical data — PT003
- Messaging categories don't match user mental models — PT002

**✅ Success looks like:** Search returns relevant, actionable results within top 3 options

**💡 Opportunity:** Redesign search algorithm to prioritize forms and tools over articles

**👥 Owner:** `Content` — Search relevance and information architecture require content strategy expertise

<br>

### 5️⃣ Communication

**What happens:** User attempts to send messages to healthcare providers or support teams through the app.

**📱 Touchpoints:** Messaging interface, category selection, message composition

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002 |

**🔴 Pain Points:**
- Categorical barriers prevent simple doctor communication — PT002
- Messaging system creates unnecessary complexity — PT002

**✅ Success looks like:** Direct message composition available within 2 taps from main menu

**💡 Opportunity:** Add streamlined "Quick Message" option bypassing category selection

**👥 Owner:** `Product` — Messaging workflow simplification requires product strategy decisions

<br>

### 6️⃣ Task Completion

**What happens:** User completes or abandons tasks, often switching to phone support for complex issues.

**📱 Touchpoints:** Confirmation screens, error messages, phone support contact information

| Emotion | Quote |
|:-------:|-------|
| 😔 Resigned | "By the time this app loads what I need, I could have talked to a person and gotten my answer." — PT003 |

**🔴 Pain Points:**
- Performance issues drive users to alternative support channels — PT003
- Task abandonment due to poor search and navigation — PT002
- Accessibility barriers prevent task completion — PT001

**✅ Success looks like:** 80% of common tasks completed within the app without phone support

**💡 Opportunity:** Add offline functionality for frequently accessed information

**👥 Owner:** `Engineering` — Offline capabilities require technical architecture changes

<br>

---

## 🎯 Recommendations

> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| Priority | Opportunity | Stage | Owner | Effort |
|:---------|-------------|-------|-------|:------:|
| 🔴 | Implement low-bandwidth optimization with progress indicators | App Launch | `Engineering` | 🔵🔵🔵 |
| 🔴 | Conduct accessibility audit and fix all button labels | Task Execution | `Accessibility` | 🔵🔵⚪ |
| 🟡 | Redesign search with prominent placement and relevant results | Information Seeking | `Content` | 🔵🔵⚪ |
| 🟡 | Add streamlined messaging bypassing category selection | Communication | `Product` | 🔵🔵⚪ |
| 🟢 | Audit navigation labels and eliminate duplicate options | Navigation Discovery | `Design` | 🔵⚪⚪ |
| 🟢 | Add offline functionality for frequently accessed information | Task Completion | `Engineering` | 🔵🔵🔵 |

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | How can we prioritize performance optimization for rural users with limited connectivity while maintaining feature richness? | `Engineering + Product` |
| 2 | What's the fastest path to fix critical accessibility violations without disrupting current development cycles? | `Accessibility + Engineering` |
| 3 | Should we implement a simplified "express" interface for common tasks to reduce cognitive load? | `Design + Product` |

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
