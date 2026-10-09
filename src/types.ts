export interface VideoFile {
  id: string;
  name: string;
  sizeMB: number;
  status: 'pending' | 'uploading' | 'completed' | 'paused' | 'failed';
  uploadedMB: number;
  path: string;
  progress: number; // 0 to 100
  speedMBs?: number;
  etaSeconds?: number;
  uploadedAt?: string;
  limboTime?: number;
  errorMessage?: string;
}

export type NetworkProfile = 'unmetered' | 'metered';

export interface AppConfig {
  sourceFolder: string;
  destinationFolder: string;
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
  channelName?: string;
  channelHandle?: string;
  autoStartOnLaunch?: boolean;
  licenseKey?: string;
}

export interface AppState {
  licenseKey: string;
  isLicenseVerified: boolean;
  engineStatus: 'ONLINE' | 'OFFLINE';
  networkProfile: NetworkProfile;
  activeTargetDir: string;
  tokenExists: boolean;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'system';
}

export interface UploadProgressPayload {
  videoId?: string;
  filename: string;
  percent: number;
  uploadedMB: number;
  totalMB: number;
  speedMBs: number;
  etaSeconds: number;
}

declare global {
  interface Window {
    electronAPI?: {
      getConfig: () => Promise<AppConfig>;
      saveConfig: (newConfig: Partial<AppConfig>) => Promise<{ success: boolean; config: AppConfig }>;
      openDirectoryDialog: (defaultPath?: string) => Promise<string | null>;
      openExternalUrl: (url: string) => Promise<boolean>;
      scanQueueFiles: () => Promise<{ pending: VideoFile[]; completed: VideoFile[] }>;
      showNotification: (payload: { title?: string; body: string }) => void;
      exchangeOAuthCode: (code: string) => Promise<{ success: boolean; channelName?: string; channelHandle?: string; error?: string }>;
      startUpload: (payload: { networkProfile: string }) => Promise<{ success: boolean; message?: string }>;
      stopUpload: () => Promise<{ success: boolean }>;
      onUploaderProgress: (callback: (data: UploadProgressPayload) => void) => () => void;
      onWorkerLog: (callback: (data: { type: 'info' | 'success' | 'warn' | 'error' | 'system'; text: string }) => void) => () => void;
      onWorkerStopped: (callback: () => void) => () => void;
    };
  }
}
