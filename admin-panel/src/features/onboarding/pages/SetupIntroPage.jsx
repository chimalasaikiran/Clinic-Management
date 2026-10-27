import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import AppTopBar from '../../../components/layout/AppTopBar'
import Button from '../../../components/ui/Button'
import InsetIcon from '../../../components/ui/InsetIcon'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import SetupShowcase from '../components/SetupShowcase'
import { SETUP_ROADMAP } from '../data/setupRoadmap'

const pad = (value) => String(value).padStart(2, '0')

function RoadmapItem({ item, index }) {
  return (
    <li className="-mx-2.5 flex items-start rounded-xl border border-transparent p-[11px]">
      <span
        className={cn(
          'mr-3.5 flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold',
          item.current
            ? 'border-teal-100 bg-teal-50 text-teal-700'
            : 'border-slate-200 bg-slate-100/80 text-slate-600',
        )}
      >
        {pad(index + 1)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className={cn('text-sm leading-5 font-semibold', item.current ? 'text-ink' : 'text-slate-800')}>
            {item.title}
          </h3>
          {item.current ? (
            <span className="rounded border border-teal-200 bg-teal-50 px-[7px] py-[3px] text-[10px] leading-[15px] font-medium text-teal-700">
              Current
            </span>
          ) : (
            <span className="font-mono text-[11px] leading-[16.5px] text-slate-400">{item.meta}</span>
          )}
        </div>
        <p className="text-xs leading-4 text-slate-500">{item.description}</p>
      </div>
    </li>
  )
}

export default function SetupIntroPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppTopBar />
      <main className="flex flex-1 flex-col lg:flex-row">
        <SetupShowcase />

        <section className="flex flex-1 flex-col justify-between bg-[#fafafa] lg:border-l lg:border-slate-200">
          <div className="flex flex-col gap-2 px-5 pt-8 pb-4 sm:px-14">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className="inline-flex items-center rounded-full border border-teal-200/70 bg-teal-50 px-[11px] py-[5px]">
                <span className="size-1.5 rounded-full bg-teal-600" />
                <span className="pl-1.5 text-[11px] leading-[16.5px] font-bold tracking-[0.55px] text-teal-800 uppercase">
                  Step 01 of 05 · Initialization
                </span>
              </span>
              <span className="text-xs font-semibold tracking-[1.2px] text-slate-400 uppercase">Production v4.2</span>
            </div>

            <p className="pt-[11px] text-[11px] leading-[16.5px] font-bold tracking-[1.1px] text-teal-700 uppercase">
              Clinic setup
            </p>
            <h1 className="text-4xl leading-10 font-extrabold tracking-[-0.9px] text-ink">Set up your clinic</h1>
            <p className="max-w-lg pt-[3px] text-[15px] leading-[24.38px] text-slate-600">
              Configure your clinic once, and we'll tailor the workspace around how your clinic operates.
            </p>

            <div className="mt-7 flex items-center justify-between border-b border-slate-200/80 pb-[13px]">
              <span className="font-mono text-[11px] leading-[16.5px] font-bold tracking-[0.55px] text-slate-500 uppercase">
                You'll configure
              </span>
              <span className="text-[11px] leading-[16.5px] font-medium text-slate-400">Auto-synced</span>
            </div>

            <ol className="mt-[11px] flex flex-col gap-[3px]">
              {SETUP_ROADMAP.map((item, index) => (
                <RoadmapItem key={item.id} item={item} index={index} />
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-200/80 bg-white px-5 pt-[33px] pb-8 sm:px-14">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button
                className="rounded-xl px-7 py-3.5"
                onClick={() => navigate(ROUTES.signup)}
                trailing={
                  <InsetIcon
                    src={icons.arrowRightInset}
                    size={16}
                    inset={[20.83, 12.5, 20.83, 12.5]}
                    bleed={[-8.04, -6.25]}
                  />
                }
              >
                Begin setup
              </Button>
              <p className="text-xs leading-4 font-medium text-slate-500">
                Already have an account?{' '}
                <TextLink tone="teal" underline className="font-semibold decoration-teal-300">
                  Sign in
                </TextLink>
              </p>
            </div>
            <p className="flex items-center gap-2 text-[11px] leading-[16.5px] font-medium text-slate-400">
              <img src={icons.clock} alt="" />
              Approx. 8–10 minutes · Saves automatically as you progress
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
