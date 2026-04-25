// Helper to generate a random hex color
function getRandomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.random() * 30; // 70-100%
  const l = 50 + Math.random() * 20; // 50-70%
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function generateProblem(numElements = 15, numSets = 8, maxWeight = 10, isWeighted = true) {
  const universe = [];
  const minDistance = 5; // Minimum % distance between elements
  
  for (let i = 0; i < numElements; i++) {
    let x, y;
    let isValid = false;
    let attempts = 0;
    
    while (!isValid && attempts < 50) {
      x = 25 + Math.random() * 50; // 25% to 75%
      y = 25 + Math.random() * 50;
      
      isValid = true;
      for (const el of universe) {
        const dist = Math.sqrt((el.x - x) ** 2 + (el.y - y) ** 2);
        if (dist < minDistance) {
          isValid = false;
          break;
        }
      }
      attempts++;
    }
    
    universe.push({ id: i, x, y });
  }

  const sets = [];
  for (let i = 0; i < numSets; i++) {
    const numElementsInSet = Math.floor(Math.random() * (numElements / 2)) + 2; // 2 to N/2 elements
    const elements = [];
    
    // Pick a random center for this set to keep elements localized
    const setCenterX = 25 + Math.random() * 50;
    const setCenterY = 25 + Math.random() * 50;
    
    // Sort all available elements by distance to the set center
    const tempUniverse = [...universe].map(e => ({
      ...e,
      dist: Math.sqrt((e.x - setCenterX) ** 2 + (e.y - setCenterY) ** 2)
    })).sort((a, b) => a.dist - b.dist);
    
    for (let j = 0; j < numElementsInSet && tempUniverse.length > 0; j++) {
      elements.push(tempUniverse[j].id);
    }
    
    sets.push({
      id: `S${i+1}`,
      name: `Set ${i+1}`,
      elements: elements,
      weight: isWeighted ? Math.floor(Math.random() * maxWeight) + 1 : 1,
      color: getRandomColor()
    });
  }

  // Ensure universe is covered by at least adding all elements to a "fallback" set if needed
  const covered = new Set();
  sets.forEach(s => s.elements.forEach(e => covered.add(e)));
  
  const uncoveredElements = universe.map(e => e.id).filter(id => !covered.has(id));
  if (uncoveredElements.length > 0) {
    sets.push({
      id: `S_fallback`,
      name: `Fallback Set`,
      elements: uncoveredElements,
      weight: isWeighted ? Math.floor(Math.random() * maxWeight) + 1 : 1,
      color: getRandomColor()
    });
  }

  return { universe, sets };
}

export function runGreedy(universe, sets, isWeighted = true) {
  let remainingElements = new Set(universe.map(e => e.id));
  let availableSets = [...sets];
  let totalCost = 0;
  
  const steps = [];
  
  // Step 0: Initial state
  steps.push({
    step: 0,
    selectedSet: null,
    newlyCovered: [],
    totalCost: 0,
    remainingCount: remainingElements.size,
    candidates: availableSets.map(s => ({
      ...s,
      newlyCoveredCount: s.elements.filter(e => remainingElements.has(e)).length,
      metric: 0
    }))
  });

  let stepCount = 1;

  while (remainingElements.size > 0 && availableSets.length > 0) {
    let bestSet = null;
    let bestMetric = isWeighted ? Infinity : -1;
    let bestNewlyCovered = [];
    
    const candidates = [];

    for (const set of availableSets) {
      const newlyCovered = set.elements.filter(e => remainingElements.has(e));
      const newlyCoveredCount = newlyCovered.length;
      
      let metric;
      
      if (newlyCoveredCount === 0) {
        continue; // This set covers nothing new
      }

      if (isWeighted) {
        metric = set.weight / newlyCoveredCount; // minimize cost per element
        if (metric < bestMetric) {
          bestMetric = metric;
          bestSet = set;
          bestNewlyCovered = newlyCovered;
        }
      } else {
        metric = newlyCoveredCount; // maximize elements covered
        if (metric > bestMetric) {
          bestMetric = metric;
          bestSet = set;
          bestNewlyCovered = newlyCovered;
        }
      }
      
      candidates.push({
        id: set.id,
        name: set.name,
        color: set.color,
        weight: set.weight,
        newlyCoveredCount,
        metric
      });
    }

    if (!bestSet) break; // Cannot cover remaining

    bestNewlyCovered.forEach(e => remainingElements.delete(e));
    totalCost += bestSet.weight;
    availableSets = availableSets.filter(s => s.id !== bestSet.id);

    steps.push({
      step: stepCount++,
      selectedSet: bestSet,
      newlyCovered: bestNewlyCovered,
      totalCost,
      remainingCount: remainingElements.size,
      candidates: candidates.sort((a, b) => isWeighted ? a.metric - b.metric : b.metric - a.metric)
    });
  }

  return steps;
}

export function runOptimal(universe, sets) {
  let bestCost = Infinity;
  let bestSets = [];
  
  const allElements = universe.map(e => e.id);
  
  function backtrack(index, currentSets, currentCost, coveredSet) {
    if (coveredSet.size === allElements.length) {
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestSets = [...currentSets];
      }
      return;
    }
    
    if (index >= sets.length) return;
    if (currentCost >= bestCost) return; // Pruning
    
    // Branch 1: Skip set
    backtrack(index + 1, currentSets, currentCost, coveredSet);
    
    // Branch 2: Include set
    const set = sets[index];
    const newCovered = new Set(coveredSet);
    let newlyAddedCount = 0;
    
    for (const e of set.elements) {
      if (!newCovered.has(e)) {
        newCovered.add(e);
        newlyAddedCount++;
      }
    }
    
    if (newlyAddedCount > 0) { // Only include if it helps
      currentSets.push(set);
      backtrack(index + 1, currentSets, currentCost + set.weight, newCovered);
      currentSets.pop();
    }
  }

  backtrack(0, [], 0, new Set());
  
  return { optimalCost: bestCost, optimalSets: bestSets };
}

export function calculateAlpha(sets) {
  let maxSetSize = 0;
  for (const s of sets) {
    if (s.elements.length > maxSetSize) {
      maxSetSize = s.elements.length;
    }
  }
  
  // Harmonic number H_n
  let hn = 0;
  for (let i = 1; i <= maxSetSize; i++) {
    hn += 1 / i;
  }
  
  return {
    maxSetSize,
    alpha: hn
  };
}

export function generateWorstCaseExample(n = 6) {
  const universe = [];
  // Arrange elements in a neat circle for the worst case to look pretty
  const centerX = 50;
  const centerY = 50;
  const radius = 25;
  for (let i = 1; i <= n; i++) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    universe.push({
      id: i,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }

  const sets = [
    { 
      id: 'S_opt', 
      name: 'Opt (Full)', 
      elements: universe.map(e => e.id), 
      weight: 1, 
      color: getRandomColor() 
    }
  ];

  for (let i = 1; i <= n; i++) {
    // Weight = 1 / (n - i + 1) slightly reduced to ensure it beats the optimal set's yield
    let w = (1 / (n - i + 1)) - 0.001;
    if (w <= 0) w = 0.001;
    sets.push({
      id: `S_greedy_${i}`,
      name: `Greedy ${i}`,
      elements: [i],
      weight: parseFloat(w.toFixed(4)),
      color: getRandomColor()
    });
  }

  return { universe, sets };
}
