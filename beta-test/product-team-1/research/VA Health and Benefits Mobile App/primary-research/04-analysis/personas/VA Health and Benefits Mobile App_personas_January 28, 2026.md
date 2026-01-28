# 👤 Personas: VA Health and Benefits Mobile App

> **2 personas** from **3 participants** | **Generated:** January 28, 2026

---

## At a Glance

| Persona | Archetype | Based On | Key Need |
|---------|-----------|----------|----------|
| 1 | The Accessibility-First Navigator | PT001, PT003 | Reliable interface elements that work with assistive technology and slow connections |
| 2 | The Efficiency-Seeking Regular | PT002, PT003 | Streamlined paths for frequent tasks without unnecessary complexity |

---

## Persona 1: The Accessibility-First Navigator

**Based on:** PT001, PT003

> "I shouldn't have to guess what buttons do. That's basic accessibility." — PT001

**Who they are:**

| Attribute | Details |
|-----------|---------|
| **Background** | Military veterans with accessibility needs (vision loss, rural connectivity) |
| **Tech Setup** | iPhone with VoiceOver, large text settings, limited rural broadband |
| **VA Usage** | Regular users (3-4 times weekly) for prescriptions and appointments |

**What they're trying to do:**

- Update contact information and manage profile settings — *Evidence: PT001, PT003*
- Check prescription status and refill medications — *Evidence: PT001, PT003*
- Navigate healthcare appointments and scheduling — *Evidence: PT001, PT003*
- Access disability benefits and payment information — *Evidence: PT001, PT003*

**What blocks them:**

| Frustration | Evidence |
|-------------|----------|
| Unlabeled buttons that screen readers can't interpret | "There's a button that just says 'Button' without any descriptive text" — PT001 |
| Extreme loading times that exceed even rural internet expectations | "By the time this app loads what I need, I could have talked to a person and gotten my answer" — PT003 |
| Important action buttons hidden at bottom of screens | Edit button positioned at bottom, nearly missed during contact update — PT001 |
| Interface elements too small despite accessibility settings | Edit buttons remained difficult to locate even with large text enabled — PT003 |

**How they cope:** Maintain phone numbers for backup support, develop high patience thresholds for slow technology, use systematic VoiceOver navigation strategies

**Design implication:** Implement comprehensive button labeling and optimize performance for low-bandwidth connections while ensuring consistent accessibility element sizing

---

## Persona 2: The Efficiency-Seeking Regular

**Based on:** PT002, PT003

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002

**Who they are:**

| Attribute | Details |
|-----------|---------|
| **Background** | Veterans with 2+ years app experience who know what works and what doesn't |
| **Tech Setup** | Android and iPhone users with standard settings, various connectivity |
| **VA Usage** | Regular users who rely on app for routine healthcare management |

**What they're trying to do:**

- Send simple messages to healthcare providers — *Evidence: PT002, PT003*
- Refill prescriptions efficiently — *Evidence: PT002*
- Check appointment schedules quickly — *Evidence: PT002*
- Find specific forms and benefits information — *Evidence: PT002*

**What blocks them:**

| Frustration | Evidence |
|-------------|----------|
| Search function hidden and provides irrelevant results | "The search is hard to find and the results aren't great. I'd probably give up and call someone instead" — PT002 |
| Messaging system creates unnecessary categorical barriers | "I just want to ask my doctor a simple question, but I have to navigate through all these categories first" — PT002 |
| Benefits information too basic for comprehensive needs | Information display too basic, lacked important details — PT002 |
| Confusing duplicate navigation options | "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things?" — PT002 |

**How they cope:** Stick to features that work well (prescriptions, appointments), avoid complex features, plan to use phone support for challenging tasks

**Design implication:** Redesign search functionality for better discoverability and streamline messaging interface to reduce categorical complexity

---

## Design Priorities

| # | Opportunity | Helps Persona | Effort |
|---|-------------|---------------|:------:|
| 1 | Implement comprehensive button labeling audit | Accessibility-First Navigator | 🔵⚪⚪ |
| 2 | Optimize app performance for low-bandwidth connections | Both | 🔵🔵⚪ |
| 3 | Redesign search with prominent placement and relevant results | Efficiency-Seeking Regular | 🔵🔵⚪ |
| 4 | Streamline messaging interface with direct communication options | Both | 🔵🔵🔵 |

---

## Methodology

**Framework:** Evidence-Based Persona Development

**Approach:** Composite archetypes from behavioral patterns across participants — not 1:1 mapping.

**Data Sources:** PT001, PT002, PT003

**Why these groupings:** PT001 and PT003 both demonstrated accessibility needs (assistive technology and rural connectivity) requiring reliable, properly-labeled interface elements. PT002 and PT003 both showed patterns of efficiency-seeking behavior, wanting streamlined paths for routine tasks without unnecessary complexity. These groupings capture the core tension between accessibility requirements and efficiency needs in VA mobile app usage.

### References

- **Alan Cooper** — Goal-directed personas, "The Inmates Are Running the Asylum"
- **Kim Goodwin** — "Designing for the Digital Age"
- **Nielsen Norman Group** — Persona best practices

---

*Generated by Qori*
