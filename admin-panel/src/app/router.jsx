import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ROUTES } from '../config/routes'
import CreateAccountPage from '../features/auth/pages/CreateAccountPage'
import VerifyAccountPage from '../features/auth/pages/VerifyAccountPage'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import ClinicalSpecialtiesPage from '../features/onboarding/pages/ClinicalSpecialtiesPage'
import ClinicProfilePage from '../features/onboarding/pages/ClinicProfilePage'
import OperationalInfoPage from '../features/onboarding/pages/OperationalInfoPage'
import PracticeContactPage from '../features/onboarding/pages/PracticeContactPage'
import SetupCompletePage from '../features/onboarding/pages/SetupCompletePage'
import SetupIntroPage from '../features/onboarding/pages/SetupIntroPage'

export const routes = [
  { path: ROUTES.root, element: <Navigate to={ROUTES.setup} replace /> },

  { path: ROUTES.signup, element: <CreateAccountPage /> },
  { path: ROUTES.verify, element: <VerifyAccountPage /> },

  { path: ROUTES.setup, element: <SetupIntroPage /> },
  { path: ROUTES.clinic, element: <ClinicProfilePage /> },
  { path: ROUTES.contact, element: <PracticeContactPage /> },
  { path: ROUTES.operations, element: <OperationalInfoPage /> },
  { path: ROUTES.specialties, element: <ClinicalSpecialtiesPage /> },
  { path: ROUTES.complete, element: <SetupCompletePage /> },

  { path: ROUTES.dashboard, element: <DashboardPage /> },

  { path: '*', element: <Navigate to={ROUTES.setup} replace /> },
]

export const router = createBrowserRouter(routes)
