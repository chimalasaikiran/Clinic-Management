// The vitals drawer's record in the shape the API takes.
export const toVitalsRequest = (record, encounterId) => ({
  encounterId, systolic: record.bp.sys, diastolic: record.bp.dia, pulse: record.pulse, respiration: record.resp, temperatureF: record.temp, spo2: record.spo2,
  weightKg: record.weight, heightCm: record.height, bloodSugar: record.rbs ?? undefined, painScore: record.pain ?? undefined, site: record.site, posture: record.posture, device: record.device,
})
