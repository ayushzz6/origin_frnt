'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Heart, Lock, Eye, CheckCircle2, UserCheck, AlertTriangle, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'our-commitment', title: 'Our Commitment', icon: Heart },
  { id: 'age-verification', title: '1. Age & Consent', icon: UserCheck },
  { id: 'no-payments', title: '2. No Minor Payments', icon: Lock },
  { id: 'safe-content', title: '3. Safe Environment', icon: Shield },
  { id: 'data-protection', title: '4. Data Protection', icon: Eye },
  { id: 'parental-rights', title: '5. Parental Controls', icon: CheckCircle2 },
  { id: 'reporting', title: '6. Reporting Concerns', icon: AlertTriangle },
  { id: 'changes', title: '7. Policy Changes', icon: Mail },
];

export default function ChildrensSafetyPolicy() {
  const [activeSection, setActiveSection] = useState('our-commitment');

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
    <div className="min-h-screen bg-background text-foreground font-sans relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30 dark:opacity-20">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px] animate-pulse" />
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
            <div className="p-2 rounded-full bg-secondary/50 border border-border group-hover:scale-105 transition-transform">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Home
          </Link>
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase bg-secondary/50 border border-border px-3 py-1 rounded-full">
            CHILD SAFETY
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Children's Safety Policy
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-4">
            Our absolute commitment to protecting students under 18 on the O3 Origin platform.
          </p>
          <div className="flex justify-center items-center gap-2 flex-wrap text-xs text-muted-foreground font-bold uppercase tracking-widest bg-secondary/35 border border-border/40 px-4 py-2 rounded-full w-max mx-auto">
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
            <div className="p-6 bg-card/60 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary opacity-30" />
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
                      className={`flex items-center gap-3.5 px-4.5 py-3.5 text-sm font-bold rounded-2xl text-left transition-all duration-300 ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
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
            <div className="p-8 sm:p-12 bg-card/60 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl space-y-12">
              
              {/* Commitment */}
              <section id="our-commitment" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Heart className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Our Commitment</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin's primary users are students under 18 preparing for JEE and NEET. We take the safety,
                    privacy, and wellbeing of every minor on our platform as our most important responsibility.
                  </p>
                  <p>
                    This safety policy explains exactly how we protect children, what rules govern their interaction,
                    and what rights parents and guardians have to control their child's educational experience.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 1. Age Verification and Parental Consent */}
              <section id="age-verification" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">1. Age Verification and Parental Consent</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Every user who registers on O3 Origin must provide their date of birth. Users whose age indicates they
                    are below 18 are automatically identified as minor users. The following rules apply to all minor users
                    without exception:
                  </p>
                  <ul className="space-y-3.5 mt-4 list-none pl-0">
                    {[
                      "A parent or legal guardian's email address must be provided during registration",
                      "A consent verification email is sent to the parent or guardian immediately",
                      "The account is not activated until the parent or guardian completes verification",
                      "The parent or guardian must confirm they have read and accepted the Terms and Conditions and Privacy Policy on behalf of the minor"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 bg-primary/5 border border-primary/20 p-5 rounded-2xl text-sm font-semibold leading-relaxed">
                    O3 Origin will not knowingly activate an account for a user under 18 without completed parental consent
                    verification. Accounts found to have bypassed this process using false date of birth information will be
                    suspended immediately upon discovery.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 2. No Independent Payments by Minors */}
              <section id="no-payments" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">2. No Independent Payments by Minors</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p className="text-lg font-bold text-foreground">
                    This is an absolute rule on O3 Origin with no exceptions.
                  </p>
                  <p>
                    No user under 18 may independently initiate, authorise, or complete any payment transaction on O3
                    Origin. This includes subscription purchases, plan upgrades, and any future in-app purchases.
                  </p>
                  <p>
                    All financial transactions for minor users must be:
                  </p>
                  <ul className="space-y-3.5 mt-4 list-none pl-0">
                    {[
                      "Initiated by a parent or legal guardian",
                      "Completed using the parent's or guardian's own payment method",
                      "Made from an account or device belonging to the parent or guardian"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    O3 Origin implements technical safeguards to prevent payment by minor accounts. If a payment is
                    found to have been made independently by a verified minor, O3 Origin will cancel the subscription and
                    issue a full refund to the payment source. The parent or guardian will be notified immediately.
                  </p>
                  <p className="mt-4">
                    If you believe your child has made an unauthorised payment, contact us immediately at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>
                    . We will investigate and resolve the matter within 5 business days.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 3. Safe Content Environment */}
              <section id="safe-content" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">3. Safe Content Environment</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    O3 Origin is a strictly educational platform. We ensure:
                  </p>
                  <ul className="space-y-3.5 list-none pl-0">
                    {[
                      "All AI-generated content is filtered for educational relevance and age appropriateness",
                      "No advertisements are served to users under 18",
                      "No behavioural profiling for commercial purposes is applied to minor users",
                      "Community features are moderated and inappropriate content is removed promptly",
                      "Students cannot be contacted by teachers or other users outside of structured educational interactions on the platform"
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

              {/* 4. Data Protection for Minors */}
              <section id="data-protection" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">4. Data Protection for Minors</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We apply the highest level of data protection to all minor users:
                  </p>
                  <ul className="space-y-3.5 list-none pl-0">
                    {[
                      "We collect only the minimum data necessary to provide the educational service",
                      "Data of minor users is never sold or shared with third parties for commercial purposes",
                      "AI service providers who process student data are contractually bound to data protection standards",
                      "Performance data of minor users is stored securely and accessible only to the student and their parent or guardian upon request",
                      "We comply with India's Digital Personal Data Protection Act 2023 (DPDPA) requirements for processing children's data"
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

              {/* 5. Parental Rights and Controls */}
              <section id="parental-rights" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">5. Parental Rights and Controls</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    Parents and guardians of minor users have the following rights:
                  </p>
                  <ul className="space-y-3.5 list-none pl-0">
                    {[
                      "Right to access: Request a complete report of all data held about their child",
                      "Right to correct: Request correction of any inaccurate information",
                      "Right to delete: Request full deletion of their child's account and all associated data",
                      "Right to withdraw consent: Withdraw consent for their child's use of the platform at any time",
                      "Right to restrict: Restrict specific types of data processing for their child"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    To exercise any of these rights, email us at{' '}
                    <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline font-bold">
                      2003origin@gmail.com
                    </a>{' '}
                    with the subject line <strong>'Parental Rights Request'</strong> along with the child's registered
                    email and proof of your relationship to the child. We will respond within 15 business days.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 6. Reporting Concerns */}
              <section id="reporting" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">6. Reporting Concerns</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    If you are a student, parent, teacher, or any other person who has a concern about the safety or
                    wellbeing of a minor on O3 Origin, please contact us immediately:
                  </p>
                  <div className="bg-secondary/40 border border-border p-6 rounded-2xl space-y-2 text-sm font-semibold">
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <a href="mailto:2003origin@gmail.com" className="text-primary hover:underline">
                        2003origin@gmail.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Subject:</span> Child Safety Concern
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a href="https://o3origin.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        o3origin.com
                      </a>
                    </p>
                  </div>
                  <p className="mt-4">
                    We treat every child safety concern as a priority and will investigate and respond within 24 hours on
                    working days.
                  </p>
                </div>
              </section>

              <hr className="border-border/40" />

              {/* 7. Changes to This Policy */}
              <section id="changes" className="scroll-mt-36">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">7. Changes to This Policy</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-4 font-medium">
                  <p>
                    We may update this Children's Safety Policy to reflect changes in law, technology, or platform features.
                    Parents and guardians of minor users will be notified by email of any material changes at least 7 days
                    before they take effect.
                  </p>
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
