import React, { useState, useEffect } from 'react';
import { Play, Pause, StepForward, RotateCcw, Settings2, Calculator, BarChart2, Edit3, Plus, Trash2 } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { generateProblem, runGreedy, runOptimal, calculateAlpha, generateWorstCaseExample } from './engine/SetCover';
import './App.css';

// Visualizer Component used for both Greedy and Optimal stages
const SetVisualizer = ({ universe, sets, selectedSetIds, coveredElementsIds, title, cost, isGreedy, stepData }) => {
  return (
    <div className="visualizer-wrapper">
      <div className="visualizer-header">
        <h3>{title}</h3>
        <div className={`badge-cost ${isGreedy ? 'greedy' : 'optimal'}`}>
          Cost: {typeof cost === 'number' ? cost.toFixed(2) : cost}
        </div>
      </div>
      <div className="visualizer-canvas">
        {sets.map((set, idx) => {
          const isSelected = selectedSetIds.has(set.id);
          const elementsInfo = universe.filter(e => set.elements.includes(e.id));
          if (elementsInfo.length === 0) return null;
          
          const minX = Math.min(...elementsInfo.map(e => e.x));
          const maxX = Math.max(...elementsInfo.map(e => e.x));
          const minY = Math.min(...elementsInfo.map(e => e.y));
          const maxY = Math.max(...elementsInfo.map(e => e.y));
          
          // Add stagger to padding and rotation to prevent perfect overlaps
          const padding = 10 + (idx % 4) * 3;
          const rotate = (idx % 5) * 4 - 8;
          const width = maxX - minX + padding * 2;
          const height = maxY - minY + padding * 2;
          
          // Glow effect for selected sets
          const boxShadow = isSelected ? `0 0 25px ${set.color.replace('hsl', 'hsla').replace(')', ', 0.6)')}` : 'none';
          
          return (
            <div 
              key={set.id}
              className={`set-hull ${isSelected ? 'active' : 'inactive'}`}
              style={{
                left: `${minX - padding}%`,
                top: `${minY - padding}%`,
                width: `${width}%`,
                height: `${height}%`,
                borderColor: set.color,
                backgroundColor: isSelected ? set.color.replace('hsl', 'hsla').replace(')', ', 0.15)') : 'transparent',
                transform: `rotate(${rotate}deg)`,
                boxShadow: boxShadow
              }}
            >
              <span className="set-label">{set.name}</span>
            </div>
          );
        })}

        {universe.map(el => (
          <div 
            key={el.id}
            className={`element-node ${coveredElementsIds.has(el.id) ? 'covered' : ''}`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
            }}
          >
            {el.id}
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  const [isWeighted, setIsWeighted] = useState(true);
  const [numElements, setNumElements] = useState(15);
  const [numSets, setNumSets] = useState(10);
  const [maxWeight, setMaxWeight] = useState(15);
  
  const [problemData, setProblemData] = useState(null);
  const [greedySteps, setGreedySteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [optimalData, setOptimalData] = useState(null);
  const [isCalculatingOpt, setIsCalculatingOpt] = useState(false);
  
  const [optimalSteps, setOptimalSteps] = useState([]);
  const [currentOptStep, setCurrentOptStep] = useState(0);
  const [isOptPlaying, setIsOptPlaying] = useState(false);

  const [mode, setMode] = useState('simulate'); // 'simulate' or 'edit'

  const solveFromData = (data) => {
    setIsPlaying(false);
    setIsCalculatingOpt(true);
    setOptimalData(null);
    setProblemData(data);
    
    setTimeout(() => {
      const gSteps = runGreedy(data.universe, data.sets, isWeighted);
      setGreedySteps(gSteps);
      setCurrentStep(0); // 0 is initial state
      
      const opt = runOptimal(data.universe, data.sets);
      setOptimalData(opt);
      
      const optStepsArray = [{ step: 0, selectedSet: null, totalCost: 0 }];
      let optCostAcc = 0;
      opt.optimalSets.forEach((s, idx) => {
        optCostAcc += s.weight;
        optStepsArray.push({
          step: idx + 1,
          selectedSet: s,
          totalCost: optCostAcc
        });
      });
      setOptimalSteps(optStepsArray);
      setCurrentOptStep(0);
      setIsOptPlaying(false);
      
      setIsCalculatingOpt(false);
    }, 50);
  };

  const handleGenerate = () => {
    const data = generateProblem(numElements, numSets, maxWeight, isWeighted);
    solveFromData(data);
  };

  const handleLoadWorstCase = () => {
    setIsWeighted(true);
    // You can dynamically pass numElements here, defaulting to 8 for a great visual size
    const data = generateWorstCaseExample(8);
    solveFromData(data);
  };

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line
  }, [isWeighted]);

  useEffect(() => {
    let interval;
    if (isPlaying && currentStep < greedySteps.length - 1) {
      interval = setInterval(() => {
        setCurrentStep(prev => prev + 1);
      }, 1200);
    } else if (currentStep >= greedySteps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, greedySteps.length]);

  useEffect(() => {
    let optInterval;
    if (isOptPlaying && optimalSteps.length > 0 && currentOptStep < optimalSteps.length - 1) {
      optInterval = setInterval(() => {
        setCurrentOptStep(prev => prev + 1);
      }, 1200);
    } else if (optimalSteps.length > 0 && currentOptStep >= optimalSteps.length - 1) {
      setIsOptPlaying(false);
    }
    return () => clearInterval(optInterval);
  }, [isOptPlaying, currentOptStep, optimalSteps.length]);

  if (!problemData || !greedySteps.length) return <div style={{padding: '2rem', color: '#fff'}}>Initializing...</div>;

  const stepData = greedySteps[currentStep];
  const isFinished = currentStep === greedySteps.length - 1;
  const alphaData = calculateAlpha(problemData.sets);

  const greedyCoveredElements = new Set();
  for (let i = 1; i <= currentStep; i++) {
    if (greedySteps[i].newlyCovered) {
      greedySteps[i].newlyCovered.forEach(e => greedyCoveredElements.add(e));
    }
  }
  const greedySelectedIds = new Set(
    greedySteps.slice(1, currentStep + 1).map(s => s.selectedSet?.id).filter(Boolean)
  );

  let optSelectedIds = new Set();
  let optCoveredElements = new Set();
  let currentOptCost = 0;
  if (optimalData && optimalSteps.length > 0) {
    const currentOptState = optimalSteps[currentOptStep];
    currentOptCost = currentOptState.totalCost;
    
    const setsSoFar = optimalSteps.slice(1, currentOptStep + 1).map(s => s.selectedSet);
    optSelectedIds = new Set(setsSoFar.map(s => s.id));
    
    setsSoFar.forEach(s => {
      s.elements.forEach(elId => optCoveredElements.add(elId));
    });
  }

  // Edit Handlers
  const handleSetWeightChange = (setId, val) => {
    const newData = { ...problemData };
    const sIdx = newData.sets.findIndex(s => s.id === setId);
    if (sIdx >= 0) {
      newData.sets[sIdx].weight = parseFloat(val) || 0;
      setProblemData(newData);
    }
  };

  const handleToggleElementInSet = (setId, elId) => {
    const newData = { ...problemData };
    const sIdx = newData.sets.findIndex(s => s.id === setId);
    if (sIdx >= 0) {
      const set = newData.sets[sIdx];
      if (set.elements.includes(elId)) {
        set.elements = set.elements.filter(e => e !== elId);
      } else {
        set.elements.push(elId);
      }
      setProblemData(newData);
    }
  };

  const handleApplyEdits = () => {
    setMode('simulate');
    solveFromData(problemData);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Greedy Set Cover</h1>
        <p>Interactive Simulation & <InlineMath math="\alpha" />-Approximation Analysis</p>
      </header>

      <div className="main-grid" style={{ gridTemplateColumns: '1fr' }}>
        {/* Top Control Panel */}
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="toggle-wrapper" style={{ margin: 0 }}>
              <div className={`toggle-option ${mode === 'simulate' ? 'active' : ''}`} onClick={() => setMode('simulate')}>
                Simulate
              </div>
              <div className={`toggle-option ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>
                <Edit3 size={16} style={{marginRight: 6, verticalAlign: 'middle'}}/> Edit Sets
              </div>
            </div>
            
            {mode === 'simulate' && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={handleLoadWorstCase}>
                  Load Worst Case Example (<InlineMath math="\alpha \to H_n" />)
                </button>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={isCalculatingOpt}>
                  <RotateCcw size={18} /> {isCalculatingOpt ? "Calculating..." : "Random Generation"}
                </button>
              </div>
            )}
            {mode === 'edit' && (
              <button className="btn btn-primary" onClick={handleApplyEdits}>
                Apply & Solve
              </button>
            )}
          </div>

          {mode === 'simulate' && (
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div className="toggle-wrapper" style={{ margin: 0 }}>
                <div className={`toggle-option ${!isWeighted ? 'active' : ''}`} onClick={() => setIsWeighted(false)}>Unweighted</div>
                <div className={`toggle-option ${isWeighted ? 'active' : ''}`} onClick={() => setIsWeighted(true)}>Weighted</div>
              </div>
              <div className="control-group" style={{ margin: 0 }}>
                <label>Elements: <span className="val-display">{numElements}</span></label>
                <input type="range" min="8" max="25" value={numElements} onChange={e => setNumElements(Number(e.target.value))} />
              </div>
              <div className="control-group" style={{ margin: 0 }}>
                <label>Sets: <span className="val-display">{numSets}</span></label>
                <input type="range" min="3" max="15" value={numSets} onChange={e => setNumSets(Number(e.target.value))} />
              </div>
              {isWeighted && (
                <div className="control-group" style={{ margin: 0 }}>
                  <label>Max Weight: <span className="val-display">{maxWeight}</span></label>
                  <input type="range" min="5" max="50" value={maxWeight} onChange={e => setMaxWeight(Number(e.target.value))} />
                </div>
              )}
            </div>
          )}

          {mode === 'edit' && (
            <div className="edit-panel">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Modify the weight and contents of each set. Click elements to toggle their inclusion in a set.
              </p>
              <div className="edit-sets-grid">
                {problemData.sets.map(set => (
                  <div key={set.id} className="edit-set-card" style={{ borderTop: `4px solid ${set.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong>{set.name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Weight:
                        <input 
                          type="number" 
                          value={set.weight} 
                          onChange={(e) => handleSetWeightChange(set.id, e.target.value)}
                          style={{ width: '60px', background: 'var(--bg-main)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px' }}
                        />
                      </div>
                    </div>
                    <div className="element-toggles">
                      {problemData.universe.map(el => (
                        <div 
                          key={el.id}
                          className={`el-toggle ${set.elements.includes(el.id) ? 'active' : ''}`}
                          onClick={() => handleToggleElementInSet(set.id, el.id)}
                        >
                          {el.id}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Visualization Area */}
        {mode === 'simulate' && (
          <main className="stage-container" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Greedy Section */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Greedy Approach</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn" onClick={() => { setIsPlaying(false); setCurrentStep(0); }} disabled={currentStep === 0}>
                    <RotateCcw size={20} /> Reset
                  </button>
                  <button className="btn" onClick={() => { setIsPlaying(false); setCurrentStep(Math.max(0, currentStep - 1)); }} disabled={currentStep === 0}>
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={() => setIsPlaying(!isPlaying)} disabled={isFinished} style={{ minWidth: '120px' }}>
                    {isPlaying ? <><Pause size={20} /> Pause</> : <><Play size={20} /> Play</>}
                  </button>
                  <button className="btn" onClick={() => { setIsPlaying(false); setCurrentStep(Math.min(greedySteps.length - 1, currentStep + 1)); }} disabled={isFinished}>
                    Step <StepForward size={20} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: '1 1 70%' }}>
                  <SetVisualizer 
                    title={currentStep === 0 ? "Initial State" : `Greedy Step ${currentStep}/${greedySteps.length-1}`}
                    cost={stepData.totalCost}
                    isGreedy={true}
                    universe={problemData.universe}
                    sets={problemData.sets}
                    selectedSetIds={greedySelectedIds}
                    coveredElementsIds={greedyCoveredElements}
                  />
                </div>
                <div style={{ flex: '1 1 30%', minWidth: '250px' }}>
                  <h3>Candidate Evaluation</h3>
                  <div className="set-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {stepData.candidates && stepData.candidates.map((c, idx) => {
                      const isActive = idx === 0 && !isFinished && currentStep !== greedySteps.length - 1;
                      return (
                        <div key={c.id} className={`set-item ${isActive ? 'active' : ''}`} style={{ borderLeftColor: c.color }}>
                          <div>
                            <div style={{ fontWeight: '600', color: '#fff' }}>{c.name}</div>
                            <div className="set-meta">
                              <span>Covers: {c.newlyCoveredCount}</span>
                              {isWeighted && <span>Weight: {c.weight}</span>}
                            </div>
                          </div>
                          <div className="metric-badge">
                            {isWeighted ? `Cost/El: ${(c.metric).toFixed(2)}` : `Yield: ${c.metric}`}
                          </div>
                        </div>
                      );
                    })}
                    {(!stepData.candidates || stepData.candidates.length === 0) && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                        All elements covered!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Optimal Section */}
            {optimalData && isFinished && optimalSteps.length > 0 && (
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2>Optimal Solution</h2>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={() => { setIsOptPlaying(false); setCurrentOptStep(0); }} disabled={currentOptStep === 0}>
                      <RotateCcw size={20} /> Reset
                    </button>
                    <button className="btn" onClick={() => { setIsOptPlaying(false); setCurrentOptStep(Math.max(0, currentOptStep - 1)); }} disabled={currentOptStep === 0}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsOptPlaying(!isOptPlaying)} disabled={currentOptStep === optimalSteps.length - 1} style={{ minWidth: '120px' }}>
                      {isOptPlaying ? <><Pause size={20} /> Pause</> : <><Play size={20} /> Play</>}
                    </button>
                    <button className="btn" onClick={() => { setIsOptPlaying(false); setCurrentOptStep(Math.min(optimalSteps.length - 1, currentOptStep + 1)); }} disabled={currentOptStep === optimalSteps.length - 1}>
                      Step <StepForward size={20} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ flex: '1 1 100%' }}>
                    <SetVisualizer 
                      title={currentOptStep === 0 ? "Initial State" : (currentOptStep === optimalSteps.length - 1 ? "Exact Global Minimum Cost" : `Optimal Step ${currentOptStep}/${optimalSteps.length - 1}`)}
                      cost={currentOptCost}
                      isGreedy={false}
                      universe={problemData.universe}
                      sets={problemData.sets}
                      selectedSetIds={optSelectedIds}
                      coveredElementsIds={optCoveredElements}
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Math & Conclusion Section */}
      {isFinished && optimalData && mode === 'simulate' && (
        <div className="math-section glass-panel" style={{ marginTop: '2rem' }}>
          <div className="math-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2><Calculator size={32} style={{verticalAlign: 'middle', marginRight: 12, color: 'var(--accent-1)'}}/> Approximation Ratio Analysis</h2>
            <p style={{color: 'var(--text-muted)', fontSize: '1.2rem'}}>How close did the Greedy Algorithm get to the absolute optimal?</p>
          </div>

          <div className="derivation-grid">
            <div className="derivation-card">
              <h4>Empirical Performance</h4>
              <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>
                Comparing the cost achieved by the greedy simulation against the exact mathematically optimal cost.
              </p>
              <ul style={{ lineHeight: '2' }}>
                <li>Greedy Cost (<InlineMath math="C_{greedy}" />) = <strong>{stepData.totalCost.toFixed(2)}</strong></li>
                <li>Optimal Cost (<InlineMath math="C_{opt}" />) = <strong>{optimalData.optimalCost.toFixed(2)}</strong></li>
                <li>Empirical Ratio = <InlineMath math="\frac{C_{greedy}}{C_{opt}}" /></li>
              </ul>

              <div className="ratio-highlight">
                {(stepData.totalCost / optimalData.optimalCost).toFixed(2)}x
              </div>
              <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                The greedy solution is {(stepData.totalCost / optimalData.optimalCost).toFixed(2)} times the cost of the optimal.
              </p>
            </div>

            <div className="derivation-card">
              <h4>Theoretical Bound (<InlineMath math="\alpha" />)</h4>
              <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>
                The greedy algorithm guarantees a solution cost bounded by an <InlineMath math="\alpha" /> factor times the optimal cost. 
                For Set Cover, <InlineMath math="\alpha" /> is the Harmonic Number of the maximum set size.
              </p>
              <ul style={{ lineHeight: '2' }}>
                <li>Max Set Size (<InlineMath math="|S|_{max}" />) = <strong>{alphaData.maxSetSize}</strong></li>
                <li>Harmonic Number formula: <InlineMath math="H_n = 1 + \frac{1}{2} + \frac{1}{3} + \dots + \frac{1}{n}" /></li>
                <li>
                  <InlineMath math={`H_{${alphaData.maxSetSize}} = `} />
                  <span className="mono" style={{marginLeft: '0.5rem', display: 'inline-block'}}>
                    {Array.from({length: Math.min(alphaData.maxSetSize, 6)}, (_, i) => `1/${i+1}`).join(' + ')}
                    {alphaData.maxSetSize > 6 ? ' + ...' : ''}
                  </span>
                </li>
              </ul>
              
              <div className="formula-box" style={{padding: '1rem', marginTop: '1.5rem', fontSize: '1.25rem'}}>
                <InlineMath math={`\\alpha \\approx ${alphaData.alpha.toFixed(3)}`} />
              </div>
            </div>
          </div>

          <div className="formula-box" style={{ marginTop: '2rem' }}>
            <BlockMath math="C_{greedy} \leq \alpha \times C_{opt}" />
            <div className="formula-subtext" style={{ marginTop: '1rem' }}>
              <InlineMath math={`${stepData.totalCost.toFixed(2)} \\leq ${alphaData.alpha.toFixed(3)} \\times ${optimalData.optimalCost.toFixed(2)}`} />
              <br/><br/>
              <strong><InlineMath math={`${stepData.totalCost.toFixed(2)} \\leq ${(alphaData.alpha * optimalData.optimalCost).toFixed(2)}`} /></strong>
            </div>
          </div>

          {stepData.totalCost <= (alphaData.alpha * optimalData.optimalCost) + 0.01 ? (
            <div className="final-verdict">
              <strong>Theorem Verified!</strong> The greedy algorithm produced a valid cover within the theoretical <InlineMath math="\alpha" />-approximation bound.
            </div>
          ) : (
            <div className="final-verdict failed">
              <strong>Error:</strong> The greedy algorithm exceeded the theoretical bound.
            </div>
          )}

          <div className="derivation-card" style={{ marginTop: '2rem', gridColumn: '1 / -1' }}>
            <h4>Worst-Case Scenario</h4>
            <p style={{ color: 'var(--text-muted)' }}>
              The ratio we computed empirically is almost always strictly less than the theoretical <InlineMath math="\alpha" />.
              To reach the worst case, we must construct a specific adversarial graph where the greedy algorithm is repeatedly tricked into choosing sets that are only slightly more "cost-effective" at the moment, but terrible in the long run.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              For instance, if you click the "Load Worst Case Example" button above, the simulation will generate an adversarial graph of size <InlineMath math="n" /> where the optimal solution covers everything in 1 step with cost 1.0, but Greedy is repeatedly baited into picking single elements, resulting in a total cost approaching <InlineMath math="H_n" />.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
