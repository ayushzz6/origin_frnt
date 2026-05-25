"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Building2, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Upload, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherWorkspace, WorkspaceCode } from "@/server/workspaces/types";

type OnboardingResult = { workspace: TeacherWorkspace; joinCode: WorkspaceCode };
type Availability =
  | { available: true; normalizedCode: string; displayCode: string }
  | { available: false; reason: string; normalizedCode: string | null };

const STEPS = [
  { id: "type", label: "Workspace Type" },
  { id: "details", label: "Workspace Details" },
  { id: "attribution", label: "Attribution & Confirm" }
];

const STATE_CITIES: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun"],
  "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Nagaon"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar"],
  "Haryana": ["Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Davangere", "Ballari"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Alappuzha"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Kolhapur", "Navi Mumbai"],
  "Manipur": ["Imphal"],
  "Meghalaya": ["Shillong"],
  "Mizoram": ["Aizawl"],
  "Nagaland": ["Kohima", "Dimapur"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Puri"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar"],
  "Sikkim": ["Gangtok"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Vellore"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  "Tripura": ["Agartala"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Allahabad", "Bareilly", "Aligarh"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Asansol", "Durgapur", "Kharagpur"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini"],
  "Jammu & Kashmir": ["Srinagar", "Jammu", "Anantnag"],
  "Ladakh": ["Leh", "Kargil"],
  "Puducherry": ["Puducherry", "Karaikal"]
};

