# Government Product Team: Complete Workflow Mapping

## The Reality: How Government Product Teams Actually Work

### **Phase 1: Problem Discovery & Planning**
```
Stakeholder Input → Product Strategy → Research Planning
```

**Natural Handoffs:**
- **Policy → Product:** "We need to improve veteran housing applications"
- **Product → Research:** "Help us understand the current user experience"
- **Product → Design:** "Here's the strategic context for this work"

**Information Flow:**
- Stakeholder requirements (often vague)
- Success metrics and constraints
- Compliance requirements
- Budget/timeline constraints

---

### **Phase 2: User Research & Discovery**
```
Research Planning → User Sessions → Synthesis → Insights
```

**Natural Handoffs:**
- **Research → Product:** "Here's what we learned about user needs"
- **Research → Design:** "Here are the key user pain points and mental models"
- **Research → Stakeholders:** "Here's evidence for our recommendations"

**Information Flow:**
- User interview transcripts
- Behavioral observations
- Pain points and opportunities
- Evidence-backed insights

---

### **Phase 3: Design & Solution Development**
```
Insights → Design Exploration → Prototyping → Design Decisions
```

**Natural Handoffs:**
- **Design → Product:** "Here are our recommended solutions"
- **Design → Research:** "Can you validate these concepts with users?"
- **Design → Dev:** "Here's what we need to build"

**Information Flow:**
- Design rationale tied to research
- Prototypes and wireframes
- Accessibility considerations
- Design system decisions

---

### **Phase 4: Product Definition & Planning**
```
Design Solutions → Requirements → Roadmap → Sprint Planning
```

**Natural Handoffs:**
- **Product → Dev:** "Here's what to build and why"
- **Product → QA:** "Here's how to test it"
- **Product → Stakeholders:** "Here's our plan and timeline"

**Information Flow:**
- Detailed requirements
- Acceptance criteria
- Success metrics
- Technical constraints

---

### **Phase 5: Technical Implementation**
```
Requirements → Architecture → Development → Code Review
```

**Natural Handoffs:**
- **Dev → Product:** "Here's what's technically feasible"
- **Dev → QA:** "Here's how to test this implementation"
- **Dev → DevOps:** "Here's how to deploy and maintain this"

**Information Flow:**
- Technical decisions and rationale
- Architecture documentation
- API specifications
- Security considerations

---

### **Phase 6: Validation & Launch**
```
Development → Testing → Stakeholder Review → Launch
```

**Natural Handoffs:**
- **QA → Product:** "Here's what we found in testing"
- **Team → Stakeholders:** "Here's the final product for approval"
- **Team → Operations:** "Here's how to support this in production"

**Information Flow:**
- Test results and bug reports
- Launch readiness checklists
- Support documentation
- Performance metrics

---

## **Government-Specific Workflow Realities**

### **Concurrent Streams (Not Sequential)**
```
Research ←→ Design ←→ Product ←→ Dev
    ↓         ↓         ↓        ↓
Stakeholder Management (Ongoing)
Security Review (Ongoing)
Compliance Checks (Ongoing)
Documentation (Ongoing)
```

### **Critical Handoff Points**

1. **Research → Everyone:** Insights need to reach design, product, AND stakeholders
2. **Design → Dev:** Technical feasibility feedback loop
3. **Product → Stakeholders:** Constant communication and approval cycles
4. **Dev → Compliance:** Security and accessibility validation
5. **Everyone → Documentation:** Audit trail and transition preparation

### **Team Communication Patterns**

**Daily Reality:**
- **Slack:** 80% of communication happens here
- **Formal docs:** Required for approvals and handoffs
- **Meetings:** Decision-making and alignment
- **GitHub:** Technical collaboration and version control

**Information Needs:**
- **Context:** "Why are we building this?"
- **Evidence:** "What research supports this decision?"
- **Status:** "Where are we in the process?"
- **Next steps:** "What do I need to do next?"

---

## **Qori Workflow Integration Points**

### **Natural Command Flow**
```bash
# Product Planning
/qori define-problem
/qori stakeholder-input

# Research Phase  
/qori plan-study
/qori recruit-participants
/qori conduct-sessions
/qori synthesize-insights

# Design Phase
/qori design-exploration  
/qori create-prototype
/qori validate-design
/qori finalize-design

# Product Definition
/qori write-requirements
/qori define-acceptance-criteria
/qori plan-sprint

# Development
/qori document-architecture
/qori technical-planning
/qori code-review

# Launch & Handoff
/qori prepare-launch
/qori generate-documentation
/qori transition-plan
```

### **Cross-Cutting Commands**
```bash
# Available to everyone, context-aware
/qori status              # "Where are we in the process?"
/qori context            # "Why are we building this?"
/qori handoff            # "Package work for next phase"
/qori stakeholder-update # "Generate status report"
/qori search             # "Find relevant past work"
```

### **Automatic Information Flow**
- **Research insights** automatically surface in design and product contexts
- **Design decisions** automatically link to research evidence and product requirements
- **Product requirements** automatically reference design and research work
- **Technical decisions** automatically connect to product and design constraints
- **All work** automatically contributes to documentation and transition materials

---

## **Key Design Principles**

1. **Follow the Work, Not Org Charts:** Tools should match how information actually flows
2. **Context Without Switching:** Bring relevant info to current workflow
3. **Capture While Doing:** Don't require separate documentation steps
4. **Government-Ready:** Built for compliance, security, and transition requirements
5. **Team Intelligence:** The whole becomes smarter than the sum of parts

---

## **Success Metrics**

- **Time to handoff:** How quickly can work move between phases?
- **Context preservation:** How much knowledge is lost in transitions?
- **Stakeholder satisfaction:** Are approvals faster and more informed?
- **Team efficiency:** Less time hunting for information, more time creating value
- **Audit readiness:** Can we easily explain decisions and show evidence?