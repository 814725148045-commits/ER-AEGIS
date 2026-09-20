import { generateSyntheticHospitalData, summarizeDataset } from './syntheticDataGenerator';
import { extractFeaturesFromInput, extractTrainingDataset } from './featureEngineering';
import { HospitalCongestionRandomForest } from './randomForest';
import {
  SyntheticHospitalRecord,
  DatasetSummary,
  PredictionInput,
  PredictionOutput,
} from './types';

/**
 * ER-AEGIS ML Prediction Service
 * 
 * Manages the training and inference lifecycle for the Emergency Department
 * congestion intelligence model. Operates as an in-process Random Forest ensemble,
 * with clean pluggable hooks for external Python FastAPI ML microservices.
 */
class MLPredictionService {
  private dataset: SyntheticHospitalRecord[] = [];
  private datasetSummary: DatasetSummary | null = null;
  private randomForest: HospitalCongestionRandomForest;
  private isTrained: boolean = false;

  constructor() {
    this.randomForest = new HospitalCongestionRandomForest(20, 2026);
    this.initializeAndTrain();
  }

  /**
   * Generates the 7-day 15-minute synthetic dataset and trains the Random Forest model
   */
  public initializeAndTrain(): void {
    if (this.isTrained) return;

    // 1. Generate 7-day realistic synthetic hospital operations dataset (672 intervals)
    this.dataset = generateSyntheticHospitalData({ days: 7, seed: 42 });
    this.datasetSummary = summarizeDataset(this.dataset);

    // 2. Extract feature matrices and supervision targets
    const { X, yBinary, yContinuous30, yContinuous60, yContinuous90, yContinuous120 } =
      extractTrainingDataset(this.dataset);

    // 3. Train Random Forest ensemble
    this.randomForest.fit(
      X,
      yBinary,
      yContinuous30,
      yContinuous60,
      yContinuous90,
      yContinuous120
    );

    this.isTrained = true;
  }

  /**
   * Primary inference method: predicts high congestion probability and multi-step forecast
   */
  public predictCongestion(input: PredictionInput): PredictionOutput {
    if (!this.isTrained) {
      this.initializeAndTrain();
    }

    const { features } = extractFeaturesFromInput(input);

    // Compute binary probability for highCongestionNext60Min
    const prob = this.randomForest.predictProbability(features);

    // Compute continuous multi-horizon forecasts
    const forecasts = this.randomForest.predictForecasts(features);

    // Operational level classification
    let predictedCongestionLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    if (prob < 0.35) {
      predictedCongestionLevel = 'NORMAL';
    } else if (prob < 0.65) {
      predictedCongestionLevel = 'ELEVATED';
    } else if (prob < 0.85) {
      predictedCongestionLevel = 'HIGH';
    } else {
      predictedCongestionLevel = 'CRITICAL';
    }

    // Confidence metric (model is most confident when probabilities are close to 0 or 1)
    const confidenceScore = Math.round((0.5 + Math.abs(prob - 0.5)) * 100) / 100;

    return {
      congestionProbability: prob,
      predictedCongestionLevel,
      forecast: {
        '30': Math.round(forecasts.forecast30) / 100,
        '60': Math.round(forecasts.forecast60) / 100,
        '90': Math.round(forecasts.forecast90) / 100,
        '120': Math.round(forecasts.forecast120) / 100,
      },
      forecastPercentages: {
        '30': forecasts.forecast30,
        '60': forecasts.forecast60,
        '90': forecasts.forecast90,
        '120': forecasts.forecast120,
      },
      confidence: confidenceScore,
      featureImportance: this.randomForest.featureImportances.slice(0, 8),
      modelMetadata: {
        algorithm: 'Random Forest Ensemble (20 Trees with Bagging & Feature Subspace)',
        ensembleSize: 20,
        trainingSamples: this.dataset.length,
        trainingHorizon: '7 Days (672 intervals @ 15-min frequency)',
        targetDefinition: 'highCongestionNext60Min (ED enters >=80% congestion or acute bed exhaustion in next 60m)',
        validationAccuracy: this.randomForest.validationAccuracy,
        apiReady: true,
        pythonFastApiSpec: 'POST /api/predict (Standardized JSON payload)',
        lastTrainedAt: this.randomForest.trainedAt,
      },
    };
  }

  public getSyntheticDataset(): SyntheticHospitalRecord[] {
    if (!this.isTrained) this.initializeAndTrain();
    return this.dataset;
  }

  public getDatasetSummary(): DatasetSummary {
    if (!this.isTrained || !this.datasetSummary) {
      this.initializeAndTrain();
    }
    return this.datasetSummary!;
  }
}

export const mlPredictionService = new MLPredictionService();