export function TeacherOnboardingForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [workspaceType, setWorkspaceType] = useState<"personal" | "institute">("personal");
  
  // Form State
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [rawCode, setRawCode] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [capacity, setCapacity] = useState<number>(50);
  const [logoPreview, setLogoPreview] = useState<string>("/origin-new.jpg"); // Bind to origin logo asset
  
  // Organization Code Check state
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submission State
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (workspaceType !== "institute" || !rawCode.trim()) {
      setAvailability(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const result = await apiJson<Availability>("/api/teacher/codes/check", {
        method: "POST",
        json: { rawDisplay: rawCode },
      });
      setChecking(false);
      if (result.ok) {
        setAvailability(result.data);
      } else {
        setAvailability({ available: false, reason: "Error checking code availability", normalizedCode: null });
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawCode, workspaceType]);

  const handleSubjectChange = (subject: string, checked: boolean) => {
    setSelectedSubjects(prev => 
      checked ? [...prev, subject] : prev.filter(s => s !== subject)
    );
  };

  const handleCourseChange = (course: string, checked: boolean) => {
    setSelectedCourses(prev => 
      checked ? [...prev, course] : prev.filter(c => c !== course)
    );
  };

  const nextStep = () => {
    if (currentStep === 0) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!displayName.trim()) {
        setError("Display name is required.");
        return;
      }
      if (workspaceType === "institute" && !rawCode.trim()) {
        setError("Organization code is required.");
        return;
      }
      if (workspaceType === "institute" && availability && !availability.available) {
        setError(availability.reason);
        return;
      }
      setError(null);
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getFilteredCities = () => {
    if (!state) return [];
    const cities = STATE_CITIES[state] ?? [];
    if (!city.trim()) return cities;
    return cities.filter(c => c.toLowerCase().includes(city.toLowerCase()));
  };

  async function submit() {
    setError(null);
    if (workspaceType === "institute" && availability && !availability.available) {
      setError(availability.reason);
      return;
    }

    const payload = {
      workspaceType,
      displayName: displayName.trim(),
      subjects: selectedSubjects,
      city: city.trim() || null,
      state: state.trim() || null,
      ...(workspaceType === "institute" && {
        legalName: legalName.trim() || null,
        rawCode: rawCode.trim(),
        courses: selectedCourses,
      })
    };

    const result = await apiJson<OnboardingResult>("/api/teacher/onboarding", {
      method: "POST",
      json: payload,
    });

    if (!result.ok) {
      setError(result.detail);
      return;
    }

    // Success - redirect to teacher workspace
    router.push(`/teacher/workspaces/${result.data.workspace.id}`);
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* OnboardingProgressBar */}
      <div className="relative flex justify-between items-center w-full px-4 mb-4">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > index;
          const isActive = currentStep === index;
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : isActive 
                    ? "bg-background border-primary text-primary shadow-[0_0_15px_rgba(56,189,248,0.4)]"
                    : "bg-muted border-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <span>{index + 1}</span>}
              </div>
              <span className={`mt-2 text-xs font-medium hidden sm:block ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Steps Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-medium">Select your workspace type</h2>
                <p className="text-sm text-muted-foreground">Choose the setup that fits your teaching model.</p>
              </div>

              {/* WorkspaceTypeSelector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                  onClick={() => setWorkspaceType("personal")}
                  className={`cursor-pointer transition-all duration-300 relative overflow-hidden border-2 ${
                    workspaceType === "personal" 
                      ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(56,189,248,0.15)]" 
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors mb-2 ${
                      workspaceType === "personal" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <User className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Personal Teacher</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Perfect for independent tutors, private instructors, or class batches. Quick setup to manage your own learners.
                  </CardContent>
                  {workspaceType === "personal" && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-black font-bold" />
                    </div>
                  )}
                </Card>

                <Card 
                  onClick={() => setWorkspaceType("institute")}
                  className={`cursor-pointer transition-all duration-300 relative overflow-hidden border-2 ${
                    workspaceType === "institute" 
                      ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(56,189,248,0.15)]" 
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors mb-2 ${
                      workspaceType === "institute" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Coaching Institute</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    For academies, learning centers, and institutions. Supports multi-teacher staff, custom org-codes, and scalable batches.
                  </CardContent>
                  {workspaceType === "institute" && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-black font-bold" />
                    </div>
                  )}
                </Card>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={nextStep} className="gap-2 bg-primary hover:bg-primary/95 text-black font-semibold">
                  Next Step <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <Card className="border border-border/80 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">
                  {workspaceType === "personal" ? "Personal Teacher Details" : "Institute Details"}
                </CardTitle>
                <CardDescription>Provide basic details about your setup.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="display-name">
                    {workspaceType === "personal" ? "Workspace Display Name *" : "Institute Display Name *"}
                  </Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={workspaceType === "personal" ? "Ms. Sharma's Physics Class" : "Apex Coaching Center"}
                    required
                    className="border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                {workspaceType === "institute" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="legal-name">Legal Name (optional)</Label>
                      <Input
                        id="legal-name"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        placeholder="Apex Education Systems Private Limited"
                        className="border-border/80"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-code">Organization Code *</Label>
                      <div className="relative">
                        <Input
                          id="org-code"
                          value={rawCode}
                          onChange={(e) => setRawCode(e.target.value.toUpperCase())}
                          placeholder="APEX-JEE"
                          required
                          className="border-border/80 pr-10 font-mono tracking-wider focus-visible:ring-primary focus-visible:border-primary"
                        />
                        {checking && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {/* OrgCodeChecker Indicator */}
                      {rawCode.trim() && !checking && availability && (
                        <div className={`text-xs flex items-center gap-1.5 font-medium mt-1 ${
                          availability.available ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            availability.available ? "bg-emerald-500" : "bg-destructive"
                          }`} />
                          {availability.available ? "Code available!" : availability.reason}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Target Courses</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {["JEE", "NEET", "Foundation"].map(course => (
                          <label key={course} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                            <Checkbox 
                              checked={selectedCourses.includes(course)}
                              onCheckedChange={(checked) => handleCourseChange(course, !!checked)}
                            />
                            <span className="text-sm font-medium">{course}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Subjects you Teach</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {["Physics", "Chemistry", "Mathematics", "Biology"].map(subject => (
                      <label key={subject} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox 
                          checked={selectedSubjects.includes(subject)}
                          onCheckedChange={(checked) => handleSubjectChange(subject, !!checked)}
                        />
                        <span className="text-sm font-medium">{subject}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value);
                        setCity(""); // Clear city on state change
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                    >
                      <option value="">Select State</option>
                      {Object.keys(STATE_CITIES).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setShowCitySuggestions(true);
                      }}
                      onFocus={() => setShowCitySuggestions(true)}
                      onBlur={() => {
                        // Delay hide to allow click handler to trigger
                        setTimeout(() => setShowCitySuggestions(false), 200);
                      }}
                      placeholder="Enter city"
                      className="border-border/80 focus-visible:ring-primary focus-visible:border-primary w-full"
                      autoComplete="off"
                    />
                    {showCitySuggestions && state && (
                      <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md custom-scrollbar">
                        {getFilteredCities().length > 0 ? (
                          getFilteredCities().map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setCity(c);
                                setShowCitySuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                            >
                              {c}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Press tab/enter to use custom city &quot;{city}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <Label>Estimated Learner Capacity</Label>
                    <span className="text-primary font-bold">{capacity === 500 ? "500+ Students" : `${capacity} Students`}</span>
                  </div>
                  <Slider 
                    min={10} 
                    max={500} 
                    step={10} 
                    value={[capacity]} 
                    onValueChange={(val) => setCapacity(val[0])}
                    className="py-1"
                  />
                  <p className="text-xs text-muted-foreground">Adjusts limits on classroom presence slots and batched evaluations.</p>
                </div>

                <div className="flex justify-between pt-4 border-t border-border/60">
                  <Button variant="outline" onClick={prevStep} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button 
                    onClick={nextStep} 
                    disabled={!displayName.trim() || (workspaceType === "institute" && (!rawCode.trim() || (availability !== null && !availability.available)))}
                    className="gap-2 bg-primary hover:bg-primary/95 text-black font-semibold"
                  >
                    Next Step <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="border border-border/80 shadow-md">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Profile Attribution & Confirm</CardTitle>
                <CardDescription>Review and complete your teacher profile setup.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 flex flex-col items-center">
                
                {/* AttributionUploader */}
                <div className="space-y-2 flex flex-col items-center w-full">
                  <Label className="text-center mb-1">Academy / Display Logo</Label>
                  <div className="relative group">
                    <label htmlFor="onboarding-logo-upload" className="cursor-pointer block relative">
                      <div className="w-28 h-28 rounded-full border-2 border-dashed border-primary/50 bg-muted/30 overflow-hidden flex items-center justify-center transition-all duration-300 group-hover:border-primary">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={logoPreview} 
                          alt="Academy Logo Preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                        <Upload className="w-5 h-5 text-white" />
                      </div>
                    </label>
                    <input
                      type="file"
                      id="onboarding-logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setLogoPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center max-w-xs mt-1">
                    Click the preview above to upload a custom logo, or continue with the default workspace branding file (`origin-new.jpg`).
                  </p>
                </div>

                <div className="w-full border-t border-border/60 pt-4 space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">Setup Summary</h4>
                  <div className="bg-muted/40 p-4 rounded-xl space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-semibold uppercase text-xs tracking-wider">{workspaceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{displayName}</span>
                    </div>
                    {workspaceType === "institute" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Org Code:</span>
                        <span className="font-mono text-primary font-bold">{rawCode}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subjects:</span>
                      <span className="font-medium text-xs">
                        {selectedSubjects.join(", ") || "None"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="font-medium">{capacity} Students</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between w-full pt-4 border-t border-border/60">
                  <Button variant="outline" onClick={prevStep} disabled={pending} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button 
                    onClick={() => startTransition(() => submit())} 
                    disabled={pending}
                    className="gap-2 bg-primary hover:bg-primary/95 text-black font-bold shadow-lg shadow-primary/10"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Complete Setup
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
