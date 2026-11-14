import { useParams } from 'react-router-dom'
import { usePatient } from './usePatient'

// Patient and appointment named by the route, plus the store. Either can be undefined for a bad link.
export function useAppointment() {
  const context = usePatient()
  const { appointmentId } = useParams()
  const appointment = context.find('appointments', appointmentId)
  return { ...context, appointmentId, appointment: appointment?.patientId === context.patient?.id ? appointment : undefined }
}
