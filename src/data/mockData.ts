import type { Test, TestResult, DoubtSession, StreakData, LeaderboardEntry, Question, Book, Note, Bookmark } from '@/types';

export const mockQuestions: Question[] = [
  {
    id: '1',
    text: 'A particle moves in a circular path of radius r with uniform speed v. The magnitude of its acceleration is:',
    options: ['v²/r', 'v/r', 'v/r²', 'zero'],
    correctOption: 0,
    explanation: 'In uniform circular motion, the acceleration is directed towards the center and has magnitude v²/r, called centripetal acceleration.',
    subject: 'physics',
    chapter: 'Circular Motion',
    concept: 'Centripetal Acceleration',
    difficulty: 'medium',
  },
  {
    id: '2',
    text: 'The work function of a metal is 4.2 eV. If light of wavelength 300 nm falls on it, the maximum kinetic energy of emitted photoelectrons is:',
    options: ['1.4 eV', '2.1 eV', '0 eV', '4.2 eV'],
    correctOption: 0,
    explanation: 'Using Einstein\'s photoelectric equation: KE_max = hc/λ - φ = (1240/300) - 4.2 = 4.13 - 4.2 ≈ 1.4 eV',
    subject: 'physics',
    chapter: 'Modern Physics',
    concept: 'Photoelectric Effect',
    difficulty: 'hard',
  },
  {
    id: '3',
    text: 'In the reaction 2Na + Cl₂ → 2NaCl, the oxidizing agent is:',
    options: ['Na', 'Cl₂', 'NaCl', 'Both Na and Cl₂'],
    correctOption: 1,
    explanation: 'Cl₂ accepts electrons (gets reduced), so it is the oxidizing agent. Na loses electrons (gets oxidized).',
    subject: 'chemistry',
    chapter: 'Redox Reactions',
    concept: 'Oxidizing and Reducing Agents',
    difficulty: 'easy',
  },
  {
    id: '4',
    text: 'The pH of a 0.001 M HCl solution is:',
    options: ['3', '2', '1', '4'],
    correctOption: 0,
    explanation: 'HCl is a strong acid, so [H⁺] = 0.001 M = 10⁻³ M. pH = -log[H⁺] = -log(10⁻³) = 3.',
    subject: 'chemistry',
    chapter: 'Equilibrium',
    concept: 'pH Calculation',
    difficulty: 'easy',
  },
  {
    id: '5',
    text: 'If α and β are roots of x² - 5x + 6 = 0, then the value of α² + β² is:',
    options: ['13', '25', '12', '11'],
    correctOption: 0,
    explanation: 'α + β = 5, αβ = 6. α² + β² = (α+β)² - 2αβ = 25 - 12 = 13.',
    subject: 'mathematics',
    chapter: 'Quadratic Equations',
    concept: 'Relations between Roots and Coefficients',
    difficulty: 'medium',
  },
  {
    id: '6',
    text: 'The value of ∫(0 to π/2) sin²x dx is:',
    options: ['π/4', 'π/2', '1', '0'],
    correctOption: 0,
    explanation: 'Using the identity sin²x = (1-cos2x)/2, the integral becomes [x/2 - sin(2x)/4] from 0 to π/2 = π/4.',
    subject: 'mathematics',
    chapter: 'Integration',
    concept: 'Trigonometric Integration',
    difficulty: 'medium',
  },
  {
    id: '7',
    text: 'A block of mass m is placed on a frictionless inclined plane making angle θ with horizontal. The acceleration of the block is:',
    options: ['g sin θ', 'g cos θ', 'g tan θ', 'g'],
    correctOption: 0,
    explanation: 'The component of gravity along the incline is mg sin θ. By F=ma, acceleration = g sin θ.',
    subject: 'physics',
    chapter: 'Laws of Motion',
    concept: 'Motion on Inclined Plane',
    difficulty: 'easy',
  },
  {
    id: '8',
    text: 'The hybridization of carbon in ethene (C₂H₄) is:',
    options: ['sp', 'sp²', 'sp³', 'dsp²'],
    correctOption: 1,
    explanation: 'In ethene, each carbon forms 3 sigma bonds (2 C-H and 1 C-C), requiring sp² hybridization.',
    subject: 'chemistry',
    chapter: 'Organic Chemistry',
    concept: 'Hybridization',
    difficulty: 'easy',
  },
  {
    id: '9',
    text: 'The sum of the series 1 + 2 + 3 + ... + n is:',
    options: ['n(n+1)/2', 'n(n-1)/2', 'n²', 'n(n+1)'],
    correctOption: 0,
    explanation: 'The sum of first n natural numbers is given by the formula n(n+1)/2.',
    subject: 'mathematics',
    chapter: 'Sequences and Series',
    concept: 'Arithmetic Series',
    difficulty: 'easy',
  },
  {
    id: '10',
    text: 'In a simple harmonic motion, the ratio of kinetic energy to potential energy at displacement x = A/2 is:',
    options: ['3:1', '1:3', '1:1', '2:1'],
    correctOption: 0,
    explanation: 'At x = A/2, PE = ½kx² = ½k(A/2)² = kA²/8. Total E = ½kA². KE = E - PE = 3kA²/8. Ratio KE:PE = 3:1.',
    subject: 'physics',
    chapter: 'Oscillations',
    concept: 'Energy in SHM',
    difficulty: 'hard',
  },
];

