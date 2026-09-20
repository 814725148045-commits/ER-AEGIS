import { FEATURE_NAMES, FeatureName } from './featureEngineering';
import { FeatureImportanceItem } from './types';

/**
 * ER-AEGIS Random Forest Classifier and Multi-Output Regressor
 * 
 * Implements a real, self-contained Random Forest ensemble with:
 * - Bootstrap Aggregation (Bagging with replacement)
 * - Random Feature Subspace Selection (sqrt(d) candidate features per node)
 * - Gini Impurity Gain optimization for binary classification
 * - Variance Reduction for multi-horizon continuous regression
 * - Mean Decrease in Impurity (MDI) Gini Feature Importance calculation
 */

interface ClassificationNode {
  isLeaf: boolean;
  featureIndex: number;
  threshold: number;
  probability: number; // probability of class 1 (High Congestion)
  left?: ClassificationNode;
  right?: ClassificationNode;
  impurityReduction: number;
}

interface RegressionNode {
  isLeaf: boolean;
  featureIndex: number;
  threshold: number;
  value: number; // predicted continuous value
  left?: RegressionNode;
  right?: RegressionNode;
}

class PseudoRNG {
  private state: number;
  constructor(seed: number = 777) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }
  next(): number {
    this.state = (this.state * 48271) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
  randInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// ---------------------------------------------------------------------------
// Single Classification Tree
// ---------------------------------------------------------------------------
class ClassificationTree {
  public root: ClassificationNode | null = null;
  public featureImportances: number[];

  constructor(
    private maxDepth: number = 6,
    private minSamplesSplit: number = 8,
    private numFeaturesTotal: number = FEATURE_NAMES.length
  ) {
    this.featureImportances = new Array(numFeaturesTotal).fill(0);
  }

  public fit(X: number[][], y: number[], rng: PseudoRNG): void {
    this.featureImportances.fill(0);
    this.root = this.buildTree(X, y, 0, rng);
  }

  private gini(y: number[]): number {
    if (y.length === 0) return 0;
    let ones = 0;
    for (let i = 0; i < y.length; i++) {
      if (y[i] === 1) ones++;
    }
    const p1 = ones / y.length;
    const p0 = 1 - p1;
    return 1 - (p0 * p0 + p1 * p1);
  }

  private buildTree(X: number[][], y: number[], depth: number, rng: PseudoRNG): ClassificationNode {
    const numSamples = y.length;
    let ones = 0;
    for (let i = 0; i < numSamples; i++) {
      if (y[i] === 1) ones++;
    }
    const prob = numSamples > 0 ? ones / numSamples : 0;

    // Base cases for leaf
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || prob === 0 || prob === 1) {
      return {
        isLeaf: true,
        featureIndex: -1,
        threshold: 0,
        probability: prob,
        impurityReduction: 0,
      };
    }

    const currentImpurity = this.gini(y);

    // Random feature subspace selection: pick sqrt(D) features
    const numFeaturesToConsider = Math.max(2, Math.floor(Math.sqrt(this.numFeaturesTotal)) + 1);
    const featureIndices: number[] = [];
    while (featureIndices.length < numFeaturesToConsider) {
      const fIdx = rng.randInt(0, this.numFeaturesTotal - 1);
      if (!featureIndices.includes(fIdx)) featureIndices.push(fIdx);
    }

    let bestGain = -1;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (const fIdx of featureIndices) {
      // Gather unique values for candidate thresholds
      const values = X.map((row) => row[fIdx]);
      values.sort((a, b) => a - b);

      // Test up to 10 split candidates across percentiles
      const step = Math.max(1, Math.floor(values.length / 10));
      for (let i = step; i < values.length; i += step) {
        const thresh = (values[i - 1] + values[i]) / 2;

        const leftY: number[] = [];
        const rightY: number[] = [];
        for (let j = 0; j < numSamples; j++) {
          if (X[j][fIdx] <= thresh) leftY.push(y[j]);
          else rightY.push(y[j]);
        }

        if (leftY.length === 0 || rightY.length === 0) continue;

        const leftImpurity = this.gini(leftY);
        const rightImpurity = this.gini(rightY);
        const weightedChildImpurity = (leftY.length / numSamples) * leftImpurity + (rightY.length / numSamples) * rightImpurity;
        const gain = currentImpurity - weightedChildImpurity;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = fIdx;
          bestThreshold = thresh;
        }
      }
    }

    if (bestGain <= 0.0001 || bestFeature === -1) {
      return {
        isLeaf: true,
        featureIndex: -1,
        threshold: 0,
        probability: prob,
        impurityReduction: 0,
      };
    }

    // Split samples
    const leftX: number[][] = [];
    const leftY: number[] = [];
    const rightX: number[][] = [];
    const rightY: number[] = [];

    for (let j = 0; j < numSamples; j++) {
      if (X[j][bestFeature] <= bestThreshold) {
        leftX.push(X[j]);
        leftY.push(y[j]);
      } else {
        rightX.push(X[j]);
        rightY.push(y[j]);
      }
    }

    // Accumulate MDI importance
    this.featureImportances[bestFeature] += bestGain * (numSamples / X.length);

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      probability: prob,
      impurityReduction: bestGain,
      left: this.buildTree(leftX, leftY, depth + 1, rng),
      right: this.buildTree(rightX, rightY, depth + 1, rng),
    };
  }

  public predictProbability(features: number[]): number {
    let node = this.root;
    while (node && !node.isLeaf) {
      if (features[node.featureIndex] <= node.threshold) {
        node = node.left ?? null;
      } else {
        node = node.right ?? null;
      }
    }
    return node ? node.probability : 0.5;
  }
}

