/** Checks and calculations for the nurse's vital signs entry. */

export const vitalFields = {
  systolic: { label: 'Systolic pressure', min: 60, max: 260, decimals: false },
  diastolic: { label: 'Diastolic pressure', min: 30, max: 160, decimals: false },
  heartRate: { label: 'Heart rate', min: 25, max: 250, decimals: false },
  spo2: { label: 'SpO₂', min: 50, max: 100, decimals: false },
  temperature: { label: 'Temperature', min: 30, max: 45, decimals: true },
  respiration: { label: 'Respiration rate', min: 5, max: 60, decimals: false },
  height: { label: 'Height', min: 50, max: 230, decimals: true },
  weight: { label: 'Weight', min: 2, max: 300, decimals: true },
} as const;

export type VitalKey = keyof typeof vitalFields;
export type VitalEntry = Record<VitalKey, string>;

export const emptyVitals: VitalEntry = {
  systolic: '',
  diastolic: '',
  heartRate: '',
  spo2: '',
  temperature: '',
  respiration: '',
  height: '',
  weight: '',
};

/** Reads a typed value, or null when it is missing or outside what a person can measure. */
export function vitalValue(key: VitalKey, text: string) {
  const { min, max, decimals } = vitalFields[key];
  if (!(decimals ? /^\d+(\.\d)?$/ : /^\d+$/).test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/** Returns what stops the entry being saved, or an empty string. */
export function vitalsProblem(entry: VitalEntry) {
  for (const key of Object.keys(vitalFields) as VitalKey[]) {
    if (vitalValue(key, entry[key]) === null) {
      const { label, min, max } = vitalFields[key];
      return `${label}: enter a value from ${min} to ${max}.`;
    }
  }
  return Number(entry.diastolic) < Number(entry.systolic)
    ? ''
    : 'Diastolic pressure must be lower than systolic pressure.';
}

export function bpCategory(systolic: number, diastolic: number) {
  if (systolic >= 140 || diastolic >= 90) return 'Stage 2 HTN';
  if (systolic >= 130 || diastolic >= 80) return 'Stage 1 HTN';
  if (systolic < 90 || diastolic < 60) return 'Low BP';
  return systolic >= 120 ? 'Elevated' : 'Normal';
}

/** Body mass index to one decimal place, from centimetres and kilograms. */
export function bodyMassIndex(heightCm: number, weightKg: number) {
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export const fahrenheit = (celsius: number) => Math.round((celsius * 1.8 + 32) * 10) / 10;
