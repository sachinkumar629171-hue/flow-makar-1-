import React, { useState } from 'react';
import { X, Laptop, Smartphone, Shield, LogOut, Check } from 'lucide-react';
import { INITIAL_DEVICES } from '../../data/initialData';
import { DeviceSession } from '../../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevicesModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [devices, setDevices] = useState<DeviceSession[]>(INITIAL_DEVICES);

  if (!isOpen) return null;

  const handleRevoke = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-lg bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-display text-white">Connected Devices</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-400">
            These devices are currently signed into your Flow account. Revoke any unfamiliar sessions to secure your account.
          </p>

          <div className="space-y-3">
            {devices.map(device => (
              <div
                key={device.id}
                className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-300">
                    {device.browser.includes('iPhone') || device.os.includes('iOS') || device.os.includes('Android') ? (
                      <Smartphone className="w-5 h-5" />
                    ) : (
                      <Laptop className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{device.browser}</span>
                      {device.isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      {device.location} • IP {device.ipAddress}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {device.lastActive}
                    </div>
                  </div>
                </div>

                {!device.isCurrent && (
                  <button
                    onClick={() => handleRevoke(device.id)}
                    className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Revoke Session"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 text-right">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
