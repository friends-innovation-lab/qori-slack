# 🧠 Affinity Map: VA Health and Benefits Mobile App

> **4 themes** from **3 participants** | **26 evidence items** | **Generated:** January 28, 2026

---

## At a Glance

| Theme | Evidence | Participants | Severity |
|:------|:---------|:-------------|:---------|
| Unlabeled Buttons Block Screen Reader Navigation | 6 items | PT001, PT002, PT003 | 🔴 Critical |
| Simple Tasks Become Complex Multi-Step Processes | 7 items | PT002, PT003 | 🟡 High |
| App Performance Exceeds Rural Internet Tolerance | 5 items | PT003 | 🟡 High |
| Information Architecture Gaps Leave Users Stranded | 8 items | PT001, PT002, PT003 | 🟢 Medium |

---

## Theme 1: Unlabeled Buttons Block Screen Reader Navigation

**The Pattern:** Interactive elements throughout the app lack proper accessibility labels, creating fundamental barriers for assistive technology users.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." | PT001 |
| 💬 | "I shouldn't have to guess what buttons do. That's basic accessibility." | PT001 |
| 💬 | "There's a tiny magnifying glass icon in the top right corner" | PT002 |
| 🔴 | Multiple buttons announced only as "Button" by VoiceOver | PT001 |
| 🔴 | Edit buttons too small despite large text accessibility settings | PT003 |
| 👁️ | Edit button positioned at bottom of screen, nearly missed during contact information update | PT001 |

### Implication

**Why it matters:** Screen reader users cannot complete basic tasks when interface elements lack descriptive labels, effectively excluding veterans with vision disabilities from digital services.

**Design opportunity:** Implement comprehensive accessibility audit and add descriptive labels to all interactive elements, following WCAG 2.1 AA standards.

---

## Theme 2: Simple Tasks Become Complex Multi-Step Processes

**The Pattern:** Basic user intentions like asking a doctor a question or finding claim information require navigating through unnecessarily complex categorical systems.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." | PT002 |
| 💬 | "Sometimes I feel like I'm going through a maze just to do simple things." | PT002 |
| 💬 | "What if my question doesn't fit neatly into these categories?" | PT002 |
| 💬 | "Where would a completed claim show up?" | PT003 |
| 🔴 | Messaging system creates unnecessary barriers with confusing category systems | PT002 |
| 🔴 | Unable to locate completed claim status despite expecting to find processed information | PT003 |
| 👁️ | Participant wanted simple doctor communication but faced multiple categorical barriers | PT002 |

### Implication

**Why it matters:** Veterans abandon digital tasks when simple intentions require complex navigation, driving increased call center volume and user frustration.

**Design opportunity:** Streamline messaging interface with direct communication options and add historical claims section to information architecture.

---

## Theme 3: App Performance Exceeds Rural Internet Tolerance

**The Pattern:** Loading times and connectivity issues create barriers that exceed even rural users' adapted expectations for slow technology.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "By the time this app loads what I need, I could have talked to a person and gotten my answer." | PT003 |
| 💬 | "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me." | PT003 |
| 💬 | "I have patience, but this app tests it." | PT003 |
| 🔴 | Loading screens took 45+ seconds consistently, with multiple timeout warnings | PT003 |
| 🔴 | Connection drops causing form data loss concerns | PT003 |

### Implication

**Why it matters:** Rural veterans represent a significant VA user population who face unique connectivity challenges that current app performance doesn't accommodate.

**Design opportunity:** Implement low-bandwidth optimization, better loading states, and offline functionality for frequently accessed information.

---

## Theme 4: Information Architecture Gaps Leave Users Stranded

**The Pattern:** Users encounter dead ends when seeking specific information, with system organization not matching veteran mental models for benefits and healthcare.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." | PT002 |
| 💬 | "I'm hearing a lot of different elements but nothing that clearly says 'Schedule new appointment.'" | PT001 |
| 💬 | "The search is hard to find and the results aren't great. I'd probably give up and call someone instead." | PT002 |
| 🔴 | Search function nearly unusable - hidden icon and irrelevant results | PT002 |
| 🔴 | Benefits section lacks actionable information | PT002 |
| 🔴 | Confusing duplicate navigation options create decision paralysis | PT002 |
| 🔴 | Unclear appointment scheduling interface lacks clear labeling | PT001 |
| 👁️ | System showed "No active claims" when participant expected historical information | PT003 |

### Implication

**Why it matters:** Veterans cannot complete critical benefit and healthcare tasks when information architecture doesn't align with their expectations and needs.

**Design opportunity:** Redesign search functionality, clarify navigation labels to eliminate duplicates, and enhance information sections with actionable details.

---

## ✅ What's Working

Positive findings from the research:

| What Works | Evidence | Source |
|------------|----------|--------|
| Large text accessibility implementation | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |
| Prescription management interface | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| Logical main menu structure | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| Appointment checking functionality | Straightforward navigation completed in 2 minutes with no issues | PT002 |

---

## 🔗 Cross-Theme Connections

The themes reveal a pattern of **accessibility and usability barriers that compound each other**. Poor labeling (Theme 1) combines with complex navigation (Theme 2) to create particularly challenging experiences for screen reader users. Performance issues (Theme 3) exacerbate information architecture problems (Theme 4) by making trial-and-error navigation even more frustrating. All themes point to a need for **user-centered design that accommodates diverse veteran needs** including disability, geographic location, and technology comfort levels.

---

## Recommended Actions

| Priority | Action | Addresses Theme | Effort |
|:--------:|--------|-----------------|:------:|
| 1 | Conduct comprehensive accessibility audit and fix all unlabeled interactive elements | Theme 1 | 🔵🔵⚪ |
| 2 | Implement low-bandwidth optimization and better loading states | Theme 3 | 🔵🔵🔵 |
| 3 | Add direct messaging option and historical claims section | Theme 2 | 🔵🔵⚪ |
| 4 | Redesign search with prominent placement and improved relevance | Theme 4 | 🔵🔵⚪ |
| 5 | Standardize action button placement and sizing across all sections | Theme 1, 4 | 🔵⚪⚪ |

---

## Methodology

**Framework:** Affinity Diagramming / KJ Method

**Approach:** Inductive clustering — themes emerged from natural patterns in the data rather than predetermined categories. Individual data points were extracted first, then grouped by similarity, then named using participant language.

**Data Sources:** PT001, PT002, PT003

**Evidence Utilization:** 87% of extracted data points used in themes

---

### References

This analysis follows established qualitative research methods:

- **KJ Method** (Affinity Diagramming) — Jiro Kawakita, 1960s
- **Contextual Design** — Karen Holtzblatt & Hugh Beyer
- **Inductive Thematic Analysis** — Braun & Clarke, 2006

---

*Generated by Qori • January 28, 2026*
