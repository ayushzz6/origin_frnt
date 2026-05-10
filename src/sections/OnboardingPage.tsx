'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  BookOpen,
  Users,
  Youtube,
  Building2,
  Share2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Target,
} from 'lucide-react';
import type { User } from '@/types';
import { completeOnboardingAction } from '@/server/actions/profile-actions';

interface OnboardingPageProps {
  user: User;
  onComplete: (data: Partial<User>) => void | Promise<void>;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    class: '',
    isDropper: false,
    selectedCourse: '',
    subjects: [] as string[],
    referralSource: '',
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      try {
        const response = await completeOnboardingAction({
          class: formData.class,
          isDropper: formData.isDropper,
          selectedCourse: formData.selectedCourse,
          subjects: formData.subjects,
          referralSource: formData.referralSource,
        });
        await onComplete(response);
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.class !== '';
      case 2:
        return formData.selectedCourse !== '';
      case 3:
        return formData.subjects.length > 0;
      case 4:
        return formData.referralSource !== '';
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <img
                  src="/origin-new.jpg"
                  alt="ORIGIN Student"
                  className="h-16 w-auto"
                />
              </div>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Which class are you in?</h2>
              <p className="text-slate-600 dark:text-slate-400">This helps us personalize your learning experience</p>
            </div>

            <RadioGroup
              value={formData.class}
              onValueChange={(value) => setFormData({ ...formData, class: value, isDropper: value === 'dropper' })}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { value: '9', label: 'Class 9', desc: 'Foundation' },
                { value: '10', label: 'Class 10', desc: 'Board + Foundation' },
                { value: '11', label: 'Class 11', desc: 'JEE/NEET Prep' },
                { value: '12', label: 'Class 12', desc: 'Final Stretch' },
                { value: 'dropper', label: 'Dropper', desc: 'One More Try' },
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex flex-col items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-primary/50 dark:hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 dark:peer-data-[state=checked]:bg-primary/10"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white">{option.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">{option.desc}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Choose your course</h2>
              <p className="text-slate-600 dark:text-slate-400">Select the exam you are preparing for</p>
            </div>

            <RadioGroup
              value={formData.selectedCourse}
              onValueChange={(value) => setFormData({ ...formData, selectedCourse: value, subjects: [] })}
              className="space-y-3"
            >
              {[
                { value: 'JEE', label: 'JEE (Main + Advanced)', desc: 'Engineering Entrance Exam' },
                { value: 'NEET', label: 'NEET (UG)', desc: 'Medical Entrance Exam' },
                ...(['9', '10'].includes(formData.class) ? [{ value: 'Foundation', label: 'Foundation (9th/10th)', desc: 'Early Prep for JEE/NEET' }] : []),
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-primary/50 dark:hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 dark:peer-data-[state=checked]:bg-primary/10"
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-slate-900 dark:text-white block">{option.label}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{option.desc}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden p-2">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Select your subjects</h2>
              <p className="text-slate-600 dark:text-slate-400">We will tailor your experience based on these</p>
            </div>

            <div className="space-y-3">
              {(formData.selectedCourse === 'JEE'
                ? [
                  { value: 'Physics', label: 'Physics', desc: 'Mechanics, Electricity, Modern Physics' },
                  { value: 'Chemistry', label: 'Chemistry', desc: 'Organic, Inorganic, Physical' },
                  { value: 'Mathematics', label: 'Mathematics', desc: 'Calculus, Algebra, Geometry' },
                ]
                : formData.selectedCourse === 'NEET'
                  ? [
                    { value: 'Physics', label: 'Physics', desc: 'Mechanics, Electricity, Modern Physics' },
                    { value: 'Chemistry', label: 'Chemistry', desc: 'Organic, Inorganic, Physical' },
                    { value: 'Biology', label: 'Biology', desc: 'Botany, Zoology' },
                  ]
                  : [
                    { value: 'Physics', label: 'Physics', desc: 'Foundation Concepts' },
                    { value: 'Chemistry', label: 'Chemistry', desc: 'Foundation Concepts' },
                    { value: 'Mathematics', label: 'Mathematics', desc: 'Foundation Concepts' },
                    { value: 'Biology', label: 'Biology', desc: 'Foundation Concepts' },
                  ]
              ).map((subject) => (
                <div key={subject.value}>
                  <Checkbox
                    id={subject.value}
                    checked={formData.subjects.includes(subject.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          subjects: [...formData.subjects, subject.value],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          subjects: formData.subjects.filter((s) => s !== subject.value),
                        });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <Label
                    htmlFor={subject.value}
                    className="flex items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-primary/50 dark:hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 dark:peer-data-[state=checked]:bg-primary/10"
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-slate-900 dark:text-white block">{subject.label}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{subject.desc}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">How did you hear about ORIGIN?</h2>
              <p className="text-slate-600 dark:text-slate-400">Help us understand our reach</p>
            </div>

            <RadioGroup
              value={formData.referralSource}
              onValueChange={(value) => setFormData({ ...formData, referralSource: value })}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { value: 'friends', label: 'Friends', icon: Users },
                { value: 'youtube', label: 'YouTube', icon: Youtube },
                { value: 'coaching', label: 'Coaching', icon: Building2 },
                { value: 'social', label: 'Social Media', icon: Share2 },
                { value: 'other', label: 'Other', icon: BookOpen },
              ].map((option) => (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex flex-col items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-primary/50 dark:hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 dark:peer-data-[state=checked]:bg-primary/10"
                  >
                    <option.icon className="w-6 h-6 text-primary mb-2" />
                    <span className="font-medium text-slate-900 dark:text-white">{option.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 transition-colors duration-300">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-lg border-0 shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl dark:ring-1 dark:ring-white/10">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Step {step} of {totalSteps}</span>
              <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-800" />
          </div>

          {/* Step Content */}
          {renderStep()}

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-12 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex-1 h-12 bg-primary hover:opacity-90 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {step === totalSteps ? (
                <>
                  Complete Setup
                  <Sparkles className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
