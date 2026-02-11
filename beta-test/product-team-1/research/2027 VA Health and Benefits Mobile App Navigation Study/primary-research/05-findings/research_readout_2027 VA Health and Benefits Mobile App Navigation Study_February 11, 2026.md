<div align="center">

# 📊 Research Report
## 2027 VA Health and Benefits Mobile App Navigation Study

**February 11, 2026**

---

| Participants | Sessions | Methodology | Lead Researcher |
|:------------:|:--------:|:-----------:|:---------------:|
| 3 | 3 | Usability Testing | lapedra@cityfriends.tech |

</div>

---

## 📌 Executive Summary

> [!IMPORTANT]
> **Bottom Line:** Critical accessibility violations and navigation inefficiencies in the VA mobile app are preventing veterans from completing essential health and benefits tasks, requiring immediate fixes to button labeling and information architecture.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons block screen reader users from task completion | Veterans with disabilities cannot access critical VA services | Audit and fix all button accessibility labels |
| 🟡 | Claims status buried under multiple navigation levels despite daily usage | Power users experience friction accessing most-needed information | Elevate claims status to home screen |
| 🟢 | Logical main menu structure aligns with veteran mental models | Veterans can navigate efficiently when accessibility barriers are removed | Maintain Health/Benefits/Payments/Profile organization |

---

## 🎯 Research Overview

### Why We Conducted This Research

This research informed the VA product team's decision on which navigation improvements to prioritize for the mobile app redesign in Q1 2026, specifically focusing on main menu restructuring, search functionality enhancements, and information hierarchy changes. The findings help Veterans complete health and benefits tasks more efficiently by creating clearer pathways to essential services like appointment scheduling, prescription refills, and disability claim tracking.

### Research Objectives

- **Identify** specific navigation and information architecture issues that contribute to the 45% task abandonment rate
- **Understand** veteran mental models for organizing health and benefits services within the mobile app
- **Evaluate** current task completion flows across health and benefits features
- **Prioritize** actionable design solutions to improve user satisfaction from 4.2/10 to above 7/10

### Research Questions

1. What navigation pain points cause users to abandon critical tasks like appointment scheduling and disability claim status checks?
2. How do veterans expect to navigate health and benefits tasks compared to other government and healthcare mobile applications?
3. Which proposed information architecture improvements would reduce task completion time and increase success rates?
4. What are the top 5 navigation barriers preventing efficient access to frequently used veteran services?

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled buttons block screen reader navigation
- Claims status requires excessive navigation taps
- Search functionality fails for common queries
- Session timeouts disrupt active task completion

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Touch targets too small for motor accessibility
- Technical jargon confuses claim status understanding
- Inconsistent text scaling across UI elements
- Interface elements hidden at bottom of screens

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Logical main menu structure (Health/Benefits/Payments/Profile)
- Home screen appointments provide immediate access
- Prescription management section properly labeled

</td>
</tr>
</table>

---

## 🔍 Detailed Findings

### Finding 1: Unlabeled Buttons Create Critical Accessibility Barriers

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Multiple buttons throughout the interface were announced only as "Button" by VoiceOver, providing no indication of their function or purpose. This prevented the screen reader user from completing tasks efficiently and created significant accessibility barriers for navigation.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Marine veteran using VoiceOver*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001**

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT001

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Conduct comprehensive audit of all buttons and implement descriptive accessibility labels

**Rationale:** Screen reader users rely entirely on proper labeling to navigate interfaces, and unlabeled buttons create complete task blockers

**Owner:** UX/Accessibility Team

**Effort Estimate:** Medium

</details>

---

### Finding 2: Claims Status Buried Despite Daily Usage Patterns

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The participant who checks claims daily had to navigate through multiple menu levels and tap 5 times to reach status information. This creates unnecessary friction for one of the most frequently accessed features by veterans with pending disability claims.

#### Supporting Evidence

> "Why is claims under Benefits and not on the main screen? I check that every day."
> 
> — **PT002** *Army veteran with pending disability claim*

