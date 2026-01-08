# 🧭 Journey Map: VA Health and Benefits Mobile App

> **4 stages mapped** | **Confidence:** High | **Generated:** January 8, 2026

---

## 📊 Executive Summary

| | |
|-----------|-------|
| 👤 **Primary User** | Veterans managing health appointments and benefits via mobile app |
| 🗺️ **Journey Scope** | App Launch → Task Completion |
| 📍 **Total Stages** | 4 |
| 📈 **Data Confidence** | High - 3 participants with detailed transcripts |

### 🔥 Top Pain Points
| # | Pain Point | Source |
|---|------------|--------|
| 1 | App takes 8+ seconds to load, no progress indicator | PT003, 00:01:56 |
| 2 | Edit button hidden in overflow menu, not visible on profile screen | PT003, 00:02:52 |
| 3 | Filed claim shows "No active claims" - status not synced | PT003, 00:03:42 |

### 💡 Top Opportunities  
| # | Opportunity | Impact |
|---|-------------|--------|
| 1 | Add skeleton loading UI + optimize API calls to target <3s load | High |
| 2 | Move Edit button inline with profile header, use pencil icon | High |
| 3 | Add "Pending claims" section separate from "Active claims" | Medium |

<br>

---

## 👤 Primary User Profile

> Veterans who have used VA services for several years and access the app 3-4 times weekly. Includes users who rely on accessibility features (large text) and have limited data plans (prefer Wi-Fi).

| 🎯 Goal | 🌍 Context |
|---------|-----------|
| Complete routine tasks (appointments, prescriptions, claims) in under 2 minutes | Using app on mobile with limited data, often on Wi-Fi at home |

**Key Characteristics:**
- ✓ Uses large text settings on phone — PT003, 00:00:53
- ✓ Prefers Wi-Fi due to limited data plan — PT003, 00:01:30
- ✓ Has been using VA services since 2015 — PT003, 00:00:45

<br>

---

## 🗺️ Journey Stages

### 1️⃣ App Launch

**What happens:** User opens the app and waits while content loads. No progress indicator shows, leaving them uncertain if the app is working.

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "Everything takes forever to load." — PT003, 00:01:56 |

**🔴 Pain Points:**
- App takes 8+ seconds to reach usable state — PT003, 00:01:56
- No loading indicator, user doesn't know if app is frozen — PT003, 00:01:56

**✅ Success looks like:** App reaches usable state in under 3 seconds with skeleton UI showing immediately on launch

**💡 Opportunity:** Implement skeleton loading screens that appear within 500ms; lazy-load non-critical content; cache previous session data

**👥 Owner:** `Engineering` — Requires API optimization and frontend loading state implementation

<br>

---

### 2️⃣ Profile Navigation

**What happens:** User navigates to Profile section to update contact information but cannot find the Edit button.

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "That Edit button was hard to spot." — PT003, 00:02:52 |

**🔴 Pain Points:**
- Edit button is in overflow menu (⋯), not visible on main profile screen — PT003, 00:02:52
- User expected Edit button next to each field or at top of screen — PT003, 00:02:52

**✅ Success looks like:** User locates Edit action within 2 seconds of viewing profile, without opening any menus

**💡 Opportunity:** Add inline Edit button (pencil icon) in profile header; alternatively, make each field tappable to edit directly

**👥 Owner:** `Design` — Requires UI pattern update for profile editing flow

<br>

---

### 3️⃣ Claim Status Check

**What happens:** User navigates to Benefits section to check on a claim they filed, but sees "No active claims" despite having submitted one recently.

| Emotion | Quote |
|:-------:|-------|
| 😕 Confused | "No active claims showing even though a claim was filed." — PT003, 00:03:42 |

**🔴 Pain Points:**
- Recently filed claim not appearing in "Active claims" list — PT003, 00:03:42
- No "Pending" or "Processing" status category exists — PT003, 00:03:42
- User unsure if claim submission actually went through — PT003, 00:03:42

**✅ Success looks like:** User sees their claim with current status (Submitted → Under Review → Decision) within 1 tap from Benefits screen

**💡 Opportunity:** Add "Pending Claims" section that shows claims not yet in active review; add submission confirmation with tracking number

**👥 Owner:** `Product` + `Engineering` — Requires data model change to surface pending claims and sync with VA claims system

<br>

---

### 4️⃣ Contact Info Update

**What happens:** User attempts to update phone number but the process is slow and unclear, making a simple task feel burdensome.

| Emotion | Quote |
|:-------:|-------|
| 😤 Frustrated | "Everything takes so long to load, it makes simple tasks feel like a big production." — PT003, 00:02:58 |

**🔴 Pain Points:**
- Each field edit triggers full page reload — PT003, 00:02:58
- No inline validation, errors only show after submission — PT003, 00:02:58
- Unclear if changes saved successfully — PT003, 00:02:58

**✅ Success looks like:** User updates phone number in under 30 seconds with inline editing and immediate "Saved" confirmation

**💡 Opportunity:** Implement inline editing with optimistic UI updates; show green checkmark confirmation immediately on save

**👥 Owner:** `Engineering` + `Design` — Requires frontend refactor for inline editing pattern

<br>

---

## 🎯 Recommendations

| Priority | Opportunity | Stage | Owner | Effort |
|:--------:|-------------|-------|-------|:------:|
| 🔴 | Add skeleton loading + target <3s load time | App Launch | `Engineering` | 🔵🔵⚪ |
| 🔴 | Move Edit button inline with profile header | Profile Navigation | `Design` | 🔵⚪⚪ |
| 🟡 | Add "Pending Claims" section with status tracking | Claim Status | `Product` | 🔵🔵⚪ |
| 🟡 | Implement inline editing with instant confirmation | Contact Update | `Engineering` | 🔵🔵⚪ |

> **Legend:** 🔴 High | 🟡 Medium | 🟢 Low — Effort: 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

<br>

---

## 💬 Discussion Questions

| # | Question | For |
|---|----------|-----|
| 1 | What's our target load time? Is 3 seconds achievable with current API architecture? | Engineering |
| 2 | Should Edit button be inline (always visible) or revealed on tap (cleaner but hidden)? | Design |
| 3 | Can we surface pending claims from the VA claims API, or is that data not available? | Product + Engineering |

<br>

---

## 📚 Methodology

**Approach:** Journey mapping from qualitative research data — analyzing user actions, emotions, and pain points stage by stage.

**Data Sources:** PT001, PT002, PT003 coded transcripts

---

*Generated by Qori • January 8, 2026*
