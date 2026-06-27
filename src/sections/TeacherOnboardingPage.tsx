'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Briefcase,
    BookOpen,
    Users,
    Youtube,
    Building2,
    Share2,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    School,
    GraduationCap
} from 'lucide-react';
import type { User } from '@/types';
import { completeOnboardingAction } from '@/server/actions/profile-actions';

interface TeacherOnboardingPageProps {
    user: User;
    onComplete: (data: Partial<User>) => void | Promise<void>;
}

export default function TeacherOnboardingPage({ onComplete }: TeacherOnboardingPageProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        yearsOfExperience: '',
        subjects: [] as string[],
        referralSource: '',
        studentCapacity: ''
    });

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const handleNext = async () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            try {
                const response = await completeOnboardingAction({
                    yearsOfExperience: formData.yearsOfExperience,
                    subjects: formData.subjects,
                    referralSource: formData.referralSource,
                    studentCapacity: formData.studentCapacity
                });
                await onComplete(response);
            } catch (error) {
                console.error('Failed to complete teacher onboarding:', error);
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
                return formData.yearsOfExperience !== '';
            case 2:
                return formData.subjects.length > 0;
            case 3:
                return formData.referralSource !== '';
            case 4:
                return formData.studentCapacity !== '';
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
                                    src="/Origin-Teacher-Logo.png"
                                    alt="ORIGIN Teacher"
                                    className="h-16 w-auto"
                                />
                            </div>
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3CACA3]/10 to-[#1E3A5F]/10 flex items-center justify-center mb-4">
                                <Briefcase className="w-8 h-8 text-[#3CACA3]" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Years of Experience</h2>
                            <p className="text-slate-600 dark:text-slate-400">How long have you been teaching?</p>
                        </div>

                        <RadioGroup
                            value={formData.yearsOfExperience}
                            onValueChange={(value) => setFormData({ ...formData, yearsOfExperience: value })}
                            className="grid grid-cols-2 gap-4"
                        >
                            {[
                                { value: '0-2', label: '0-2 Years', desc: 'Just starting out' },
                                { value: '3-5', label: '3-5 Years', desc: 'Experienced' },
                                { value: '6-10', label: '6-10 Years', desc: 'Seasoned Professional' },
                                { value: '10+', label: '10+ Years', desc: 'Expert' }
                            ].map((option) => (
                                <div key={option.value}>
                                    <RadioGroupItem
                                        value={option.value}
                                        id={option.value}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={option.value}
                                        className="flex flex-col items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-[#3CACA3]/50 dark:hover:border-[#3CACA3]/50 peer-data-[state=checked]:border-[#3CACA3] peer-data-[state=checked]:bg-[#3CACA3]/5 dark:peer-data-[state=checked]:bg-[#3CACA3]/10"
                                    >
                                        <span className="font-semibold text-slate-900 dark:text-white">{option.label}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.desc}</span>
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
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3CACA3]/10 to-[#1E3A5F]/10 flex items-center justify-center mb-4">
                                <BookOpen className="w-8 h-8 text-[#3CACA3]" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Subject Expertise</h2>
                            <p className="text-slate-600 dark:text-slate-400">Select subjects you are an expert in</p>
                        </div>

                        <div className="space-y-3">
                            {[
                                { value: 'physics', label: 'Physics', desc: 'Mechanics, Electromagnetism, Optics' },
                                { value: 'chemistry', label: 'Chemistry', desc: 'Organic, Inorganic, Physical' },
                                { value: 'mathematics', label: 'Mathematics', desc: 'Algebra, Calculus, Trig' },
                                { value: 'biology', label: 'Biology', desc: 'Botany, Zoology' }
                            ].map((subject) => (
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
                                        className="flex items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-[#3CACA3]/50 dark:hover:border-[#3CACA3]/50 peer-data-[state=checked]:border-[#3CACA3] peer-data-[state=checked]:bg-[#3CACA3]/5 dark:peer-data-[state=checked]:bg-[#3CACA3]/10"
                                    >
                                        <div className="flex-1">
                                            <span className="font-semibold text-slate-900 dark:text-white block">{subject.label}</span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400">{subject.desc}</span>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5 text-[#3CACA3] opacity-0 peer-data-[state=checked]:opacity-100" />
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3CACA3]/10 to-[#1E3A5F]/10 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-[#3CACA3]" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">How did you hear about us?</h2>
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
                                        className="flex flex-col items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-[#3CACA3]/50 dark:hover:border-[#3CACA3]/50 peer-data-[state=checked]:border-[#3CACA3] peer-data-[state=checked]:bg-[#3CACA3]/5 dark:peer-data-[state=checked]:bg-[#3CACA3]/10"
                                    >
                                        <option.icon className="w-6 h-6 text-[#3CACA3] mb-2" />
                                        <span className="font-medium text-slate-900 dark:text-white">{option.label}</span>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3CACA3]/10 to-[#1E3A5F]/10 flex items-center justify-center mb-4">
                                <School className="w-8 h-8 text-[#3CACA3]" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Student Capacity</h2>
                            <p className="text-slate-600 dark:text-slate-400">How many students can you bring to joy?</p>
                        </div>

                        <RadioGroup
                            value={formData.studentCapacity}
                            onValueChange={(value) => setFormData({ ...formData, studentCapacity: value })}
                            className="grid grid-cols-1 gap-3"
                        >
                            {[
                                { value: '50-100', label: '50 - 100 Students', desc: 'Small Batch' },
                                { value: '101-500', label: '101 - 500 Students', desc: 'Medium Batch' },
                                { value: '501-1000', label: '501 - 1000 Students', desc: 'Large Batch' },
                                { value: '1000+', label: '1000+ Students', desc: 'Institution Level' }
                            ].map((option) => (
                                <div key={option.value}>
                                    <RadioGroupItem
                                        value={option.value}
                                        id={option.value}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={option.value}
                                        className="flex items-center p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-[#3CACA3]/50 dark:hover:border-[#3CACA3]/50 peer-data-[state=checked]:border-[#3CACA3] peer-data-[state=checked]:bg-[#3CACA3]/5 dark:peer-data-[state=checked]:bg-[#3CACA3]/10"
                                    >
                                        <div className="flex-1">
                                            <span className="font-semibold text-slate-900 dark:text-white block">{option.label}</span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400">{option.desc}</span>
                                        </div>
                                        <GraduationCap className="w-5 h-5 text-[#3CACA3] opacity-0 peer-data-[state=checked]:opacity-100" />
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
        <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 neu-surface text-foreground transition-colors duration-300">
            <Card className="w-full max-w-lg neu-raised border-0 shadow-none">
                <CardContent className="p-5 sm:p-8">
                    {/* Progress */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Step {step} of {totalSteps}</span>
                            <span className="text-sm font-medium text-[#3CACA3]">{Math.round(progress)}%</span>
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
                            className="flex-1 h-12 bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] hover:opacity-90 text-white rounded-xl font-medium disabled:opacity-50"
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
