'use client';

import { createFeedback } from '@/lib/actions/generate.action';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import Loading from './Loading';
import { VideoInterviewPanel } from './VideoInterviewPanel';

interface SavedMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

const GetInterview = ({ userName, userId, type, interviewId, questions }: GetInterviewProps) => {
  const router = useRouter();
  
  // Navigation & State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(true);

  // References for speech
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript || interimTranscript) {
            setAnswers((prev) => ({
              ...prev,
              [currentQuestionIndex]: (prev[currentQuestionIndex] || '') + finalTranscript + interimTranscript
            }));
          }
        };

        rec.onerror = (err: any) => {
          console.error("Speech recognition error:", err);
          if (err.error !== 'no-speech') {
            setIsRecording(false);
          }
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, [currentQuestionIndex]);

  // Voice synthesis: Chloe reads the question out loud
  const speakQuestion = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel(); // cancel any active synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Load voices and select preferred female English voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes("Google US English") || 
        v.name.includes("Natural") || 
        v.lang.startsWith("en")
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speak question whenever index changes
  useEffect(() => {
    if (questions && questions.length > 0) {
      const activeQuestion = questions[currentQuestionIndex];
      // Slight timeout to wait for user transition to feel natural
      const t = setTimeout(() => {
        speakQuestion(activeQuestion);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [currentQuestionIndex, questions]);

  // Stop voice and synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const handleNext = () => {
    if (isRecording) {
      recognitionRef.current.stop();
    }
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (isRecording) {
      recognitionRef.current.stop();
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (isRecording) {
      recognitionRef.current.stop();
    }

    setIsRedirecting(true);
    setErrorMessage(null);

    // Format the transcript as array of alternating questions and answers
    const transcript: SavedMessage[] = [];
    
    questions?.forEach((q, index) => {
      transcript.push({
        role: 'assistant',
        content: q
      });
      transcript.push({
        role: 'user',
        content: answers[index]?.trim() || "(No response provided by candidate.)"
      });
    });

    try {
      const result = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: transcript
      });

      if (result.success && result.feedbackId) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        throw new Error("Failed to save feedback evaluation.");
      }
    } catch (err: any) {
      console.error("Evaluation submission error:", err);
      setErrorMessage(err?.message || "Error submitting interview results.");
      setIsRedirecting(false);
    }
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loading />
        <p className="text-gray-400 mt-4">Loading interview session details...</p>
      </div>
    );
  }

  const activeQuestion = questions[currentQuestionIndex];
  const activeAnswer = answers[currentQuestionIndex] || '';
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative">
      {isRedirecting && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <div className="w-16 h-16 relative mb-6">
            <span className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-pulse" />
            <span className="absolute inset-2 rounded-full border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Grading in Progress</h3>
          <p className="text-sm text-gray-400 max-w-sm text-center">
            Chloe is compiling your evaluation scores, strength details, and tailored improvement metrics. Hold tight!
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-sm">
          ❌ {errorMessage}
        </div>
      )}

      {/* Video Panel Toggle Control Header */}
      <div className="flex justify-between items-center mb-6 bg-dark-300 border border-dark-100/50 p-4 rounded-xl glassmorphism">
        <div className="flex items-center gap-3">
          <span className="text-xl">📹</span>
          <div>
            <h4 className="text-sm font-bold text-white">Interactive Video Assessment</h4>
            <p className="text-[11px] text-gray-500 font-mono">Stream simulated peer feeds & track candidate posture</p>
          </div>
        </div>
        <button
          onClick={() => setShowVideo(!showVideo)}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-200 cursor-pointer",
            showVideo
              ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40"
              : "bg-dark-200 text-gray-400 border-dark-100 hover:text-white hover:bg-dark-100"
          )}
        >
          {showVideo ? "Hide Video Feed" : "Show Video Feed"}
        </button>
      </div>

      {/* Conditionally render WebRTC Video Grid */}
      {showVideo && <VideoInterviewPanel roomId={interviewId || "default-session"} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Virtual Interviewer Profile */}
        <div className="lg:col-span-4 bg-dark-200 border border-dark-100 rounded-xl p-6 shadow-lg glassmorphism text-center flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            <span className={cn(
              "absolute inset-0 rounded-full border-4 border-emerald-500/30 transition-all duration-300",
              isSpeaking && "animate-ping border-emerald-500",
              isRecording && "border-red-500/50 scale-105"
            )} />
            <Image 
              src="/Chloe RT600.webp" 
              alt="Interviewer avatar" 
              width={128} 
              height={128} 
              className="object-cover rounded-full border border-dark-100 z-10 w-full h-full relative"
            />
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 p-2 rounded-full border-2 border-dark-200 text-xs animate-bounce z-20">
                🔊
              </span>
            )}
            {isRecording && (
              <span className="absolute -bottom-1 -left-1 bg-red-500 p-2 rounded-full border-2 border-dark-200 text-xs animate-pulse z-20">
                🎙️
              </span>
            )}
          </div>

          <h3 className="text-xl font-bold text-white">Chloe</h3>
          <p className="text-xs text-emerald-400 font-mono mb-4">AI Recruiter & Virtual Interviewer</p>
          
          <div className="w-full bg-dark-300/50 rounded-lg p-4 border border-dark-100/50 text-left">
            <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Status</p>
            <p className="text-sm font-mono text-gray-300">
              {isSpeaking ? (
                <span className="text-emerald-400">● Chloe is reading the question</span>
              ) : isRecording ? (
                <span className="text-red-400 animate-pulse">● Chloe is listening to your answer</span>
              ) : (
                <span className="text-gray-400">● Chloe is waiting for your response</span>
              )}
            </p>
          </div>

          <button 
            onClick={() => speakQuestion(activeQuestion)} 
            className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 py-1 px-3 bg-dark-300 border border-dark-100 rounded-full hover:bg-dark-400"
          >
            🔊 Repeat Question
          </button>
        </div>

        {/* Right Column: Q&A Interactive workspace */}
        <div className="lg:col-span-8 bg-dark-200 border border-dark-100 rounded-xl p-8 shadow-lg glassmorphism flex flex-col min-h-[460px]">
          
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex justify-between items-center text-sm font-semibold text-gray-400 mb-2">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span className="text-emerald-400 font-mono">{Math.round(progressPercent)}% Completed</span>
            </div>
            <div className="w-full bg-dark-400 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Text */}
          <div className="mb-6 flex-grow">
            <div className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-2 font-mono">Question</div>
            <h4 className="text-xl font-bold text-white leading-relaxed">
              {activeQuestion}
            </h4>
          </div>

          {/* Answer Input and Controller */}
          <div className="mb-6 relative">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="answer" className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">
                Your Answer
              </label>
              
              {/* Micro dictation mic button */}
              <button
                onClick={toggleRecording}
                className={cn(
                  "flex items-center gap-2 py-1 px-3 rounded-full text-xs font-bold transition-all border",
                  isRecording 
                    ? "bg-red-950/80 border-red-500 text-red-200 animate-pulse" 
                    : "bg-dark-300 border-dark-100 text-gray-400 hover:text-white hover:bg-dark-400"
                )}
                title={isRecording ? "Stop voice dictation" : "Dictate your answer using microphone"}
              >
                <span className={cn("size-2 rounded-full", isRecording ? "bg-red-500" : "bg-gray-500")} />
                {isRecording ? "Recording Answer..." : "Speak Answer (Voice)"}
              </button>
            </div>

            {/* Styled input container */}
            <div className="relative">
              <textarea
                id="answer"
                value={activeAnswer}
                onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestionIndex]: e.target.value }))}
                rows={8}
                className="w-full bg-dark-300 border border-dark-100 rounded-lg px-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-y leading-relaxed"
                placeholder={isRecording ? "Dictating voice in real-time... Speak into your microphone." : "Write your response here. Or click 'Speak Answer' to dictate."}
              />
              
              {/* Crimson Glow pulse sound wave indicator inside text area */}
              {isRecording && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-red-950/90 border border-red-500/50 py-1.5 px-3 rounded-full">
                  <div className="size-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="size-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  <div className="size-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                  <span className="text-[10px] font-bold text-red-300 font-mono uppercase ml-1">Live Mic</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation and Submission Buttons */}
          <div className="flex justify-between items-center border-t border-dark-100 pt-6">
            <button
              onClick={handleBack}
              disabled={currentQuestionIndex === 0}
              className="px-5 py-2.5 bg-dark-300 hover:bg-dark-400 text-gray-300 font-semibold rounded-lg border border-dark-100 disabled:opacity-40 disabled:pointer-events-none transition-colors text-sm"
            >
              ← Previous
            </button>

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-black font-extrabold rounded-lg shadow-lg hover:shadow-emerald-950/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm flex items-center gap-1"
              >
                🏁 Finish & Get Feedback
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold rounded-lg hover:shadow-emerald-950/10 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm flex items-center gap-1"
              >
                Next Question →
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default GetInterview;