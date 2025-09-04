// Simple test to verify the grader works
import { runChallenge, type Challenge } from './asmGrader';

// Test challenge
const testChallenge: Challenge = {
  id: 'test_simple',
  title: 'Simple Test',
  prompt: 'Load 42 into R0',
  starter: 'MOV R0, #42\nHALT',
  watches: ['R0'],
  asserts: [
    { type: 'register', reg: 'R0', equals: 42 }
  ],
  maxSteps: 100,
  hints: ['Use MOV instruction']
};

// Test the grader
export async function testGrader() {
  console.log('Testing grader...');
  
  const code = 'MOV R0, #42\nHALT';
  const result = await runChallenge(code, testChallenge);
  
  console.log('Test result:', result);
  
  if (result.passed) {
    console.log('✅ Grader test passed!');
  } else {
    console.log('❌ Grader test failed:', result.error);
  }
  
  return result.passed;
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testGrader().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}