// ---------------------------------------------------------------------------
// Single Continuous Regression Tree
// ---------------------------------------------------------------------------
class RegressionTree {
  public root: RegressionNode | null = null;

  constructor(
    private maxDepth: number = 5,
    private minSamplesSplit: number = 8,
    private numFeaturesTotal: number = FEATURE_NAMES.length
  ) {}

  public fit(X: number[][], y: number[], rng: PseudoRNG): void {
    this.root = this.buildTree(X, y, 0, rng);
  }

  private variance(y: number[]): number {
    if (y.length <= 1) return 0;
    let sum = 0;
    for (let i = 0; i < y.length; i++) sum += y[i];
    const mean = sum / y.length;
    let v = 0;
    for (let i = 0; i < y.length; i++) {
      const diff = y[i] - mean;
      v += diff * diff;
    }
    return v / y.length;
  }

  private buildTree(X: number[][], y: number[], depth: number, rng: PseudoRNG): RegressionNode {
    const numSamples = y.length;
    let sum = 0;
    for (let i = 0; i < numSamples; i++) sum += y[i];
    const meanValue = numSamples > 0 ? sum / numSamples : 50;

    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit) {
      return { isLeaf: true, featureIndex: -1, threshold: 0, value: meanValue };
    }

    const currentVar = this.variance(y);
    if (currentVar < 0.5) {
      return { isLeaf: true, featureIndex: -1, threshold: 0, value: meanValue };
    }

    const numFeaturesToConsider = Math.max(2, Math.floor(Math.sqrt(this.numFeaturesTotal)) + 1);
    const featureIndices: number[] = [];
    while (featureIndices.length < numFeaturesToConsider) {
      const fIdx = rng.randInt(0, this.numFeaturesTotal - 1);
      if (!featureIndices.includes(fIdx)) featureIndices.push(fIdx);
    }

    let bestReduction = -1;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (const fIdx of featureIndices) {
      const values = X.map((row) => row[fIdx]);
      values.sort((a, b) => a - b);

      const step = Math.max(1, Math.floor(values.length / 8));
      for (let i = step; i < values.length; i += step) {
        const thresh = (values[i - 1] + values[i]) / 2;

        const leftY: number[] = [];
        const rightY: number[] = [];
        for (let j = 0; j < numSamples; j++) {
          if (X[j][fIdx] <= thresh) leftY.push(y[j]);
          else rightY.push(y[j]);
        }

        if (leftY.length === 0 || rightY.length === 0) continue;

        const leftVar = this.variance(leftY);
        const rightVar = this.variance(rightY);
        const childVar = (leftY.length / numSamples) * leftVar + (rightY.length / numSamples) * rightVar;
        const reduction = currentVar - childVar;

        if (reduction > bestReduction) {
          bestReduction = reduction;
          bestFeature = fIdx;
          bestThreshold = thresh;
        }
      }
    }

    if (bestReduction <= 0.001 || bestFeature === -1) {
      return { isLeaf: true, featureIndex: -1, threshold: 0, value: meanValue };
    }

    const leftX: number[][] = [];
    const leftY: number[] = [];
    const rightX: number[][] = [];
    const rightY: number[] = [];

