import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ActionsPage } from './components/actions/ActionsPage';
import { BacklogDrilldown } from './components/backlog/BacklogDrilldown';
import { DataDictionaryPage } from './components/dictionary/DataDictionaryPage';
import { InvoicesDrilldown } from './components/invoices/InvoicesDrilldown';
import { LeadTimeDrilldown } from './components/leadTime/LeadTimeDrilldown';
import { MissingEsdDrilldown } from './components/missingEsd/MissingEsdDrilldown';
import { RawDataPage } from './components/rawData/RawDataPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { RootCauseDrilldown } from './components/rootCause/RootCauseDrilldown';
import { SotOtifDrilldown } from './components/sotOtif/SotOtifDrilldown';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/actions" element={<ActionsPage />} />
      <Route path="/backlog" element={<BacklogDrilldown />} />
      <Route path="/data-dictionary" element={<DataDictionaryPage />} />
      <Route path="/invoices" element={<InvoicesDrilldown />} />
      <Route path="/lead-time" element={<LeadTimeDrilldown />} />
      <Route path="/missing-esd" element={<MissingEsdDrilldown />} />
      <Route path="/raw-data" element={<RawDataPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/root-cause" element={<RootCauseDrilldown />} />
      <Route path="/sot-otif" element={<SotOtifDrilldown />} />
    </Routes>
  );
}
