# 🧭 Journey Map: VA Health and Benefits Mobile App

> **Generated:** January 28, 2026 | **Data:** PT001, PT002, PT003

---

## Overview

| Priority | Pain Point | Opportunity |
|:--------:|------------|-------------|
| 🔴 | Unlabeled interactive elements blocking screen reader users — PT001 | Add descriptive labels to all buttons and interactive elements |
| 🔴 | Extreme loading times making app nearly unusable — PT003 | Implement low-bandwidth optimization and loading progress indicators |
| 🟡 | Search function hidden and provides irrelevant results — PT002 | Redesign search with prominent placement and improved relevance |

---

## 🗺️ Journey Stages

### 1️⃣ Initial Access

**What happens:** User opens VA app and navigates to main menu to begin task

**📱 Touchpoints:** Home screen → Main navigation menu (Health, Benefits, Payments, Profile)

| Emotion | Quote |
|:-------:|-------|
| 😊 Confident | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." — PT001 |

**🔴 Pain Points:**
- Loading screens take 45+ seconds consistently — PT003
- Rural connectivity issues cause timeout warnings — PT003

**✅ Success looks like:** Main menu loads within 5 seconds with clear navigation labels

**💡 Opportunity:** Add skeleton loading states and optimize for low-bandwidth connections

**👥 Owner:** `Engineering` — Performance optimization requires backend and mobile app improvements

<br>

### 2️⃣ Task Navigation

**What happens:** User navigates through app sections to locate specific functionality

**📱 Touchpoints:** Section menus, search function, category navigation

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "There's a tiny magnifying glass icon in the top right corner" — PT002 |

**🔴 Pain Points:**
- Search icon hidden and difficult to discover — PT002
- Multiple similar options create confusion ("Claims" vs "File a Claim") — PT002
- Buttons announced only as "Button" without descriptive text — PT001

**✅ Success looks like:** Users find target functionality within 3 taps using clear navigation labels

**💡 Opportunity:** Make search prominent in header and add descriptive labels to all interactive elements

**👥 Owner:** `Design` — Information architecture and interface labeling improvements needed

<br>

### 3️⃣ Information Access

**What happens:** User attempts to view or retrieve specific information from VA systems

**📱 Touchpoints:** Benefits sections, claim status pages, appointment listings, prescription details

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "Where would a completed claim show up?" — PT003 |

**🔴 Pain Points:**
- System shows "No active claims" when user expects historical data — PT003
- Benefits information too basic, lacks actionable details — PT002
- Important action buttons hidden at bottom of screens — PT001

**✅ Success looks like:** Complete information displays within 10 seconds including historical data

**💡 Opportunity:** Add historical claims section and enhance benefits detail pages

**👥 Owner:** `Product` — Information architecture decisions about what data to display and where

<br>

### 4️⃣ Communication

**What happens:** User attempts to send messages to care team or ask questions

**📱 Touchpoints:** Messaging interface, category selection, message composition

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002 |

**🔴 Pain Points:**
- Confusing category system creates barriers to simple communication — PT002
- Messaging interface slow to load at each step — PT003
- Categories don't match user mental models — PT002

**✅ Success looks like:** Direct message composition available within 2 taps from main menu

**💡 Opportunity:** Add direct doctor communication option bypassing category requirements

**👥 Owner:** `Content` — Message categorization and user flow simplification

<br>

### 5️⃣ Task Completion

**What happens:** User completes specific actions like updating information or submitting requests

**📱 Touchpoints:** Forms, edit buttons, submission confirmations, prescription refill requests

| Emotion | Quote |
|:-------:|-------|
| 😊 Satisfied | "This part actually works really well. It shows when I last refilled it, how many refills I have left, and the request button is obvious." — PT002 |

**🔴 Pain Points:**
- Edit buttons too small despite large text accessibility settings — PT003
- Form data loss concerns during connection drops — PT003
- Search results provide generic articles instead of actionable forms — PT002

**✅ Success looks like:** Forms save progress automatically and complete successfully within 3 minutes

**💡 Opportunity:** Implement auto-save functionality and ensure all buttons scale with accessibility settings

**👥 Owner:** `Accessibility` — Button sizing and form persistence improvements needed

<br>

---

## 🎯 Recommendations

| Priority | Opportunity | Stage | Owner | Effort |
|:--------:|-------------|-------|-------|:------:|
| 🔴 | Add descriptive labels to all buttons and interactive elements | Task Navigation | `Accessibility` | 🔵🔵⚪ |
| 🔴 | Implement low-bandwidth optimization and loading progress indicators | Initial Access | `Engineering` | 🔵🔵🔵 |
| 🟡 | Add historical claims section to information architecture | Information Access | `Product` | 🔵🔵⚪ |
| 🟡 | Redesign search with prominent placement and improved relevance | Task Navigation | `Design` | 🔵🔵🔵 |
| 🟢 | Add direct doctor communication option bypassing categories | Communication | `Content` | 🔵⚪⚪ |

> **Legend:** 🔴 High | 🟡 Medium | 🟢 Low — Effort: 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | Should we prioritize performance optimization for rural users or accessibility fixes for screen reader users first? | Product |
| 2 | Can we implement auto-save functionality without significant backend changes? | Engineering |
| 3 | How do we balance simplified messaging with clinical documentation requirements? | All |

<br>

---

## 📚 Methodology

**Framework:** Experience Journey Mapping

**Approach:** Stage-by-stage analysis of user actions, emotions, pain points, and opportunities from qualitative research data.

**Data Sources:** PT001 (Marine veteran, VoiceOver user), PT002 (Navy veteran, regular app user), PT003 (Army veteran, rural Alabama resident)

<br>

---

### References

This analysis follows established journey mapping methods:

- **Adaptive Path** — Pioneers of journey mapping methodology
- **Nielsen Norman Group** — Stage-based emotion mapping framework
- **Service Design Thinking** — Stickdorn & Schneider, touchpoint analysis
- **Mapping Experiences** — Jim Kalbach, O'Reilly Media

---

*Generated by Qori • AI-assisted journey mapping from user research data*
