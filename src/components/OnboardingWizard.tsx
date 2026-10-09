import React, { useState } from 'react';
import { 
  Folder, 
  CheckCircle2, 
  ExternalLink, 
  Key, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Youtube, 
  ShieldCheck, 
  HardDrive, 
  AlertCircle,
  FileJson,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppConfig } from '../types';

interface OnboardingWizardProps {
  onComplete: (config: AppConfig) => void;
  initialConfig?: AppConfig;
  onCancel?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  initialConfig,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Folders
  const [sourceFolder, setSourceFolder] = useState(
    initialConfig?.sourceFolder || 'C:\\Videos\\Pending'
  );
  const [destinationFolder, setDestinationFolder] = useState(
    initialConfig?.destinationFolder || 'C:\\Videos\\Completed'
  );

  // Step 2: YouTube API Credentials
  const [credentialMode, setCredentialMode] = useState<'upload' | 'manual'>('upload');
  const [clientId, setClientId] = useState(initialConfig?.clientId || '');
  const [clientSecret, setClientSecret] = useState(initialConfig?.clientSecret || '');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  // Step 3: Channel Authorization
  const [authCode, setAuthCode] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(!!initialConfig?.channelName);
  const [connectedChannel, setConnectedChannel] = useState<{
    name: string;
    handle?: string;
  } | null>(initialConfig?.channelName ? { name: initialConfig.channelName, handle: initialConfig.channelHandle } : null);

  // Step 4: Settings summary & auto-start
  const [autoStart, setAutoStart] = useState(initialConfig?.autoStartOnLaunch ?? true);

  // Real native directory selection via Electron IPC
  const handleBrowseSource = async () => {
    if (window.electronAPI?.openDirectoryDialog) {
      const selected = await window.electronAPI.openDirectoryDialog(sourceFolder);
      if (selected) setSourceFolder(selected);
    }
  };

  const handleBrowseDest = async () => {
    if (window.electronAPI?.openDirectoryDialog) {
      const selected = await window.electronAPI.openDirectoryDialog(destinationFolder);
      if (selected) setDestinationFolder(selected);
    }
  };

