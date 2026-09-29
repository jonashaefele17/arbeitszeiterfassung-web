import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { PageHeader, TodayButton } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { ChevronLeft, ChevronRight, ShareIcon } from '../../components/ui/icons';
import { AnimatedHeight } from '../../components/ui/AnimatedHeight';
import { transitions } from '../../components/ui/motion';
import { balanceForMonth, resolveMonth, summarize, vacationAccount } from '../../domain/calculations/summary';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useUiStore } from '../../stores/uiStore';
import { compareYearMonth, formatMonth, sameYearMonth, shiftMonth, yearMonthOf } from '../../utils/date';
import { runSafely } from '../../utils/errors';
import { MonthCalendar } from './MonthCalendar';
import { MonthStats } from './MonthStats';
import { SyncBadge } from '../sync/SyncBadge';

export function MonthView() {
  const { ctx, profile } = useReadyData();
  const month = useUiStore((s) => s.currentMonth);
  const setMonth = useUiStore((s) => s.setMonth);
  const goToToday = useUiStore((s) => s.goToToday);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [exporting, setExporting] = useState(false);

  const todayMonth = yearMonthOf(ctx.today);
  const days = useMemo(() => resolveMonth(month, ctx), [month, ctx]);
  const summary = useMemo(() => summarize(days, ctx), [days, ctx]);
  const balance = useMemo(() => balanceForMonth(month, ctx), [month, ctx]);
  const vacation = useMemo(
    () => vacationAccount(month.year, profile.vacationDaysPerYear, ctx),
    [month.year, profile.vacationDaysPerYear, ctx],
  );

  const go = (amount: 1 | -1) => {
    setDirection(amount);
    setMonth(shiftMonth(month, amount));
  };
  const swipe = useHorizontalSwipe(go);

  const exportPdf = async () => {
    setExporting(true);
    await runSafely(async () => {
      const { exportMonthlyPdf } = await import('./pdf/exportMonthlyPdf');
      await exportMonthlyPdf({ month, days, summary, balance, profile, ctx });
    }, 'Das PDF konnte nicht erstellt werden.');
    setExporting(false);
  };

  return (
    <div>
      <PageHeader
        accessory={<SyncBadge />}
        title={formatMonth(month)}
        subtitle={String(month.year)}
        actions={
          <>
            <TodayButton
              active={!sameYearMonth(month, todayMonth)}
              onClick={() => {
                setDirection(compareYearMonth(month, todayMonth) < 0 ? 1 : -1);
                goToToday();
              }}
            />
            <IconButton label="Vorheriger Monat" onClick={() => go(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Nächster Monat" onClick={() => go(1)}>
              <ChevronRight />
            </IconButton>
          </>
        }
      />

      {/* Nur der Kalender wird gewischt und animiert; die Statistiken darunter bleiben stehen. */}
      <AnimatedHeight>
        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={`${month.year}-${month.month}`}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d * 40, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d * -40, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transitions.standard}
              {...swipe}
              className="touch-pan-y"
            >
              <MonthCalendar month={month} days={days} today={ctx.today} />
            </motion.div>
          </AnimatePresence>
        </div>
      </AnimatedHeight>
      <MonthStats summary={summary} balance={balance} vacation={vacation} />

      <div className="pt-6">
        <Button block variant="secondary" onClick={exportPdf} disabled={exporting} className="gap-2">
          <ShareIcon />
          {exporting ? 'PDF wird erstellt …' : 'PDF exportieren'}
        </Button>
      </div>
    </div>
  );
}