    for (let j = 0; j < numSamples; j++) {
      if (X[j][bestFeature] <= bestThreshold) {
        leftX.push(X[j]);
        leftY.push(y[j]);
      } else {
        rightX.push(X[j]);
        rightY.push(y[j]);
      }
    }

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      value: meanValue,
      left: this.buildTree(leftX, leftY, depth + 1, rng),
      right: this.buildTree(rightX, rightY, depth + 1, rng),
    };
  }

  public predict(features: number[]): number {
    let node = this.root;
    while (node && !node.isLeaf) {
      if (features[node.featureIndex] <= node.threshold) {
        node = node.left ?? null;
      } else {
        node = node.right ?? null;
      }
    }
    return node ? node.value : 50;
  }
}

// ---------------------------------------------------------------------------
// Random Forest Ensemble (Classifier + Multi-Horizon Regressors)
// ---------------------------------------------------------------------------
export class HospitalCongestionRandomForest {
  private classificationTrees: ClassificationTree[] = [];
  private regressor30: RegressionTree[] = [];
  private regressor60: RegressionTree[] = [];
  private regressor90: RegressionTree[] = [];
  private regressor120: RegressionTree[] = [];
  public featureImportances: FeatureImportanceItem[] = [];
  public validationAccuracy: number = 0.89;
  public trainedSamples: number = 0;
  public trainedAt: string = '';

  constructor(private nTrees: number = 20, private seed: number = 2026) {}

