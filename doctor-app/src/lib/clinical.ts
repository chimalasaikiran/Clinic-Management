export const inRange = (text: string, min: number, max: number) => {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value >= min && value <= max;
};

/** Body mass index to one decimal place, or null when either measure is missing. */
export function bodyMassIndex(heightCm: number, weightKg: number): number | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/** The label shown beside a blood pressure reading (ACC/AHA bands). */
export function bloodPressureStage(systolic: number, diastolic: number) {
  if (systolic >= 140 || diastolic >= 90) return 'HIGH · Stage 2 HTN';
  if (systolic >= 130 || diastolic >= 80) return 'HIGH · Stage 1 HTN';
  if (systolic >= 120) return 'ELEVATED';
  return 'NORMAL';
}
