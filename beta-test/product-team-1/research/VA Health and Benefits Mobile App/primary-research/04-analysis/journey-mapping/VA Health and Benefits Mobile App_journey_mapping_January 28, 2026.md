# 🧭 Journey Map: VA Health and Benefits Mobile App

> **Generated:** January 28, 2026 | **Data:** PT001, PT002, PT003

---

## Overview

| Priority | Pain Point | Opportunity |
|:---------|------------|-------------|
| 🔴 | Extreme loading times blocking basic tasks — PT003 | Implement low-bandwidth optimization with progress indicators |
| 🔴 | Unlabeled interactive elements creating accessibility barriers — PT001 | Conduct accessibility audit and fix all button labels |
| 🟡 | Search function nearly unusable — PT002 | Redesign search with prominent placement and relevant results |

---

## 🗺️ Journey Stages

### 1️⃣ Initial Access

**What happens:** Veterans open the VA app to complete routine tasks like checking benefits, prescriptions, or appointments.

**📱 Touchpoints:** Home screen → Main navigation (Health, Benefits, Payments, Profile)

| Emotion | Quote |
|:-------:|-------|
| 😊 Optimistic | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." — PT001 |

**🔴 Pain Points:**
- Loading screens take 45+ seconds consistently — PT003
- Multiple timeout warnings due to slow connections — PT003

**✅ Success looks like:** App loads within 10 seconds on rural connections with clear progress indicators

**💡 Opportunity:** Add skeleton loading screens and optimize for low-bandwidth connections

**👥 Owner:** `Engineering` — Performance optimization requires backend and frontend improvements

<br>

### 2️⃣ Task Navigation

**What happens:** Users navigate through app sections to find specific functions like scheduling appointments or filing claims.

**📱 Touchpoints:** Section menus, navigation buttons, search functionality

| Emotion | Quote |
|:-------:|-------|
| 😤 Confused | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." — PT002 |

**🔴 Pain Points:**
- Search icon hidden and difficult to discover — PT002
- Duplicate navigation options create decision paralysis — PT002
- Unlabeled buttons announced only as "Button" by screen readers — PT001

**✅ Success looks like:** Users find target functions within 3 taps without confusion about navigation labels

**💡 Opportunity:** Audit navigation labels for clarity and eliminate duplicates, make search prominently visible

**👥 Owner:** `Design` — Information architecture and navigation patterns need redesign

<br>

### 3️⃣ Task Execution

**What happens:** Veterans attempt to complete specific tasks like updating contact information, checking claim status, or messaging healthcare providers.

**📱 Touchpoints:** Forms, edit buttons, messaging interface, status displays

| Emotion | Quote |
|:-------:|-------|
| 😠 Frustrated | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002 |

**🔴 Pain Points:**
- Edit buttons positioned at bottom of screens, nearly missed — PT001
- Messaging system creates unnecessary categorical barriers — PT002
- Unable to locate completed claim status information — PT003

**✅ Success looks like:** Primary action buttons visible without scrolling, messaging completes in under 2 minutes

**💡 Opportunity:** Standardize action button placement and add direct messaging option bypassing categories

**👥 Owner:** `Design` — Interface patterns and user flow optimization needed

<br>

### 4️⃣ Information Retrieval

**What happens:** Users seek specific information about their benefits, prescriptions, or healthcare status.

**📱 Touchpoints:** Benefits sections, prescription lists, appointment details, search results

| Emotion | Quote |
|:-------:|-------|
| 😊 Satisfied | "This part actually works really well. It shows when I last refilled it, how many refills I have left, and the request button is obvious." — PT002 |

**🔴 Pain Points:**
- Benefits information too high-level, lacks actionable details — PT002
- Search returns generic articles instead of relevant forms — PT002
- System shows "No active claims" instead of historical data — PT003

**✅ Success looks like:** Benefits display includes specific dollar amounts and dates, search returns actionable forms within top 3 results

**💡 Opportunity:** Enhance benefits detail level and improve search result relevance algorithm

**👥 Owner:** `Content` — Information architecture and search optimization required

<br>

### 5️⃣ Task Completion

**What happens:** Veterans finalize their intended actions and receive confirmation of successful completion.

**📱 Touchpoints:** Confirmation screens, success messages, updated status displays

| Emotion | Quote |
|:-------:|-------|
| 😤 Resigned | "By the time this app loads what I need, I could have talked to a person and gotten my answer." — PT003 |

**🔴 Pain Points:**
- Extended task completion times due to performance issues — PT003
- Connection drops causing concerns about form data loss — PT003
- Some tasks require fallback to phone support — PT002, PT003

**✅ Success looks like:** Tasks complete within expected timeframes with clear success confirmation and data persistence

**💡 Opportunity:** Add auto-save functionality and offline capability for basic information

**👥 Owner:** `Engineering` — Data persistence and offline functionality implementation

<br>

---

## 🎯 Recommendations

> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| Priority | Opportunity | Stage | Owner | Effort |
|:---------|-------------|-------|-------|:------:|
| 🔴 | Implement low-bandwidth optimization with progress indicators | Initial Access | `Engineering` | 🔵🔵🔵 |
| 🔴 | Conduct accessibility audit and fix all unlabeled buttons | Task Navigation | `Accessibility` | 🔵🔵⚪ |
| 🟡 | Redesign search with prominent placement and relevant results | Task Navigation | `Design` | 🔵🔵⚪ |
| 🟡 | Standardize action button placement across all screens | Task Execution | `Design` | 🔵🔵⚪ |
| 🟢 | Add auto-save functionality for form data persistence | Task Completion | `Engineering` | 🔵⚪⚪ |

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | What are the technical constraints for optimizing performance on rural connections with limited bandwidth? | Engineering |
| 2 | Should we prioritize fixing accessibility violations or performance issues first, given both are critical? | Product |
| 3 | How can we better integrate the mobile app experience with phone support to create seamless omnichannel service? | All |

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