> "I had to tap like five times to get to my claim status."
> 
> — **PT002**

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Add claims status widget to customizable home screen

**Rationale:** Daily usage patterns indicate this should be immediately accessible rather than buried in navigation hierarchy

**Owner:** Product Team

**Effort Estimate:** High

</details>

---

### Finding 3: Search Functionality Fails for Common Queries

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search feature failed to return useful results for common queries like "claim," forcing the participant to abandon search and navigate manually. This represents a complete failure of a critical discovery mechanism.

#### Supporting Evidence

> "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful."
> 
> — **PT002**

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Redesign search to include contextual results for common veteran terms

**Rationale:** Search should surface relevant results for basic queries that veterans commonly use

**Owner:** Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Session Timeouts Disrupt Active Task Completion

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Session timeout occurred twice during the session, with the second instance causing loss of a secure message draft that had to be restarted. This creates significant frustration and task abandonment for users actively engaged with the application.

#### Supporting Evidence

> "Why does this keep logging me out? I was just using it an hour ago."
> 
> — **PT003** *Navy veteran experiencing session timeout*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT003

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Extend session timeout for active users or implement draft saving

**Rationale:** Users actively engaging with the app should not lose work due to aggressive timeout policies

**Owner:** Engineering Team

**Effort Estimate:** Medium

</details>

---

### Finding 5: Touch Targets Too Small for Motor Accessibility

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The participant with age-related motor control difficulties experienced 3 miss-taps during the session and moved slowly and deliberately when attempting to tap buttons due to their small size. This creates physical strain and reduces confidence in navigation.

#### Supporting Evidence

> "I need bigger buttons. These are hard to tap with my fingers."
> 
> — **PT003** *Navy veteran with motor accessibility needs*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT003

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Increase minimum touch target sizes to meet accessibility guidelines

**Rationale:** Larger touch targets accommodate users with motor difficulties and improve overall usability

**Owner:** UX Team

**Effort Estimate:** Medium

</details>

---

## ✅ What's Working Well

> [!TIP]
> These elements should be preserved and potentially expanded in future iterations.

| Positive Finding | Evidence | Participant(s) |
|:-----------------|:---------|:---------------|
| **Logical Main Menu Structure** | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| **Home Screen Appointments** | "I like that my appointments are right on the home screen. That's what I check most." | PT002 |
| **Prescription Management Section** | "This section actually works pretty well - I can understand what each section contains." | PT001 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran with VoiceOver, expert screen reader user | Highlighted critical accessibility violations blocking task completion | "Every button needs a proper label. I shouldn't have to guess what things do." |
| **PT002** | Army veteran, daily app user with pending disability claim | Revealed navigation friction for power users and search failures | "I wish I could just have claims on my home screen." |
| **PT003** | Navy veteran with age-related vision and motor accessibility needs | Demonstrated impact of inconsistent accessibility implementation | "Text is still too small in some places even with the large text setting." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Marine (1), Army (1), Navy (1) |
| Assistive Technology Users | 1 (VoiceOver), 1 (Large Text/Bold Text) |
| App Usage Patterns | Daily (1), Primary tasks focused (2) |

> [!NOTE]
> Small sample size limits generalizability, but findings represent critical accessibility and navigation issues that affect veteran access to essential services.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | Usability Testing with Task-Based Scenarios |
| **Sessions Conducted** | 3 |
| **Session Duration** | 90 minutes (planned) |
| **Research Focus** | Navigation structure, information architecture, search functionality, and task completion flows |
| **Recruitment Method** | Email outreach |
| **Data Collection** | Observer notes, think-aloud protocol, task completion tracking |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Audit and fix all unlabeled buttons with descriptive accessibility labels** | Unlabeled buttons block screen reader navigation | UX/Accessibility Team | M |
| 2 | **Add claims status widget to customizable home screen** | Claims status buried despite daily usage | Product Team | H |

### 
