import { ReactNode } from 'react';

export interface TutorialStep {
  targetId: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'none' | 'click' | 'focus';
}

export const PAGES_STEPS: Record<string, TutorialStep[]> = {
  dashboard: [
    {
      targetId: 'tutorial-welcome',
      title: 'Welcome to ORIGIN!',
      description: 'We\'ve engineered this platform to help you master your goals. Let us show you around.',
      placement: 'center'
    },
    {
      targetId: 'tutorial-nav-ogcode',
      title: 'Explore OGCode',
      description: 'Our proprietary problem-solving suite. Practice with thousands of high-yield questions.',
      placement: 'bottom'
    },
    {
        targetId: 'tutorial-nav-doubt-solver',
        title: 'AI Explainer',
        description: 'Stuck? Our AI Bot is integrated everywhere to explain concepts and solve doubts instantly.',
        placement: 'bottom'
    },
    {
        targetId: 'tutorial-nav-tests',
        title: 'Scientific Testing',
        description: 'Simulate real exam environments with national-level test series and real-time performance analytics.',
        placement: 'bottom'
    },
    {
        targetId: 'tutorial-nav-dpp',
        title: 'Daily Practice',
        description: 'Personalized Daily Practice Problems (DPP) tailored to your learning velocity.',
        placement: 'bottom'
    },
    {
      targetId: 'tutorial-events',
      title: 'Global Events',
      description: 'Stay updated with national competitions, workshops, and exclusive mentorship sessions.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-tracker',
      title: 'Live Focus Tracker',
      description: 'Monitor your study velocity in real-time. Use the Pomodoro timer to maintain maximum cognitive intensity.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-challenge',
      title: 'Daily AI Challenge',
      description: 'Every day, our AI generates a targeted challenge to push your boundaries.',
      placement: 'left'
    },
    {
      targetId: 'tutorial-points',
      title: 'Prestige & Rewards',
      description: 'Earn points for consistency and level up from Novice to Master.',
      placement: 'left'
    },
    {
      targetId: 'tutorial-todo',
      title: 'Strategic Goals',
      description: 'Break down your goals into daily tasks and conquer them one by one.',
      placement: 'top'
    },
    {
      targetId: 'tutorial-mentor-trigger',
      title: 'Your AI Mentor',
      description: 'Your constant academic companion. Click my face anytime for guidance.',
      placement: 'top'
    },
    {
      targetId: 'tutorial-mentor',
      title: 'Contextual Intelligence',
      description: 'I see exactly what you see. You can even highlight any text on the screen to ask me about it instantly!',
      placement: 'top'
    }
  ],
  'ogcode-workspace': [
    {
      targetId: 'tutorial-ogcode-content',
      title: 'Analyze & Conquer',
      description: 'Read the question carefully. We use scientific formatting to help you visualize complex concepts.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-ogcode-input',
      title: 'Interact',
      description: 'Select your options or enter your numerical answer here. Multiple modes are supported.',
      placement: 'left'
    },
    {
      targetId: 'tutorial-ogcode-submit',
      title: 'Commit Solution',
      description: 'Submit your answer to get instant feedback and points based on your accuracy and speed.',
      placement: 'top'
    },
    {
        targetId: 'tutorial-ogcode-stats',
        title: 'Performance Vitals',
        description: 'Keep an eye on the clock and your earned points. Speed and precision are both rewarded.',
        placement: 'bottom'
    }
  ],
  'ogcode-list': [
    {
      targetId: 'tutorial-ogcode-subject-filter',
      title: 'Subject Intelligence',
      description: 'Select your target subject to refine the arena. We support Physics, Chemistry, Mathematics, and Biology.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-ogcode-difficulty-filter',
      title: 'Intensity Control',
      description: 'Switch between Easy, Medium, Hard, or the elite "Insane" levels to match your preparation depth.',
      placement: 'bottom'
    }
  ],
  'doubt-solver': [
    {
      targetId: 'tutorial-doubt-solver-new',
      title: 'Initiate Discussion',
      description: 'Stuck on a concept or a complex problem? Click here to start a fresh academic dialogue with your personal AI Mentor.',
      placement: 'bottom'
    },
    {
      targetId: 'tutorial-mentor',
      title: 'AI Mastery',
      description: 'Our AI is trained on vast academic datasets to provide you with step-by-step solutions and conceptual deep-dives.',
      placement: 'left'
    }
  ],
  'test-list': [
    {
      targetId: 'tutorial-test-hub',
      title: 'Exam Simulation',
      description: 'Access nationwide test series. Each test is designed to push your conceptual clarity to the limit.',
      placement: 'bottom'
    }
  ],
  'dpp': [
    {
      targetId: 'tutorial-dpp-hub',
      title: 'Daily Practice Hub',
      description: 'Your personalized batch of challenges. Consistency here is the key to mastering your rank.',
      placement: 'bottom'
    }
  ],
  'tasks-goals': [
    {
      targetId: 'tutorial-goals-hub',
      title: 'Strategic Planning',
      description: 'Manage your academic roadmap. Set milestones and track your progress through each chapter.',
      placement: 'bottom'
    }
  ]
};

// Legacy support if needed, or fallback
export const TUTORIAL_STEPS = PAGES_STEPS.dashboard;

