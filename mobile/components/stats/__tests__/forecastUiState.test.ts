import { describe, expect, it } from 'vitest';

import {
  FORECAST_CONFIDENCE_CAPTION,
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
