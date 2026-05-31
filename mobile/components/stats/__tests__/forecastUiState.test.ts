import { describe, expect, it } from 'vitest';

import {
  FORECAST_CONFIDENCE_CAPTION,
  forecastSectionView,
  forecastUiState,
} from '../forecastUiState';

describe('forecastUiState', () => {
  it('is cold below the forecast gate (0–6)', () => {
    expect(forecastUiState(0)).toBe('cold');
    expect(forecastUiState(6)).toBe('cold');
  });

  it('is warming at the gate through 13 (7–13)', () => {
    expect(forecastUiState(7)).toBe('warming');
    expect(forecastUiState(13)).toBe('warming');
  });

  it('is mature at the mature threshold and above (14+)', () => {
    expect(forecastUiState(14)).toBe('mature');
    expect(forecastUiState(99)).toBe('mature');
  });

  it('defensively reads a non-finite / negative count as cold', () => {
    expect(forecastUiState(Number.NaN)).toBe('cold');
    expect(forecastUiState(-3)).toBe('cold');
  });
});

describe('FORECAST_CONFIDENCE_CAPTION', () => {
  it('uses the exact S5.2 captions; cold has none (badge instead)', () => {
    expect(FORECAST_CONFIDENCE_CAPTION.cold).toBeNull();
    expect(FORECAST_CONFIDENCE_CAPTION.warming).toBe('Forecast confidence: low');
    expect(FORECAST_CONFIDENCE_CAPTION.mature).toBe('Forecast confidence: high');
  });
});

describe('forecastSectionView (audit #7)', () => {
  it('shows the cold view (with countdown) only when truly cold', () => {
    expect(forecastSectionView({ state: 'cold', hasShape: false })).toBe('cold');
    // Cold stays cold even if a shape leaks in — count is below the gate.
    expect(forecastSectionView({ state: 'cold', hasShape: true })).toBe('cold');
  });

  it('shows the chart when gated-in and the shape is present', () => {
    expect(forecastSectionView({ state: 'warming', hasShape: true })).toBe('chart');
    expect(forecastSectionView({ state: 'mature', hasShape: true })).toBe('chart');
  });

  it('shows a neutral placeholder — NOT a negative countdown — when count ≥ gate but the shape is missing', () => {
    expect(forecastSectionView({ state: 'warming', hasShape: false })).toBe('placeholder');
    expect(forecastSectionView({ state: 'mature', hasShape: false })).toBe('placeholder');
  });
});
