# 📚 Desk Research: Qori Testing

**Date:** December 9, 2025

**Research Questions:** 

> ℹ️ *This analysis is based solely on the documents provided. All findings, themes, and recommendations are derived from the uploaded content.*

---

## 📋 Executive Summary

⚠️ No documents were provided. Unable to generate executive summary.

---

## 📄 Documents Reviewed

| Document | Type | Source | Date | Key Focus |
|----------|------|--------|------|-----------|
| JMIR_Older_Veterans_Telehealth_Usability_2024.md.pdf | Study | Journal of Medical Internet Research (JMIR) | March 2024 | Usability evaluation of VA Video Connect (VVC) among older Veterans |
| VA_Telehealth_Modernization_Strategy_2025.md.pdf | Brief | VA Office of Connected Care, Digital Experience Team | October 2024 | Strategic direction for modernizing Veteran telehealth experience |
| VA_OIG_Telehealth_Access_Report_2024.md.pdf | Report | VA Office of Inspector General | September 15, 2024 | Examination of VA telehealth program implementation and access issues |

---

## 🎯 Key Themes

### [Usability Challenges for Older Veterans]

**What the documents show:** 
The documents highlight significant usability challenges faced by older Veterans when using telehealth platforms, particularly VA Video Connect (VVC). These challenges include confusion about multiple entry points, fear of irreversible actions, desire for human support options, and cognitive load of context-switching.

**Evidence from documents:**
- "Current VVC interface presents significant usability barriers for older Veterans." - from JMIR_Older_Veterans_Telehealth_Usability_2024.md.pdf
- "Participants described receiving appointment information through multiple channels with inconsistent formatting and instructions." - from JMIR_Older_Veterans_Telehealth_Usability_2024.md.pdf

**Why it matters for Qori Testing:**
Understanding the specific usability challenges faced by older Veterans is crucial for designing and testing telehealth platforms like VVC to ensure they are user-friendly and accessible to this demographic.

### [Improving Telehealth Accessibility]

**What the documents show:** 
There is a focus on enhancing the accessibility of telehealth services, especially for users with assistive technologies and specific accessibility needs. Recommendations include implementing standardized pre-appointment communication protocols, improving VVC accessibility for screen reader users, and creating caregiver-specific access features.

**Evidence from documents:**
- "Veterans using assistive technologies reported screen reader compatibility issues with VVC interface." - from VA_OIG_Telehealth_Access_Report_2024.md.pdf
- "Deploy automated pre-appointment device testing... Create simplified joining instructions in multiple formats." - from VA_OIG_Telehealth_Access_Report_2024.md.pdf

**Why it matters for Qori Testing:**
Ensuring telehealth platforms are accessible to users with diverse needs, including those using assistive technologies, is essential for inclusive and effective healthcare delivery, making accessibility testing a critical aspect of Qori Testing.

### [Streamlining Appointment Joining Experience]

**What the documents show:** 
Efforts are being made to simplify the process of joining telehealth appointments, aiming to reduce the time to join and improve the success rate of first-attempt joins. Initiatives include one-click join from unified notifications, automatic device detection, and eliminating unnecessary confirmation steps.

**Evidence from documents:**
- "Goal: Reduce time-to-join from 4.5 minutes to under 1.5 minutes." - from VA_Telehealth_Modernization_Strategy_2025.md.pdf
- "One-click join from unified notification... Eliminate unnecessary confirmation steps." - from VA_Telehealth_Modernization_Strategy_2025.md.pdf

**Why it matters for Qori Testing:**
Efficient and user-friendly appointment joining processes are essential for a positive telehealth experience. Testing the effectiveness of these streamlined processes through Qori Testing can ensure a seamless user journey.

### [Proactive Technical Readiness]

**What the documents show:** 
There is an emphasis on identifying and resolving technical issues before telehealth appointments to improve the overall user experience. Initiatives include automated pre-appointment device testing, proactive SMS/email notifications with test results, and presenting fallback options automatically when issues are detected.

**Evidence from documents:**
- "Goal: Identify and resolve technical issues before appointment time." - from VA_Telehealth_Modernization_Strategy_2025.md.pdf
- "Deploy automated pre-appointment device testing... Fallback options presented automatically when issues detected." - from VA_OIG_Telehealth_Access_Report_2024.md.pdf

**Why it matters for Qori Testing:**
Conducting Qori Testing that includes scenarios to test the effectiveness of proactive technical readiness measures can help ensure that telehealth platforms are prepared to address potential issues before they impact the user experience.

### [Impact of Rural Veterans]

**What the documents show:** 
Rural Veterans show higher telehealth utilization rates but also face more technical difficulties. This demographic's unique challenges highlight the importance of designing telehealth platforms that cater to the specific needs and constraints of rural users.

**Evidence from documents:**
- "Veterans in rural areas showed 62% higher telehealth utilization than urban counterparts, but also reported 23% more technical difficulties." - from VA_OIG_Telehealth_Access_Report_2024.md.pdf
- "Efforts are being made to modernize the Veteran telehealth experience, with specific focus on the appointment joining and onboarding flows." - from VA_Telehealth_Modernization_Strategy_2025.md.pdf

**Why it matters for Qori Testing:**
Considering the unique challenges faced by rural Veterans in accessing telehealth services is crucial for Qori Testing to ensure that platforms are tailored to meet the needs of this specific user group.

---

## ✅ Recommendations & Next Steps

**Immediate Actions** (This Week)
- [ ] Simplify Joining Experience — Based on the finding that 34% of Veterans reported difficulty joining video appointments on their first attempt due to technical issues.
- [ ] Implement Automated Pre-Appointment Device Testing — Based on the finding that Veterans who received pre-appointment technical check communications were 67% more likely to successfully join their first appointment without assistance.
- [ ] Expand Technical Support Hours — Based on the recommendation to expand technical support hours to include evenings/weekends to address accessibility gaps.

**Short-Term Priorities** (This Month)
- [ ] Improve VVC Accessibility for Screen Reader Users — Based on the finding that Veterans using assistive technologies reported screen reader compatibility issues with the VVC interface.
- [ ] Create Simplified Joining Instructions in Multiple Formats — Based on the recommendation to implement standardized pre-appointment communication protocols including device testing links and step-by-step joining instructions.
- [ ] Develop Mobile-First Onboarding Experience — Based on the finding that smartphone usage rates were high, but users experienced more audio issues.

**Further Research Needed**
- Identify the impact of the proposed design improvements on the usability and success rates of older Veterans using telehealth platforms.
- Explore the effectiveness of integrating telehealth technical support into MyHealtheVet for seamless assistance.

---

## 📖 Sources

1. **JMIR_Older_Veterans_Telehealth_Usability_2024.md.pdf** — Sarah Chen, PhD, MPH et al., Date not specified
   - Key contribution: Usability evaluation of VA Video Connect among older Veterans, highlighting design improvements for successful telehealth participation.

2. **VA_Telehealth_Modernization_Strategy_2025.md.pdf** — VA Office of Connected Care, Digital Experience Team, October 2024
   - Key contribution: Outlines the strategic direction for modernizing the Veteran telehealth experience, focusing on appointment joining and onboarding flows.

3. **VA_OIG_Telehealth_Access_Report_2024.md.pdf** — Office of Healthcare Inspections, September 15, 2024
   - Key contribution: Report on the VA telehealth program implementation, emphasizing access, quality of care, and Veteran satisfaction with video-based healthcare services.
