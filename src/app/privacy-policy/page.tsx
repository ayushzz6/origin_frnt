'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Info, Database, Eye, Lock, FileText, CheckCircle2, User, Key, RefreshCw, Cookie, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'who-we-are', title: '1. Who We Are', icon: Info },
  { id: 'info-collect', title: '2. Information We Collect', icon: Database },
  { id: 'info-use', title: '3. How We Use Information', icon: RefreshCw },
  { id: 'children-privacy', title: '4. Children\'s Privacy', icon: Lock },
  { id: 'data-sharing', title: '5. Data Sharing', icon: Eye },
  { id: 'data-security', title: '6. Data Security', icon: Key },
  { id: 'data-retention', title: '7. Data Retention', icon: FileText },
  { id: 'your-rights', title: '8. Your Rights', icon: User },
  { id: 'cookies', title: '9. Cookies', icon: Cookie },
  { id: 'policy-changes', title: '10. Policy Changes', icon: Shield },
  { id: 'contact-us', title: '11. Contact Us', icon: Mail },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('who-we-are');

  useEffect(() => {
    const container = document.querySelector('main');
    const observerOptions = {
      root: container,
      rootMargin: '-100px 0px -60% 0px',
      threshold: 0,
    };

    const visibleSections = new Map<string, boolean>();

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        visibleSections.set(entry.target.id, entry.isIntersecting);
      });

      const intersectingIds = SECTIONS.map((s) => s.id).filter((id) => visibleSections.get(id));

      if (intersectingIds.length > 0) {
        setActiveSection(intersectingIds[0]);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const activeLink = document.getElementById(`sidebar-link-${activeSection}`);
    if (activeLink) {
      activeLink.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen neu-surface text-foreground font-sans relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30 dark:opacity-20">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Navigation & Back Button */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300"
            id="back-home-btn"
          >
            <div className="p-2 neu-raised rounded-full group-hover:scale-105 transition-transform">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Home
          </Link>
          <span className="neu-raised rounded-full px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            PRIVACY
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            How O3 Origin collects, uses, and protects your information.
          </p>
          <div className="flex justify-center items-center gap-2 flex-wrap text-xs text-muted-foreground font-bold uppercase tracking-widest neu-inset rounded-full px-4 py-2 w-max mx-auto">
            <span>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</span>
            <span className="text-border">•</span>
            <span>o3origin.com</span>
            <span className="text-border">•</span>
            <span>Effective Date: June 1, 2026</span>
          </div>
        </header>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Sticky Sidebar Index */}
          <aside className="lg:col-span-4 sticky top-28 hidden lg:block">
            <div className="neu-raised rounded-3xl p-6 relative overflow-hidden">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                Document Contents
              </h2>
              <nav className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl text-left transition-all duration-300 ${
                        isActive
                          ? 'neu-raised text-primary'
                          : 'rounded-xl hover:neu-raised transition-all text-muted-foreground hover:text-foreground'
                      }`}
                      id={`sidebar-link-${section.id}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Right: Policy Content */}
          <article className="lg:col-span-8 space-y-12">
            <div className="neu-raised rounded-3xl p-8 sm:p-12 space-y-12">
              
              {/* 1. Who We Are */}
              <section id="who-we-are" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Info className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Who We Are</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin is an AI-powered education platform operated by{' '}
                    <strong>SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</strong>, incorporated in India.
                  </p>
                  <p>
                    Our platform helps students prepare for JEE, NEET, and other competitive examinations through
                    personalised AI-driven learning. We are reachable at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. Information We Collect */}
              <section id="info-collect" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Database className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. Information We Collect</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-6 font-medium">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-3">From Students</h3>
                    <p className="mb-3">When a student registers and uses O3 Origin, we collect:</p>
                    <ul className="space-y-2 list-none pl-0">
                      {[
                        "Name, email address, and date of birth",
                        "Phone number (optional, for account recovery)",
                        "Academic information including grade, target examination, subjects selected",
                        "Test responses, scores, time spent per question, and performance history",
                        "Study session data including duration, frequency, and topic coverage",
                        "Device information, IP address, and browser type for security purposes",
                        "Voluntary information provided in conversations with Origin AI"
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-3">From Parents or Guardians</h3>
                    <p>
                      For users under 18, we require parental or guardian consent. We collect the parent's or guardian's
                      name, email address, and relationship to the student for verification purposes.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-3">From Teachers</h3>
                    <p>
                      Teachers who join the marketplace provide their name, qualifications, subject expertise, contact details,
                      and with explicit written consent, voice and teaching style data for AI agent creation.
                    </p>
                  </div>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. How We Use Your Information */}
              <section id="info-use" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. How We Use Your Information</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>We use the information collected for the following purposes:</p>
                  <ul className="space-y-3.5 list-none pl-0">
                    {[
                      "To create and manage your account and provide access to the platform",
                      "To diagnose learning gaps and generate personalised practice materials",
                      "To power the Origin AI mentor and teacher AI agents",
                      "To track academic progress and generate performance reports",
                      "To communicate important updates, feature announcements, and support responses",
                      "To improve our AI models and platform functionality using anonymised, aggregated data",
                      "To comply with applicable Indian laws and regulations",
                      "To detect fraud, misuse, or security threats"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 4. Children's Privacy — Users Under 18 */}
              <section id="children-privacy" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. Children's Privacy — Users Under 18</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin's primary users are students under 18 years of age. We take the protection of children's
                    personal data extremely seriously and comply with India's Digital Personal Data Protection Act 2023
                    (DPDPA).
                  </p>
                  
                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Parental Consent</h3>
                  <p>
                    No student under the age of 18 may create an account or use paid features of O3 Origin without verified
                    parental or guardian consent. During registration, users born after a date indicating they are below 18
                    will be required to provide a parent or guardian's contact information. A consent verification link will be
                    sent to the parent or guardian before the account is activated.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">No Payment by Minors</h3>
                  <p>
                    Users under the age of 18 are strictly prohibited from making any payment on O3 Origin independently.
                    All subscription purchases, upgrades, and transactions for minor users must be initiated and completed
                    by a parent or legal guardian using their own payment method. Origin will not process payments where
                    the account holder is a verified minor without parental authorisation on record.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Data Minimisation for Minors</h3>
                  <p>
                    We collect only the minimum data necessary to provide the educational service. We do not serve
                    behavioural advertising to users under 18. We do not share or sell any data of users under 18 to third
                    parties for commercial purposes.
                  </p>

                  <h3 className="text-lg font-bold text-foreground mt-6 mb-2">Parental Rights</h3>
                  <p>
                    Parents and guardians have the right to review the personal data we hold about their child, request
                    corrections to inaccurate data, withdraw consent and request deletion of their child's account and data
                    at any time, and restrict certain types of data processing. To exercise any of these rights, contact us at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 5. Data Sharing */}
              <section id="data-sharing" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Data Sharing</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>We do not sell your personal data. We share data only in the following limited circumstances:</p>
                  <ul className="space-y-3.5 list-none pl-0">
                    {[
                      "With AI service providers (Google Gemini, Sarvam AI) strictly for processing educational queries — these providers are contractually bound to data protection standards",
                      "With payment processors for subscription transactions — only transaction data necessary for processing is shared",
                      "With teachers on the platform, only the academic performance data of students who are enrolled under that teacher",
                      "With law enforcement or regulatory authorities when required by Indian law",
                      "With incubation partners or investors in anonymised, aggregated form only"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 6. Data Security */}
              <section id="data-security" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Key className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">6. Data Security</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We implement industry-standard security measures including encrypted data transmission using
                    HTTPS, secure storage of passwords using hashing, access controls limiting data access to authorised
                    personnel only, and regular security reviews.
                  </p>
                  <p>
                    However, no system is completely immune to risk. If you suspect a security breach affecting your account,
                    contact us immediately at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 7. Data Retention */}
              <section id="data-retention" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">7. Data Retention</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We retain your data for as long as your account is active. If you delete your account, we will delete or
                    anonymise your personal data within 30 days, except where retention is required by law.
                  </p>
                  <p>
                    Academic performance data may be retained in anonymised form for research and model improvement purposes
                    indefinitely.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 8. Your Rights */}
              <section id="your-rights" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">8. Your Rights</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Under applicable Indian law, you have the right to access, correct, and request deletion of your personal
                    data. You may also withdraw consent for specific types of processing.
                  </p>
                  <p>
                    To exercise these rights, write to us at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>
                    . We will respond within 15 business days.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 9. Cookies */}
              <section id="cookies" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Cookie className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">9. Cookies</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin uses cookies and similar technologies to maintain login sessions, remember preferences, and
                    analyse platform usage. You may disable cookies through your browser settings, but this may affect
                    certain platform features.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 10. Changes to This Policy */}
              <section id="policy-changes" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">10. Changes to This Policy</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We may update this Privacy Policy from time to time. We will notify registered users of material changes
                    via email and in-app notification at least 7 days before the changes take effect. Continued use of the
                    platform after the effective date constitutes acceptance of the updated policy.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 11. Contact Us */}
              <section id="contact-us" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">11. Contact Us</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>For any questions, concerns, or requests related to this Privacy Policy, contact:</p>
                  <div className="neu-inset rounded-2xl p-6 space-y-2 text-sm font-semibold">
                    <p className="text-foreground font-bold">SUPERGOAT TECHNOLOGIES PRIVATE LIMITED</p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline">
                        2003origin@gmail.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a href="https://o3origin.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        o3origin.com
                      </a>
                    </p>
                    <p className="text-muted-foreground font-medium">Agartala, Tripura, India</p>
                  </div>
                </div>
              </section>

            </div>
          </article>
        </div>

        {/* Footer info */}
        <footer className="mt-20 text-center text-xs text-muted-foreground border-t border-border/40 pt-8">
          <p>© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
