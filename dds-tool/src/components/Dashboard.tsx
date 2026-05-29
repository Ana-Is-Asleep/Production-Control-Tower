'use client';

import { useState, useMemo } from 'react';
import { FilterBar } from './filters/FilterBar';
import { SOTOTIFCard } from './cards/SOTOTIFCard';
import { BacklogCard } from './cards/BacklogCard';
import { SKUDeepDive } from './cards/SKUDeepDive';
import { InvoicesCard } from './cards/InvoicesCard';
import { NotBookedCard } from './cards/NotBookedCard';
import { PickupDistributionCard } from './cards/PickupDistributionCard';
import { UploadPanel } from './upload/UploadPanel';
import { OpenActions } from './shared/OpenActions';
import { useFilters } from '../hooks/useFilters';
import { useAnnotations } from '../hooks/useAnnotations';
import { useKPIs } from '../hooks/useKPIs';
import type { PurchaseLine } from '../types';
import { computeKPI } from '../lib/kpiFormulas';

export function Dashboard() {
  // starts empty, user uploads BC files to populate
  const [allLines, setAllLines] = useState<PurchaseLine[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { filters, setFilters, weeklyLines, accumulatingLines, allSuppliers, lastWeek, lastYear } = useFilters(allLines);
  const annotations = useAnnotations();
  const kpis = useKPIs(weeklyLines, accumulatingLines);

  const allAnnotated = useMemo(() => {
    if (kpis.failingLines.length === 0) return true;
    return kpis.failingLines.every((l) => annotations.isAnnotated(`${l.po}-${l.line}`));
  }, [kpis.failingLines, annotations]);

  const handleLoad = (lines: PurchaseLine[]) => {
    setAllLines(lines);
    annotations.reset();
  };

  return (
    <div className="min-h-screen w-full bg-canvas">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        allSuppliers={allSuppliers}
        lastWeek={lastWeek}
        lastYear={lastYear}
        onOpenUpload={() => setUploadOpen(true)}
        allAnnotated={allAnnotated}
      />

      <div className="grid grid-cols-5 gap-4 p-4">
        <div className="col-span-3">
          <SOTOTIFCard
            sotPct={kpis.sotPct}
            otifPct={kpis.otifPct}
            weeklyTrend={kpis.weeklyTrend}
            failingLines={kpis.failingLines}
            annotations={annotations.entries}
            onUpdateAnnotation={(key, data) => {
              if (annotations.entries[key]) annotations.updateAnnotation(key, data);
              else annotations.addAnnotation(key, data);
            }}
            tmComment={annotations.tmComment}
            setTmComment={annotations.setTmComment}
            tmName={annotations.tmName}
            setTmName={annotations.setTmName}
            weeklyLines={weeklyLines}
          />
        </div>
        <div className="col-span-2">
          <BacklogCard backlog={kpis.backlogSummary} />
        </div>

        <div className="col-span-5 grid grid-cols-4 gap-4">
          <SKUDeepDive lines={weeklyLines} />
          <InvoicesCard />
          <NotBookedCard lines={kpis.notBookedLines} />
          <PickupDistributionCard lines={weeklyLines} />
        </div>
      </div>

      <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} onLoad={handleLoad} />
      <OpenActions />
    </div>
  );
}