export const mockTests: Test[] = [
  {
    id: '1',
    title: 'Circular Motion Mastery',
    description: 'Test your understanding of circular motion concepts including centripetal force, banking of roads, and vertical circles.',
    subject: 'physics',
    chapter: 'Circular Motion',
    difficulty: 'medium',
    duration: 30,
    totalQuestions: 5,
    questions: mockQuestions.filter(q => q.chapter === 'Circular Motion' || q.subject === 'physics').slice(0, 5),
    isPremium: false,
    attempted: false,
  },
  {
    id: '2',
    title: 'JEE Main Physics Full Test',
    description: 'Complete physics test covering all major topics for JEE Main preparation.',
    subject: 'physics',
    difficulty: 'hard',
    duration: 60,
    totalQuestions: 10,
    questions: mockQuestions.filter(q => q.subject === 'physics'),
    isPremium: true,
    attempted: false,
  },
  {
    id: '3',
    title: 'Organic Chemistry Fundamentals',
    description: 'Basic concepts of organic chemistry including hybridization, nomenclature, and reaction mechanisms.',
    subject: 'chemistry',
    chapter: 'Organic Chemistry',
    difficulty: 'easy',
    duration: 20,
    totalQuestions: 5,
    questions: mockQuestions.filter(q => q.subject === 'chemistry').slice(0, 5),
    isPremium: false,
    attempted: true,
    score: 75,
  },
  {
    id: '4',
    title: 'Mathematics Mixed Practice',
    description: 'Mixed questions from algebra, calculus, and coordinate geometry.',
    subject: 'mathematics',
    difficulty: 'medium',
    duration: 45,
    totalQuestions: 8,
    questions: mockQuestions.filter(q => q.subject === 'mathematics'),
    isPremium: false,
    attempted: false,
  },
  {
    id: '5',
    title: 'JEE Advanced Complete Mock',
    description: 'Full-length mock test with questions from all three subjects at JEE Advanced level.',
    subject: 'mixed',
    difficulty: 'hard',
    duration: 180,
    totalQuestions: 15,
    questions: mockQuestions,
    isPremium: true,
    attempted: false,
  },
  {
    id: '6',
    title: 'Modern Physics Quick Test',
    description: 'Photoelectric effect, atomic structure, and nuclear physics concepts.',
    subject: 'physics',
    chapter: 'Modern Physics',
    difficulty: 'hard',
    duration: 25,
    totalQuestions: 4,
    questions: mockQuestions.filter(q => q.chapter === 'Modern Physics'),
    isPremium: true,
    attempted: false,
  },
];

export const mockTestResult: TestResult = {
  testId: '3',
  score: 75,
  correctAnswers: 3,
  wrongAnswers: 1,
  unattempted: 1,
  timeTaken: 900,
  answers: [
    { questionId: '3', selectedOption: 1, timeSpent: 120, isMarkedForReview: false },
    { questionId: '4', selectedOption: 0, timeSpent: 90, isMarkedForReview: false },
    { questionId: '8', selectedOption: 1, timeSpent: 150, isMarkedForReview: true },
    { questionId: '1', selectedOption: null, timeSpent: 0, isMarkedForReview: false },
  ],
  weakAreas: [
    { topic: 'Redox Reactions', accuracy: 45 },
    { topic: 'Equilibrium', accuracy: 52 }
  ],
  strongAreas: [
    { topic: 'Organic Chemistry', accuracy: 88 }
  ],
  aiAnalysis: {
    summary: 'Good attempt! You show strong understanding of organic chemistry concepts. However, you need to work on redox reactions and equilibrium calculations. Your time management was decent but could be improved.',
    mistakes: [
      {
        questionId: '1',
        concept: 'Centripetal Acceleration',
        error: 'Skipped the question',
        explanation: 'In uniform circular motion, acceleration is always directed towards the center with magnitude v²/r.',
        howToApproach: 'Remember: Any object moving in a circle at constant speed has centripetal acceleration = v²/r directed towards the center.',
      },
    ],
    recommendations: [
      'Practice more problems on redox reactions',
      'Review pH calculation concepts',
      'Work on time management for unattempted questions',
    ],
    dppGenerated: true,
  },
};

