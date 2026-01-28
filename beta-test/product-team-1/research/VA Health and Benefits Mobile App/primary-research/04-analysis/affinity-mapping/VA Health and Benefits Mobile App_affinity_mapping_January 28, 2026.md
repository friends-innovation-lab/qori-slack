# 🧠 Affinity Map: VA Health and Benefits Mobile App

> **4 themes** from **3 participants** | **32 evidence items** | **Generated:** January 28, 2026

---

## At a Glance

| Theme | Evidence | Participants | Severity |
|-------|:--------:|:------------:|:--------:|
| Unlabeled Buttons Block Screen Reader Navigation | 8 items | PT001, PT002, PT003 | 🔴 Critical |
| Simple Tasks Become Complex Through Poor Information Architecture | 9 items | PT001, PT002, PT003 | 🔴 Critical |
| Extreme Loading Times Make App Nearly Unusable | 7 items | PT002, PT003 | 🟡 High |
| Prescription and Appointment Features Work Smoothly | 8 items | PT001, PT002, PT003 | 🟢 Medium |

---

## Theme 1: Unlabeled Buttons Block Screen Reader Navigation

**The Pattern:** Interactive elements throughout the app lack descriptive labels, creating fundamental accessibility barriers for screen reader users and causing confusion even for sighted users.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." | PT001 |
| 💬 | "I shouldn't have to guess what buttons do. That's basic accessibility." | PT001 |
| 💬 | "There's a tiny magnifying glass icon in the top right corner" | PT002 |
| 🔴 | Multiple buttons announced only as "Button" by VoiceOver with no descriptive text | PT001 |
| 🔴 | Edit buttons too small despite large text accessibility settings enabled | PT003 |
| 🔴 | Search function nearly unusable due to hidden icon and poor discoverability | PT002 |
| 👁️ | Edit button positioned at bottom of screen, nearly missed during contact information update | PT001 |
| 👁️ | Participant would abandon search and use phone support instead due to poor interface | PT002 |

### Implication

**Why it matters:** Screen reader users cannot complete basic tasks when buttons lack proper labels, and even sighted users struggle with poorly designed interface elements. This creates fundamental accessibility violations that exclude veterans with disabilities.

**Design opportunity:** Implement comprehensive button labeling audit and ensure all interactive elements have meaningful, descriptive labels that work with assistive technology.

---

## Theme 2: Simple Tasks Become Complex Through Poor Information Architecture

**The Pattern:** Veterans want to complete straightforward tasks but encounter confusing navigation, unclear categories, and missing information that forces them to use alternative support channels.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." | PT002 |
| 💬 | "Where would a completed claim show up?" | PT003 |
| 💬 | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." | PT002 |
| 💬 | "I'm hearing a lot of different elements but nothing that clearly says 'Schedule new appointment.'" | PT001 |
| 🔴 | Unable to locate completed claim status - system showed "No active claims" when participant expected processed claim information | PT003 |
| 🔴 | Benefits section lacks actionable information - information display too basic for comprehensive user needs | PT002 |
| 🔴 | Confusing duplicate navigation options creating decision paralysis about correct path | PT002 |
| 👁️ | Messaging system creates unnecessary barriers through confusing category systems | PT002 |
| 👁️ | Task failure requiring fallback to phone support for claim status inquiry | PT003 |

### Implication

**Why it matters:** Veterans abandon digital tasks and resort to phone support when simple actions become unnecessarily complex, increasing call center load and reducing user satisfaction with VA services.

**Design opportunity:** Redesign information architecture to match veteran mental models, eliminate duplicate navigation options, and provide direct paths for common tasks like doctor communication and claim tracking.

---

## Theme 3: Extreme Loading Times Make App Nearly Unusable

