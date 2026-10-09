import React, { useState } from 'react';
import { 
  X, 
  Folder, 
  HardDrive, 
  Key, 
  RotateCcw, 
  Check, 
  Wifi, 
  Save,
  Trash2
} from 'lucide-react';
import { AppConfig, NetworkProfile } from '../types';

interface SettingsModalProps {
  config: AppConfig;
  networkProfile: NetworkProfile;
  onSave: (newConfig: AppConfig, newProfile: NetworkProfile) => void;
  onClose: () => void;
  onRunWizard: () => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  networkProfile,
  onSave,
  onClose,
  onRunWizard,
  onResetAllData
}) => {
  const [sourceFolder, setSourceFolder] = useState(config.sourceFolder);
  const [destinationFolder, setDestinationFolder] = useState(config.destinationFolder);
  const [clientId, setClientId] = useState(config.clientId);
  const [clientSecret, setClientSecret] = useState(config.clientSecret);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkProfile>(networkProfile);
  const [autoStart, setAutoStart] = useState(config.autoStartOnLaunch ?? true);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppConfig = {
      ...config,
      sourceFolder: sourceFolder.trim(),
      destinationFolder: destinationFolder.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      autoStartOnLaunch: autoStart
    };
    onSave(updated, selectedNetwork);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0e1626] border-b border-[#1E293B] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F9FAFB]">
              Application Settings & Configuration
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#F9FAFB] transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Section: Directories */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#06B6D4] flex items-center space-x-2">
              <Folder className="w-3.5 h-3.5" />
              <span>Real Filesystem Folders</span>
            </h4>
            
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex justify-between">
                <span>Pending Videos Source Folder</span>
                <span className="text-[10px] text-emerald-400 font-mono">Monitored</span>
              </label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={sourceFolder}
                  onChange={(e) => setSourceFolder(e.target.value)}
                  placeholder="e.g. C:\Videos\Pending"
                  className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4]"
                />
                <button 
                  type="button"
                  onClick={handleBrowseSource}
                  className="bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#F9FAFB] px-4 py-2.5 rounded-xl transition flex items-center space-x-1.5"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider flex justify-between">
                <span>Completed Videos Vault Folder</span>
                <span className="text-[10px] text-emerald-400 font-mono">Vault</span>
              </label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={destinationFolder}
                  onChange={(e) => setDestinationFolder(e.target.value)}
                  placeholder="e.g. C:\Videos\Completed"
                  className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4]"
                />
                <button 
                  type="button"
                  onClick={handleBrowseDest}
                  className="bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#F9FAFB] px-4 py-2.5 rounded-xl transition flex items-center space-x-1.5"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section: YouTube API Credentials */}
          <div className="space-y-4 pt-4 border-t border-[#1E293B]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#06B6D4] flex items-center space-x-2">
              <Key className="w-3.5 h-3.5" />
              <span>Google Cloud OAuth Credentials</span>
            </h4>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                Client ID
              </label>
              <input 
                type="text" 
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Google OAuth Client ID"
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                Client Secret
              </label>
              <input 
                type="password" 
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Google OAuth Client Secret"
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-xs font-mono text-[#F9FAFB] focus:outline-none focus:border-[#06B6D4]"
              />
            </div>
          </div>

          {/* Section: Ingestion Profile & Behavior */}
          <div className="space-y-4 pt-4 border-t border-[#1E293B]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#06B6D4] flex items-center space-x-2">
              <Wifi className="w-3.5 h-3.5" />
              <span>Network & Engine Behavior</span>
            </h4>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                Network Ingestion Profile
              </label>
              <select 
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value as NetworkProfile)}
                className="w-full bg-[#1E293B] border border-[#334155] text-xs text-[#F9FAFB] px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#06B6D4]"
              >
                <option value="unmetered">Unmetered Wi-Fi (Continuous Upload Mode)</option>
                <option value="metered">Metered Mobile Data (Immediate Hardware Pause)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#1E293B]/60 rounded-xl border border-[#334155]">
              <span className="text-xs text-[#F9FAFB]">Auto-Start background worker on launch</span>
              <button
                type="button"
                onClick={() => setAutoStart(!autoStart)}
                className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                  autoStart ? 'bg-[#06B6D4]' : 'bg-[#334155]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-black transition-transform ${
                  autoStart ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="pt-4 border-t border-[#1E293B] flex flex-wrap gap-3 items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onRunWizard();
              }}
              className="text-xs font-bold uppercase tracking-wider text-[#06B6D4] hover:underline flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Setup Wizard Again</span>
            </button>

            <button
              type="button"
              onClick={onResetAllData}
              className="text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 transition flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Saved Config</span>
            </button>
          </div>

        </form>

        {/* Footer */}
        <div className="bg-[#0e1626] border-t border-[#1E293B] px-6 py-4 flex items-center justify-between">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1E293B] transition"
          >
            Cancel
          </button>

          <button 
            type="button"
            onClick={handleSubmit}
            className="bg-[#06B6D4] hover:bg-[#2563EB] text-black font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition flex items-center space-x-2"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