export const mockDoubtSessions: DoubtSession[] = [
  {
    id: '1',
    title: 'Circular Motion Doubts',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'I don\'t understand why centripetal acceleration is v²/r. Can you explain?',
        timestamp: new Date('2024-01-15T10:00:00'),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Great question! Let me break it down for you.\n\nWhen an object moves in a circle, its velocity is constantly changing direction (even if speed is constant). This change in velocity means there\'s acceleration.\n\n**Derivation:**\n1. Consider velocity vectors at two close points on the circle\n2. The change in velocity Δv points towards the center\n3. Using similar triangles: Δv/v = Δs/r\n4. So Δv = v(Δs/r)\n5. Acceleration = Δv/Δt = v(Δs/Δt)/r = v²/r\n\n**Key insight:** The faster you go (v) or the tighter the turn (smaller r), the more acceleration you need!\n\nThink of it like this: when you turn a corner in a car, you feel pushed outward - that\'s because the car is accelerating inward (towards the center of the turn) to change your direction.',
        timestamp: new Date('2024-01-15T10:01:00'),
      },
    ],
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:01:00'),
  },
];

export const mockStreakData: StreakData = {
  currentStreak: 5,
  longestStreak: 12,
  lastStudyDate: new Date(),
  weeklyData: [true, true, true, true, true, false, false],
};

export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, userId: '2', name: 'Aarav Sharma', score: 9850, studyTime: 420, location: 'Mumbai', isLive: true },
  { rank: 2, userId: '3', name: 'Priya Patel', score: 9720, studyTime: 380, location: 'Delhi', isLive: false },
  { rank: 3, userId: '4', name: 'Rahul Kumar', score: 9680, studyTime: 410, location: 'Bangalore', isLive: true },
  { rank: 4, userId: '5', name: 'Sneha Gupta', score: 9540, studyTime: 350, location: 'Mumbai', isLive: false },
  { rank: 5, userId: '6', name: 'Vikram Rao', score: 9420, studyTime: 390, location: 'Hyderabad', isLive: true },
  { rank: 6, userId: '7', name: 'Neha Singh', score: 9380, studyTime: 360, location: 'Pune', isLive: false },
  { rank: 7, userId: '8', name: 'Arjun Mehta', score: 9250, studyTime: 340, location: 'Mumbai', isLive: false },
  { rank: 8, userId: '9', name: 'Kavya Iyer', score: 9180, studyTime: 370, location: 'Chennai', isLive: true },
  { rank: 9, userId: '10', name: 'Rohan Desai', score: 9050, studyTime: 320, location: 'Delhi', isLive: false },
  { rank: 10, userId: '11', name: 'Ananya Reddy', score: 8920, studyTime: 310, location: 'Bangalore', isLive: false },
];

