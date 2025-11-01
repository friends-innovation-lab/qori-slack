# Key Code Changes

## 1. Calculate Billed Rate Helper (Add after formatUSD)

```javascript
const calculateBilledRate = (costRate, markupPercent) => {
  return costRate * (1 + markupPercent / 100);
};
```

## 2. Role Data Structure (Update role objects to include)

```javascript
{
  subCostRate: 0,
  subMarkupPercent: 0,  // NEW - replaces subBilledRate direct input
  // ... other fields
}
```

## 3. RoleDrawer Subcontractor Section (Replace existing)

```javascript
{role.company !== "Prime" && (
  <>
    <div>
      <label>Sub Cost Rate ($/hr)</label>
      <Input
        type="number"
        step="0.01"
        value={role.subCostRate || ""}
        onChange={(e) =>
          onChange({ ...role, subCostRate: Number(e.target.value) })
        }
      />
    </div>
    <div>
      <label>Prime Markup %</label>
      <Input
        type="number"
        step="0.5"
        min="0"
        value={role.subMarkupPercent ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          onChange({
            ...role,
            subMarkupPercent: value ? Number(value) : 0,
          });
        }}
      />
      <div className="text-[10px] text-gray-500 mt-1">
        Gov rate = Cost × (1 + Markup%)
        {subBilledRate > 0 && (
          <div className="text-[#4ECDC4] mt-1">
            → ${subBilledRate.toFixed(2)}/hr billed to gov
          </div>
        )}
      </div>
    </div>
  </>
)}
```

## 4. Deduplication Logic (Add in Main App)

```javascript
const deduplicatedRoles = useMemo(() => {
  const roleMap = new Map();
  
  roles.forEach((role) => {
    const displayName = role.customRoleName || (mode === "gsa" ? role.gsaRole : role.role);
    const key = `${displayName}-${role.level}-${role.company}-${role.subName || ''}-${role.subCostRate || 0}-${role.subMarkupPercent || 0}`;
    
    if (!roleMap.has(key)) {
      roleMap.set(key, {
        ...role,
        dedupKey: key,
        originalRoles: [role],
      });
    } else {
      const existing = roleMap.get(key);
      existing.originalRoles.push(role);
    }
  });
  
  return Array.from(roleMap.values());
}, [roles, mode]);
```

## 5. Auto-Negotiation Component (Add to ResultsPanel)

```javascript
function AutoNegotiationPanel({ roles, setRoles, targetBid, currentTotal, onCalculate }) {
  if (!targetBid || !currentTotal) return null;
  
  const diff = currentTotal - targetBid;
  const isOverBudget = diff > 0;
  
  if (!isOverBudget) return null;

  const applyStrategy = (strategy) => {
    const updated = roles.map((role) => {
      if (role.company === "Prime") return role;
      
      const currentMarkup = role.subMarkupPercent || 0;
      let newMarkup = currentMarkup;
      
      if (strategy === "aggressive") {
        newMarkup = currentMarkup * 0.5;  // -50%
      } else if (strategy === "balanced") {
        newMarkup = currentMarkup * 0.75; // -25%
      } else if (strategy === "conservative") {
        newMarkup = currentMarkup * 0.85; // -15%
      }
      
      return { ...role, subMarkupPercent: Math.max(0, newMarkup) };
    });
    
    setRoles(updated);
    setTimeout(() => onCalculate(), 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Negotiation</CardTitle>
      </CardHeader>
      <CardContent>
        <button onClick={() => applyStrategy("aggressive")}>
          Aggressive (-50% markup)
        </button>
        <button onClick={() => applyStrategy("balanced")}>
          Balanced (-25% markup)
        </button>
        <button onClick={() => applyStrategy("conservative")}>
          Conservative (-15% markup)
        </button>
      </CardContent>
    </Card>
  );
}
```
