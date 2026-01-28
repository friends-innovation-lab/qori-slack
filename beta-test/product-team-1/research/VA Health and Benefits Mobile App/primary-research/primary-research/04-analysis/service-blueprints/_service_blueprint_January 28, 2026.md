# 🔧 Service Blueprint: VA Mobile App Prescription Refill Journey

> **Generated:** January 28, 2026 | **Scope:** Prescription refill request from app launch to confirmation

---

## Overview

| | |
|---|---|
| **Service** | VA Mobile App Prescription Refill |
| **Scope** | App launch → Refill confirmation received |
| **User** | Veterans managing ongoing prescriptions via mobile app |
| **Key Failure Points** | 4 identified |
| **Data Completeness** | Partial — missing backstage processes |

---

## Blueprint Layers

| Layer | What It Shows | Data Source | Status |
|-------|---------------|-------------|--------|
| 👤 **Customer Actions** | What the user does | User research | ✅ |
| 💻 **Frontstage** | What the user sees/touches | User research | ✅ |
| ⚙️ **Backstage** | Internal processes users don't see | Stakeholder input | ⚠️ Gaps |
| 🗄️ **Support Systems** | Databases, APIs, tools | Stakeholder input | ⚠️ Gaps |

---

## Service Blueprint

### Stage 1: App Access & Authentication

| Layer | What Happens |
|-------|--------------|
| 👤 **Customer Action** | Opens VA mobile app, enters credentials — PT002, PT003 |
| 💻 **Frontstage** | Login screen, loading indicators, main dashboard with Health menu |
| ——— | *Line of Visibility* ——————————————— |
| ⚙️ **Backstage** | [NEEDS STAKEHOLDER INPUT] |
| 🗄️ **Support Systems** | [NEEDS STAKEHOLDER INPUT] |

**⚠️ Failure Point:** Extreme loading times (45+ seconds) blocking basic access — PT003 rural connectivity issues

---

### Stage 2: Navigation to Prescriptions

| Layer | What Happens |
|-------|--------------|
| 👤 **Customer Action** | Taps Health menu, navigates to prescriptions section — PT001, PT002 |
| 💻 **Frontstage** | Main menu with "Health, Benefits, Payments, Profile" options, prescription submenu |
| ——— | *Line of Visibility* ——————————————— |
| ⚙️ **Backstage** | [NEEDS STAKEHOLDER INPUT] |
| 🗄️ **Support Systems** | [NEEDS STAKEHOLDER INPUT] |

---

### Stage 3: Prescription List Display

| Layer | What Happens |
|-------|--------------|
| 👤 **Customer Action** | Reviews prescription list, identifies medications needing refill — PT002 |
| 💻 **Frontstage** | List showing medication names, refill dates, remaining refills, request buttons |
| ——— | *Line of Visibility* ——————————————— |
| ⚙️ **Backstage** | [NEEDS STAKEHOLDER INPUT] |
| 🗄️ **Support Systems** | [NEEDS STAKEHOLDER INPUT] |

---

### Stage 4: Refill Request Submission

| Layer | What Happens |
|-------|--------------|
| 👤 **Customer Action** | Taps refill request button for specific medication — PT002 |
| 💻 **Frontstage** | Clear "request refill" button, confirmation dialog, processing indicator |
| ——— | *Line of Visibility* ——————————————— |
| ⚙️ **Backstage** | [NEEDS STAKEHOLDER INPUT] |
| 🗄️ **Support Systems** | [NEEDS STAKEHOLDER INPUT] |

**⚠️ Failure Point:** Connection drops during form submission causing data loss concerns — PT003

---

### Stage 5: Confirmation & Status Update

| Layer | What Happens |
|-------|--------------|
| 👤 **Customer Action** | Receives confirmation, checks updated prescription status — PT002 |
| 💻 **Frontstage** | Success message, updated prescription list showing new refill status |
| ——— | *Line of Visibility* ——————————————— |
| ⚙️ **Backstage** | [NEEDS STAKEHOLDER INPUT] |
| 🗄️ **Support Systems** | [NEEDS STAKEHOLDER INPUT] |

**⚠️ Failure Point:** Slow loading prevents users from confirming successful submission — PT003

---

## Failure Point Analysis

| # | Failure Point | Layer | Cause | Impact on User | Fix Owner |
|---|---------------|-------|-------|----------------|-----------|
| 1 | 45+ second loading times | Support Systems | Poor low-bandwidth optimization | Task abandonment, phone fallback | `Engineering` |
| 2 | Connection drops during submission | Support Systems | No offline capability/data persistence | Form data loss anxiety | `Engineering` |
| 3 | Slow confirmation loading | Backstage | Performance bottlenecks | Uncertainty about request success | `Engineering` |
| 4 | Accessibility button sizing | Frontstage | Inconsistent large text implementation | Difficulty locating edit functions | `Design` |

---

## Backstage Gaps

> ⚠️ The following need stakeholder input to complete. Consider interviewing these roles:

| Stage | What We Don't Know | Who to Ask |
|-------|-------------------|------------|
| Authentication | Identity verification process, session management | Engineering Lead |
| Prescription Retrieval | How medication data is fetched, caching strategy | Product Owner |
| Refill Processing | Backend workflow, pharmacy integration | Operations Lead |
| Performance Issues | Infrastructure limitations, optimization priorities | Engineering Lead |

**Suggested next step:** Use `/plan-study` → "Create Stakeholder Interview Guide" to prepare for these conversations.

---

## Recommendations

| Priority | Opportunity | Addresses | Owner | Effort |
|:--------:|-------------|-----------|-------|:------:|
| 🔴 | Implement low-bandwidth optimization and progressive loading | Failure Points 1, 3 | `Engineering` | 🔵🔵🔵 |
| 🔴 | Add offline capability and form data persistence | Failure Point 2 | `Engineering` | 🔵🔵🔵 |
| 🟡 | Ensure consistent accessibility button scaling | Failure Point 4 | `Design` | 🔵🔵⚪ |
| 🟢 | Add loading progress indicators for rural users | User anxiety during delays | `Design` | 🔵⚪⚪ |

> **Legend:** 🔴 High | 🟡 Medium | 🟢 Low — Effort: 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

<br>

---

## 📚 Methodology

**Framework:** Service Blueprinting

**Approach:** Maps customer actions alongside frontstage interactions, backstage processes, and support systems to reveal service delivery gaps.

**Data Sources:**
- User research: PT001 (accessibility expert), PT002 (regular user), PT003 (rural connectivity)
- Stakeholder input: None — gaps noted above

<br>

---

### References

This analysis follows established service design methods:

- **Lynn Shostack** — Creator of service blueprinting methodology (1984)
- **Service Design Thinking** — Stickdorn & Schneider
- **Nielsen Norman Group** — Service blueprint guidelines
- **Practical Service Blueprinting** — Erik Flowers & Megan Miller

---

*Generated by Qori • AI-assisted service design analysis*
