'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ChevronLeft,
  Check,
  Sparkles,
  MessageCircle,
  Users,
  Zap,
  Shield,
  Clock,
  Star,
  Loader2
} from 'lucide-react';
import type { User } from '@/types';

interface PremiumProps {
  user?: User | null;
  onBack: () => void;
  onSubscribe: (plan: string) => void;
}

interface PremiumPlan {
  id: string;
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: string[];
  notIncluded: string[];
  cta: string;
  popular: boolean;
  current: boolean;
  comingSoon?: boolean;
}

export default function Premium({ user, onBack, onSubscribe }: PremiumProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const plans: PremiumPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      description: 'Get started with basic features',
      features: [
        '5 tests per month',
        'Basic analytics',
        'Limited doubt solving (5/day)',
        'Community access',
      ],
      notIncluded: [
        'AI-generated DPPs',
        'Advanced analytics',
        '1-on-1 mentorship',
        'Priority support',
      ],
      cta: 'Current Plan',
      popular: false,
      current: !user?.isPremium,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: { monthly: 0, yearly: 0 },
      comingSoon: true,
      description: 'Most popular for serious aspirants',
      features: [
        'Unlimited tests',
        'Advanced AI analysis',
        'Unlimited doubt solving',
        'Personalized DPPs',
        'Priority support',
        'Detailed performance insights',
      ],
      notIncluded: [
        '1-on-1 mentorship',
        'Custom study plans',
      ],
      cta: 'Coming Soon',
      popular: true,
      current: false,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: { monthly: 0, yearly: 0 },
      comingSoon: true,
      description: 'Complete mentorship package',
      features: [
        'Everything in Pro',
        '1-on-1 mentorship',
        'Custom study plans',
        'Mock interview prep',
        '24/7 priority mentor',
        'Exclusive webinars',
        'Career guidance',
      ],
      notIncluded: [],
      cta: 'Coming Soon',
      popular: false,
      current: false,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    onSubscribe(planId);
    setIsProcessing(false);
    setSelectedPlan(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-primary/5 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-slate-200/50 dark:bg-slate-900/80 dark:border-slate-800/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Upgrade to Pro</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Unlock Your Full Potential</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Get unlimited access to AI-powered tests, personalized DPPs, and 24/7 doubt solving.
            Cancel anytime.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            Monthly
          </span>
          <Switch
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            Yearly
          </span>
          <Badge className="bg-green-100 text-green-600 ml-2">
            Save 33%
          </Badge>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative border-0 shadow-lg overflow-hidden dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10 ${plan.popular ? 'ring-primary scale-105' : ''
                }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-white text-center py-2 text-sm font-medium">
                  Most Popular
                </div>
              )}

              <CardContent className={`p-8 ${plan.popular ? 'pt-14' : ''}`}>
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      {plan.comingSoon ? 'Coming Soon' : `₹${billingCycle === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}`}
                    </span>
                    {!plan.comingSoon && <span className="text-slate-500 dark:text-slate-400">/month</span>}
                  </div>
                  {!plan.comingSoon && billingCycle === 'yearly' && plan.price.yearly > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      ₹{plan.price.yearly} billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 opacity-50">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-slate-400 text-xs">−</span>
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400 line-through">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={plan.current || isProcessing}
                  className={`w-full rounded-full py-6 ${plan.current
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : plan.popular
                      ? 'bg-primary text-white hover:opacity-90'
                      : 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600'
                    }`}
                >
                  {isProcessing && selectedPlan === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : plan.current ? (
                    'Current Plan'
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <Card className="border-0 shadow-soft mb-12 dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">
              Why Upgrade to Pro?
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: () => <img src="/ai-bot.png" className="w-7 h-7 object-cover rounded-lg" />,
                  title: 'AI-Powered Learning',
                  description: 'Personalized tests and DPPs based on your weak areas',
                },
                {
                  icon: MessageCircle,
                  title: '24/7 Doubt Solving',
                  description: 'Get instant solutions anytime, even at 2 AM',
                },
                {
                  icon: Users,
                  title: 'Expert Mentorship',
                  description: 'Learn from IITians who have cracked JEE',
                },
                {
                  icon: Zap,
                  title: 'Advanced Analytics',
                  description: 'Track every concept and predict your rank',
                },
              ].map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden p-2">
                    <img src="/ai-bot.png" alt="AI" className="w-full h-full object-cover rounded-lg" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>



        {/* FAQ */}
        <Card className="border-0 shadow-soft dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">
              Frequently Asked Questions
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
                },
                {
                  q: "Is there a free trial?",
                  a: "Yes! Pro and Premium plans come with a 7-day free trial. No credit card required to start.",
                },
                {
                  q: "What payment methods are accepted?",
                  a: "We accept UPI, credit/debit cards, net banking, and wallets via Razorpay.",
                },
                {
                  q: "Can I switch plans later?",
                  a: "Absolutely! You can upgrade or downgrade your plan at any time from your profile settings.",
                },
              ].map((faq, index) => (
                <div key={index}>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{faq.q}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-12 text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="text-sm">Secure Payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm">7-Day Free Trial</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span className="text-sm">Cancel Anytime</span>
          </div>
        </div>
      </main>
    </div>
  );
}
