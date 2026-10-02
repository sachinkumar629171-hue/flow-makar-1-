import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Video, Link as LinkIcon, Plus, Trash2, ChevronUp, ChevronDown, Monitor, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { HeroItem } from '../../types';

interface HeroSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeroSettingsModal: React.FC<HeroSettingsModalProps> = ({ isOpen, onClose }) => {
  const { heroConfig, updateHeroConfig } = useAuth();
  const [items, setItems] = useState<HeroItem[]>(heroConfig.items || []);
  const [rotationSpeed, setRotationSpeed] = useState(heroConfig.rotationSpeed || 5000);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Only initialize local state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setItems(heroConfig.items || []);
      setRotationSpeed(heroConfig.rotationSpeed || 5000);
    }
  }, [isOpen]); // Removed heroConfig dependency

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateHeroConfig({ items, rotationSpeed });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    const newItem: HeroItem = {
      id: Math.random().toString(36).substring(2, 11),
      title: 'New Hero Banner',
      description: 'Enter description here...',
      mediaUrl: '',
      mediaType: 'image',
      buttonText: 'Generate Video',
      buttonUrl: '#'
    };
    setItems([...items, newItem]);
    setActiveItemIndex(items.length);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    if (activeItemIndex >= newItems.length) {
      setActiveItemIndex(Math.max(0, newItems.length - 1));
    }
  };

  const updateItem = (index: number, data: Partial<HeroItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...data } : item));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
    setActiveItemIndex(targetIndex);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[#121318] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hero Banner Management</h2>
              <p className="text-xs text-neutral-400">Configure multi-banner rotating display</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? 'Saved!' : 'Save All'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Item List */}
          <div className="w-64 border-r border-neutral-800 bg-neutral-900/30 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Banner List</span>
              <button
                onClick={addItem}
                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {items.map((item, index) => (
              <div
                key={item.id}
                onClick={() => setActiveItemIndex(index)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  activeItemIndex === index 
                    ? 'bg-blue-500/10 border-blue-500/50 text-white' 
                    : 'bg-neutral-800/50 border-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-950 flex items-center justify-center overflow-hidden">
                    {item.mediaType === 'image' ? (
                      item.mediaUrl ? (
                        <img src={item.mediaUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-neutral-600" />
                      )
                    ) : (
                      <Video className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>
                  <span className="text-xs font-medium truncate">{item.title || `Banner ${index + 1}`}</span>
                </div>
              </div>
            ))}

            <div className="mt-8 pt-6 border-t border-neutral-800">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Rotation Delay</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rotationSpeed / 1000}
                  onChange={(e) => setRotationSpeed(Number(e.target.value) * 1000)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="Seconds"
                />
                <span className="text-[10px] text-neutral-500">sec</span>
              </div>
            </div>
          </div>

          {/* Main Editor */}
          <div className="flex-1 overflow-y-auto p-8">
            {items[activeItemIndex] ? (
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex items-center justify-between pb-6 border-b border-neutral-800/50">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Editing Item #{activeItemIndex + 1}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveItem(activeItemIndex, 'up')}
                      disabled={activeItemIndex === 0}
                      className="p-2 text-neutral-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => moveItem(activeItemIndex, 'down')}
                      disabled={activeItemIndex === items.length - 1}
                      className="p-2 text-neutral-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => removeItem(activeItemIndex)}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Media Type</label>
                    <div className="flex p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <button
                        onClick={() => updateItem(activeItemIndex, { mediaType: 'image' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                          items[activeItemIndex].mediaType === 'image' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Image
                      </button>
                      <button
                        onClick={() => updateItem(activeItemIndex, { mediaType: 'video' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                          items[activeItemIndex].mediaType === 'video' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        Video
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Media URL (Video/Image Link)</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        type="text"
                        value={items[activeItemIndex].mediaUrl}
                        onChange={(e) => updateItem(activeItemIndex, { mediaUrl: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        placeholder="Paste image/video direct link..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Banner Title</label>
                    <input
                      type="text"
                      value={items[activeItemIndex].title}
                      onChange={(e) => updateItem(activeItemIndex, { title: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Button Text</label>
                    <input
                      type="text"
                      value={items[activeItemIndex].buttonText}
                      onChange={(e) => updateItem(activeItemIndex, { buttonText: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="col-span-full space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Description</label>
                    <textarea
                      value={items[activeItemIndex].description}
                      onChange={(e) => updateItem(activeItemIndex, { description: e.target.value })}
                      rows={3}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>

                  <div className="col-span-full space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Button Redirection URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input
                        type="text"
                        value={items[activeItemIndex].buttonUrl}
                        onChange={(e) => updateItem(activeItemIndex, { buttonUrl: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-4">
                <div className="p-4 bg-neutral-900 rounded-full">
                  <Monitor className="w-12 h-12 text-neutral-700" />
                </div>
                <p className="text-sm">Select or add a banner to start editing</p>
                <button
                  onClick={addItem}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                >
                  Create Your First Banner
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
