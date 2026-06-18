import { create } from 'zustand';

const useScanStore = create((set) => ({
  latestScan: null,       // most recent completed scan payload
  scanHistory: [],        // list of ScanHistoryItem
  isProcessing: false,    // true while poll loop is running
  currentScanId: null,    // scan_id being polled

  setProcessing: (value) => set({ isProcessing: value }),

  setCurrentScanId: (id) => set({ currentScanId: id }),

  setLatestScan: (scan) => set({ latestScan: scan }),

  prependHistory: (historyItem) =>
    set((state) => ({ scanHistory: [historyItem, ...state.scanHistory] })),

  setHistory: (items) => set({ scanHistory: items }),

  removeScanFromHistory: (scanId) =>
    set((state) => ({
      scanHistory: state.scanHistory.filter((s) => s.id !== scanId),
      latestScan:
        state.latestScan?.scan_id === scanId ? null : state.latestScan,
    })),

  reset: () => set({ latestScan: null, scanHistory: [], isProcessing: false, currentScanId: null }),
}));

export default useScanStore;
