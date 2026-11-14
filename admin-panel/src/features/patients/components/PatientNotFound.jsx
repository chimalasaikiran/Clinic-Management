import { UserX } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { ROUTES } from '../../../config/routes'
import EmptyState from './EmptyState'

export default function PatientNotFound({ title = 'Patient record not found' }) {
  return (
    <EmptyState icon={UserX} title={title} action={<ActionButton to={ROUTES.patients}>Back to patients</ActionButton>}>
      No patient with this ID exists in the master directory. Search the directory by name, mobile number or MRN.
    </EmptyState>
  )
}
