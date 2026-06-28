'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<'right' | 'below'>('below');
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // If there's room to the right (dropdown is 384px wide + 8px gap), open right
      setDropdownPos(rect.right + 392 <= window.innerWidth ? 'right' : 'below');
    }
    setIsOpen(prev => !prev);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleToggle}
        className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors relative bg-primary/10 dark:bg-white/5 rounded-full"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "absolute w-80 sm:w-96 bg-white dark:bg-zinc-950 border border-primary/20 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-[100]",
              dropdownPos === 'right'
                ? "left-full ml-2 top-0"
                : "right-0 mt-2"
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-primary/10 dark:border-zinc-900 flex items-center justify-between bg-primary/5 dark:bg-white/5">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {unreadCount} New
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-50 dark:divide-zinc-900">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={cn(
                        "p-4 transition-all relative group cursor-default",
                        !notification.read ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                      )}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium leading-none mb-1",
                            !notification.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 mb-2">
                            {notification.message}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-medium">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:text-zinc-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!notification.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">All caught up!</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">No new notifications to show.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-primary/10 dark:border-zinc-900 bg-primary/5 dark:bg-white/5">
                <button 
                  onClick={clearAll}
                  className="w-full py-2 text-xs text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors font-medium rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
