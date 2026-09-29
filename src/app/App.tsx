import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Toaster } from '../components/ui/Toaster';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { transitions } from '../components/ui/motion';
import { ForeignDataScreen, LoginScreen, NotConfiguredScreen, SetInitialPasswordScreen } from '../features/auth/AuthScreens';
import { useAuthStore } from '../features/auth/authStore';
import { DayEditorSheet } from '../features/day-editor/DayEditorSheet';
import { MonthView } from '../features/monthly/MonthView';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { WeekView } from '../features/overview/WeekView';
import { SettingsView } from '../features/settings/SettingsView';
import { useAppData } from '../hooks/useAppData';
import { useUiStore } from '../stores/uiStore';
import { AppDataContext } from './AppDataContext';
import { TabBar } from './TabBar';

export function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthGate />
        <Toaster />
      </MotionConfig>
    </ErrorBoundary>
  );
}

/** Anmeldung vor allem anderen: erst mit gültiger Sitzung werden die lokalen Daten geladen. */
function AuthGate() {
  const auth = useAuthStore((s) => s.state);
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  switch (auth.status) {
    case 'loading':
      return null;
    case 'not-configured':
      return <NotConfiguredScreen />;
    case 'signed-out':
      return <LoginScreen />;
    case 'must-change-password':
      return <SetInitialPasswordScreen user={auth.user} />;
    case 'foreign-data':
      return <ForeignDataScreen user={auth.user} />;
    case 'signed-in':
      return <Root />;
  }
}

function Root() {
  const data = useAppData();
  if (data.status === 'loading') return null;
  if (data.status === 'error') return <StorageError />;
  if (data.status === 'onboarding') return <OnboardingFlow />;
  return (
    <AppDataContext.Provider value={{ profile: data.profile, ctx: data.ctx }}>
      <MainShell />
    </AppDataContext.Provider>
  );
}

function MainShell() {
  const activeTab = useUiStore((s) => s.activeTab);
  return (
    <>
      <main className="safe-top mx-auto min-h-dvh max-w-lg px-5 pb-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transitions.micro}
          >
            {activeTab === 'overview' && <WeekView />}
            {activeTab === 'month' && <MonthView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar />
      <DayEditorSheet />
    </>
  );
}

function StorageError() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-[22px] font-semibold">Daten konnten nicht geladen werden</h1>
      <p className="text-[15px] text-ink-2">
        Der lokale Speicher deines Browsers ist nicht verfügbar. Bitte öffne die App nicht im privaten Modus und lade sie
        neu.
      </p>
    </div>
  );
}