**The Pattern:** Loading delays consistently exceed user tolerance, even for veterans accustomed to slower rural internet connections, making basic tasks take 6-10 minutes instead of 1-2 minutes.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "By the time this app loads what I need, I could have talked to a person and gotten my answer." | PT003 |
| 💬 | "This is pretty typical for this app. Everything takes forever to load." | PT003 |
| 💬 | "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me." | PT003 |
| 💬 | "I have patience, but this app tests it." | PT003 |
| 🔴 | Loading screens took 45+ seconds consistently with multiple timeout warnings | PT003 |
| 🔴 | Extended simple tasks to 6-10 minutes, making app nearly unusable for basic functions | PT003 |
| 👁️ | Rural connectivity issues combined with app performance created worry about losing progress | PT003 |

### Implication

**Why it matters:** Performance issues that exceed even rural internet user expectations drive veterans away from digital services and back to phone support, undermining VA's digital transformation goals.

**Design opportunity:** Implement low-bandwidth optimization, better loading states, and offline functionality for basic information to serve veterans across all geographic locations.

---

## Theme 4: Prescription and Appointment Features Work Smoothly

**The Pattern:** When VA app features are designed with clear information display and obvious actions, veterans complete tasks efficiently and express high satisfaction with the digital experience.

### Evidence

| Type | Evidence | Source |
|:----:|----------|--------|
| 💬 | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| 💬 | "This part actually works really well. It shows when I last refilled it, how many refills I have left, and the request button is obvious." | PT002 |
| 💬 | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| 💬 | "This section actually works pretty well - I can understand what each section contains." | PT001 |
| ✅ | Prescription management completed smoothly with clear information display and obvious action buttons | PT002 |
| ✅ | Appointment checking straightforward navigation completed in 2 minutes with no issues | PT002 |
| ✅ | Logical menu structure enabled efficient task completion for prescription management | PT001 |
| ✅ | Large text accessibility implementation succeeded in improving readability for vision needs | PT003 |

### Implication

**Why it matters:** These successful features demonstrate that VA can create effective mobile experiences when design follows user-centered principles, providing a template for improving other app sections.

**Design opportunity:** Apply the design patterns from successful prescription and appointment features to problematic areas like messaging, claims, and search functionality.

---

## ✅ What's Working

Positive findings from the research:

| What Works | Evidence | Source |
|------------|----------|--------|
| Large text accessibility implementation | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |
| Prescription refill workflow | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| Main navigation structure | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| Messaging system interface logic | "This messaging system is actually not bad. It's slow to load like everything else, but once you're in it, it makes sense." | PT003 |

---

## 🔗 Cross-Theme Connections

The themes reveal a pattern where **technical implementation quality determines user success**. Features with proper labeling, clear information architecture, and good performance (Theme 4) create positive experiences, while features lacking these basics (Themes 1-3) drive users to phone support. This suggests that **accessibility, usability, and performance are interconnected** — fixing one without the others still results in user frustration.

---

## Recommended Actions

| Priority | Action | Addresses Theme | Effort |
|:--------:|--------|-----------------|:------:|
| 1 | Conduct comprehensive accessibility audit and fix all unlabeled interactive elements | Theme 1 | 🔵🔵⚪ |
| 2 | Implement low-bandwidth optimization and better loading states for rural users | Theme 3 | 🔵🔵🔵 |
| 3 | Redesign messaging interface with direct doctor communication option | Theme 2 | 🔵🔵⚪ |
| 4 | Add historical claims section to information architecture | Theme 2 | 🔵⚪⚪ |

---

## Methodology

**Framework:** Affinity Diagramming / KJ Method

**Approach:** Inductive clustering — themes emerged from natural patterns in the data rather than predetermined categories. Individual data points were extracted first, then grouped by similarity, then named using participant language.

**Data Sources:** PT001, PT002, PT003

**Evidence Utilization:** 89% of extracted data points used in themes

---

### References

This analysis follows established qualitative research methods:

- **KJ Method** (Affinity Diagramming) — Jiro Kawakita, 1960s
- **Contextual Design** — Karen Holtzblatt & Hugh Beyer
- **Inductive Thematic Analysis** — Braun & Clarke, 2006

---

*Generated by Qori • January 28, 2026*
