import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import OnboardingLayout from '../components/OnboardingLayout'
import { COMPLETED_FOUNDATIONS, NEXT_CAPABILITIES } from '../data/setupSummary'

export default function SetupCompletePage() {
  const navigate = useNavigate()

  return (
    <OnboardingLayout formSide="left">
      <div className="flex flex-col">
        <p className="flex items-center gap-2 pb-3 text-xs leading-4 font-semibold tracking-[0.6px] text-slate-600 uppercase">
          <span className="size-2 rounded-full bg-emerald-500" />
          ClinicOS setup
        </p>
        <h1 className="text-3xl leading-10 font-bold tracking-[-0.9px] text-slate-900 sm:text-4xl">
          Your clinic is ready to go.
        </h1>
        <p className="pt-3.5 text-base leading-[26px] text-slate-600">
          The essentials are configured. You can continue setting up additional capabilities from your workspace
          whenever you're ready.
        </p>

        <section className="flex flex-col gap-3.5 pt-[31px]">
          <h2 className="text-[11px] leading-[16.5px] font-bold tracking-[0.55px] text-slate-500 uppercase">
            Setup completed
          </h2>
          <ul className="flex flex-col gap-3">
            {COMPLETED_FOUNDATIONS.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-[17px]"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <img src={icons.completeCheck} alt="" />
                  </span>
                  <div className="flex flex-col">
                    <h3 className="text-sm leading-5 font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-xs leading-4 text-slate-600">{item.description}</p>
                  </div>
                </div>
                <span className="hidden text-xs leading-4 font-medium text-slate-400 sm:block">Configured</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-[21px]">
          <div className="flex items-start gap-3">
            <span className="pt-0.5">
              <img src={icons.infoCircle} alt="" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-xs leading-4 font-semibold text-slate-900">
                Continue configuring from your workspace
              </h2>
              <p className="text-xs leading-[19.5px] text-slate-600">
                Add services, staff, billing, branches and other capabilities whenever you're ready.
              </p>
              <ul className="flex flex-wrap gap-2 pt-3">
                {NEXT_CAPABILITIES.map((capability) => (
                  <li
                    key={capability}
                    className="rounded-md border border-slate-200 bg-white px-[11px] pt-1 pb-[5.5px] text-[11px] leading-[16.5px] font-medium text-slate-600"
                  >
                    {capability}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3.5 pt-8">
          <Button
            fullWidth
            onClick={() => navigate(ROUTES.dashboard)}
            trailing={<img src={icons.completeArrow} alt="" />}
          >
            Go to my workspace
          </Button>
          <div className="flex justify-center pt-0.5">
            <TextLink to={ROUTES.setup} className="py-1 text-xs leading-4 font-semibold text-slate-600">
              Review setup
            </TextLink>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
