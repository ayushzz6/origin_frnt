'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowLeft, Search, Check, ChevronDown, BookOpen, Users, Lock, CreditCard, Laptop, Settings } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All FAQs', icon: HelpCircle },
  { id: 'general', label: 'General', icon: BookOpen },
  { id: 'students', label: 'For Students', icon: Users },
  { id: 'parents', label: 'For Parents', icon: Lock },
  { id: 'teachers', label: 'For Teachers', icon: Settings },
  { id: 'pricing', label: 'Pricing & Plans', icon: CreditCard },
  { id: 'technical', label: 'Technical Support', icon: Laptop },
];

const FAQS = [
  // General
  {
    category: 'general',
    question: 'What is O3 Origin?',
    answer: 'O3 Origin is an AI-powered education platform that helps students prepare for JEE, NEET, and other competitive examinations. Unlike other platforms that give you more content, Origin first diagnoses exactly where you are going wrong and why — then teaches the fix in the style of your favourite teacher.'
  },
  {
    category: 'general',
    question: 'What does O3 stand for?',
    answer: 'O3 stands for Observe, Optimise, Own — the three steps of our core learning loop. Like the ozone layer that protects the Earth invisibly, O3 Origin is the invisible intelligence layer protecting every student\'s preparation.'
  },
  {
    category: 'general',
    question: 'Who built O3 Origin?',
    answer: 'O3 Origin is built by SUPERGOAT TECHNOLOGIES PRIVATE LIMITED, founded by Dipraj Biswas (CEO, NIT Agartala) and Ayush Pal (CTO, IIT Madras). We are a student-founded startup building from Agartala, Tripura.'
  },
  {
    category: 'general',
    question: 'Is O3 Origin only for JEE and NEET?',
    answer: 'We are currently focused on JEE Main, JEE Advanced, and NEET preparation. We plan to expand to other competitive examinations including UPSC, state board exams, and Class 9-10 foundation courses in future updates.'
  },
  // For Students
  {
    category: 'students',
    question: 'How does Origin diagnose my weak areas?',
    answer: 'When you take a chapter test or full mock on Origin, our AI analyses every question you answered — not just whether you got it right or wrong, but how long you took, which options you considered, and what kind of mistake was made. It identifies the precise root cause: whether it is a conceptual gap, a formula misapplication, a procedural error, or a time-pressure failure.'
  },
  {
    category: 'students',
    question: 'What is a DPP and how is mine personalised?',
    answer: 'DPP stands for Daily Practice Problems. On most platforms, DPPs are the same for all students. On Origin, your DPP is generated based specifically on your diagnosed weak sub-topics. If you struggled with Carnot cycle efficiency, your DPP will target exactly that — not all of thermodynamics.'
  },
  {
    category: 'students',
    question: 'What is the Room feature?',
    answer: 'The Room feature lets you and your friends take tests together in real time using a shared room code — similar to how you join a game in Ludo. You can compete, see a live leaderboard, and share results. It makes studying with friends competitive and fun.'
  },
  {
    category: 'students',
    question: 'What is OGCode?',
    answer: 'OGCode is our structured problem-solving section where you can browse and solve problems organised by subject, topic, and subtopic. If you get stuck, you can use the AI Solver directly from within OGCode to get a step-by-step explanation.'
  },
  {
    category: 'students',
    question: 'Can I use O3 Origin for free?',
    answer: 'Yes. O3 Origin has a free tier that includes 5 AI doubt solves per day, chapter-wise tests, a basic weakness report, formula sheets, 5 DPPs per week, and community access. Paid plans unlock unlimited access to all features.'
  },
  // For Parents
  {
    category: 'parents',
    question: 'Is O3 Origin safe for my child?',
    answer: 'Yes. O3 Origin is designed specifically for students and takes the protection of minors extremely seriously. We do not serve advertisements. We do not share your child\'s data with third parties for commercial purposes. All content on the platform is strictly educational.'
  },
  {
    category: 'parents',
    question: 'Can my child pay for a subscription themselves?',
    answer: 'No. Users under 18 are strictly prohibited from making any payment independently on O3 Origin. All subscription purchases for minor users must be made by a parent or legal guardian. If you discover an unauthorised transaction, contact us immediately at 2003origin@gmail.com.'
  },
  {
    category: 'parents',
    question: 'Do I need to give consent for my child to use Origin?',
    answer: 'Yes. Students under 18 require verified parental or guardian consent before their account is activated. During registration, you will receive a consent verification email. The account will not be active until you confirm your consent.'
  },
  {
    category: 'parents',
    question: 'Can I view my child\'s progress on Origin?',
    answer: 'Yes. Parents can request a progress report for their child\'s account at any time by contacting us at 2003origin@gmail.com. We are building a dedicated parent dashboard that will be available in a future update.'
  },
  {
    category: 'parents',
    question: 'How do I delete my child\'s account?',
    answer: 'Contact us at 2003origin@gmail.com with your child\'s registered email address and your relationship to the student. We will delete the account and all personal data associated with it within 30 days.'
  },
  // For Teachers
  {
    category: 'teachers',
    question: 'How does the teacher marketplace work?',
    answer: 'Teachers join Origin and create an AI agent trained on their teaching style, explanations, and content — with their full written consent. Students can choose to learn from your AI agent, available 24 hours a day. Your reputation on the platform grows automatically based on how well your students perform, not on how famous you already are.'
  },
  {
    category: 'teachers',
    question: 'How much do I earn as a teacher on Origin?',
    answer: 'Teachers earn 60% of all subscription revenue generated by students enrolled under their AI agent. Earnings are calculated monthly and paid out subject to a minimum threshold. You also retain full ownership of your content.'
  },
  {
    category: 'teachers',
    question: 'Can I withdraw consent for my AI agent at any time?',
    answer: 'Yes. You can withdraw consent and request removal of your AI agent at any time by writing to 2003origin@gmail.com. Your agent will be deactivated within 7 business days of your request.'
  },
  {
    category: 'teachers',
    question: 'Do I need technical knowledge to join?',
    answer: 'No. The AI agent creation process is handled entirely by the Origin team with your participation. You do not need any technical skills — just your teaching expertise and willingness to share it.'
  },
  // Pricing and Subscriptions
  {
    category: 'pricing',
    question: 'What are the pricing plans?',
    answer: 'Origin offers a Free tier, a Pro plan (per subject or all subjects bundle) for unlimited AI-powered preparation, and an Elite plan that adds Teacher AI Agent access, custom study roadmaps, and parent progress reports. Exact pricing is displayed on the pricing page at o3origin.com.'
  },
  {
    category: 'pricing',
    question: 'Can I cancel my subscription?',
    answer: 'Yes. You can cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing cycle. You will retain access to paid features until the cycle ends.'
  },
  {
    category: 'pricing',
    question: 'Is there a refund policy?',
    answer: 'Refunds are available in limited cases — technical failure exceeding 72 hours, duplicate payment due to platform error, or verified payment made independently by a minor. Submit refund requests to 2003origin@gmail.com within 7 days of the transaction.'
  },
  // Technical
  {
    category: 'technical',
    question: 'What devices does O3 Origin support?',
    answer: 'O3 Origin is accessible on any modern web browser on desktop, laptop, tablet, and mobile devices. A dedicated mobile app is in development and will be announced on our Instagram @o3.origin.'
  },
  {
    category: 'technical',
    question: 'Is my data secure?',
    answer: 'Yes. All data is transmitted using HTTPS encryption. Passwords are stored using secure hashing. We conduct regular security reviews and restrict data access to authorised personnel only.'
  },
  {
    category: 'technical',
    question: 'What if I face a technical issue?',
    answer: 'Contact our support team at 2003origin@gmail.com with a description of the issue and your registered email address. We aim to respond within 24 hours on working days.'
  }
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen neu-surface text-foreground font-sans relative overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30 dark:opacity-20">
        <div className="absolute top-[-10%] right-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
            FAQ Blueprints
          </span>
        </div>

        {/* Page Title */}
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed mb-8">
            Everything students, parents, and teachers need to know about O3 Origin.
          </p>

          {/* Search bar */}
          <div className="relative max-w-2xl mx-auto neu-inset rounded-2xl flex items-center px-4">
            <Search className="text-muted-foreground w-5 h-5 shrink-0" />
            <input
              type="text"
              placeholder="Search policies, payments, AI doubt solvers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-2 py-4 bg-transparent outline-none text-sm font-semibold"
              id="faq-search-input"
            />
          </div>
        </header>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setExpandedIndex(null);
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  isSelected
                    ? 'neu-raised text-primary'
                    : 'text-muted-foreground hover:neu-raised hover:text-foreground'
                }`}
                id={`faq-tab-${cat.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQ Accordion List */}
        <div className="max-w-4xl mx-auto space-y-4 min-h-[300px]">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <div
                  key={index}
                  className={`neu-raised rounded-2xl transition-all duration-300 ${
                    isExpanded ? 'ring-1 ring-primary/20' : ''
                  }`}
                >
                  <button
                    onClick={() => handleToggle(index)}
                    className="w-full px-6 py-5.5 flex items-center justify-between text-left gap-4 outline-none group"
                    id={`faq-question-btn-${index}`}
                  >
                    <span className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                      {faq.question}
                    </span>
                    <div
                      className={`p-1.5 rounded-lg transition-transform duration-300 shrink-0 ${
                        isExpanded ? 'rotate-180 text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>
                  <div
                    className={`transition-all duration-350 overflow-hidden ${
                      isExpanded ? 'max-h-[500px] border-t border-border/20' : 'max-h-0'
                    }`}
                  >
                    <div className="px-6 py-5 text-muted-foreground font-medium leading-relaxed text-sm sm:text-base neu-inset rounded-b-2xl">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 neu-raised rounded-3xl">
              <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 stroke-1 animate-pulse" />
              <p className="text-lg font-bold text-muted-foreground">No questions found matching "{searchQuery}"</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-5 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <footer className="mt-20 text-center text-xs text-muted-foreground border-t border-border/40 pt-8">
          <p>© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
