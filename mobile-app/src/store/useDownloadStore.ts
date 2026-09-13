import { create } from 'zustand';
import { generateReportFile } from '../components/Download/pdfGenerator';
import { ReportOptions } from '../types/download.types';

interface DownloadStore {
  isGenerating: boolean;
  /**
   * Builds the report file and returns its local URI.
   * Errors are re-thrown so the caller can surface them — this store previously
   * swallowed them into an `error` field that no component ever read, which is
   * why a failed download looked like a silent no-op.
   * Saving / sharing is the caller's job (see DownloadOptionsModal).
   */
  generateFile: (options: ReportOptions) => Promise<string>;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  isGenerating: false,

  generateFile: async (options) => {
    set({ isGenerating: true });
    try {
      return await generateReportFile(options);
    } finally {
      set({ isGenerating: false });
    }
  },
}));
