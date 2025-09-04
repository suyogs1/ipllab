import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Target, Play, Award, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react';
import { loadLessons, loadChallenges, runChallenge, getCompletionStatus, saveCompletion, showConfetti, validateChallenge, type Challenge } from '../grader/asmGrader';
import { GlassCard } from '../components/ui/GlassCard';
import { GlowTabs } from '../components/ui/GlowTabs';
import { NeonButton } from '../components/ui/NeonButton';
import { TagPill } from '../components/ui/TagPill';
import { PanelHeader } from '../components/ui/PanelHeader';
import { ScrollArea } from '../components/ScrollArea';
import { useDebuggerBus } from '../state/debuggerBus.tsx';

interface LearnProps {
  onOpenInDebugger: (code: string) => void;
}

interface Lesson {
  id: string;
  title: string;
  goals: string[];
  theory: string;
  snippets: Array<{
    label: string;
    source: string;
    watches: string[];
  }>;
  quiz: Array<{
    q: string;
    options: string[];
    answer: number;
  }>;
}

const Learn: React.FC<LearnProps> = ({ onOpenInDebugger }) => {
  const { setPendingLoad } = useDebuggerBus();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [challenges, setChallenges] = useState<Record<string, Challenge[]>>({});
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState<'lessons' | 'challenges'>('lessons');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    loadContent();
    setCompletions(getCompletionStatus());
  }, []);

  const loadContent = async () => {
    const [lessonsData, challengesData] = await Promise.all([
      loadLessons(),
      loadChallenges()
    ]);
    setLessons(lessonsData);
    setChallenges(challengesData);
  };

  const handleTryChallenge = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setChallengeCode(challenge.starter);
    setGradeResult(null);
    
    // Load in debugger with challenge-specific setup
    setPendingLoad({
      source: challenge.starter,
      watches: challenge.watches || [],
      breakpoints: challenge.breakpoints || [0], // Set breakpoint at first line
      asserts: challenge.asserts || [],
      cursorLine: 0
    });
    
    onOpenInDebugger(challenge.starter);
  };

  const handleGradeChallenge = async () => {
    if (!selectedChallenge) return;
    
    setGrading(true);
    setGradeResult(null);
    
    try {
      const result = await runChallenge(challengeCode, selectedChallenge);
      setGradeResult(result);
      
      if (result.passed) {
        saveCompletion(selectedChallenge.id);
        setCompletions(prev => ({ ...prev, [selectedChallenge.id]: true }));
        showConfetti();
      }
    } catch (err) {
      setGradeResult({
        passed: false,
        results: [],
        error: err instanceof Error ? err.message : 'Grading failed'
      });
    } finally {
      setGrading(false);
    }
  };

  const handleQuizAnswer = (lessonId: string, questionIndex: number, answer: number) => {
    const key = `${lessonId}_${questionIndex}`;
    setQuizAnswers(prev => ({ ...prev, [key]: answer }));
  };

  const checkQuizComplete = (lesson: Lesson) => {
    return lesson.quiz.every((_, index) => {
      const key = `${lesson.id}_${index}`;
      const userAnswer = quizAnswers[key];
      return userAnswer !== undefined && userAnswer === lesson.quiz[index].answer;
    });
  };

  const tabs = [
    {
      id: 'lessons' as const,
      label: `Lessons (${lessons.length})`,
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'challenges' as const,
      label: `Challenges (${Object.values(challenges).flat().length})`,
      icon: <Target className="w-4 h-4" />,
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-edge/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent mb-2">
              Learn Assembly
            </h1>
            <p className="text-slate-400">Master assembly programming with interactive lessons and challenges</p>
          </div>
          
          <GlowTabs
            tabs={tabs}
            activeTab={selectedTab}
            onTabChange={setSelectedTab}
          />
        </motion.div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {selectedTab === 'lessons' && (
          <div className="h-full flex min-h-0">
            {/* Lesson List */}
            <div className="w-80 border-r border-edge/50 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-4" data-testid="lesson-list">
                <h3 className="font-semibold text-slate-200 mb-3 flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-accent" />
                  Interactive Lessons
                </h3>
                <div className="space-y-2">
                  {lessons.map((lesson, index) => (
                    <motion.button
                      key={lesson.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setSelectedLesson(lesson)}
                      data-testid="lesson-card"
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                        selectedLesson?.id === lesson.id
                          ? 'bg-accent/20 border-accent/50 text-accent shadow-neon-sm'
                          : 'bg-panel/50 border-edge/50 text-slate-300 hover:bg-panel hover:border-accent/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">L{index + 1}: {lesson.title}</div>
                          <div className="text-sm opacity-70">{lesson.goals.length} goals</div>
                        </div>
                        {checkQuizComplete(lesson) && (
                          <CheckCircle className="w-5 h-5 text-ok" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Lesson Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
              {selectedLesson ? (
                <div className="p-6 max-w-4xl space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <h2 className="text-2xl font-bold text-slate-200 mb-2">{selectedLesson.title}</h2>
                    {checkQuizComplete(selectedLesson) && (
                      <TagPill variant="success" className="mb-4">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </TagPill>
                    )}
                  </motion.div>
                  
                  {/* Goals */}
                  <GlassCard>
                    <PanelHeader
                      title="Learning Goals"
                      icon={<Target className="w-4 h-4" />}
                    />
                    <div className="p-4">
                      <ul className="space-y-2">
                        {selectedLesson.goals.map((goal, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start space-x-2 text-slate-300"
                          >
                            <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                            <span>{goal}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </GlassCard>

                  {/* Theory */}
                  <GlassCard>
                    <PanelHeader
                      title="Theory"
                      icon={<BookOpen className="w-4 h-4" />}
                    />
                    <div className="p-4">
                      <p className="text-slate-300 leading-relaxed">{selectedLesson.theory}</p>
                    </div>
                  </GlassCard>

                  {/* Code Snippets */}
                  <GlassCard>
                    <PanelHeader
                      title="Interactive Examples"
                      subtitle={`${selectedLesson.snippets.length} examples`}
                      icon={<Play className="w-4 h-4" />}
                    />
                    <div className="p-4 space-y-4">
                      {selectedLesson.snippets.map((snippet, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          data-testid="lesson-snippet"
                          className="bg-edge/30 rounded-xl border border-edge/50 overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-edge/50 flex items-center justify-between">
                            <h4 className="font-medium text-slate-200">{snippet.label}</h4>
                            <NeonButton
                              size="sm"
                              data-testid="snippet-debug-btn"
                              onClick={() => {
                                // Load in debugger with lesson-specific setup
                                setPendingLoad({
                                  source: snippet.source,
                                  watches: snippet.watches || [],
                                  breakpoints: [0], // Set breakpoint at first line
                                  cursorLine: 0
                                });
                                onOpenInDebugger(snippet.source);
                              }}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Debug
                            </NeonButton>
                          </div>
                          <div className="p-4">
                            <pre className="text-sm font-mono text-accent bg-bg/50 p-3 rounded-lg overflow-x-auto border border-edge/30">
                              {snippet.source}
                            </pre>
                            {snippet.watches.length > 0 && (
                              <div className="mt-3 flex items-center space-x-2">
                                <TagPill variant="accent" size="sm">Watch</TagPill>
                                <span className="text-sm text-slate-400">
                                  {snippet.watches.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Quiz */}
                  {selectedLesson.quiz.length > 0 && (
                    <GlassCard>
                      <PanelHeader
                        title="Knowledge Check"
                        subtitle={`${selectedLesson.quiz.length} questions`}
                        icon={<AlertCircle className="w-4 h-4" />}
                      />
                      <div className="p-4 space-y-6">
                        {selectedLesson.quiz.map((question, qIndex) => {
                          const key = `${selectedLesson.id}_${qIndex}`;
                          const userAnswer = quizAnswers[key];
                          const isCorrect = userAnswer === question.answer;
                          const hasAnswered = userAnswer !== undefined;
                          
                          return (
                            <motion.div
                              key={qIndex}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: qIndex * 0.1 }}
                              className="bg-edge/30 rounded-xl border border-edge/50 p-4"
                            >
                              <h4 className="font-medium text-slate-200 mb-4">
                                {qIndex + 1}. {question.q}
                              </h4>
                              <div className="space-y-2">
                                {question.options.map((option, oIndex) => (
                                  <button
                                    key={oIndex}
                                    onClick={() => handleQuizAnswer(selectedLesson.id, qIndex, oIndex)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                                      hasAnswered
                                        ? oIndex === question.answer
                                          ? 'bg-ok/20 border-ok/50 text-ok'
                                          : userAnswer === oIndex && !isCorrect
                                          ? 'bg-danger/20 border-danger/50 text-danger'
                                          : 'bg-slate-700/30 border-slate-600/50 text-slate-500'
                                        : userAnswer === oIndex
                                        ? 'bg-accent/20 border-accent/50 text-accent'
                                        : 'bg-panel/50 border-edge/50 text-slate-300 hover:bg-panel hover:border-accent/30'
                                    }`}
                                    disabled={hasAnswered}
                                  >
                                    <span className="font-mono text-sm mr-2">
                                      {String.fromCharCode(65 + oIndex)}.
                                    </span>
                                    {option}
                                  </button>
                                ))}
                              </div>
                              {hasAnswered && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`mt-3 flex items-center space-x-2 ${
                                    isCorrect ? 'text-ok' : 'text-danger'
                                  }`}
                                >
                                  {isCorrect ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {isCorrect ? 'Correct!' : 'Incorrect. Try again!'}
                                  </span>
                                </motion.div>
                              )}
                            </motion.div>
                          );
                        })}
                        
                        {checkQuizComplete(selectedLesson) && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 bg-ok/20 border border-ok/50 rounded-xl"
                          >
                            <div className="flex items-center text-ok">
                              <Award className="w-5 h-5 mr-2" />
                              <span className="font-medium">Lesson completed! Great job!</span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </GlassCard>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto">
                      <BookOpen className="w-8 h-8 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-slate-200 mb-2">Choose a Lesson</h3>
                      <p className="text-slate-400">Select a lesson from the sidebar to start learning</p>
                    </div>
                  </motion.div>
                </div>
              )}
              </ScrollArea>
            </div>
          </div>
        )}

        {selectedTab === 'challenges' && (
          <div className="h-full flex min-h-0">
            {/* Challenge List */}
            <div className="w-80 border-r border-edge/50 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-4" data-testid="challenge-list">
                {Object.entries(challenges).map(([tier, tierChallenges]) => (
                  <div key={tier} className="mb-6">
                    <h3 className="font-semibold text-slate-200 mb-3 capitalize flex items-center">
                      <Target className="w-4 h-4 mr-2 text-accent2" />
                      {tier} ({tierChallenges.length})
                    </h3>
                    <div className="space-y-2">
                      {tierChallenges.map((challenge, index) => (
                        <motion.button
                          key={challenge.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => setSelectedChallenge(challenge)}
                          data-testid="challenge-card"
                          className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                            selectedChallenge?.id === challenge.id
                              ? 'bg-accent2/20 border-accent2/50 text-accent2 shadow-neon-sm'
                              : 'bg-panel/50 border-edge/50 text-slate-300 hover:bg-panel hover:border-accent2/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{challenge.title}</div>
                              <div className="text-sm opacity-70">
                                {challenge.asserts.length} tests
                              </div>
                            </div>
                            {completions[challenge.id] && (
                              <Award className="w-5 h-5 text-warn" />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Challenge Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
              {selectedChallenge ? (
                <div className="p-6 max-w-4xl space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-slate-200 mb-2">{selectedChallenge.title}</h2>
                      {completions[selectedChallenge.id] && (
                        <TagPill variant="warning">
                          <Award className="w-3 h-3 mr-1" />
                          Completed
                        </TagPill>
                      )}
                    </div>
                  </motion.div>

                  <GlassCard>
                    <PanelHeader
                      title="Challenge"
                      icon={<Target className="w-4 h-4" />}
                    />
                    <div className="p-4">
                      <p className="text-slate-300 leading-relaxed">{selectedChallenge.prompt}</p>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <PanelHeader
                      title="Your Solution"
                      icon={<Play className="w-4 h-4" />}
                      actions={
                        <div className="flex space-x-2">
                          <NeonButton
                            size="sm"
                            variant="secondary"
                            data-testid="challenge-debug-btn"
                            onClick={() => handleTryChallenge(selectedChallenge)}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Debug
                          </NeonButton>
                          <NeonButton
                            size="sm"
                            onClick={handleGradeChallenge}
                            isLoading={grading}
                            disabled={grading}
                          >
                            {grading ? 'Grading...' : 'Grade Solution'}
                          </NeonButton>
                        </div>
                      }
                    />
                    <div className="p-4">
                      <textarea
                        value={challengeCode}
                        onChange={(e) => setChallengeCode(e.target.value)}
                        className="w-full h-64 p-3 font-mono text-sm bg-bg/50 border border-edge/50 rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                        placeholder="Write your solution here..."
                      />
                    </div>
                  </GlassCard>

                  {gradeResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <GlassCard className={gradeResult.passed ? 'border-ok/50' : 'border-danger/50'}>
                        <div className="p-4">
                          <div className="flex items-center mb-4">
                            {gradeResult.passed ? (
                              <CheckCircle className="w-6 h-6 text-ok mr-3" />
                            ) : (
                              <AlertCircle className="w-6 h-6 text-danger mr-3" />
                            )}
                            <span className={`font-medium text-lg ${
                              gradeResult.passed ? 'text-ok' : 'text-danger'
                            }`}>
                              {gradeResult.passed ? 'Challenge Passed!' : 'Challenge Failed'}
                            </span>
                          </div>
                          
                          {gradeResult.error && (
                            <div className="mb-4 p-3 bg-danger/20 border border-danger/50 rounded-lg">
                              <div className="text-danger text-sm">
                                <strong>Error:</strong> {gradeResult.error}
                              </div>
                            </div>
                          )}
                          
                          {gradeResult.results && gradeResult.results.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {gradeResult.results.map((result: any, index: number) => (
                                <div key={index} className="flex items-center space-x-2">
                                  {result.ok ? (
                                    <CheckCircle className="w-4 h-4 text-ok" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-danger" />
                                  )}
                                  <span className={`text-sm ${
                                    result.ok ? 'text-ok' : 'text-danger'
                                  }`}>
                                    {result.detail || `Test ${index + 1}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {gradeResult.steps && (
                            <TagPill variant="accent" size="sm">
                              Executed in {gradeResult.steps} steps
                            </TagPill>
                          )}
                        </div>
                      </GlassCard>
                    </motion.div>
                  )}

                  {selectedChallenge.hints.length > 0 && (
                    <GlassCard>
                      <PanelHeader
                        title="Hints"
                        subtitle={`${selectedChallenge.hints.length} hints available`}
                        icon={<Lightbulb className="w-4 h-4" />}
                      />
                      <div className="p-4">
                        <ul className="space-y-3">
                          {selectedChallenge.hints.map((hint, index) => (
                            <motion.li
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-start space-x-3 text-slate-300"
                            >
                              <div className="w-6 h-6 bg-warn/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-warn text-xs font-bold">{index + 1}</span>
                              </div>
                              <span>{hint}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </GlassCard>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-accent2/20 rounded-2xl flex items-center justify-center mx-auto">
                      <Target className="w-8 h-8 text-accent2" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-slate-200 mb-2">Choose a Challenge</h3>
                      <p className="text-slate-400">Select a challenge from the sidebar to start coding</p>
                    </div>
                  </motion.div>
                </div>
              )}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Learn;