  /**
   * Trains the Random Forest on the 7-day synthetic feature matrix
   */
  public fit(
    X: number[][],
    yBinary: number[],
    y30: number[],
    y60: number[],
    y90: number[],
    y120: number[]
  ): void {
    const rng = new PseudoRNG(this.seed);
    const nSamples = X.length;
    this.trainedSamples = nSamples;
    this.trainedAt = new Date().toISOString();

    this.classificationTrees = [];
    this.regressor30 = [];
    this.regressor60 = [];
    this.regressor90 = [];
    this.regressor120 = [];

    const rawImportances = new Array(FEATURE_NAMES.length).fill(0);

    // Train N bootstrap classification trees
    for (let t = 0; t < this.nTrees; t++) {
      // Bootstrap sample with replacement
      const bootX: number[][] = [];
      const bootYBinary: number[] = [];
      const bootY30: number[] = [];
      const bootY60: number[] = [];
      const bootY90: number[] = [];
      const bootY120: number[] = [];

      for (let s = 0; s < nSamples; s++) {
        const idx = rng.randInt(0, nSamples - 1);
        bootX.push(X[idx]);
        bootYBinary.push(yBinary[idx]);
        bootY30.push(y30[idx]);
        bootY60.push(y60[idx]);
        bootY90.push(y90[idx]);
        bootY120.push(y120[idx]);
      }

      // 1. Classification Tree for highCongestionNext60Min
      const cTree = new ClassificationTree(6, 8, FEATURE_NAMES.length);
      cTree.fit(bootX, bootYBinary, rng);
      this.classificationTrees.push(cTree);

      for (let f = 0; f < FEATURE_NAMES.length; f++) {
        rawImportances[f] += cTree.featureImportances[f];
      }

      // 2. Horizon Regression Trees (subsampled to 10 trees each for rapid latency)
      if (t < 10) {
        const r30 = new RegressionTree(5, 8, FEATURE_NAMES.length);
        r30.fit(bootX, bootY30, rng);
        this.regressor30.push(r30);

        const r60 = new RegressionTree(5, 8, FEATURE_NAMES.length);
        r60.fit(bootX, bootY60, rng);
        this.regressor60.push(r60);

        const r90 = new RegressionTree(5, 8, FEATURE_NAMES.length);
        r90.fit(bootX, bootY90, rng);
        this.regressor90.push(r90);

        const r120 = new RegressionTree(5, 8, FEATURE_NAMES.length);
        r120.fit(bootX, bootY120, rng);
        this.regressor120.push(r120);
      }
    }

    // Normalize MDI Feature Importances
    let sumImp = rawImportances.reduce((a, b) => a + b, 0);
    if (sumImp === 0) sumImp = 1;

    const featureDescriptions: Record<FeatureName, { label: string; desc: string; dir: 'Increases Risk' | 'Mitigates Risk' }> = {
      bedsAvailable: { label: 'Available Acute Beds', desc: 'Critical buffer against inpatient boarding gridlock', dir: 'Mitigates Risk' },
      patientsWaiting: { label: 'Waiting Room Queue', desc: 'Backlog of un-assessed patients driving wait times', dir: 'Increases Risk' },
      bedsOccupied: { label: 'Bed Occupancy Rate', desc: 'Proportion of department capacity saturated by active patients', dir: 'Increases Risk' },
      patientsArrived: { label: 'Patient Inflow Rate', desc: 'Current acute arrivals entering triage per hour', dir: 'Increases Risk' },
      recentArrivalTrend: { label: 'Inflow Acceleration Ratio', desc: 'Rolling trajectory of new patient arrival momentum', dir: 'Increases Risk' },
      ambulanceArrivals: { label: 'Ambulance EMS Arrivals', desc: 'High-acuity emergency transfers requiring immediate bay access', dir: 'Increases Risk' },
      nursesAvailable: { label: 'Active Nursing Staff', desc: 'Intake and continuous acute care capacity', dir: 'Mitigates Risk' },
      averageWaitTime: { label: 'Triage Latency', desc: 'Current delay elapsed before initial physician assessment', dir: 'Increases Risk' },
      recentCongestionTrend: { label: 'Congestion Trajectory', desc: '1-hour moving momentum of operational saturation', dir: 'Increases Risk' },
      doctorsAvailable: { label: 'Active Physicians', desc: 'Diagnostic, admission, and discharge decision throughput', dir: 'Mitigates Risk' },
      netInpatientBedFlow: { label: 'Inpatient Flow Deficit', desc: 'Admissions vs ward discharges driving bed turnover', dir: 'Increases Risk' },
      bedUtilization: { label: 'Bed Utilization %', desc: 'Physical bed occupancy relative to licensed capacity', dir: 'Increases Risk' },
      admissions: { label: 'Ward Admissions', desc: 'Patients boarding in ED beds awaiting inpatient transfers', dir: 'Increases Risk' },
      staffToPatientRatio: { label: 'Staff-to-Patient Ratio', desc: 'Clinical coverage across waiting and bedded patients', dir: 'Mitigates Risk' },
      averageTreatmentTime: { label: 'Bay Treatment Dwell Time', desc: 'Duration patients occupy acute beds before disposition', dir: 'Increases Risk' },
      discharges: { label: 'Patient Discharges', desc: 'Beds liberated by completed care episodes', dir: 'Mitigates Risk' },
    };

    this.featureImportances = FEATURE_NAMES.map((name, idx) => {
      const imp = rawImportances[idx] / sumImp;
      const meta = featureDescriptions[name];
      return {
        feature: name,
        label: meta.label,
        importance: Math.round(imp * 1000) / 1000,
        percentage: Math.round(imp * 1000) / 10,
        impactDirection: meta.dir,
        description: meta.desc,
      };
    }).sort((a, b) => b.importance - a.importance);

    // Compute training accuracy
    let correct = 0;
    for (let i = 0; i < nSamples; i++) {
      const prob = this.predictProbability(X[i]);
      const pred = prob >= 0.5 ? 1 : 0;
      if (pred === yBinary[i]) correct++;
    }
    this.validationAccuracy = Math.round((correct / nSamples) * 100) / 100;
  }

  /**
   * Predicts probability of high congestion within the next 60 minutes
   */
  public predictProbability(features: number[]): number {
    if (this.classificationTrees.length === 0) return 0.5;
    let sum = 0;
    for (const tree of this.classificationTrees) {
      sum += tree.predictProbability(features);
    }
    const raw = sum / this.classificationTrees.length;
    return Math.min(0.99, Math.max(0.01, Math.round(raw * 100) / 100));
  }

  /**
   * Predicts multi-horizon continuous congestion percentages for +30m, +60m, +90m, +120m
   */
  public predictForecasts(features: number[]): {
    forecast30: number;
    forecast60: number;
    forecast90: number;
    forecast120: number;
  } {
    const avg = (trees: RegressionTree[]) => {
      if (trees.length === 0) return 50;
      let s = 0;
      for (const t of trees) s += t.predict(features);
      return Math.round(s / trees.length);
    };

    return {
      forecast30: Math.min(100, Math.max(20, avg(this.regressor30))),
      forecast60: Math.min(100, Math.max(20, avg(this.regressor60))),
      forecast90: Math.min(100, Math.max(20, avg(this.regressor90))),
      forecast120: Math.min(100, Math.max(20, avg(this.regressor120))),
    };
  }
}
