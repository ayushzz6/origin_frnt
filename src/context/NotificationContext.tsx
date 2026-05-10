'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

import { useAuth } from '@/context/AuthContext';
import { getUserTitle } from '@/lib/achievements';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth() || { user: null };

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('origin_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt)
        })));
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
  }, []);

  // Daily Welcome Logic
  useEffect(() => {
    if (!user) return;

    const today = new Date().toDateString();
    const lastWelcome = localStorage.getItem(`last_welcome_${user.id}`);

    if (lastWelcome !== today) {
      const title = getUserTitle(user);
      const displayName = title ? `${title} ${user.name.split(' ')[0]}` : user.name.split(' ')[0];
      
      const welcomeMessages = [
        `Good morning, ${displayName}! Ready to conquer your goals today?`,
        `Welcome back, ${displayName}. Consistency is the key to success!`,
        `Hello ${displayName}! Your future self will thank you for today's effort.`,
        `Great to see you, ${displayName}. Let's make every minute count!`,
      ];
      
      const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

      addNotification({
        title: `Welcome, ${displayName}!`,
        message: randomMessage,
        type: 'info'
      });

      localStorage.setItem(`last_welcome_${user.id}`, today);
    }
  }, [user]);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem('origin_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem('origin_notifications');
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
