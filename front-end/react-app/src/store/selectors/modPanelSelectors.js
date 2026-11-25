import { createSelector } from '@reduxjs/toolkit';
import { QUEUE_TABS } from '../../Components/platform/data/modPanelData';
import { selectModReports } from '../slices/modPanelSlice';

export const selectModPanelUi = (state) => state.modPanel.ui;

export const selectFilteredModReports = createSelector(
  [selectModReports, (state) => selectModPanelUi(state).activeQTab, (state) => selectModPanelUi(state).queueSearch],
  (reports, tab, search) => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => report.status === tab && (!query ||
      [report.reportedUser, report.ref, report.reason].some((value) => value?.toLowerCase().includes(query))));
  },
);

export const selectSelectedModReport = createSelector(
  [selectModReports, (state) => selectModPanelUi(state).selectedId],
  (reports, id) => reports.find((report) => report.id === id) || reports[0] || null,
);

export const selectModQueueCounts = createSelector([selectModReports], (reports) => {
  const counts = Object.fromEntries(QUEUE_TABS.map((status) => [status, 0]));
  for (const { status } of reports) {
    if (Object.hasOwn(counts, status)) counts[status] += 1;
  }
  return counts;
});