export const dppQuestions: Question[] = [
  {
    id: 'dpp1',
    text: 'In the reaction: MnO₄⁻ + Fe²⁺ + H⁺ → Mn²⁺ + Fe³⁺ + H₂O, how many moles of Fe²⁺ are oxidized by 1 mole of MnO₄⁻?',
    options: ['1', '2', '3', '5'],
    correctOption: 3,
    explanation: 'MnO₄⁻ → Mn²⁺ involves gain of 5 electrons. Fe²⁺ → Fe³⁺ involves loss of 1 electron. So 1 mole MnO₄⁻ oxidizes 5 moles Fe²⁺.',
    subject: 'chemistry',
    chapter: 'Redox Reactions',
    concept: 'Redox Stoichiometry',
    difficulty: 'medium',
  },
  {
    id: 'dpp2',
    text: 'The pH of a 10⁻⁸ M HCl solution is approximately:',
    options: ['8', '7', '6.98', '6'],
    correctOption: 2,
    explanation: 'At such low concentrations, water autoionization contributes significantly. [H⁺] = 10⁻⁸ + 10⁻⁷ = 1.1 × 10⁻⁷. pH = -log(1.1 × 10⁻⁷) ≈ 6.98.',
    subject: 'chemistry',
    chapter: 'Equilibrium',
    concept: 'pH of Very Dilute Acids',
    difficulty: 'hard',
  },
  {
    id: 'dpp3',
    text: 'Which of the following is the strongest oxidizing agent?',
    options: ['F₂', 'Cl₂', 'Br₂', 'I₂'],
    correctOption: 0,
    explanation: 'F₂ has the highest standard reduction potential (+2.87 V), making it the strongest oxidizing agent among halogens.',
    subject: 'chemistry',
    chapter: 'Redox Reactions',
    concept: 'Standard Reduction Potential',
    difficulty: 'easy',
  },
];

export const mockBooks: Book[] = [
  {
    id: 'ncert-phy-11-1',
    title: 'Physics Part I - Class 11',
    bookClass: '11',
    subject: 'Physics',
    coverImage: 'https://images.unsplash.com/photo-1636466497769-f81855aebf13?auto=format&fit=crop&q=80&w=400',
    isLiked: true,
    chapters: [
      { id: 'ch1', title: 'Physical World', pages: 15 },
      { id: 'ch2', title: 'Units and Measurements', pages: 22 },
      { id: 'ch3', title: 'Motion in a Straight Line', pages: 18 },
      { id: 'ch4', title: 'Motion in a Plane', pages: 25 },
    ]
  },
  {
    id: 'ncert-chem-11-1',
    title: 'Chemistry Part I - Class 11',
    bookClass: '11',
    subject: 'Chemistry',
    coverImage: 'https://images.unsplash.com/photo-1603126857599-f6e15782fd5d?auto=format&fit=crop&q=80&w=400',
    isLiked: false,
    chapters: [
      { id: 'ch1', title: 'Some Basic Concepts of Chemistry', pages: 20 },
      { id: 'ch2', title: 'Structure of Atom', pages: 28 },
      { id: 'ch3', title: 'Classification of Elements', pages: 16 },
    ]
  },
  {
    id: 'ncert-math-12-1',
    title: 'Mathematics Part I - Class 12',
    bookClass: '12',
    subject: 'Mathematics',
    coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400',
    isLiked: false,
    chapters: [
      { id: 'ch1', title: 'Relations and Functions', pages: 25 },
      { id: 'ch2', title: 'Inverse Trigonometric Functions', pages: 18 },
      { id: 'ch3', title: 'Matrices', pages: 30 },
    ]
  },
  {
    id: 'ncert-bio-11',
    title: 'Biology - Class 11',
    bookClass: '11',
    subject: 'Biology',
    coverImage: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&q=80&w=400',
    isLiked: true,
    chapters: [
      { id: 'ch1', title: 'The Living World', pages: 12 },
      { id: 'ch2', title: 'Biological Classification', pages: 20 },
    ]
  }
];

export const mockLibraryUserSet: string[] = ['ncert-phy-11-1', 'ncert-math-12-1']; // Book IDs the user has added to their library

export const mockNotes: Note[] = [
  {
    id: 'note-1',
    bookId: 'ncert-phy-11-1',
    chapterId: 'ch2',
    pageNumber: 5,
    content: 'Important formula for dimensional analysis: [M^a L^b T^c]',
    color: '#FEF3C7', // yellow-100
    createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000 * 2),
    tags: ['formulas', 'dimensions']
  },
  {
    id: 'note-2',
    bookId: 'ncert-phy-11-1',
    chapterId: 'ch3',
    pageNumber: 12,
    content: 'Difference between average speed and average velocity - speed is strictly scalar.',
    color: '#D1FAE5', // green-100
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    tags: ['kinematics', 'concepts']
  }
];

export const mockBookmarks: Bookmark[] = [
  {
    id: 'bm-1',
    bookId: 'ncert-phy-11-1',
    pageNumber: 22,
    title: 'Significant Figures Rules',
    createdAt: new Date()
  },
  {
    id: 'bm-2',
    bookId: 'ncert-math-12-1',
    pageNumber: 15,
    title: 'Properties of Inverse Functions',
    createdAt: new Date(Date.now() - 86400000)
  }
];
