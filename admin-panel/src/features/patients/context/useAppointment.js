import { useParams } from 'react-router-dom'
import { useApiResource } from '../../../hooks/useApiResource'
import { toAppointmentView } from '../adapters'
import { appointmentsApi } from '../api'
import { usePatient } from './usePatient'

// Patient and appointment named by the route, with the appointment's full history loaded from the API.
// `appointment` is undefined while loading and for a bad link (or an appointment of another patient).
export function useAppointment() {
  const context = usePatient()
  const { appointmentId } = useParams()
  const resource = useApiResource(() => appointmentsApi.get(appointmentId).then(toAppointmentView), appointmentId)

  // After a change: reload this appointment and the patient's history so every screen agrees.
  const reload = async () => {
    resource.reload()
    await context.refresh()
  }

  const appointment = resource.data?.id === appointmentId ? resource.data : undefined
  const belongs = appointment && context.patient && appointment.patientId === context.patient.id
  return {
    ...context,
    appointmentId,
    appointment: belongs ? appointment : undefined,
    loading: context.loading || (resource.loading && !appointment),
    reload,
  }
}
