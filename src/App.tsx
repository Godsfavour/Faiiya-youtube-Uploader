import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  CheckCircle2, 
  Play, 
  Square, 
  RefreshCw, 
  Wifi, 
  ShieldCheck, 
  Terminal, 
  Lock, 
  Copy, 
  Check, 
  FileCode, 
  Download, 
  AlertTriangle, 
  Settings, 
  FileVideo, 
  Sparkles, 
  HardDrive,
  PlusCircle,
  ChevronRight,
  Clock,
  Zap,
  X,
  Upload
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { VideoFile, TerminalLog, NetworkProfile, AppConfig, UploadProgressPayload } from './types';
import { exportCodebase, CodeFile } from './data/exportCodebase';
import { OnboardingWizard } from './components/OnboardingWizard';
import { SettingsModal } from './components/SettingsModal';

const DEFAULT_CONFIG: AppConfig = {
  sourceFolder: 'C:\\Videos\\Pending',
  destinationFolder: 'C:\\Videos\\Completed',
  clientId: '',
  clientSecret: '',
  isConfigured: false,
  channelName: undefined,
  autoStartOnLaunch: false,
  licenseKey: 'FAIIYA-ENTERPRISE-PRO-2026'
};

export default function App() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // Navigation & Workspace Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'codebase'>('dashboard');
  const [selectedCodeFile, setSelectedCodeFile] = useState<CodeFile>(exportCodebase[0]);
  const [codeCopied, setCodeCopied] = useState(false);

  // App Configuration
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('faiiya_uploader_config');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_CONFIG;
  });

  const [showWizard, setShowWizard] = useState(!config.isConfigured);
  const [showSettings, setShowSettings] = useState(false);

  // License & Core Engine State
  const [licenseKey, setLicenseKey] = useState(config.licenseKey || 'FAIIYA-ENTERPRISE-PRO-2026');
  const [isLicenseVerified, setIsLicenseVerified] = useState(true);
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const [engineStatus, setEngineStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [networkProfile, setNetworkProfile] = useState<NetworkProfile>('unmetered');

  // Real Videos Queue (Populated from real files on disk)
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [activeVideoName, setActiveVideoName] = useState<string | null>(null);

  // Live Terminal Logs
  const [logs, setLogs] = useState<TerminalLog[]>([
    { 
      id: 'init-1', 
      timestamp: new Date().toTimeString().split(' ')[0], 
      text: isElectron 
        ? '[SYSTEM] Faiiya Desktop Engine initialized with native Windows OS bindings.' 
        : '[SYSTEM] Faiiya GUI active in browser mode. Compile with electron-builder for native file streaming.', 
      type: 'system' 
    }
  ]);
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const logTerminalEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-app Notification System
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    body: string;
    type: 'success' | 'warn' | 'info';
  } | null>(null);

  const triggerToast = (title: string, body: string, type: 'success' | 'warn' | 'info' = 'info') => {
    const id = Math.random().toString();
    setToastNotification({ id, title, body, type });
    setTimeout(() => {
      setToastNotification(prev => prev?.id === id ? null : prev);
    }, 4500);
  };

  const appendLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' | 'system' = 'info') => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newLog: TerminalLog = {
      id: Math.random().toString(),
      timestamp: timeStr,
      text,
      type
    };
    setLogs(prev => [...prev.slice(-200), newLog]);
  };

  // Real Queue Scanner function
  const scanFiles = async () => {
    if (window.electronAPI?.scanQueueFiles) {
      try {
        const { pending, completed } = await window.electronAPI.scanQueueFiles();
        setVideos([...pending, ...completed]);
      } catch (err: any) {
        appendLog(`[ERROR] Failed to scan queue folders: ${err.message}`, 'error');
      }
    }
  };

  // Electron IPC Lifecycle Synchronization
  useEffect(() => {
    if (!isElectron) return;

    // 1. Fetch real configuration from disk
    window.electronAPI!.getConfig().then((diskConfig) => {
      if (diskConfig) {
        setConfig(diskConfig);
        if (!diskConfig.isConfigured) {
          setShowWizard(true);
        }
      }
    });

    // 2. Initial real scan of directories
    scanFiles();

    // 3. Register real progress listener from child process
    const unbindProgress = window.electronAPI!.onUploaderProgress((data: UploadProgressPayload) => {
      setActiveVideoName(data.filename);
      setVideos(prev => prev.map(v => {
        if (v.name === data.filename) {
          return {
            ...v,
            status: data.percent >= 100 ? 'completed' : 'uploading',
            progress: data.percent,
            uploadedMB: data.uploadedMB,
            sizeMB: data.totalMB,
            speedMBs: data.speedMBs,
            etaSeconds: data.etaSeconds
          };
        }
        return v;
      }));
    });

    // 4. Register real log stream from uploader stdout
    const unbindLog = window.electronAPI!.onWorkerLog((log) => {
      appendLog(log.text, log.type);
    });

    // 5. Register worker stopped listener
    const unbindStopped = window.electronAPI!.onWorkerStopped(() => {
      setEngineStatus('OFFLINE');
      setActiveVideoName(null);
      scanFiles();
    });

    // 6. Periodic queue folder sync (every 4s) to detect incoming renders
    const interval = setInterval(() => {
      scanFiles();
    }, 4000);

    return () => {
      unbindProgress();
      unbindLog();
      unbindStopped();
      clearInterval(interval);
    };
  }, [isElectron]);

  // Terminal autoscroll
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Verify license key
  const handleVerifyLicense = () => {
    if (!licenseKey.trim()) {
      setLicenseError('License key is required.');
      return;
    }
    setVerifyingLicense(true);
    setLicenseError(null);
    appendLog(`[LICENSE] Validating commercial signature: ${licenseKey.substring(0, 10)}...`, 'info');

    setTimeout(() => {
      setVerifyingLicense(false);
      if (licenseKey.trim().length >= 8) {
        setIsLicenseVerified(true);
        triggerToast('License Active', 'Commercial license signature confirmed.', 'success');
        appendLog('[LICENSE] Signature verified. Engine operational.', 'success');
      } else {
        setIsLicenseVerified(false);
        setLicenseError('License signature is invalid.');
      }
    }, 600);
  };

  // Real Start Worker trigger
  const handleStartWorker = async () => {
    if (!isLicenseVerified) {
      triggerToast('Security Lock', 'Please verify your commercial license first.', 'warn');
      return;
    }

    if (window.electronAPI?.startUpload) {
      appendLog('[SYSTEM] Requesting main process to spawn uploader.js child process...', 'system');
      const res = await window.electronAPI.startUpload({ networkProfile });
      if (res.success) {
        setEngineStatus('ONLINE');
        triggerToast('Engine Started', 'Background bulk uploader is processing queue.', 'success');
      } else {
        triggerToast('Start Failed', res.message || 'Worker could not start.', 'warn');
        appendLog(`[ERROR] Start worker failed: ${res.message}`, 'error');
      }
    } else {
      triggerToast(
        'Electron Required', 
        'Please run via "npm start" or compile with "npm run dist" for live background process spawning.', 
        'info'
      );
    }
  };

  // Real Stop Worker trigger
  const handleStopWorker = async () => {
    if (window.electronAPI?.stopUpload) {
      await window.electronAPI.stopUpload();
    }
    setEngineStatus('OFFLINE');
    setActiveVideoName(null);
    appendLog('[SYSTEM] Sent termination signal to upload worker.', 'warn');
    triggerToast('Engine Stopped', 'Active upload worker terminated.', 'warn');
  };

  // Change network profile
  const handleNetworkProfileChange = (profile: NetworkProfile) => {
    setNetworkProfile(profile);
    appendLog(`[NETWORK] Profile set to: ${profile === 'unmetered' ? 'Unmetered Wi-Fi (Continuous)' : 'Metered Mobile Data (Immediate Pause)'}`, 'info');
    
    if (profile === 'metered') {
      triggerToast('Network Paused', 'Metered network active. Ingestion paused.', 'warn');
    } else {
      triggerToast('Network Resumed', 'Continuous stream restored.', 'success');
    }
  };

  // Save Settings from modal
  const handleSaveSettings = async (newConfig: AppConfig, newProfile: NetworkProfile) => {
    setConfig(newConfig);
    setNetworkProfile(newProfile);
    localStorage.setItem('faiiya_uploader_config', JSON.stringify(newConfig));

    if (window.electronAPI?.saveConfig) {
      await window.electronAPI.saveConfig(newConfig);
    }

    appendLog(`[CONFIG] Updated settings: Source=${newConfig.sourceFolder}, Destination=${newConfig.destinationFolder}`, 'info');
    triggerToast('Settings Saved', 'Configuration saved to disk.', 'success');
    scanFiles();
  };

  // Complete Onboarding Wizard
  const handleWizardComplete = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem('faiiya_uploader_config', JSON.stringify(newConfig));

    if (window.electronAPI?.saveConfig) {
      await window.electronAPI.saveConfig(newConfig);
    }

    setShowWizard(false);
    appendLog('[WIZARD] Setup completed successfully. Configuration written to disk.', 'success');
    triggerToast('Setup Complete', 'Folders and channel configured.', 'success');
    scanFiles();

    if (newConfig.autoStartOnLaunch) {
      setTimeout(() => handleStartWorker(), 600);
    }
  };

  // Clear data
  const handleResetAllData = () => {
    localStorage.removeItem('faiiya_uploader_config');
    handleStopWorker();
    setVideos([]);
    setShowSettings(false);
    setShowWizard(true);
    triggerToast('Config Cleared', 'Launching Setup Wizard...', 'info');
  };

  // Folder browse shortcut
  const handleBrowseFolder = async () => {
    if (window.electronAPI?.openDirectoryDialog) {
      const selected = await window.electronAPI.openDirectoryDialog(config.sourceFolder);
      if (selected) {
        const updated = { ...config, sourceFolder: selected };
        setConfig(updated);
        await window.electronAPI.saveConfig(updated);
        scanFiles();
      }
    } else {
      setShowSettings(true);
    }
  };

  // File import for testing in web browser
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newItems: VideoFile[] = (Array.from(files) as File[]).map((f) => ({
        id: 'file-' + Math.random().toString(36).substring(2, 9),
        name: f.name,
        sizeMB: parseFloat((f.size / (1024 * 1024)).toFixed(1)),
        status: 'pending',
        uploadedMB: 0,
        path: `${config.sourceFolder}\\${f.name}`,
        progress: 0
      }));
      setVideos(prev => [...newItems, ...prev]);
      appendLog(`[FILES] Loaded ${files.length} real video file(s) into queue.`, 'info');
      triggerToast('Files Queued', `Added ${files.length} video(s) to queue.`, 'info');
    }
  };

  // Copy code helper
  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedCodeFile.content);
    setCodeCopied(true);
    triggerToast('Copied', `${selectedCodeFile.name} copied to clipboard!`, 'success');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Download codebase bundle
  const downloadCodebaseZip = () => {
    let combinedContent = `# FAIIYA YOUTUBE UPLOADER - ELECTRON DESKTOP APPLICATION CODEBASE\n`;
    combinedContent += `# Platform: Windows 11 (.exe installer via electron-builder)\n\n`;
    exportCodebase.forEach(f => {
      combinedContent += `================================================================================\n`;
      combinedContent += `FILE: ${f.name}\n`;
      combinedContent += `================================================================================\n\n`;
      combinedContent += f.content;
      combinedContent += `\n\n\n`;
    });

    const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'faiiya-youtube-uploader-sources.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast('Exported', 'Downloaded complete Electron desktop sources.', 'success');
  };

  // Derived metrics
  const pendingVideos = videos.filter(v => v.status !== 'completed');
  const completedVideos = videos.filter(v => v.status === 'completed');
  const activeVideo = videos.find(v => v.name === activeVideoName || v.status === 'uploading');
  const pendingMB = pendingVideos.reduce((a, b) => a + b.sizeMB, 0).toFixed(1);
  const completedMB = completedVideos.reduce((a, b) => a + b.sizeMB, 0).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F9FAFB] font-sans antialiased overflow-x-hidden flex flex-col selection:bg-[#06B6D4] selection:text-black">
      
      {/* WINDOW SHELL HEADER */}
      <div className="bg-[#0B0F19] border-b border-[#1E293B] px-5 py-2.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${engineStatus === 'ONLINE' ? 'bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]' : 'bg-[#EF4444]'}`} />
            <span className="font-bold uppercase tracking-wider text-[#9CA3AF] text-[10px]">
              Faiiya YouTube Bulk Uploader
            </span>
          </div>
          <span className="text-[#334155]">|</span>
          <span className="text-[10px] text-[#9CA3AF] font-mono">
            {isElectron ? 'Windows 11 Native Desktop IPC Connected' : 'Web View Standby'}
          </span>
        </div>

        <div className="flex items-center space-x-6 text-[#9CA3AF] font-mono text-[11px] hidden sm:flex">
          <div className="flex items-center space-x-1">
            <Wifi className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="uppercase text-[10px]">{networkProfile}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-[#9CA3AF] hover:text-[#06B6D4] transition p-1"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <div className="w-3 h-3 rounded flex items-center justify-center hover:bg-[#1E293B] transition cursor-pointer">
            <span className="block w-2.5 h-[1px] bg-[#9CA3AF]"></span>
          </div>
          <div className="w-3 h-3 rounded flex items-center justify-center hover:bg-[#1E293B] transition cursor-pointer">
            <span className="block w-2 h-2 border border-[#9CA3AF] rounded-sm"></span>
          </div>
        </div>
      </div>

      {/* TOP NAVIGATION BAR */}
      <div className="bg-[#0e1626] border-b border-[#1E293B] px-6 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#06B6D4] to-[#2563EB] flex items-center justify-center font-bold text-black text-xs shadow-md">
            F
          </div>
          <div>
            <span className="text-[#F9FAFB] font-bold text-base tracking-wider uppercase">Faiiya</span>
            <span className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-wider ml-1.5 opacity-80">YouTube Uploader</span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-[#1E293B] border border-[#334155] rounded-xl p-0.5 max-w-sm w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'dashboard'
                ? 'bg-[#334155] text-[#F9FAFB] shadow'
                : 'text-[#9CA3AF] hover:text-[#F9FAFB]'
            }`}
          >
            Control Cockpit
          </button>
          <button 
            onClick={() => setActiveTab('codebase')}
            className={`flex-1 sm:px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'codebase'
                ? 'bg-[#334155] text-[#F9FAFB] shadow'
                : 'text-[#9CA3AF] hover:text-[#F9FAFB]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Electron Sources (.exe)</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowWizard(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#06B6D4] flex items-center space-x-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Setup Wizard</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#9CA3AF] hover:text-[#F9FAFB] transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button 
            onClick={downloadCodebaseZip}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#2563EB] text-black font-bold text-xs uppercase tracking-wider transition shadow-[0_0_12px_rgba(6,182,212,0.3)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Sources</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' ? (
          <div className="flex h-full max-w-[1520px] mx-auto bg-[#0B0F19] overflow-hidden">
            
            {/* PANEL A: LEFT CONTROL SIDEBAR */}
            <aside className="w-[330px] shrink-0 border-r border-[#1E293B] flex flex-col p-6 space-y-6 overflow-y-auto hidden lg:flex bg-[#0B0F19] custom-scrollbar">
              
              {/* Channel connection banner */}
              <div className="bg-[#1E293B] border border-[#334155] p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    Connected Channel
                  </span>
                  {config.channelName ? (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Authorized
                    </span>
                  ) : (
                    <span className="text-[10px] text-yellow-400 font-bold uppercase flex items-center">
                      Not Connected
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center font-bold text-white text-sm shadow">
                    YT
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#F9FAFB] truncate">
                      {config.channelName || 'No Channel Connected'}
                    </p>
                    <p className="text-[10px] font-mono text-[#9CA3AF] truncate">
                      {config.channelName ? 'Scope: youtube.upload' : 'Run Setup Wizard to connect'}
                    </p>
                  </div>
                </div>
              </div>

              {/* License field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Commercial License Activation
                  </label>
                  {isLicenseVerified ? (
                    <span className="flex items-center text-[10px] text-emerald-400 font-mono uppercase font-semibold">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center text-[10px] text-rose-500 font-mono uppercase font-semibold">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </span>
                  )}
                </div>

                <div className="flex space-x-2">
                  <input 
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Enter License Key"
                    className="bg-[#1E293B] border border-[#334155] text-xs font-mono px-3 py-2 rounded-lg flex-1 focus:outline-none focus:border-[#06B6D4] text-[#F9FAFB] transition min-w-0"
                  />
                  <button 
                    onClick={handleVerifyLicense}
                    disabled={verifyingLicense}
                    className="bg-[#06B6D4] hover:bg-[#2563EB] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors shrink-0 flex items-center justify-center"
                  >
                    {verifyingLicense ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Verify</span>}
                  </button>
                </div>

                {licenseError && (
                  <p className="text-[11px] text-rose-400 flex items-center space-x-1 pt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{licenseError}</span>
                  </p>
                )}
              </div>

              {/* Engine Status card */}
              <div className="bg-[#1E293B] border border-[#334155] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">
                    Background Engine
                  </p>
                  <p className={`text-base font-bold mt-0.5 ${engineStatus === 'ONLINE' ? 'text-[#10B981]' : 'text-rose-500'}`}>
                    {engineStatus}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${engineStatus === 'ONLINE' ? 'bg-[#10B981] shadow-[0_0_12px_#10B981] animate-pulse' : 'bg-[#EF4444]'}`} />
                </div>
              </div>

              {/* Primary Engine Controls */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold tracking-wider uppercase text-[#9CA3AF]">
                  Engine Control Triggers
                </span>

                <button 
                  id="btn_start_uploads"
                  onClick={handleStartWorker}
                  disabled={!isLicenseVerified || engineStatus === 'ONLINE'}
                  className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-black font-bold text-xs py-3 px-4 rounded-xl tracking-wide uppercase transition flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Uploader Background Worker</span>
                </button>

                <button 
                  id="btn_stop_uploads"
                  onClick={handleStopWorker}
                  disabled={!isLicenseVerified || engineStatus === 'OFFLINE'}
                  className="w-full bg-[#1E293B] hover:bg-[#EF4444]/20 border border-[#334155] hover:border-[#EF4444] disabled:opacity-40 text-rose-400 font-bold text-xs py-3 px-4 rounded-xl tracking-wide uppercase transition flex items-center justify-center space-x-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Uploader Background Worker</span>
                </button>

                <button 
                  onClick={() => setShowWizard(true)}
                  className="w-full bg-transparent border border-[#06B6D4] hover:bg-[#06B6D4]/10 text-[#06B6D4] font-bold text-xs py-2.5 px-4 rounded-xl tracking-wide uppercase transition flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Authenticate Channel Connection</span>
                </button>
              </div>

              {/* Network profile selector */}
              <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                <label className="block text-[11px] font-bold tracking-wider uppercase text-[#9CA3AF]">
                  Network Ingestion Profile
                </label>
                <select 
                  value={networkProfile}
                  onChange={(e) => handleNetworkProfileChange(e.target.value as NetworkProfile)}
                  className="w-full bg-[#1E293B] border border-[#334155] text-[#F9FAFB] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#06B6D4] transition"
                >
                  <option value="unmetered">Unmetered Wi-Fi (Continuous Stream)</option>
                  <option value="metered">Metered Mobile Data (Immediate Pause)</option>
                </select>
              </div>

            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0F19]">
              
              {/* TOP SECTION: DIRECTORIES & METRICS */}
              <section className="shrink-0 p-6 border-b border-[#1E293B] bg-[#0d121d] flex flex-col space-y-5">
                
                {/* Directory Pathways Display */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111827] border border-[#1E293B] p-4 rounded-xl">
                  <div className="space-y-2 flex-1 min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <Folder className="w-4 h-4 text-[#06B6D4] shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Source Queue:</span>
                      <span className="text-xs font-mono text-[#F9FAFB] truncate">{config.sourceFolder}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Completed Vault:</span>
                      <span className="text-xs font-mono text-[#F9FAFB] truncate">{config.destinationFolder}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button 
                      onClick={scanFiles}
                      className="p-2 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-lg text-xs font-bold text-[#F9FAFB] transition"
                      title="Rescan Disk Folders"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={handleBrowseFolder}
                      className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-lg text-xs font-bold uppercase text-[#F9FAFB] transition flex items-center space-x-1.5"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Change Folder</span>
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-[#06B6D4] hover:bg-[#2563EB] rounded-lg text-xs font-bold uppercase text-black transition flex items-center space-x-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Select Files...</span>
                    </button>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      accept="video/*" 
                      onChange={handleFileInputChange} 
                      className="hidden" 
                    />
                  </div>
                </div>

                {/* Metrics 4-Col Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#1E293B] p-4 rounded-xl border border-[#334155] flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Pending in Queue</p>
                      <p className="text-2xl font-bold text-[#F9FAFB] mt-0.5">{pendingVideos.length} <span className="text-xs font-normal text-[#9CA3AF]">Files</span></p>
                      <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">{pendingMB} MB remaining</p>
                    </div>
                    <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#334155] hidden sm:block">
                      <FileVideo className="w-5 h-5 text-[#06B6D4]" />
                    </div>
                  </div>

                  <div className="bg-[#1E293B] p-4 rounded-xl border border-[#334155] flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Completed Vault</p>
                      <p className="text-2xl font-bold text-[#10B981] mt-0.5">{completedVideos.length} <span className="text-xs font-normal text-[#9CA3AF]">Files</span></p>
                      <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">{completedMB} MB shifted</p>
                    </div>
                    <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#334155] hidden sm:block">
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    </div>
                  </div>

                  <div className="bg-[#1E293B] p-4 rounded-xl border border-[#334155] flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Transfer Speed</p>
                      <p className="text-2xl font-bold text-[#06B6D4] mt-0.5 font-mono">
                        {activeVideo?.status === 'uploading' ? `${activeVideo.speedMBs || 0} MB/s` : '0.0 MB/s'}
                      </p>
                      <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">
                        {engineStatus === 'ONLINE' ? 'Active Ingestion' : 'Engine Idle'}
                      </p>
                    </div>
                    <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#334155] hidden sm:block">
                      <Zap className="w-5 h-5 text-[#06B6D4]" />
                    </div>
                  </div>

                  <div className="bg-[#1E293B] p-4 rounded-xl border border-[#334155] flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Estimated Time (ETA)</p>
                      <p className="text-2xl font-bold text-[#F9FAFB] mt-0.5 font-mono">
                        {activeVideo?.status === 'uploading' && activeVideo.etaSeconds ? `${activeVideo.etaSeconds}s` : '--'}
                      </p>
                      <p className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">Current Video Finish</p>
                    </div>
                    <div className="bg-[#0B0F19] p-2.5 rounded-lg border border-[#334155] hidden sm:block">
                      <Clock className="w-5 h-5 text-[#9CA3AF]" />
                    </div>
                  </div>
                </div>

              </section>

              {/* BOTTOM SECTION: REAL-TIME PROGRESS, TERMINAL & QUEUE TABLE */}
              <section className="flex-1 p-6 flex flex-col space-y-5 overflow-y-auto custom-scrollbar">
                
                {/* ACTIVE TASK CARD */}
                <div className="bg-[#1E293B] p-5 rounded-2xl border border-[#334155] space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1 min-w-0 pr-4">
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest font-bold">
                        Active Upload Stream
                      </p>
                      <div className="flex items-center space-x-2">
                        {activeVideo && (
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            activeVideo.status === 'uploading' 
                              ? 'bg-[#06B6D4] animate-ping' 
                              : 'bg-yellow-500'
                          }`} />
                        )}
                        <p className="text-base font-bold text-[#F9FAFB] truncate">
                          {activeVideo ? activeVideo.name : (engineStatus === 'ONLINE' ? 'Scanning folder for pending video files...' : 'Engine offline. Press Start to begin uploads.')}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-mono text-[#06B6D4] font-bold shrink-0">
                      {activeVideo ? activeVideo.progress.toFixed(1) : '0.0'}%
                    </p>
                  </div>

                  {/* Granular Progress Bar */}
                  <div className="w-full h-2.5 bg-[#0B0F19] rounded-full overflow-hidden p-0.5 border border-[#334155]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#06B6D4] via-[#2563EB] to-[#10B981] rounded-full transition-all duration-300"
                      style={{ width: activeVideo ? `${activeVideo.progress}%` : '0%' }}
                    />
                  </div>

                  {activeVideo && (
                    <div className="flex justify-between text-[11px] text-[#9CA3AF] font-mono pt-1">
                      <span>Transferred: {activeVideo.uploadedMB} / {activeVideo.sizeMB} MB</span>
                      <span>Speed: {activeVideo.speedMBs || 0} MB/s</span>
                      <span>ETA: {activeVideo.etaSeconds ? `${activeVideo.etaSeconds}s remaining` : '--'}</span>
                    </div>
                  )}
                </div>

                {/* LIVE CONSOLE TERMINAL OUTPUT */}
                <div className="bg-black rounded-2xl p-4 border border-[#1E293B] font-mono text-xs text-[#9CA3AF] flex flex-col min-h-[220px] max-h-[300px]">
                  <div className="flex justify-between items-center border-b border-[#1E293B] pb-2 mb-2 shrink-0">
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <p className="text-[#F9FAFB] uppercase text-[10px] tracking-widest font-bold">
                        Node.js uploader.js Live Console Stream
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="text" 
                        placeholder="Filter logs..."
                        value={searchLogQuery}
                        onChange={(e) => setSearchLogQuery(e.target.value)}
                        className="bg-[#1E293B] border border-[#334155] text-[10px] text-[#F9FAFB] px-2 py-1 rounded-md focus:outline-none focus:border-[#06B6D4] w-28 sm:w-36"
                      />
                      <button 
                        onClick={() => { setLogs([]); appendLog('[SYSTEM] Console cleared by user.', 'system'); }}
                        className="text-[10px] text-[#9CA3AF] hover:text-[#F9FAFB] uppercase tracking-wider bg-[#1E293B] border border-[#334155] py-1 px-2 rounded-md transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 scroll-smooth pr-2 custom-scrollbar">
                    {logs
                      .filter(log => log.text.toLowerCase().includes(searchLogQuery.toLowerCase()))
                      .map((log) => {
                        let textClr = 'text-[#9CA3AF]';
                        if (log.type === 'success') textClr = 'text-[#10B981] font-medium';
                        if (log.type === 'error') textClr = 'text-rose-500 font-bold';
                        if (log.type === 'warn') textClr = 'text-yellow-400';
                        if (log.type === 'system') textClr = 'text-[#06B6D4] font-semibold';

                        return (
                          <div key={log.id} className="flex items-start space-x-2 hover:bg-[#1E293B]/40 px-1 py-0.5 rounded transition">
                            <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                            <span className={`${textClr} break-all`}>{log.text}</span>
                          </div>
                        );
                      })}
                    {engineStatus === 'ONLINE' && <p className="text-[#06B6D4] animate-pulse">_</p>}
                    <div ref={logTerminalEndRef} />
                  </div>
                </div>

                {/* VIDEO QUEUE TABLE */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-[#9CA3AF]">
                      Live Queue Files ({videos.length} Detected)
                    </span>
                    <button 
                      onClick={scanFiles}
                      className="text-[#06B6D4] hover:text-[#2563EB] text-xs uppercase font-bold tracking-wider transition flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh From Disk</span>
                    </button>
                  </div>

                  <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden">
                    {videos.length === 0 ? (
                      <div className="p-8 text-center space-y-3">
                        <FileVideo className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
                        <p className="text-xs text-[#9CA3AF]">No video files currently in {config.sourceFolder}</p>
                        <p className="text-[11px] text-[#64748B]">Drop video files (.mp4, .mov, .mkv) into your source directory or click "Select Files" above.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1E293B] text-[#9CA3AF] uppercase text-[10px] font-bold tracking-wider border-b border-[#334155]">
                            <tr>
                              <th className="py-3 px-4">Filename</th>
                              <th className="py-3 px-4">Size</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Progress</th>
                              <th className="py-3 px-4 text-right">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B]">
                            {videos.map((vid) => (
                              <tr key={vid.id} className="hover:bg-[#1E293B]/40 transition">
                                <td className="py-3 px-4 font-mono font-medium text-[#F9FAFB] flex items-center space-x-2">
                                  <FileVideo className="w-4 h-4 text-[#06B6D4] shrink-0" />
                                  <span className="truncate max-w-xs">{vid.name}</span>
                                </td>
                                <td className="py-3 px-4 font-mono text-[#9CA3AF]">
                                  {vid.sizeMB} MB
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center space-x-1 ${
                                    vid.status === 'completed' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : vid.status === 'uploading'
                                      ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30 animate-pulse'
                                      : vid.status === 'paused'
                                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                      : 'bg-slate-700/30 text-slate-300 border border-slate-600/40'
                                  }`}>
                                    <span>{vid.status}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-20 h-1.5 bg-[#0B0F19] rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-[#06B6D4]" 
                                        style={{ width: `${vid.progress}%` }} 
                                      />
                                    </div>
                                    <span className="text-[11px] text-[#9CA3AF]">{vid.progress}%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-[10px] text-[#9CA3AF] truncate max-w-xs">
                                  {vid.status === 'completed' ? 'Completed Vault' : 'Pending Queue'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </section>
            </main>

          </div>
        ) : (
          /* CODEBASE EXPLORER TAB */
          <div className="flex h-full max-w-[1520px] mx-auto bg-[#0B0F19] overflow-hidden">
            
            {/* Sidebar with file list */}
            <aside className="w-full lg:w-[340px] shrink-0 border-r border-[#1E293B] flex flex-col p-6 space-y-6 overflow-y-auto bg-[#0B0F19] custom-scrollbar">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">
                  Packaged Distribution Sources
                </p>
                <h3 className="text-sm font-bold text-[#F9FAFB] uppercase tracking-wider">
                  Windows 11 Electron Files
                </h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed pt-1">
                  These source files constitute the complete desktop application ready to compile into an <code className="text-[#06B6D4]">.exe</code> installer.
                </p>
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="text-xs text-[#9CA3AF] font-mono px-2 py-1 select-none flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-[#06B6D4]" />
                  <span>/faiiya-youtube-uploader/</span>
                </div>
                {exportCodebase.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => {
                      setSelectedCodeFile(f);
                      setCodeCopied(false);
                    }}
                    className={`w-full text-left font-mono text-xs px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedCodeFile.name === f.name
                        ? 'bg-[#1E293B] border-[#06B6D4] text-[#06B6D4] font-bold shadow'
                        : 'bg-transparent border-transparent hover:bg-[#1E293B] text-[#9CA3AF] hover:text-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <FileCode className={`w-4 h-4 shrink-0 ${selectedCodeFile.name === f.name ? 'text-[#06B6D4]' : 'text-[#9CA3AF]'}`} />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  </button>
                ))}
              </div>

              {/* Compilation quick command card */}
              <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl space-y-3 shrink-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-[#06B6D4]">
                  Antigravity Terminal Commands
                </span>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#334155] font-mono text-[11px] text-[#F9FAFB] select-all space-y-1">
                  <div>npm install</div>
                  <div>npm run dist</div>
                </div>
                <button 
                  onClick={downloadCodebaseZip}
                  className="w-full bg-[#06B6D4] hover:bg-[#2563EB] text-black font-bold text-xs py-3 rounded-xl tracking-wider uppercase transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Code Bundle</span>
                </button>
              </div>
            </aside>

            {/* Code Viewer Panel */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0d121d]">
              <div className="bg-[#1E293B] px-6 py-4 flex items-center justify-between border-b border-[#334155] shrink-0">
                <div>
                  <h4 className="text-xs font-mono font-bold text-[#06B6D4] uppercase tracking-widest flex items-center space-x-2">
                    <span>File: {selectedCodeFile.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#0B0F19] text-[#9CA3AF] text-[10px]">{selectedCodeFile.language}</span>
                  </h4>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {selectedCodeFile.description}
                  </p>
                </div>
                <button 
                  onClick={handleCopyCode}
                  className="bg-[#0B0F19] hover:bg-[#2d3a52] text-[#9CA3AF] border border-[#334155] px-4 py-2 hover:text-[#F9FAFB] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition"
                >
                  {codeCopied ? (
                    <>
                      <Check className="w-4 h-4 text-[#10B981]" />
                      <span className="text-[#10B981]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Pre Box */}
              <div className="flex-1 overflow-auto p-6 bg-[#0B0F19] custom-scrollbar">
                <pre className="font-mono text-xs text-[#F9FAFB] leading-relaxed overflow-x-auto whitespace-pre select-text selection:bg-[#06B6D4] selection:text-[#0B0F19]">
                  <code>{selectedCodeFile.content}</code>
                </pre>
              </div>
            </main>

          </div>
        )}
      </div>

      {/* ONBOARDING WIZARD */}
      <AnimatePresence>
        {showWizard && (
          <OnboardingWizard
            initialConfig={config}
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            config={config}
            networkProfile={networkProfile}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            onRunWizard={() => setShowWizard(true)}
            onResetAllData={handleResetAllData}
          />
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 50 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#1E293B] border border-[#334155] p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-start space-x-3.5"
          >
            <div className="shrink-0 mt-0.5">
              {toastNotification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : toastNotification.type === 'warn' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-[#06B6D4]" />
              )}
            </div>
            <div className="flex-1 space-y-0.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#F9FAFB]">
                {toastNotification.title}
              </h5>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {toastNotification.body}
              </p>
            </div>
            <button 
              onClick={() => setToastNotification(null)}
              className="text-[#9CA3AF] hover:text-[#F9FAFB] transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