  // Handle real credentials.json parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentialError(null);
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const creds = parsed.installed || parsed.web || parsed;
          if (creds.client_id && creds.client_secret) {
            setClientId(creds.client_id.trim());
            setClientSecret(creds.client_secret.trim());
            setCredentialError(null);
          } else {
            setCredentialError('JSON does not contain client_id and client_secret. Ensure you downloaded OAuth client credentials from Google Cloud Console.');
          }
        } catch {
          setCredentialError('Failed to parse JSON file. Ensure it is a valid Google OAuth client secrets file.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Real OAuth URL generation and opening
  const getAuthUrl = () => {
    if (!clientId.trim()) return '';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;
  };

  const handleOpenAuthUrl = async () => {
    setAuthError(null);
    const url = getAuthUrl();
    if (!url) {
      setAuthError('Please configure your Google OAuth Client ID first in Step 2.');
      return;
    }

    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Real OAuth token exchange
  const handleVerifyAuthCode = async () => {
    if (!authCode.trim()) {
      setAuthError('Please paste the authorization code provided by Google.');
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);

    try {
      if (window.electronAPI?.exchangeOAuthCode) {
        // Save client credentials in main process before exchange
        await window.electronAPI.saveConfig({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          sourceFolder,
          destinationFolder
        });

        const result = await window.electronAPI.exchangeOAuthCode(authCode.trim());
        if (result.success) {
          setIsAuthorized(true);
          setConnectedChannel({
            name: result.channelName || 'Authenticated YouTube Channel',
            handle: result.channelHandle
          });
        } else {
          setAuthError(result.error || 'Failed to exchange authorization code with Google API.');
        }
      } else {
        // Fallback for browser configuration preview
        setIsAuthorized(true);
        setConnectedChannel({
          name: 'Authorized YouTube Channel'
        });
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authorization error occurred.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Finish setup
  const handleFinish = () => {
    const finalConfig: AppConfig = {
      sourceFolder: sourceFolder.trim(),
      destinationFolder: destinationFolder.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      isConfigured: true,
      channelName: connectedChannel?.name,
      channelHandle: connectedChannel?.handle,
      autoStartOnLaunch: autoStart
    };
    onComplete(finalConfig);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F19] text-[#F9FAFB] flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <div className="bg-[#0e1626] border-b border-[#1E293B] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#06B6D4] to-[#2563EB] flex items-center justify-center font-bold text-black text-sm">
            F
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wider uppercase text-[#F9FAFB]">
              Faiiya YouTube Uploader
            </h1>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">
              Live Setup & Folder Configuration
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center space-x-3">
          {[
            { step: 1, label: 'Folders' },
            { step: 2, label: 'Credentials' },
            { step: 3, label: 'Channel Auth' },
            { step: 4, label: 'Review' }
          ].map((item) => (
            <div key={item.step} className="flex items-center space-x-2">
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === item.step
                    ? 'bg-[#06B6D4] text-[#0B0F19] shadow-[0_0_12px_#06B6D4]'
                    : currentStep > item.step
                    ? 'bg-[#10B981] text-black'
                    : 'bg-[#1E293B] text-[#9CA3AF]'
                }`}
              >
                {currentStep > item.step ? <Check className="w-4 h-4 stroke-[3]" /> : item.step}
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider hidden sm:inline ${
                currentStep === item.step ? 'text-[#06B6D4]' : 'text-[#9CA3AF]'
              }`}>
                {item.label}
              </span>
              {item.step < 4 && <div className="w-4 h-[1px] bg-[#1E293B] hidden md:block" />}
            </div>
          ))}
        </div>

        {onCancel && (
          <button 
            onClick={onCancel}
            className="text-xs text-[#9CA3AF] hover:text-[#F9FAFB] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-lg border border-[#1E293B] hover:bg-[#1E293B] transition"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center items-center custom-scrollbar">
        <div className="w-full max-w-2xl bg-[#111827] border border-[#1E293B] rounded-2xl p-6 md:p-10 shadow-2xl space-y-8">
          
          {/* STEP 1: FOLDERS */}
          {currentStep === 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">Step 1 of 4</span>
                <h2 className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
                  Set Real Ingestion & Vault Folders
                </h2>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Choose the actual directories on your computer. The engine monitors the source folder for new video files, and moves them to the vault upon completed upload.
                </p>
              </div>

              <div className="space-y-5 pt-2">
                {/* Source Folder */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Folder className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Source Videos Folder (Monitored Queue)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Live Input</span>
                  </label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={sourceFolder}
                      onChange={(e) => setSourceFolder(e.target.value)}
                      placeholder="e.g. C:\Users\YourName\Videos\Pending"
                      className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4] transition"
                    />
                    <button 
                      type="button"
                      onClick={handleBrowseSource}
                      className="bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#F9FAFB] px-5 py-3 rounded-xl transition flex items-center space-x-2 shrink-0"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Browse...</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Place your completed render files (<code className="text-[#06B6D4]">.mp4</code>, <code className="text-[#06B6D4]">.mov</code>, <code className="text-[#06B6D4]">.mkv</code>) in this folder.
                  </p>
                </div>

                {/* Destination Folder */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Destination Folder (Completed Vault)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Live Output</span>
                  </label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={destinationFolder}
                      onChange={(e) => setDestinationFolder(e.target.value)}
                      placeholder="e.g. C:\Users\YourName\Videos\Completed"
                      className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4] transition"
                    />
                    <button 
                      type="button"
                      onClick={handleBrowseDest}
                      className="bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#F9FAFB] px-5 py-3 rounded-xl transition flex items-center space-x-2 shrink-0"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Browse...</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Files are moved here automatically once YouTube confirms upload verification.
                  </p>
                </div>

                <div className="bg-[#1E293B]/60 border border-[#334155] rounded-xl p-4 flex items-start space-x-3">
                  <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    Directories will be automatically verified or created on your system.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: YOUTUBE API CREDENTIALS */}
          {currentStep === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">Step 2 of 4</span>
                <h2 className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
                  Google Cloud OAuth Credentials
                </h2>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Provide your Google Cloud Console OAuth Desktop App client credentials. Upload your downloaded <code className="text-[#06B6D4]">credentials.json</code> file or enter your keys manually.
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex bg-[#1E293B] p-1 rounded-xl border border-[#334155] space-x-1">
                <button
                  type="button"
                  onClick={() => setCredentialMode('upload')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
                    credentialMode === 'upload' 
                      ? 'bg-[#06B6D4] text-black shadow' 
                      : 'text-[#9CA3AF] hover:text-[#F9FAFB]'
                  }`}
                >
                  Upload credentials.json
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialMode('manual')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
                    credentialMode === 'manual' 
                      ? 'bg-[#06B6D4] text-black shadow' 
                      : 'text-[#9CA3AF] hover:text-[#F9FAFB]'
                  }`}
                >
                  Manual Text Input
                </button>
              </div>

              {credentialMode === 'upload' ? (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-[#334155] hover:border-[#06B6D4] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-[#1E293B]/40 group">
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden" 
                    />
                    <div className="w-12 h-12 rounded-xl bg-[#1E293B] group-hover:bg-[#06B6D4]/10 flex items-center justify-center mb-3 transition">
                      <Upload className="w-6 h-6 text-[#06B6D4]" />
                    </div>
                    <p className="text-sm font-bold text-[#F9FAFB]">
                      {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Select or Drag credentials.json here'}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">
                      Download from Google Cloud Console &gt; APIs & Services &gt; Credentials
                    </p>
                  </label>

                  {clientId && (
                    <div className="bg-[#1E293B] border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileJson className="w-5 h-5 text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-[#F9FAFB]">OAuth Client ID Parsed Successfully</p>
                          <p className="text-[10px] font-mono text-[#9CA3AF] truncate max-w-sm">{clientId}</p>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}

                  {credentialError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-2 text-xs text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{credentialError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                      Google OAuth Client ID
                    </label>
                    <input 
                      type="text" 
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="e.g. 123456789-xxxxxxxx.apps.googleusercontent.com"
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4] transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                      Google OAuth Client Secret
                    </label>
                    <input 
                      type="password" 
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4] transition"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-[#9CA3AF]">
                  Credentials are saved locally in <code className="text-[#06B6D4]">%APPDATA%/FaiiyaUploader</code>
                </span>
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-[#06B6D4] hover:underline flex items-center space-x-1"
                >
                  <span>Open Cloud Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CHANNEL AUTHORIZATION */}
          {currentStep === 3 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">Step 3 of 4</span>
                <h2 className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
                  Connect YouTube Channel
                </h2>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Authenticate your YouTube account using standard Google OAuth 2.0. This generates a secure local token granting upload permissions.
                </p>
              </div>

              {!isAuthorized ? (
                <div className="space-y-5">
                  <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl space-y-3">
                    <p className="text-xs font-bold text-[#F9FAFB] uppercase tracking-wider">
                      1. Open Google OAuth Consent Screen
                    </p>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">
                      Click below to open your browser and grant permissions for YouTube bulk uploading.
                    </p>
                    <button 
                      type="button"
                      onClick={handleOpenAuthUrl}
                      disabled={!clientId.trim()}
                      className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition flex items-center space-x-2 shadow-lg"
                    >
                      <Youtube className="w-4 h-4 fill-current" />
                      <span>Connect YouTube Account</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </button>
                    {!clientId.trim() && (
                      <p className="text-[11px] text-yellow-400">
                        * Please configure your Google Client ID in Step 2 before opening the consent URL.
                      </p>
                    )}
                  </div>

                  <div className="bg-[#1E293B] border border-[#334155] p-5 rounded-2xl space-y-3">
                    <p className="text-xs font-bold text-[#F9FAFB] uppercase tracking-wider">
                      2. Paste Authorization Code
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      After accepting the permissions, Google will display an authorization code. Paste it here to complete the connection:
                    </p>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                        placeholder="4/0Aean9zV_..."
                        className="flex-1 bg-[#0B0F19] border border-[#334155] rounded-xl px-4 py-3 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4] transition"
                      />
                      <button 
                        type="button"
                        onClick={handleVerifyAuthCode}
                        disabled={isAuthorizing || !authCode.trim()}
                        className="bg-[#06B6D4] hover:bg-[#2563EB] disabled:opacity-40 text-black font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition flex items-center space-x-2 shrink-0"
                      >
                        {isAuthorizing ? (
                          <span>Verifying...</span>
                        ) : (
                          <>
                            <Key className="w-3.5 h-3.5" />
                            <span>Verify Code</span>
                          </>
                        )}
                      </button>
                    </div>

                    {authError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-2 text-xs text-rose-400">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#1E293B] border border-emerald-500/40 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-black text-xl shadow-lg">
                      <Youtube className="w-7 h-7 text-black fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-[#F9FAFB]">{connectedChannel?.name}</h4>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full uppercase">
                          Authorized
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">Ready for live background video streaming</p>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] p-3 rounded-xl border border-[#334155] text-[11px] text-[#9CA3AF] font-mono flex items-center justify-between">
                    <span>OAuth Token Path:</span>
                    <span className="text-emerald-400">%APPDATA%/FaiiyaUploader/token.json</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 4: FINISH & LAUNCH */}
          {currentStep === 4 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">Ready</span>
                <h2 className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
                  Review & Finalize Setup
                </h2>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Configuration is ready. Any video files in your source directory will be detected and uploaded automatically.
                </p>
              </div>

              {/* Summary card */}
              <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-4 text-xs">
                <div className="flex justify-between items-center pb-3 border-b border-[#334155]">
                  <span className="text-[#9CA3AF]">Source Queue Folder</span>
                  <span className="font-mono text-[#F9FAFB] text-right truncate max-w-xs">{sourceFolder}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#334155]">
                  <span className="text-[#9CA3AF]">Completed Vault Folder</span>
                  <span className="font-mono text-[#F9FAFB] text-right truncate max-w-xs">{destinationFolder}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-[#334155]">
                  <span className="text-[#9CA3AF]">Connected Channel</span>
                  <span className="text-emerald-400 font-bold">{connectedChannel?.name || 'Authorized'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9CA3AF]">Upload Protocol</span>
                  <span className="text-[#06B6D4] font-mono">Google YouTube API v3 Resumable Chunks</span>
                </div>
              </div>

              {/* Auto start toggle */}
              <div className="flex items-center justify-between p-4 bg-[#1E293B]/60 rounded-xl border border-[#334155]">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#F9FAFB]">Auto-Start Background Worker</p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Begin scanning and uploading pending videos immediately after launching Cockpit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoStart(!autoStart)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                    autoStart ? 'bg-[#06B6D4]' : 'bg-[#334155]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${
                    autoStart ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-[#1E293B]">
            {currentStep > 1 ? (
              <button 
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-5 py-3 rounded-xl border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1E293B] transition flex items-center space-x-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button 
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="bg-[#06B6D4] hover:bg-[#2563EB] text-black font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition flex items-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button 
                type="button"
                id="btn_finish_onboarding"
                onClick={handleFinish}
                className="bg-gradient-to-r from-[#06B6D4] to-[#10B981] hover:from-[#0891b2] hover:to-[#059669] text-black font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl transition flex items-center space-x-2 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Finish Setup & Launch Cockpit</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
